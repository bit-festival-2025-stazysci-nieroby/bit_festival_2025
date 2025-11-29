import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, onSnapshot, getDocs, query, limit } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { MapPin, Calendar, Tag, Edit3, Loader2, UserPlus, Check, UserMinus, X, ChevronRight } from 'lucide-react';

interface UserProfileData {
  uid?: string; // dodane pole
  displayName: string;
  email: string;
  photoURL: string;
  location?: string;
  tags?: string[];
  createdAt?: string;
}

interface ProfileProps {
  targetUid?: string | null;
  onUserClick?: (uid: string) => void;
}

const Profile = ({ targetUid, onUserClick = () => {} }: ProfileProps) => {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeList, setActiveList] = useState<'followers' | 'following' | null>(null);
  const [listUsers, setListUsers] = useState<UserProfileData[]>([]);
  const [listLoading, setListLoading] = useState(false);
  
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
          setProfile({ uid: docSnap.id, ...docSnap.data() } as UserProfileData);
        } else {
            if (isOwnProfile && auth.currentUser) {
                setProfile({
                    uid: auth.currentUser.uid,
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
    if (!auth.currentUser || !uidToFetch || isOwnProfile) return;

    const unsubscribe = onSnapshot(doc(db, "users", auth.currentUser.uid, "following", uidToFetch), 
      (docSnap) => {
        setIsFollowing(docSnap.exists());
      },
      (error) => console.error("Error checking follow:", error)
    );

    return () => unsubscribe();
  }, [uidToFetch, isOwnProfile]);

  useEffect(() => {
    if (!uidToFetch) return;

    const followersUnsub = onSnapshot(collection(db, "users", uidToFetch, "followers"), (snap) => setFollowersCount(snap.size));
    const followingUnsub = onSnapshot(collection(db, "users", uidToFetch, "following"), (snap) => setFollowingCount(snap.size));

    return () => {
        followersUnsub();
        followingUnsub();
    };
  }, [uidToFetch]);
  useEffect(() => {
    const fetchListUsers = async () => {
        if (!activeList || !uidToFetch) return;
        
        setListLoading(true);
        setListUsers([]);

        try {
            const listRef = collection(db, "users", uidToFetch, activeList);
            const q = query(listRef, limit(20));
            const querySnapshot = await getDocs(q);
            
            const userIds = querySnapshot.docs.map(doc => doc.id);

            if (userIds.length === 0) {
                setListUsers([]);
                return;
            }
            const userPromises = userIds.map(id => getDoc(doc(db, "users", id)));
            const userSnaps = await Promise.all(userPromises);

            const usersData: UserProfileData[] = [];
            userSnaps.forEach(snap => {
                if (snap.exists()) {
                    usersData.push({ uid: snap.id, ...snap.data() } as UserProfileData);
                }
            });

            setListUsers(usersData);

        } catch (error) {
            console.error(`Error fetching ${activeList}:`, error);
        } finally {
            setListLoading(false);
        }
    };

    fetchListUsers();
  }, [activeList, uidToFetch]);


  const handleToggleFollow = async () => {
      if (!auth.currentUser || !uidToFetch) return;
      setFollowLoading(true);

      const myId = auth.currentUser.uid;
      const targetId = uidToFetch;

      try {
          if (isFollowing) {
              await deleteDoc(doc(db, "users", myId, "following", targetId));
              await deleteDoc(doc(db, "users", targetId, "followers", myId));
          } else {
              await setDoc(doc(db, "users", myId, "following", targetId), { timestamp: serverTimestamp() });
              await setDoc(doc(db, "users", targetId, "followers", myId), { timestamp: serverTimestamp() });
          }
      } catch (error) {
          console.error("Error toggling follow:", error);
          alert("Permission error. Check console.");
      } finally {
          setFollowLoading(false);
      }
  };

  const openList = (type: 'followers' | 'following') => {
      setActiveList(type);
  };

  const handleListUserClick = (uid: string) => {
      setActiveList(null);
      onUserClick(uid); 
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    );
  }

  if (!profile) return <div className="text-center py-20 text-gray-500 dark:text-gray-400">User not found</div>;

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in duration-500 relative">
      
      {/* MODAL LISTY UŻYTKOWNIKÓW */}
      {activeList && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setActiveList(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <h3 className="font-bold text-lg capitalize text-gray-900 dark:text-white">{activeList}</h3>
                    <button onClick={() => setActiveList(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500 dark:text-gray-400">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="overflow-y-auto p-2 flex-1">
                    {listLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-teal-500" /></div>
                    ) : listUsers.length > 0 ? (
                        <div className="space-y-1">
                            {listUsers.map(u => (
                                <div 
                                    key={u.uid} 
                                    onClick={() => u.uid && handleListUserClick(u.uid)}
                                    className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer transition-colors group"
                                >
                                    <img src={u.photoURL} alt={u.displayName} className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-600" />
                                    <div className="flex-1">
                                        <div className="font-bold text-gray-900 dark:text-white text-sm">{u.displayName}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                                    </div>
                                    <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 group-hover:text-teal-500 transition-colors" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                            No users found in this list.
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* HEADER PROFILU */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 dark:bg-gray-800 dark:border-gray-700">
        <div className={`h-32 bg-gradient-to-r ${isOwnProfile ? 'from-teal-400 to-blue-500' : 'from-orange-400 to-pink-500'}`}></div>

        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-4">
            <img 
              src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`} 
              alt={profile.displayName} 
              className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover bg-white dark:border-gray-800"
            />
            
            {isOwnProfile ? (
              <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
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
                        <Check size={16} /> Following
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

            {/* STATYSTYKI KLIKALNE */}
            <div className="flex gap-6 mb-6 border-y border-gray-100 py-4 dark:border-gray-700">
                <button 
                    onClick={() => openList('followers')}
                    className="flex items-center gap-2 group hover:opacity-80 transition-opacity cursor-pointer"
                >
                    <span className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-teal-500 transition-colors">{followersCount}</span>
                    <span className="text-gray-500 text-sm dark:text-gray-400">Followers</span>
                </button>
                <button 
                    onClick={() => openList('following')}
                    className="flex items-center gap-2 group hover:opacity-80 transition-opacity cursor-pointer"
                >
                    <span className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-teal-500 transition-colors">{followingCount}</span>
                    <span className="text-gray-500 text-sm dark:text-gray-400">Following</span>
                </button>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-2 dark:text-gray-400">
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