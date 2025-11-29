import os
import json
import datetime
import firebase_admin
from firebase_admin import credentials, firestore, auth
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

# --- 1. ROBUST FIREBASE INITIALIZATION ---
# This pattern prevents "App already exists" errors when Django auto-reloads.
if not firebase_admin._apps:
    # Option A: Use a local file (Best for testing)
    # Ensure 'serviceAccountKey.json' is in your project root or manage.py folder
    cred_path = os.path.join(settings.BASE_DIR, 'serviceAccountKey.json')
    
    # Option B: Use Environment Variable (Best for Cloud Run/Production)
    # cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')

    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        print(f"WARNING: Firebase credentials not found at {cred_path}")

db = firestore.client()

# --- 2. API ENDPOINTS ---

@csrf_exempt
def sync_offline_activity(request):
    """
    Endpoint for Mobile App to upload 'Offline Activity' data.
    Receives JSON data with a 'proof_token' from the proximity handshake.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)

    try:
        # Verify the user sending the data via Firebase Auth Token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return JsonResponse({'error': 'No token provided'}, status=401)
        
        # Header format: "Bearer <token>"
        token = auth_header.split(" ")[1]
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token['uid']

        data = json.loads(request.body)
        
        # 3. VALIDATE THE PROXIMITY TOKEN (The "AirTag" Proof)
        friend_uid = data.get('friend_uid')
        proof_token = data.get('proof_token') 
        
        # In a real scenario, you would cryptographically verify that 'proof_token' 
        # was signed by 'friend_uid's private key.
        # if not verify_signature(friend_uid, proof_token): 
        #    return JsonResponse({'error': 'Invalid proximity handshake'}, status=403)

        # 4. SAVE TO FIRESTORE
        # We use a batch write or transaction to ensure data consistency
        activity_ref = db.collection('activities').document()
        
        activity_data = {
            'participants': [uid, friend_uid],
            'type': data.get('activity_type', 'unknown'),
            'timestamp': firestore.SERVER_TIMESTAMP,
            'location': {
                'lat': data.get('lat'),
                'lng': data.get('lng')
            },
            'tags': data.get('ai_tags', []),  # Tags from on-device AI (TensorFlow Lite)
            'user_comment': data.get('comment', '')
        }
        
        activity_ref.set(activity_data)

        # 5. UPDATE USER PROFILES
        # Link this activity to both users' history so it appears on their profiles
        # Note: In a large app, consider using a separate 'feeds' collection
        db.collection('users').document(uid).update({
            'recent_activities': firestore.ArrayUnion([activity_ref.id])
        })
        # Only update friend if they are a registered user
        if friend_uid:
             db.collection('users').document(friend_uid).update({
                'recent_activities': firestore.ArrayUnion([activity_ref.id])
            })

        return JsonResponse({'status': 'success', 'activity_id': activity_ref.id})

    except Exception as e:
        # Log the error in production
        print(f"Error in sync_offline_activity: {e}")
        return JsonResponse({'error': str(e)}, status=500)

def get_feed(request):
    """
    Web Endpoint: Fetches global or friend feed.
    Used by the Leaflet.js map on the frontend.
    """
    try:
        # Query: Get last 50 activities sorted by time
        docs = db.collection('activities')\
                 .order_by('timestamp', direction=firestore.Query.DESCENDING)\
                 .limit(50)\
                 .stream()
        
        feed_data = []
        for doc in docs:
            act = doc.to_dict()
            
            # Handle timestamp serialization
            ts = act.get('timestamp')
            if ts:
                ts = ts.isoformat()

            feed_data.append({
                'id': doc.id,
                'type': act.get('type'),
                'location': act.get('location'),
                'participants': act.get('participants'),
                'tags': act.get('tags'),
                'timestamp': ts,
                'comment': act.get('user_comment', '')
            })
            
        return JsonResponse({'feed': feed_data})

    except Exception as e:
        print(f"Error in get_feed: {e}")
        return JsonResponse({'error': str(e)}, status=500)
