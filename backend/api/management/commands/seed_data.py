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
                "user_comment": "Morning walk in Warsaw",
            },
            {
                "participants": ["userC"],
                "type": "coffee",
                "timestamp": firestore.SERVER_TIMESTAMP,
                "location": {"lat": 52.4064, "lng": 16.9252},
                "tags": ["cafe"],
                "user_comment": "Coffee in Poznań",
            },
        ]

        for item in sample_items:
            doc = db.collection("activities").document()
            doc.set(item)
            self.stdout.write(self.style.SUCCESS(f"Inserted: {doc.id}"))

        self.stdout.write(self.style.SUCCESS("Sample data added!"))
