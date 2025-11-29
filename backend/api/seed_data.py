from django.core.management.base import BaseCommand
from firebase_admin import firestore

db = firestore.client()

class Command(BaseCommand):
    help = "Insert sample activity data into Firestore"

    def handle(self, *args, **kwargs):
        sample_items = [
            {
                "participants": ["userA", "userB"],
                "type": "walk",
                "timestamp": firestore.SERVER_TIMESTAMP,
                "location": {"lat": 52.2297, "lng": 21.0122},
                "tags": ["outdoor", "fitness"],
                "user_comment": "Morning walk in Warsaw"
            },
            {
                "participants": ["userC"],
                "type": "coffee",
                "timestamp": firestore.SERVER_TIMESTAMP,
                "location": {"lat": 52.4064, "lng": 16.9252},
                "tags": ["drink"],
                "user_comment": "Coffee break"
            }
        ]

        for item in sample_items:
            doc_ref = db.collection("activities").document()
            doc_ref.set(item)
            self.stdout.write(self.style.SUCCESS(f"Inserted: {doc_ref.id}"))

        self.stdout.write(self.style.SUCCESS("Sample Firestore data created!"))
