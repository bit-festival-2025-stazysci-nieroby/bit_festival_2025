from django.core.management.base import BaseCommand
from firebase_admin import firestore
import random

db = firestore.client()


class Command(BaseCommand):
    help = "Insert sample activities + users + likes + comments for the new schema"

    def handle(self, *args, **kwargs):

        # ============================================================
        # 1️⃣ Create fake users
        # ============================================================

        fake_users = [
            {"uid": "alice", "display_name": "Alice Doe", "city": "Warsaw"},
            {"uid": "bob", "display_name": "Bob Green", "city": "Kraków"},
            {"uid": "charlie", "display_name": "Charlie Red", "city": "Gdańsk"},
            {"uid": "david", "display_name": "David Black", "city": "Wrocław"},
            {"uid": "eve", "display_name": "Eve White", "city": "Poznań"},
        ]

        example_tags = ["fitness", "outdoor", "coffee", "friends", "study"]

        for u in fake_users:
            db.collection("users").document(u["uid"]).set({
                "uid": u["uid"],
                "display_name": u["display_name"],
                "city": u["city"],
                "tags": random.sample(example_tags, 2),
                "description": f"This is {u['display_name']}",
                "created_at": firestore.SERVER_TIMESTAMP,
            })

        self.stdout.write(self.style.SUCCESS("Fake users added!"))

        # ============================================================
        # 2️⃣ Create sample activities (NEW SCHEMA)
        # ============================================================

        sample_activities = [
            {
                "participants": ["alice", "bob"],
                "tags": ["outdoor", "fitness"],
                "description": "Morning workout together",
                "location": {"lat": 52.22, "lng": 21.01},
            },
            {
                "participants": ["charlie"],
                "tags": ["coffee"],
                "description": "Coffee break ☕",
                "location": {"lat": 52.4064, "lng": 16.9252},
            },
            {
                "participants": ["david", "eve"],
                "tags": ["study", "friends"],
                "description": "Studying for exams",
                "location": {"lat": 51.11, "lng": 17.02},
            },
        ]

        for item in sample_activities:

            # Create activity
            activity_ref = db.collection("activities").document()
            activity_ref.set({
                "participants": item["participants"],
                "tags": item["tags"],
                "description": item["description"],
                "location": item["location"],
                "timestamp": firestore.SERVER_TIMESTAMP
            })

            activity_id = activity_ref.id

            # ============================================================
            # 3️⃣ Add likes
            # ============================================================

            number_of_likes = random.randint(0, 4)
            like_users = random.sample(fake_users, number_of_likes)

            for u in like_users:
                activity_ref.collection("likes").document(u["uid"]).set({
                    "user_id": u["uid"],
                    "user_display_name": u["display_name"],
                    "timestamp": firestore.SERVER_TIMESTAMP
                })

            # ============================================================
            # 4️⃣ Add comments
            # ============================================================

            number_of_comments = random.randint(0, 4)
            comment_users = random.sample(fake_users, number_of_comments)

            for u in comment_users:
                activity_ref.collection("comments").add({
                    "user_id": u["uid"],
                    "user_display_name": u["display_name"],
                    "text": f"Sample comment from {u['display_name']}",
                    "timestamp": firestore.SERVER_TIMESTAMP
                })

            self.stdout.write(self.style.SUCCESS(
                f"Added activity {activity_id} with {number_of_likes} likes and {number_of_comments} comments"
            ))

        self.stdout.write(self.style.SUCCESS("Sample data generation complete!"))
