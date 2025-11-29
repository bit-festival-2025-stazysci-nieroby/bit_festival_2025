import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore'; 
import { db, auth } from '../lib/firebase';
import { Check } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}
//to trzeba bedzie jakos przerobic

const AVAILABLE_TAGS = [
  'Running', 'Cycling', 'Gym', 'Yoga', 
  'Hiking', 'Swimming', 'Crossfit', 'Meditation',
  'Pilates', 'Team Sports', 'Dancing', 'Climbing'
];

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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

    try {
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        displayName: auth.currentUser.displayName,
        photoURL: auth.currentUser.photoURL,
        interests: selectedTags,
        isOnboardingCompleted: true, // Flaga, że user to wypełnił
        createdAt: new Date().toISOString()
      }, { merge: true }); 
      onComplete(); 
    } catch (error) {
      console.error("Error saving profile:", error);
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

        <div className="flex flex-wrap gap-3 justify-center mb-10">
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
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${
            selectedTags.length === 0
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-200 cursor-pointer'
          }`}
        >
          {isSaving ? 'Saving...' : 'Continue to App'}
        </button>
      </div>
    </div>
  );
};

export default Onboarding;