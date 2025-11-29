import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from firebase_admin import auth, firestore
from api import db


# ============================================================
# Helpers
# ============================================================

def get_uid_from_request(request):
    """ Extract and verify Firebase ID token from Authorization header. """
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
    """Ensure minimal user profile exists."""
    user_ref = db.collection("users").document(uid)
    doc = user_ref.get()
    if not doc.exists:
        try:
            fb_user = auth.get_user(uid)
        except Exception:
            fb_user = None

        user_ref.set({
            "uid": uid,
            "tags": [],
            "description": "",
            "city": "",
            "created_at": firestore.SERVER_TIMESTAMP,
            "display_name": fb_user.display_name if fb_user else ""
        })


def get_display_name_or_default(uid):
    try:
        fb_user = auth.get_user(uid)
        return fb_user.display_name or "User"
    except Exception:
        return "User"


# ============================================================
# 1. Sync Offline Activity
# ============================================================

@csrf_exempt
def sync_offline_activity(request):
    """Create activity (mobile offline sync)."""
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

            # NEW: time_start = now
            "time_start": firestore.SERVER_TIMESTAMP,

            # NEW: time_end from request or None
            "time_end": data.get("time_end"),

            "location": {
                "lat": data.get("lat"),
                "lng": data.get("lng")
            },
            "description": data.get("description", "")
        })

        # Save recent activities
        try:
            db.collection("users").document(uid).update({
                "recent_activities": firestore.ArrayUnion([activity_ref.id])
            })
            if friend_uid:
                db.collection("users").document(friend_uid).update({
                    "recent_activities": firestore.ArrayUnion([activity_ref.id])
                })
        except Exception:
            pass

        return JsonResponse({"status": "success", "activity_id": activity_ref.id})

    except Exception as e:
        print("[ERROR sync_offline_activity]", e)
        return JsonResponse({"error": str(e)}, status=500)


# ============================================================
# 2. Feed
# ============================================================

def get_feed(request):
    """Return feed: latest activities."""
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
            try:
                likes_count = likes_ref.count().get().value
            except Exception:
                likes_count = len(list(likes_ref.stream()))

            user_liked = False
            if uid:
                try:
                    user_liked = likes_ref.document(uid).get().exists
                except Exception:
                    user_liked = any(l.id == uid for l in likes_ref.stream())

            # Comments
            comments_ref = db.collection("activities").document(activity_id).collection("comments")
            try:
                comments_count = comments_ref.count().get().value
            except Exception:
                comments_count = len(list(comments_ref.stream()))

            # Last comment
            last_comment = None
            try:
                last_docs = comments_ref.order_by(
                    "timestamp", direction=firestore.Query.DESCENDING
                ).limit(1).stream()
                last_docs = list(last_docs)
                if last_docs:
                    c = last_docs[0].to_dict()
                    c_ts = c.get("timestamp")
                    last_comment = {
                        "user_id": c.get("user_id"),
                        "user_display_name": c.get("user_display_name"),
                        "text": c.get("text"),
                        "timestamp": c_ts.isoformat() if c_ts else None
                    }
            except Exception:
                pass

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
                "user_liked": user_liked,
                "last_comment": last_comment
            })

        return JsonResponse({"feed": feed})

    except Exception as e:
        print("[ERROR get_feed]", e)
        return JsonResponse({"error": str(e)}, status=500)


# ============================================================
# 3. Likes
# ============================================================

