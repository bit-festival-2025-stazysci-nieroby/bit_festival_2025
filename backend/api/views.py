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
    Extract and verify Firebase ID token from Authorization header.
    Returns (uid, error_response) - error_response is JsonResponse or None.
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
    """
    Ensure that a minimal user profile exists in /users/{uid}.
    Fields: uid, tags, description, city, created_at
    """
    user_ref = db.collection("users").document(uid)
    doc = user_ref.get()

    if not doc.exists:
        # Try to get firebase user to set some basic name if available.
        try:
            fb_user = auth.get_user(uid)
            # If display_name is available we could save it, but minimal profile per spec.
        except Exception:
            fb_user = None

        user_ref.set({
            "uid": uid,
            "tags": [],
            "description": "",
            "city": "",
            "created_at": firestore.SERVER_TIMESTAMP,
            # optionally store display_name: fb_user.display_name if fb_user else ""
        })


# Helper to safely fetch display name (if auth service available)
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
    """Create activity (mobile offline sync). Requires Authorization header with Firebase token."""
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
            "timestamp": firestore.SERVER_TIMESTAMP,
            "location": {"lat": data.get("lat"), "lng": data.get("lng")},
            "description": data.get("description", "")
        })

        # Optionally add to user's recent_activities (if you want)
        try:
            db.collection("users").document(uid).update({
                "recent_activities": firestore.ArrayUnion([activity_ref.id])
            })
            if friend_uid:
                db.collection("users").document(friend_uid).update({
                    "recent_activities": firestore.ArrayUnion([activity_ref.id])
                })
        except Exception:
            # If update fails (e.g. no user doc) we ignore — ensure_user_profile created doc earlier
            pass

        return JsonResponse({"status": "success", "activity_id": activity_ref.id})

    except Exception as e:
        print("[ERROR sync_offline_activity]", e)
        return JsonResponse({"error": str(e)}, status=500)


# ============================================================
# 2. Feed
# ============================================================

def get_feed(request):
    """Return feed: latest activities with likes_count, comments_count, user_liked, last_comment."""
    uid, _ = get_uid_from_request(request)  # uid optional for guest requests

    try:
        docs = (
            db.collection("activities")
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .limit(50)
            .stream()
        )

        feed = []

        for doc in docs:
            act = doc.to_dict()
            activity_id = doc.id

            ts = act.get("timestamp")
            ts_iso = ts.isoformat() if ts else None

            # --- likes_count (fast check if user liked) ---
            # For user_liked: check if document exists (fast)
            try:
                likes_ref = db.collection("activities").document(activity_id).collection("likes")
                # Try to use count() for total count (may require new SDK); fallback to streaming
                try:
                    likes_count = likes_ref.count().get().value
                except Exception:
                    likes_count = len(list(likes_ref.stream()))
                # user_liked: document exists?
                user_liked = False
                if uid:
                    try:
                        user_liked = likes_ref.document(uid).get().exists
                    except Exception:
                        # fallback to scanning (slower)
                        user_liked = any(l.id == uid for l in likes_ref.stream())
            except Exception:
                likes_count = 0
                user_liked = False

            # --- comments_count + last_comment ---
            comments_ref = db.collection("activities").document(activity_id).collection("comments")
            try:
                try:
                    comments_count = comments_ref.count().get().value
                except Exception:
                    comments_count = len(list(comments_ref.stream()))
            except Exception:
                comments_count = 0

            last_comment = None
            try:
                last_docs = comments_ref.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(1).stream()
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
                last_comment = None

            feed.append({
                "id": activity_id,
                "tags": act.get("tags"),
                "description": act.get("description"),
                "location": act.get("location"),
                "participants": act.get("participants"),
                "timestamp": ts_iso,
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
# 3. Like / Unlike
# ============================================================

@csrf_exempt
def like_activity(request, activity_id):
    """POST: like activity (creates activities/{id}/likes/{uid})."""
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    uid, error = get_uid_from_request(request)
    if error:
        return error

    ensure_user_profile(uid)
    display_name = get_display_name_or_default(uid)

    try:
        like_ref = db.collection("activities").document(activity_id).collection("likes").document(uid)
        like_ref.set({
            "user_id": uid,
            "user_display_name": display_name,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
        return JsonResponse({"status": "liked"})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def unlike_activity(request, activity_id):
    """POST: unlike activity (deletes like doc)."""
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
    """POST: add comment to activity."""
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
    """GET: list comments (newest first)."""
    try:
        docs = (
            db.collection("activities").document(activity_id)
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
    """DELETE: remove comment if owner."""
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
# 5. Tag filtering / user tag management
# ============================================================

def activities_by_tag(request):
    """GET: ?tag=xxx - activities having provided tag (single)."""
    tag = request.GET.get("tag")
    if not tag:
        return JsonResponse({"error": "Missing ?tag="}, status=400)

    try:
        docs = (
            db.collection("activities")
            .where("tags", "array_contains", tag)
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .limit(50)
            .stream()
        )

        activities = []
        for doc in docs:
            a = doc.to_dict()
            ts = a.get("timestamp")
            activities.append({
                "id": doc.id,
                "participants": a.get("participants", []),
                "tags": a.get("tags", []),
                "description": a.get("description", ""),
                "location": a.get("location"),
                "timestamp": ts.isoformat() if ts else None
            })

        return JsonResponse({"activities": activities})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def user_add_tag(request):
    """POST: add a tag to current user. Body: { "tag": "fitness" }"""
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
    """
    POST: add multiple tags to current user.
    Body: { "tags": ["fitness", "coffee", "friends"] }
    """
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

        # Remove empty strings
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
    """POST: remove a tag from current user. Body: { "tag": "fitness" }"""
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
    """
    GET: ?tags=a,b,c  - return activities that have ANY of the provided tags (OR).
    Implementation: query by first tag then filter server-side.
    """
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
                ts = a.get("timestamp")
                results.append({
                    "id": doc.id,
                    "participants": a.get("participants", []),
                    "tags": a.get("tags", []),
                    "description": a.get("description", ""),
                    "location": a.get("location"),
                    "timestamp": ts.isoformat() if ts else None
                })

        # Optionally sort by timestamp desc
        results.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
        return JsonResponse({"activities": results})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def activities_by_tags_all(request):
    """
    GET: ?tags=a,b,c - return activities that have ALL provided tags (AND).
    Implementation: query by first tag then filter server-side for all.
    """
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
            activity_tags = a.get("tags", [])
            if all(t in activity_tags for t in tags):
                ts = a.get("timestamp")
                results.append({
                    "id": doc.id,
                    "participants": a.get("participants", []),
                    "tags": activity_tags,
                    "description": a.get("description", ""),
                    "location": a.get("location"),
                    "timestamp": ts.isoformat() if ts else None
                })

        results.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
        return JsonResponse({"activities": results})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# ============================================================
# 6. Firestore Test
# ============================================================

def test_firestore(request):
    """Simple connectivity test for Firestore."""
    try:
        ref = db.collection("test_check").document("ping")
        ref.set({"status": "working"})
        return JsonResponse({"firestore": "ok", "data": ref.get().to_dict()})
    except Exception as e:
        return JsonResponse({"firestore": "error", "error": str(e)}, status=500)
