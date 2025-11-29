import os
import json
import firebase_admin
from firebase_admin import credentials, firestore, auth
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from api import db

# -------------------------
# 1. SYNC OFFLINE ACTIVITY
# -------------------------
@csrf_exempt
def sync_offline_activity(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        # --- Verify Firebase Auth token ---
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return JsonResponse({'error': 'Missing Authorization header'}, status=401)

        token = auth_header.split(" ")[1]
        decoded = auth.verify_id_token(token)
        uid = decoded["uid"]

        # --- JSON payload ---
        data = json.loads(request.body)

        friend_uid = data.get("friend_uid")
        proof_token = data.get("proof_token")  # Not validated yet

        # --- Create Activity ---
        activity_ref = db.collection("activities").document()

        activity_data = {
            "participants": [uid, friend_uid],
            "type": data.get("activity_type", "unknown"),
            "timestamp": firestore.SERVER_TIMESTAMP,
            "location": {
                "lat": data.get("lat"),
                "lng": data.get("lng"),
            },
            "tags": data.get("ai_tags", []),
            "user_comment": data.get("comment", ""),
        }

        activity_ref.set(activity_data)

        # --- Update user's activity history ---
        db.collection("users").document(uid).update({
            "recent_activities": firestore.ArrayUnion([activity_ref.id])
        })

        if friend_uid:
            db.collection("users").document(friend_uid).update({
                "recent_activities": firestore.ArrayUnion([activity_ref.id])
            })

        return JsonResponse({
            "status": "success",
            "activity_id": activity_ref.id
        })

    except Exception as e:
        print(f"[ERROR] sync_offline_activity: {e}")
        return JsonResponse({"error": str(e)}, status=500)


# -------------------------
# 2. GET FEED (Leaflet Map)
# -------------------------
def get_feed(request):
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
            ts = act.get("timestamp")
            if ts:
                ts = ts.isoformat()

            feed.append({
                "id": doc.id,
                "type": act.get("type"),
                "location": act.get("location"),
                "participants": act.get("participants"),
                "tags": act.get("tags"),
                "timestamp": ts,
                "comment": act.get("user_comment", "")
            })

        return JsonResponse({"feed": feed})

    except Exception as e:
        print(f"[ERROR] get_feed: {e}")
        return JsonResponse({"error": str(e)}, status=500)



@csrf_exempt
def like_activity(request, activity_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        # verify Firebase token
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return JsonResponse({"error": "Missing token"}, status=401)
        token = auth_header.split(" ")[1]
        decoded = auth.verify_id_token(token)
        uid = decoded["uid"]

        # create like doc
        like_ref = db.collection("activities").document(activity_id)\
                     .collection("likes").document(uid)

        like_ref.set({
            "user_id": uid,
            "timestamp": firestore.SERVER_TIMESTAMP
        })

        return JsonResponse({"status": "liked"})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
 
 
@csrf_exempt
def comment_activity(request, activity_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        # verify Firebase token
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return JsonResponse({"error": "Missing token"}, status=401)
        token = auth_header.split(" ")[1]
        decoded = auth.verify_id_token(token)
        uid = decoded["uid"]

        data = json.loads(request.body)
        text = data.get("text", "").strip()

        if len(text) == 0:
            return JsonResponse({"error": "Empty comment"}, status=400)

        comment_ref = db.collection("activities").document(activity_id)\
                        .collection("comments").document()

        comment_ref.set({
            "user_id": uid,
            "text": text,
            "timestamp": firestore.SERVER_TIMESTAMP
        })

        return JsonResponse({"status": "comment_added", "comment_id": comment_ref.id})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# -------------------------
# 3. FIRESTORE CONNECTIVITY TEST
# -------------------------
def test_firestore(request):
    try:
        ref = db.collection("test_check").document("ping")
        ref.set({"status": "working"})

        return JsonResponse({
            "firestore": "ok",
            "data": ref.get().to_dict()
        })

    except Exception as e:
        print(f"[ERROR] test_firestore: {e}")
        return JsonResponse({
            "firestore": "error",
            "error": str(e)
        }, status=500)
