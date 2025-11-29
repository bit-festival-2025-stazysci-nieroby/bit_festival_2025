from django.core.management.base import BaseCommand
from firebase_admin import firestore
from api import views
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
            {"type": "workout", "description": "Morning workout 💪"},
            {"type": "coffee", "description": "Coffee break ☕"},
            {"type": "walk", "description": "Evening walk 🌆"},
            {"type": "study", "description": "Studying for exams 📚"},
            {"type": "hangout", "description": "Group hangout 🎉"},
            {"type": "run", "description": "Running together 🏃‍♂️"},
            {"type": "gym", "description": "Gym session 🏋️"},
            {"type": "work", "description": "Work & chill 💻"},
        ]

        city_locations = {
            "Warsaw": {"lat": 52.22, "lng": 21.01},
            "Poznań": {"lat": 52.4064, "lng": 16.9252},
            "Kraków": {"lat": 50.0647, "lng": 19.9450},
            "Wrocław": {"lat": 51.11, "lng": 17.02},
            "Gdańsk": {"lat": 54.3520, "lng": 18.6466},
        }

        # Generate 15 activities
        for _ in range(15):

            # Pick participants (at least 1)
            selected_users = random.sample(fake_users, random.randint(1, 3))
            participants = [u["uid"] for u in selected_users]

            # Choose activity template and tags
            template = random.choice(sample_activity_templates)
            tags = random.sample(example_tags, random.randint(1, 3))

            # City = city of first participant
            first_city = selected_users[0]["city"]
            location = city_locations.get(first_city, city_locations["Warsaw"])

            activity_ref = db.collection("activities").document()
            activity_ref.set({
                "type": template["type"],
                "participants": participants,
                "tags": tags,
                "description": template["description"],
                "location": location,
                "time_start": firestore.SERVER_TIMESTAMP,
                "time_end": None,
            })

            activity_id = activity_ref.id

            # ---------- Likes ----------
            like_users = random.sample(fake_users, random.randint(0, len(fake_users)))
            for u in like_users:
                activity_ref.collection("likes").document(u["uid"]).set({
                    "user_id": u["uid"],
                    "user_display_name": u["display_name"],
                    "timestamp": firestore.SERVER_TIMESTAMP
                })

            # ---------- Comments ----------
            comment_users = random.sample(fake_users, random.randint(0, 5))
            for u in comment_users:
                activity_ref.collection("comments").add({
                    "user_id": u["uid"],
                    "user_display_name": u["display_name"],
                    "text": f"{u['display_name']} says hello!",
                    "timestamp": firestore.SERVER_TIMESTAMP
                })

            self.stdout.write(self.style.SUCCESS(
                f"Activity {activity_id}: {len(participants)} participants"
            ))

        self.stdout.write(self.style.SUCCESS("Sample data generation complete!"))
