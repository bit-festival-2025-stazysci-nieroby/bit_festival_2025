from django.core.management.base import BaseCommand
from firebase_admin import firestore
import random

db = firestore.client()


class Command(BaseCommand):
    help = "Insert sample activities + users + likes + comments for the new schema"

    def handle(self, *args, **kwargs):

        # ============================================================
        # 1️⃣ USERS — Create fake users
        # ============================================================

        fake_users = [
            {"uid": "alice", "display_name": "Alice Doe", "city": "Warsaw"},
            {"uid": "bob", "display_name": "Bob Green", "city": "Kraków"},
            {"uid": "charlie", "display_name": "Charlie Red", "city": "Gdańsk"},
            {"uid": "david", "display_name": "David Black", "city": "Wrocław"},
            {"uid": "eve", "display_name": "Eve White", "city": "Poznań"},
        ]

        example_tags = ["fitness", "outdoor", "coffee", "friends", "study", "gym", "run"]

        for u in fake_users:
            db.collection("users").document(u["uid"]).set({
                "uid": u["uid"],
                "display_name": u["display_name"],
                "city": u["city"],
                "tags": random.sample(example_tags, random.randint(1, 3)),
                "description": f"Hi, I'm {u['display_name']}",
                "created_at": firestore.SERVER_TIMESTAMP,
            })

        self.stdout.write(self.style.SUCCESS("Fake users added!"))

        # ============================================================
        # 2️⃣ ACTIVITIES — Generate sample activities
        # ============================================================

        sample_activity_templates = [
            "Morning workout",
            "Coffee break ☕",
            "Evening walk",
            "Studying for exams",
            "Group hangout",
            "Running together",
            "Gym session",
            "Work & chill",
        ]

        locations = [
            {"lat": 52.22, "lng": 21.01},   # Warsaw
            {"lat": 52.4064, "lng": 16.9252},  # Poznań
            {"lat": 50.0647, "lng": 19.9450},  # Kraków
            {"lat": 51.11, "lng": 17.02},      # Wrocław
            {"lat": 54.3520, "lng": 18.6466},  # Gdańsk
        ]

        # Generate 12 activities
        for _ in range(12):

            # random participants (1–3 users)
            part_count = random.randint(1, 3)
            participants = random.sample([u["uid"] for u in fake_users], part_count)

            # random tags (1–3 tags)
            tags = random.sample(example_tags, random.randint(1, 3))

            activity_ref = db.collection("activities").document()
            activity_ref.set({
                "participants": participants,
                "tags": tags,
                "description": random.choice(sample_activity_templates),
                "location": random.choice(locations),
                "timestamp": firestore.SERVER_TIMESTAMP
            })

            activity_id = activity_ref.id

            # ============================================================
            # 3️⃣ LIKES
            # ============================================================

            like_count = random.randint(0, len(fake_users))
            like_users = random.sample(fake_users, like_count)

            for u in like_users:
                activity_ref.collection("likes").document(u["uid"]).set({
                    "user_id": u["uid"],
                    "user_display_name": u["display_name"],
                    "timestamp": firestore.SERVER_TIMESTAMP
                })

            # ============================================================
            # 4️⃣ COMMENTS
            # ============================================================

            comment_count = random.randint(0, 5)
            comment_users = random.sample(fake_users, comment_count)

            for u in comment_users:
                activity_ref.collection("comments").add({
                    "user_id": u["uid"],
                    "user_display_name": u["display_name"],
                    "text": f"{u['display_name']} says hello!",
                    "timestamp": firestore.SERVER_TIMESTAMP
                })

            self.stdout.write(self.style.SUCCESS(
                f"Activity {activity_id}: {len(participants)} participants, "
                f"{like_count} likes, {comment_count} comments"
            ))

        self.stdout.write(self.style.SUCCESS("Sample data generation complete!"))
