import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, onSnapshot, getDocs, query, limit, where, orderBy } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { MapPin, Calendar, Tag, Edit3, Loader2, UserPlus, Check, UserMinus, X, ChevronRight, Activity, BarChart2, Save, Image as ImageIcon, FileText } from 'lucide-react';
import ActivityCard from './ActivityCard';
import type { ActivityPost } from '../types';

interface UserProfileData {
  uid?: string;
  displayName: string;
  email: string;
  photoURL: string;
  location?: string;
  bio?: string; // Nowe pole
  tags?: string[];
  createdAt?: string;
}

interface ProfileProps {
  targetUid?: string | null;
  onUserClick?: (uid: string) => void;
  onActivityClick?: (activityId: string) => void;
}

interface WeeklyStat {
  label: string;
  count: number;
  height: number;
}

// Lista dostępnych tagów do edycji
const AVAILABLE_TAGS = [
  "gym", "running", "cycling", "walking", "hiking", "swimming", 
  "basketball", "football", "tennis", "yoga", "boxing", "dance", 
  "skiing", "coffee", "study", "coding", "music", "gaming", 
  "outdoor", "meditation"
];

const Profile = ({ targetUid, onUserClick = () => {}, onActivityClick = () => {} }: ProfileProps) => {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Stany followersów
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Stany list i aktywności
  const [activeList, setActiveList] = useState<'followers' | 'following' | null>(null);
  const [listUsers, setListUsers] = useState<UserProfileData[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [userActivities, setUserActivities] = useState<ActivityPost[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  
  // Stany wykresu
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStat[]>([
      { label: '3 weeks ago', count: 0, height: 2 },
      { label: '2 weeks ago', count: 0, height: 2 },
      { label: 'Last week', count: 0, height: 2 },
      { label: 'This week', count: 0, height: 2 },
  ]);

  // --- STANY EDYCJI PROFILU ---
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
      displayName: '',
      location: '',
      photoURL: '',
      bio: '', // Nowe pole w formularzu
      tags: [] as string[]
  });
  const [saving, setSaving] = useState(false);
  
  const isOwnProfile = !targetUid || (auth.currentUser && targetUid === auth.currentUser.uid);
  const uidToFetch = targetUid || auth.currentUser?.uid;

  // 1. Pobieranie profilu
  useEffect(() => {
    const fetchProfile = async () => {
      if (!uidToFetch) return;
      setLoading(true);
      try {
        const docRef = doc(db, "users", uidToFetch);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfileData;
          setProfile({ uid: docSnap.id, ...data });
          
          // Inicjalizacja formularza edycji, jeśli to nasz profil
          if (isOwnProfile) {
              setEditForm({
                  displayName: data.displayName || '',
                  location: data.location || '',
                  photoURL: data.photoURL || '',
                  bio: data.bio || '',
                  tags: data.tags || []
              });
          }
        } else {
            if (isOwnProfile && auth.currentUser) {
                const initialData = {
                    uid: auth.currentUser.uid,
                    displayName: auth.currentUser.displayName || 'User',
                    email: auth.currentUser.email || '',
                    photoURL: auth.currentUser.photoURL || '',
                    bio: '',
                    tags: []
                };
                setProfile(initialData);
                setEditForm({
                    displayName: initialData.displayName,
                    location: '',
                    photoURL: initialData.photoURL,
                    bio: '',
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

  // 2. Follow Status
  useEffect(() => {
    if (!auth.currentUser || !uidToFetch || isOwnProfile) return;
    const unsubscribe = onSnapshot(doc(db, "users", auth.currentUser.uid, "following", uidToFetch), 
      (docSnap) => setIsFollowing(docSnap.exists()),
      (error) => console.error("Error checking follow:", error)
    );
    return () => unsubscribe();
  }, [uidToFetch, isOwnProfile]);

  // 3. Liczniki
  useEffect(() => {
    if (!uidToFetch) return;
    const followersUnsub = onSnapshot(collection(db, "users", uidToFetch, "followers"), (snap) => setFollowersCount(snap.size));
    const followingUnsub = onSnapshot(collection(db, "users", uidToFetch, "following"), (snap) => setFollowingCount(snap.size));
    return () => { followersUnsub(); followingUnsub(); };
  }, [uidToFetch]);

  // 4. Aktywności i Wykres
  useEffect(() => {
    const fetchUserActivities = async () => {
        if (!uidToFetch) return;
        setActivitiesLoading(true);
        try {
            const q = query(
                collection(db, "activities"),
                where("participants", "array-contains", uidToFetch),
                orderBy("time_start", "desc"),
                limit(50)
            );
            const querySnapshot = await getDocs(q);
            
            // Wykres
            const now = new Date();
            const fourWeeksAgo = new Date();
            fourWeeksAgo.setDate(now.getDate() - 28);
            const buckets = [0, 0, 0, 0]; 

            querySnapshot.docs.forEach(doc => {
                const data = doc.data();
                let date: Date | null = null;
                const rawDate = data.time_start || data.timestamp;
                if (rawDate && typeof rawDate.toDate === 'function') date = rawDate.toDate();
                else if (rawDate && typeof rawDate === 'string') date = new Date(rawDate);

                if (!date || isNaN(date.getTime()) || date < fourWeeksAgo) return;

                const diffTime = Math.abs(now.getTime() - date.getTime());
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
                if (diffDays <= 7) buckets[3]++;
                else if (diffDays <= 14) buckets[2]++;
                else if (diffDays <= 21) buckets[1]++;
                else if (diffDays <= 28) buckets[0]++;
            });

            const maxCount = Math.max(...buckets, 1);
            setWeeklyStats([
                { label: '3 weeks ago', count: buckets[0], height: buckets[0] === 0 ? 2 : (buckets[0] / maxCount) * 100 },
                { label: '2 weeks ago', count: buckets[1], height: buckets[1] === 0 ? 2 : (buckets[1] / maxCount) * 100 },
                { label: 'Last week', count: buckets[2], height: buckets[2] === 0 ? 2 : (buckets[2] / maxCount) * 100 },
                { label: 'This week', count: buckets[3], height: buckets[3] === 0 ? 2 : (buckets[3] / maxCount) * 100 },
            ]);

            // Lista
            const recentDocs = querySnapshot.docs.slice(0, 10);
            const mappedActivities = await Promise.all(recentDocs.map(async (docSnap) => {
                const data = docSnap.data();
                const likesRef = collection(db, "activities", docSnap.id, "likes");
                const commentsRef = collection(db, "activities", docSnap.id, "comments");
                
                const [likesSnap, commentsSnap] = await Promise.all([
                    getDocs(likesRef),
                    getDocs(query(commentsRef, orderBy("timestamp", "desc")))
                ]);

                let lastComment = null;
                if (!commentsSnap.empty) {
                    const lastData = commentsSnap.docs[0].data();
                    lastComment = {
                        user_id: lastData.user_id,
                        user_display_name: lastData.user_display_name,
                        text: lastData.text,
                        timestamp: lastData.timestamp?.toDate ? lastData.timestamp.toDate() : new Date()
                    };
                }

                const displayDate = data.time_start?.toDate 
                    ? data.time_start.toDate().toLocaleString() 
                    : (data.time_start ? new Date(data.time_start).toLocaleString() : 'Unknown date');

                return {
                    id: docSnap.id,
                    user: {
                        id: uidToFetch,
                        name: profile?.displayName || "User",
                        avatar: profile?.photoURL || "",
                        location: data.location ? "Checked in" : ""
                    },
                    type: data.tags?.[0] || 'other',
                    timestamp: displayDate,
                    title: data.description ? (data.tags?.[0] ? `${data.tags[0].charAt(0).toUpperCase() + data.tags[0].slice(1)} Session` : "Activity") : "Activity",
                    description: data.description || "",
                    stats: { duration: "Done", distance: "-", pace: "-", calories: "-" },
                    social: {
                        likes: likesSnap.size,
                        comments: commentsSnap.size,
                        userLiked: auth.currentUser ? likesSnap.docs.some(d => d.id === auth.currentUser?.uid) : false,
                        lastComment: lastComment
                    }
                } as ActivityPost;
            }));
            setUserActivities(mappedActivities);
        } catch (error) { console.error(error); } finally { setActivitiesLoading(false); }
    };
    if (profile) fetchUserActivities();
  }, [uidToFetch, profile]);

  // 5. Lista userów
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
            if (userIds.length === 0) { setListUsers([]); return; }
            const userPromises = userIds.map(id => getDoc(doc(db, "users", id)));
            const userSnaps = await Promise.all(userPromises);
            const usersData: UserProfileData[] = [];
            userSnaps.forEach(snap => { if (snap.exists()) usersData.push({ uid: snap.id, ...snap.data() } as UserProfileData); });
            setListUsers(usersData);
        } catch (error) { console.error(error); } finally { setListLoading(false); }
    };
    fetchListUsers();
  }, [activeList, uidToFetch]);

  // --- FUNKCJE EDYCJI ---
  const handleEditChange = (field: string, value: any) => {
      setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleEditTag = (tag: string) => {
      const currentTags = editForm.tags;
      if (currentTags.includes(tag)) {
          handleEditChange('tags', currentTags.filter(t => t !== tag));
      } else {
          handleEditChange('tags', [...currentTags, tag]);
      }
  };

  const handleSaveProfile = async () => {
      if (!auth.currentUser || !isOwnProfile) return;
      setSaving(true);
      try {
          const userRef = doc(db, "users", auth.currentUser.uid);
          await updateDoc(userRef, {
              displayName: editForm.displayName,
              location: editForm.location,
              photoURL: editForm.photoURL,
              bio: editForm.bio, // Zapisz bio
              tags: editForm.tags
          });
          
          // Aktualizuj lokalny stan profilu
          setProfile(prev => prev ? ({ ...prev, ...editForm }) : null);
          setIsEditing(false);
      } catch (error) {
          console.error("Error saving profile:", error);
          alert("Failed to save profile.");
      } finally {
          setSaving(false);
      }
  };

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
      } catch (error) { console.error(error); } finally { setFollowLoading(false); }
  };

  const openList = (type: 'followers' | 'following') => setActiveList(type);
  const handleListUserClick = (uid: string) => { setActiveList(null); onUserClick(uid); };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-teal-500" size={32} /></div>;
  if (!profile) return <div className="text-center py-20 text-gray-500 dark:text-gray-400">User not found</div>;

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in duration-500 relative pb-10">
      
      {/* MODAL EDYCJI */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in" onClick={() => setIsEditing(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Edit Profile</h3>
                    <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400"><X size={20} /></button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
                        <input 
                            type="text" 
                            value={editForm.displayName} 
                            onChange={e => handleEditChange('displayName', e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
                        <textarea
                            value={editForm.bio}
                            onChange={e => handleEditChange('bio', e.target.value)}
                            placeholder="Tell us something about yourself..."
                            rows={3}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 resize-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                value={editForm.location} 
                                onChange={e => handleEditChange('location', e.target.value)}
                                placeholder="City, Country"
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Profile Photo URL</label>
                        <div className="relative">
                            <ImageIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                value={editForm.photoURL} 
                                onChange={e => handleEditChange('photoURL', e.target.value)}
                                placeholder="https://example.com/avatar.jpg"
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                            />
                        </div>
                        {editForm.photoURL && (
                            <img src={editForm.photoURL} alt="Preview" className="w-16 h-16 rounded-full mt-2 object-cover border border-gray-200" onError={(e) => (e.target as HTMLImageElement).src = ''}/>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Interests</label>
                        <div className="flex flex-wrap gap-2">
                            {AVAILABLE_TAGS.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => toggleEditTag(tag)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                        editForm.tags.includes(tag) 
                                        ? 'bg-teal-500 text-white border-teal-500' 
                                        : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-teal-300'
                                    }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900">
                    <button 
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-medium shadow-md flex items-center gap-2"
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> Save Changes</>}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL LISTY USERÓW */}
      {activeList && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setActiveList(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <h3 className="font-bold text-lg capitalize text-gray-900 dark:text-white">{activeList}</h3>
                    <button onClick={() => setActiveList(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400"><X size={20} /></button>
                </div>
                <div className="overflow-y-auto p-2 flex-1">
                    {listLoading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-teal-500" /></div> : listUsers.length > 0 ? (
                        <div className="space-y-1">
                            {listUsers.map(u => (
                                <div key={u.uid} onClick={() => u.uid && handleListUserClick(u.uid)} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer transition-colors group">
                                    <img src={u.photoURL} alt={u.displayName} className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-600" />
                                    <div className="flex-1">
                                        <div className="font-bold text-gray-900 dark:text-white text-sm">{u.displayName}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                                    </div>
                                    <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 group-hover:text-teal-500 transition-colors" />
                                </div>
                            ))}
                        </div>
                    ) : <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">No users found in this list.</div>}
                </div>
            </div>
        </div>
      )}

      {/* HEADER PROFILU */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 dark:bg-gray-800 dark:border-gray-700">
        <div className={`h-32 bg-gradient-to-r ${isOwnProfile ? 'from-teal-400 to-blue-500' : 'from-orange-400 to-pink-500'}`}></div>
        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-4">
            <img src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`} alt={profile.displayName} className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover bg-white dark:border-gray-800" />
            {isOwnProfile ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                <Edit3 size={16} /> Edit Profile
              </button>
            ) : (
              <button onClick={handleToggleFollow} disabled={followLoading} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer shadow-sm ${isFollowing ? 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600' : 'bg-teal-500 hover:bg-teal-600 text-white'}`}>
                {followLoading ? <Loader2 size={16} className="animate-spin" /> : isFollowing ? <><Check size={16} /> Following</> : <><UserPlus size={16} /> Follow</>}
              </button>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{profile.displayName}</h1>
            <p className="text-gray-500 mb-2 dark:text-gray-400">{isOwnProfile ? profile.email : `@${profile.displayName.toLowerCase().replace(/\s/g, '')}`}</p>
            
            {/* Wyświetlanie Bio */}
            {profile.bio && (
                <p className="text-gray-700 dark:text-gray-300 mb-4 text-sm leading-relaxed max-w-lg">
                    {profile.bio}
                </p>
            )}

            <div className="flex gap-6 mb-6 border-y border-gray-100 py-4 dark:border-gray-700">
                <button onClick={() => openList('followers')} className="flex items-center gap-2 group hover:opacity-80 transition-opacity cursor-pointer">
                    <span className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-teal-500 transition-colors">{followersCount}</span>
                    <span className="text-gray-500 text-sm dark:text-gray-400">Followers</span>
                </button>
                <button onClick={() => openList('following')} className="flex items-center gap-2 group hover:opacity-80 transition-opacity cursor-pointer">
                    <span className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-teal-500 transition-colors">{followingCount}</span>
                    <span className="text-gray-500 text-sm dark:text-gray-400">Following</span>
                </button>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-2 dark:text-gray-400">
              <div className="flex items-center gap-1"><MapPin size={16} />{profile.location || "Earth"}</div>
              <div className="flex items-center gap-1"><Calendar size={16} />Joined {profile.createdAt ? new Date(profile.createdAt).getFullYear() : new Date().getFullYear()}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-6"><Tag className="text-orange-500" size={20} /><h2 className="text-xl font-bold text-gray-900 dark:text-white">Interests & Hobbies</h2></div>
        {profile.tags && profile.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profile.tags.map((tag) => <span key={tag} className="px-4 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-full text-sm font-medium capitalize dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">{tag}</span>)}
          </div>
        ) : <p className="text-gray-400 italic">No interests selected yet.</p>}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-6"><BarChart2 className="text-teal-500" size={20} /><h2 className="text-xl font-bold text-gray-900 dark:text-white">Monthly Activity</h2></div>
        <div className="h-48 flex items-end justify-between gap-2 md:gap-4 mt-8">
            {weeklyStats.map((stat, idx) => (
                <div key={idx} className="flex flex-col justify-end h-full w-full relative group">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity mb-2 bg-gray-900 text-white text-xs py-1 px-2 rounded absolute bottom-full left-1/2 -translate-x-1/2 pointer-events-none z-10 whitespace-nowrap">{stat.count} activities</div>
                    <div className="w-full bg-teal-500 dark:bg-teal-400 rounded-t-md transition-all duration-500 hover:bg-teal-600 dark:hover:bg-teal-300" style={{ height: `${Math.max(stat.height, 2)}%` }}></div>
                    <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 font-medium text-center">{stat.label}</div>
                </div>
            ))}
        </div>
      </div>

      <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 px-1"><Activity className="text-teal-500" /> Recent Activities</h2>
          {activitiesLoading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-teal-500" size={32} /></div> : userActivities.length > 0 ? (
              <div className="space-y-6">
                  {userActivities.map(post => <ActivityCard key={post.id} post={post} onUserClick={onUserClick} onActivityClick={onActivityClick} />)}
              </div>
          ) : <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">User has no recent activities.</div>}
      </div>
    </div>
  );
};

export default Profile;