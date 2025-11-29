import os
import firebase_admin
from firebase_admin import credentials, firestore
from django.conf import settings

# Initialize Firebase once for entire Django project
if not firebase_admin._apps:
    cred_path = os.path.join(settings.BASE_DIR, "serviceAccountKey.json")
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

# Export Firestore client (shared across views + commands)
db = firestore.client()
