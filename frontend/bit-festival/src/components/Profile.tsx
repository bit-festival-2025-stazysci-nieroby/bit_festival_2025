import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { MapPin, Calendar, Tag, Edit3, Loader2, UserPlus, Check, UserMinus } from 'lucide-react';

interface UserProfileData {
  displayName: string;
  email: string;
  photoURL: string;
  location?: string;
  tags?: string[];
  createdAt?: string;
}

interface ProfileProps {
  targetUid?: string | null;
}

const Profile = ({ targetUid }: ProfileProps) => {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  
  const isOwnProfile = !targetUid || (auth.currentUser && targetUid === auth.currentUser.uid);
  const uidToFetch = targetUid || auth.currentUser?.uid;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!uidToFetch) return;
      setLoading(true);

      try {
        const docRef = doc(db, "users", uidToFetch);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfileData);
        } else {
            if (isOwnProfile && auth.currentUser) {
                setProfile({
                    displayName: auth.currentUser.displayName || 'User',
                    email: auth.currentUser.email || '',
                    photoURL: auth.currentUser.photoURL || '',
                    tags: []
                });
            } else {
                setProfile(null);
            }
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [uidToFetch, isOwnProfile]);

  useEffect(() => {
    const checkFollowStatus = async () => {
        if (!auth.currentUser || !uidToFetch || isOwnProfile) return;
        
        try {
            const followDoc = await getDoc(doc(db, "users", auth.currentUser.uid, "following", uidToFetch));
            setIsFollowing(followDoc.exists());
        } catch (error) {
            console.error("Error checking follow status:", error);
        }
    };

    checkFollowStatus();
  }, [uidToFetch, isOwnProfile]);

  const handleToggleFollow = async () => {
      if (!auth.currentUser || !uidToFetch) return;
      setFollowLoading(true);

      const myId = auth.currentUser.uid;
      const targetId = uidToFetch;

      try {
          if (isFollowing) {
              await deleteDoc(doc(db, "users", myId, "following", targetId));
              await deleteDoc(doc(db, "users", targetId, "followers", myId));
              setIsFollowing(false);
          } else {
              await setDoc(doc(db, "users", myId, "following", targetId), { timestamp: serverTimestamp() });
              await setDoc(doc(db, "users", targetId, "followers", myId), { timestamp: serverTimestamp() });
              setIsFollowing(true);
          }
      } catch (error) {
          console.error("Error toggling follow:", error);
          alert("Could not update follow status.");
      } finally {
          setFollowLoading(false);
      }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    );
  }

  if (!profile) return <div className="text-center py-20 text-gray-500">User not found</div>;

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 dark:bg-gray-800 dark:border-gray-700">
        <div className={`h-32 bg-gradient-to-r ${isOwnProfile ? 'from-teal-400 to-blue-500' : 'from-orange-400 to-pink-500'}`}></div>

        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-6">
            <img 
              src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`} 
              alt={profile.displayName} 
              className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover bg-white dark:border-gray-800"
            />
            
            {isOwnProfile ? (
              <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer dark:bg-gray-700 dark:text-gray-200">
                <Edit3 size={16} />
                Edit Profile
              </button>
            ) : (
              <button 
                onClick={handleToggleFollow}
                disabled={followLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
                    isFollowing 
                    ? 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600' 
                    : 'bg-teal-500 hover:bg-teal-600 text-white'
                }`}
              >
                {followLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                ) : isFollowing ? (
                    <>
                        <span className="group-hover:hidden flex items-center gap-2"><Check size={16} /> Following</span>
                        <span className="hidden group-hover:flex items-center gap-2"><UserMinus size={16} /> Unfollow</span>
                    </>
                ) : (
                    <>
                        <UserPlus size={16} /> Follow
                    </>
                )}
              </button>
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{profile.displayName}</h1>
            <p className="text-gray-500 mb-4 dark:text-gray-400">{isOwnProfile ? profile.email : `@${profile.displayName.toLowerCase().replace(/\s/g, '')}`}</p>

            <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-6 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <MapPin size={16} />
                {profile.location || "Earth"}
              </div>
              <div className="flex items-center gap-1">
                <Calendar size={16} />
                Joined {profile.createdAt ? new Date(profile.createdAt).getFullYear() : new Date().getFullYear()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-6">
            <Tag className="text-orange-500" size={20} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Interests & Hobbies</h2>
        </div>

        {profile.tags && profile.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profile.tags.map((tag) => (
              <span 
                key={tag} 
                className="px-4 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-full text-sm font-medium capitalize dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
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