@csrf_exempt
def like_activity(request, activity_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    uid, error = get_uid_from_request(request)
    if error:
        return error

    ensure_user_profile(uid)
    display_name = get_display_name_or_default(uid)

    try:
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
# 4. Comments
# ============================================================

@csrf_exempt
def comment_activity(request, activity_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    uid, error = get_uid_from_request(request)
    if error:
        return error

    ensure_user_profile(uid)
    display_name = get_display_name_or_default(uid)

    try:
        data = json.loads(request.body)
        text = data.get("text", "").strip()

        if not text:
            return JsonResponse({"error": "Empty comment"}, status=400)

        comment_ref = db.collection("activities").document(activity_id).collection("comments").document()
        comment_ref.set({
            "user_id": uid,
            "user_display_name": display_name,
            "text": text,
            "timestamp": firestore.SERVER_TIMESTAMP
        })

        return JsonResponse({"status": "comment_added", "comment_id": comment_ref.id})

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
# 5. Tag Filtering
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

        activities = []
        for doc in docs:
            a = doc.to_dict()
            ts = a.get("time_start")
            activities.append({
                "id": doc.id,
                "participants": a.get("participants", []),
                "tags": a.get("tags", []),
                "description": a.get("description", ""),
                "location": a.get("location"),
                "time_start": ts.isoformat() if ts else None,
                "time_end": a.get("time_end")
            })

        return JsonResponse({"activities": activities})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def user_add_tag(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    uid, error = get_uid_from_request(request)
    if error:
        return error

    try:
        data = json.loads(request.body)
        tag = data.get("tag")

        if not tag:
            return JsonResponse({"error": "Missing tag"}, status=400)

        db.collection("users").document(uid).update({
            "tags": firestore.ArrayUnion([tag])
        })

        return JsonResponse({"status": "tag_added", "tag": tag})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def user_add_tags(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    uid, error = get_uid_from_request(request)
    if error:
        return error

    try:
        data = json.loads(request.body)
        tags = data.get("tags")

        if not tags or not isinstance(tags, list):
            return JsonResponse({"error": "Missing or invalid 'tags' list"}, status=400)

        cleaned = [t for t in tags if isinstance(t, str) and t.strip()]

        if not cleaned:
            return JsonResponse({"error": "No valid tags"}, status=400)

        db.collection("users").document(uid).update({
            "tags": firestore.ArrayUnion(cleaned)
        })

        return JsonResponse({"status": "tags_added", "tags": cleaned})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def user_remove_tag(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    uid, error = get_uid_from_request(request)
    if error:
        return error

    try:
        data = json.loads(request.body)
        tag = data.get("tag")

        if not tag:
            return JsonResponse({"error": "Missing tag"}, status=400)

        db.collection("users").document(uid).update({
            "tags": firestore.ArrayRemove([tag])
        })

        return JsonResponse({"status": "tag_removed", "tag": tag})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def activities_by_tags_any(request):
    raw = request.GET.get("tags")
    if not raw:
        return JsonResponse({"error": "Missing ?tags="}, status=400)

    tags = [t.strip() for t in raw.split(",") if t.strip()]
    if not tags:
        return JsonResponse({"error": "No tags provided"}, status=400)

    try:
        first_tag = tags[0]
        docs = db.collection("activities").where("tags", "array_contains", first_tag).stream()

        results = []
        for doc in docs:
            a = doc.to_dict()
            if any(tag in a.get("tags", []) for tag in tags):
                ts = a.get("time_start")
                results.append({
                    "id": doc.id,
                    "participants": a.get("participants", []),
                    "tags": a.get("tags", []),
                    "description": a.get("description", ""),
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
    if not tags:
        return JsonResponse({"error": "No tags provided"}, status=400)

    try:
        first_tag = tags[0]
        docs = db.collection("activities").where("tags", "array_contains", first_tag).stream()

        results = []
        for doc in docs:
            a = doc.to_dict()
            if all(t in a.get("tags", []) for t in tags):
                ts = a.get("time_start")
                results.append({
                    "id": doc.id,
                    "participants": a.get("participants", []),
                    "tags": a.get("tags", []),
                    "description": a.get("description", ""),
                    "location": a.get("location"),
                    "time_start": ts.isoformat() if ts else None,
                    "time_end": a.get("time_end")
                })

        results.sort(key=lambda x: x.get("time_start") or "", reverse=True)
        return JsonResponse({"activities": results})

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
