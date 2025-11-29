import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { MapPin, Calendar, Mail, Tag, Edit3, Loader2 } from 'lucide-react';

interface UserProfileData {
  displayName: string;
  email: string;
  photoURL: string;
  location?: string;
  tags?: string[]; 
  createdAt?: string;
}

const Profile = () => {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;

      try {
        const docRef = doc(db, "users", auth.currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfileData);
        } else {
          // Fallback if firestore doc is missing but auth exists
          setProfile({
            displayName: auth.currentUser.displayName || 'User',
            email: auth.currentUser.email || '',
            photoURL: auth.currentUser.photoURL || '',
            tags: []
          });
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    );
  }

  if (!profile) return <div>User not found</div>;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        {/* Banner - Decorative Gradient */}
        <div className="h-32 bg-gradient-to-r from-teal-400 to-blue-500"></div>

        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-6">
            {/* Avatar */}
            <img 
              src={profile.photoURL || "https://ui-avatars.com/api/?name=" + profile.displayName} 
              alt={profile.displayName} 
              className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover bg-white"
            />
            
            {/* Edit Button (Visual only for now) */}
            <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer">
              <Edit3 size={16} />
              Edit Profile
            </button>
          </div>

          {/* User Info */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{profile.displayName}</h1>
            <p className="text-gray-500 mb-4">{profile.email}</p>

            {/* Meta Details */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-6">
              <div className="flex items-center gap-1">
                <MapPin size={16} />
                {profile.location || "Earth"}
              </div>
              <div className="flex items-center gap-1">
                <Calendar size={16} />
                Joined {new Date().getFullYear()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interests / Tags Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center gap-2 mb-6">
            <Tag className="text-orange-500" size={20} />
            <h2 className="text-xl font-bold text-gray-900">Interests & Hobbies</h2>
        </div>

        {profile.tags && profile.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profile.tags.map((tag) => (
              <span 
                key={tag} 
                className="px-4 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-full text-sm font-medium capitalize"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 italic">No interests selected yet.</p>
        )}
      </div>
    </div>
  );
};

export default Profile;