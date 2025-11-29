import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from firebase_admin import auth, firestore
from api import db


# ============================================================
# Helpers
# ============================================================

def get_uid_from_request(request):
    """
    Extract Firebase ID token from Authorization header.
    Used only where the UID comes from token, not URL.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None, JsonResponse({"error": "Missing Authorization header"}, status=401)

    try:
        token = auth_header.split(" ")[1]
        decoded = auth.verify_id_token(token)
        return decoded["uid"], None
    except Exception:
        return None, JsonResponse({"error": "Invalid token"}, status=401)


def ensure_user_profile(uid):
    user_ref = db.collection("users").document(uid)
    doc = user_ref.get()
    if not doc.exists:
        user_ref.set({
            "uid": uid,
            "tags": [],
            "description": "",
            "city": "",
            "display_name": "",
            "created_at": firestore.SERVER_TIMESTAMP,
        })


def get_display_name_or_default(uid):
    try:
        fb_user = auth.get_user(uid)
        return fb_user.displayName   or "User"
    except Exception:
        return "User"


# ============================================================
# Activities – Sync
# ============================================================

@csrf_exempt
def sync_offline_activity(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    uid, error = get_uid_from_request(request)
    if error:
        return error

    ensure_user_profile(uid)

    try:
        data = json.loads(request.body)
        friend_uid = data.get("friend_uid")

        activity_ref = db.collection("activities").document()
        activity_ref.set({
            "participants": list(filter(None, [uid, friend_uid])),
            "tags": data.get("tags", []),
            "description": data.get("description", ""),
            "location": {
                "lat": data.get("lat"),
                "lng": data.get("lng")
            },
            "time_start": firestore.SERVER_TIMESTAMP,
            "time_end": data.get("time_end")
        })

        return JsonResponse({"status": "success", "activity_id": activity_ref.id})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ============================================================
# Feed
# ============================================================

def get_feed(request):
    uid, _ = get_uid_from_request(request)

    try:
        docs = (
            db.collection("activities")
            .order_by("time_start", direction=firestore.Query.DESCENDING)
            .limit(50)
            .stream()
        )

        feed = []

        for doc in docs:
            act = doc.to_dict()
            activity_id = doc.id

            ts_start = act.get("time_start")
            ts_end = act.get("time_end")

            # Likes
            likes_ref = db.collection("activities").document(activity_id).collection("likes")
            likes_count = len(list(likes_ref.stream()))

            user_liked = False
            if uid:
                user_liked = likes_ref.document(uid).get().exists

            # Comments
            comments_ref = db.collection("activities").document(activity_id).collection("comments")
            comments_count = len(list(comments_ref.stream()))

            last_comment = None
            last_docs = list(
                comments_ref.order_by("timestamp", direction=firestore.Query.DESCENDING)
                .limit(1)
                .stream()
            )
            if last_docs:
                c = last_docs[0].to_dict()
                ts_c = c.get("timestamp")
                last_comment = {
                    "user_id": c.get("user_id"),
                    "user_display_name": c.get("user_display_name"),
                    "text": c.get("text"),
                    "timestamp": ts_c.isoformat() if ts_c else None
                }

            feed.append({
                "id": activity_id,
                "tags": act.get("tags"),
                "description": act.get("description"),
                "location": act.get("location"),
                "participants": act.get("participants"),
                "time_start": ts_start.isoformat() if ts_start else None,
                "time_end": ts_end.isoformat() if ts_end else None,
                "likes_count": likes_count,
                "comments_count": comments_count,
                "user_liked": uid and user_liked,
                "last_comment": last_comment
            })

        return JsonResponse({"feed": feed})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ============================================================
# Likes
# ============================================================

@csrf_exempt
def like_activity(request, activity_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    uid, error = get_uid_from_request(request)
    if error:
        return error

    ensure_user_profile(uid)

    try:
        display_name = get_display_name_or_default(uid)
        db.collection("activities").document(activity_id).collection("likes").document(uid).set({
            "user_id": uid,
            "user_display_name": display_name,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
        return JsonResponse({"status": "liked"})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def unlike_activity(request, activity_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    uid, error = get_uid_from_request(request)
    if error:
        return error

    try:
        db.collection("activities").document(activity_id).collection("likes").document(uid).delete()
        return JsonResponse({"status": "unliked"})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ============================================================
# Comments
# ============================================================

@csrf_exempt
def comment_activity(request, activity_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    uid, error = get_uid_from_request(request)
    if error:
        return error

    ensure_user_profile(uid)

    try:
        data = json.loads(request.body)
        text = data.get("text", "").strip()

        if not text:
            return JsonResponse({"error": "Empty comment"}, status=400)

        display_name = get_display_name_or_default(uid)

        ref = db.collection("activities").document(activity_id).collection("comments").document()
        ref.set({
            "user_id": uid,
            "user_display_name": display_name,
            "text": text,
            "timestamp": firestore.SERVER_TIMESTAMP
        })

        return JsonResponse({"status": "comment_added", "comment_id": ref.id})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def list_comments(request, activity_id):
    try:
        docs = (
            db.collection("activities")
            .document(activity_id)
            .collection("comments")
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .stream()
        )

        comments = []
        for d in docs:
            c = d.to_dict()
            ts = c.get("timestamp")
            comments.append({
                "id": d.id,
                "user_id": c.get("user_id"),
                "user_display_name": c.get("user_display_name"),
                "text": c.get("text"),
                "timestamp": ts.isoformat() if ts else None
            })

        return JsonResponse({"comments": comments})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def delete_comment(request, activity_id, comment_id):
    if request.method != "DELETE":
        return JsonResponse({"error": "DELETE only"}, status=405)

    uid, error = get_uid_from_request(request)
    if error:
        return error

    try:
        ref = db.collection("activities").document(activity_id).collection("comments").document(comment_id)
        doc = ref.get()

        if not doc.exists:
            return JsonResponse({"error": "Comment not found"}, status=404)

        if doc.to_dict().get("user_id") != uid:
            return JsonResponse({"error": "Unauthorized"}, status=403)

        ref.delete()
        return JsonResponse({"status": "comment_deleted"})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ============================================================
# Tag Filtering
# ============================================================

def activities_by_tag(request):
    tag = request.GET.get("tag")
    if not tag:
        return JsonResponse({"error": "Missing ?tag="}, status=400)

    try:
        docs = (
            db.collection("activities")
            .where("tags", "array_contains", tag)
            .order_by("time_start", direction=firestore.Query.DESCENDING)
            .limit(50)
            .stream()
        )

        results = []
        for doc in docs:
            a = doc.to_dict()
            ts = a.get("time_start")

            results.append({
                "id": doc.id,
                "participants": a.get("participants"),
                "tags": a.get("tags"),
                "description": a.get("description"),
                "location": a.get("location"),
                "time_start": ts.isoformat() if ts else None,
                "time_end": a.get("time_end")
            })

        return JsonResponse({"activities": results})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def activities_by_tags_any(request):
    raw = request.GET.get("tags")
    if not raw:
        return JsonResponse({"error": "Missing ?tags="}, status=400)

    tags = [t.strip() for t in raw.split(",") if t.strip()]

    try:
        first = tags[0]
        docs = db.collection("activities").where("tags", "array_contains", first).stream()

        results = []
        for doc in docs:
            a = doc.to_dict()
            if any(t in a.get("tags", []) for t in tags):
                ts = a.get("time_start")
                results.append({
                    "id": doc.id,
                    "participants": a.get("participants"),
                    "tags": a.get("tags"),
                    "description": a.get("description"),
                    "location": a.get("location"),
                    "time_start": ts.isoformat() if ts else None,
                    "time_end": a.get("time_end")
                })

        results.sort(key=lambda x: x.get("time_start") or "", reverse=True)
        return JsonResponse({"activities": results})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def activities_by_tags_all(request):
    raw = request.GET.get("tags")
    if not raw:
        return JsonResponse({"error": "Missing ?tags="}, status=400)

    tags = [t.strip() for t in raw.split(",") if t.strip()]

    try:
        first = tags[0]
        docs = db.collection("activities").where("tags", "array_contains", first).stream()

        results = []
        for doc in docs:
            a = doc.to_dict()

            if all(t in a.get("tags", []) for t in tags):
                ts = a.get("time_start")
                results.append({
                    "id": doc.id,
                    "participants": a.get("participants"),
                    "tags": a.get("tags"),
                    "description": a.get("description"),
                    "location": a.get("location"),
                    "time_start": ts.isoformat() if ts else None,
                    "time_end": a.get("time_end")
                })

        results.sort(key=lambda x: x.get("time_start") or "", reverse=True)
        return JsonResponse({"activities": results})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

# ============================================================
# User Tags (UPDATED – UID from URL, no auth)
# ============================================================

@csrf_exempt
def user_add_tag(request, uid, tag):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        db.collection("users").document(uid).update({
            "tags": firestore.ArrayUnion([tag])
        })
        return JsonResponse({"status": "tag_added", "uid": uid, "tag": tag})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def user_add_tags(request, uid, tags):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()

    if not user_doc.exists:
        return JsonResponse({"error": "User not found"}, status=404)

    try:
        user_ref.update({
            "tags": firestore.ArrayUnion(tag_list)
        })
        return JsonResponse({"status": "tags_added", "uid": uid, "tags": tag_list})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def user_remove_tag(request, uid, tag):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        db.collection("users").document(uid).update({
            "tags": firestore.ArrayRemove([tag])
        })
        return JsonResponse({"status": "tag_removed", "uid": uid, "tag": tag})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
# ============================================================
# Test Firestore
# ============================================================

def test_firestore(request):
    try:
        ref = db.collection("test_check").document("ping")
        ref.set({"status": "working"})
        return JsonResponse({"firestore": "ok", "data": ref.get().to_dict()})
    except Exception as e:
        return JsonResponse({"firestore": "error", "error": str(e)}, status=500)
