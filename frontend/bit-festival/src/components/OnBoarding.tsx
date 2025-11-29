import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore'; 
import { db, auth } from '../lib/firebase';
import { Check, Loader2 } from 'lucide-react';

// Upewnij się, że w .env masz zdefiniowane VITE_API_URL (np. http://127.0.0.1:8000)
// Jeśli nie używasz Vite env, możesz wpisać string na sztywno: "http://127.0.0.1:8000"
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

interface OnboardingProps {
  onComplete: () => void;
}

const AVAILABLE_TAGS = [
  "gym","running", "cycling",
  "walking",  "hiking",  "swimming",  "basketball",  "football",
  "volleyball",  "tennis",  "padel",  "badminton",  "climbing",
  "yoga",  "boxing", "dance",  "skating",  "skiing",  "snowboarding",
  "shopping",  "nightlife",  "concert", "photography",
  "events",  "coffee", "lunch","tea", "study",
  "reading","coding", "music",  "gaming",  "boardgames",  "crafting",  "painting",  "drawing",
  "writing",  "gardening","learning",  "volunteering",
  "outdoor", "picnic",  "sightseeing",  "birdwatching","meditation"
];

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    setError(null);

    const uid = auth.currentUser.uid;

    try {
      // KROK 1: Najpierw tworzymy/aktualizujemy usera w Firebase bezpośrednio.
      // Jest to konieczne, bo endpoint w Django robi .update(), co wymaga istnienia dokumentu.
      await setDoc(doc(db, "users", uid), {
        isOnboardingCompleted: true,
        email: auth.currentUser.email,
        displayName: auth.currentUser.displayName,
        photoURL: auth.currentUser.photoURL,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      const token = await auth.currentUser.getIdToken();
      
      const tagsString = selectedTags.join(',');
      const url = `${API_URL}/api/user/${uid}/add-tags/${encodeURIComponent(tagsString)}/`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }
      onComplete(); 

    } catch (err) {
      console.error("Error saving profile:", err);
      setError("Failed to verify tags with server. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white max-w-2xl w-full rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            What moves you? 🏃‍♂️
          </h1>
          <p className="text-gray-500">
            Select the activities you are interested in so we can personalize your feed.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center mb-10 max-h-[60vh] overflow-y-auto p-2">
          {AVAILABLE_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-6 py-3 rounded-full font-medium transition-all duration-200 border cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-teal-500 text-white border-teal-500 shadow-md transform scale-105'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:bg-gray-50'
                }`}
              >
                {tag}
                {isSelected && <Check size={16} />}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSave}
          disabled={selectedTags.length === 0 || isSaving}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-2 ${
            selectedTags.length === 0
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-200 cursor-pointer'
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="animate-spin" size={24} /> Saving...
            </>
          ) : (
            'Continue to App'
          )}
        </button>
      </div>
    </div>
  );
};

export default Onboarding;