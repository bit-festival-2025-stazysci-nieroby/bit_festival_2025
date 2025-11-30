from django.core.management.base import BaseCommand
from firebase_admin import firestore
from datetime import datetime
import calendar
import random

db = firestore.client()

class Command(BaseCommand):
    help = "Generate sample activities using EXISTING users from Firestore"

    def handle(self, *args, **kwargs):

        # ============================================================
        # 1️⃣ Read existing users from Firestore
        # ============================================================

        real_uids = [
            "93Lmo6O8xsc7jyCrjSOl2Bul3mP2",
            "Y9oxKb9Vi9YE3C0K2m1gbIywYPj1",
            "vyF9RLrDMUNGn3GWb3QE6Q3YXJo1",
        ]

        real_users = []

        for uid in real_uids:
            doc = db.collection("users").document(uid).get()

            if not doc.exists:
                self.stdout.write(self.style.ERROR(f"USER NOT FOUND: {uid}"))
                continue

            data = doc.to_dict()

            # ---- SAFE LOCATION HANDLING ----
            location_field = data.get("location")

            if isinstance(location_field, dict):
                city = location_field.get("city", "Warsaw")
            elif isinstance(location_field, str):
                city = location_field
            else:
                city = "Warsaw"

            real_users.append({
                "uid": uid,
                "display_name": data.get("displayName") or "",
                "city": city,
            })

        if not real_users:
            self.stdout.write(self.style.ERROR("No existing users found."))
            return

        self.stdout.write(self.style.SUCCESS("Loaded existing users!"))


        # ============================================================
        # 2️⃣ NEW Activity templates
        # ============================================================

        sample_activity_templates = [
            {"type": "cinema", "description": "Going to the cinema 🎬"},
            {"type": "dinner", "description": "Dinner at a restaurant 🍽️"},
            {"type": "shopping", "description": "Shopping time 🛍️"},
            {"type": "boardgames", "description": "Board game evening 🎲"},
            {"type": "gym", "description": "Strength workout 💪"},
            {"type": "run", "description": "Morning run 🏃‍♀️"},
            {"type": "coffee", "description": "Coffee meetup ☕"},
            {"type": "museum", "description": "Visiting a museum 🖼️"},
            {"type": "study", "description": "Group study session 📚"},
            {"type": "walk", "description": "Walk around the city 🌆"},
        ]

        example_tags = [
            "fun", "friends", "food", "culture", "fitness",
            "outdoor", "indoor", "health", "city", "relax",
        ]

        # NEW cities + real coordinates
        city_locations = {
            "Warsaw": {"lat": 52.2297, "lng": 21.0122},
            "Kraków": {"lat": 50.0647, "lng": 19.9450},
            "Gdańsk": {"lat": 54.3520, "lng": 18.6466},
            "Wrocław": {"lat": 51.1079, "lng": 17.0385},
            "Poznań": {"lat": 52.4064, "lng": 16.9252},
        }


        # ============================================================
        # 3️⃣ Generate activities in random days of CURRENT MONTH
        # ============================================================

        now = datetime.now()
        year = now.year
        month = now.month
        days_in_month = calendar.monthrange(year, month)[1]

        for _ in range(20):  # generate 20 activities

            selected_users = random.sample(real_users, random.randint(1, len(real_users)))
            participants = [u["uid"] for u in selected_users]

            template = random.choice(sample_activity_templates)
            tags = random.sample(example_tags, random.randint(1, 3))

            # city of first user
            first_city = selected_users[0]["city"]
            location = city_locations.get(first_city, city_locations["Warsaw"])

            # ---------- RANDOM DATE ----------
            random_day = random.randint(1, days_in_month)
            random_hour = random.randint(8, 22)
            random_minute = random.randint(0, 59)

            time_start = datetime(year, month, random_day, random_hour, random_minute)

            activity_ref = db.collection("activities").document()
            activity_ref.set({
                "type": template["type"],
                "participants": participants,
                "tags": tags,
                "description": template["description"],
                "location": location,
                "time_start": time_start,
                "time_end": None
            })

            # ---------- Likes ----------
            like_users = random.sample(real_users, random.randint(0, len(real_users)))
            for u in like_users:
                activity_ref.collection("likes").document(u["uid"]).set({
                    "user_id": u["uid"],
                    "user_display_name": u["display_name"],
                    "timestamp": time_start
                })

            # ---------- Comments ----------
            comment_users = random.sample(real_users, random.randint(0, len(real_users)))
            for u in comment_users:
                activity_ref.collection("comments").add({
                    "user_id": u["uid"],
                    "user_display_name": u["display_name"],
                    "text": f"{u['display_name']} joins the activity!",
                    "timestamp": time_start
                })

            self.stdout.write(
                self.style.SUCCESS(
                    f"Activity {activity_id}: {len(participants)} participants on {time_start}"
                )
            )

        self.stdout.write(self.style.SUCCESS("Sample activity generation complete!"))

