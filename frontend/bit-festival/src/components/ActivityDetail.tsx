import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { ArrowLeft, MapPin, Clock, Heart, MessageCircle, Send, Calendar, Share2, Timer, Flame } from 'lucide-react';
import type { ActivityPost } from '../types';

interface ActivityDetailProps {
  activityId: string;
  onBack: () => void;
  onUserClick: (uid: string) => void;
}

const ActivityDetail = ({ activityId, onBack, onUserClick }: ActivityDetailProps) => {
  const [post, setPost] = useState<ActivityPost | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  // 1. Pobieranie danych aktywności
  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const docRef = doc(db, "activities", activityId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          // Mapowanie danych z Firestore na nasz typ ActivityPost
          // (Uproszczone mapowanie, w produkcji warto wydzielić do helpera)
          const mappedPost: any = {
            id: docSnap.id,
            user: {
                id: data.participants?.[0] || 'unknown',
                name: "Loading...", // Nazwę można by pobrać z osobnego fetch'a userów
                avatar: `https://ui-avatars.com/api/?name=${data.participants?.[0] || 'U'}&background=random&color=fff`,
                location: data.location ? "Checked in" : ""
            },
            type: data.tags?.[0] || 'other',
            timestamp: data.time_start ? new Date(data.time_start.toDate()).toLocaleString() : '',
            title: data.description ? "Activity Details" : "Activity",
            description: data.description || "",
            image: data.image, // Jeśli masz obsługę obrazków
            stats: {
                duration: "Active",
                distance: "-",
                pace: "-",
                calories: "-"
            },
            social: { likes: 0, comments: 0 }
          };
          
          // Szybka poprawka na nazwę usera (pobranie z pola display name jeśli istnieje w act)
          // W twoim modelu danych user name jest w 'users', tu robimy fallback
          if(data.participants && data.participants.length > 0) {
             const userDoc = await getDoc(doc(db, "users", data.participants[0]));
             if(userDoc.exists()) {
                 mappedPost.user.name = userDoc.data().displayName;
                 mappedPost.user.avatar = userDoc.data().photoURL;
             }
          }

          setPost(mappedPost);
        }
      } catch (error) {
        console.error("Error fetching activity:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [activityId]);

  // 2. Nasłuchiwanie komentarzy (Real-time)
  useEffect(() => {
    const q = query(collection(db, "activities", activityId, "comments"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComments(loadedComments);
    });
    return () => unsubscribe();
  }, [activityId]);

  // 3. Nasłuchiwanie lajków (Real-time)
  useEffect(() => {
    const q = query(collection(db, "activities", activityId, "likes"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLikesCount(snapshot.size);
      if (auth.currentUser) {
        setIsLiked(snapshot.docs.some(doc => doc.id === auth.currentUser?.uid));
      }
    });
    return () => unsubscribe();
  }, [activityId]);

  const handleToggleLike = async () => {
    if (!auth.currentUser || !post) return;
    const likeRef = doc(db, "activities", post.id, "likes", auth.currentUser.uid);
    if (isLiked) {
      await deleteDoc(likeRef);
    } else {
      await setDoc(likeRef, {
        user_id: auth.currentUser.uid,
        timestamp: serverTimestamp()
      });
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !auth.currentUser) return;

    await addDoc(collection(db, "activities", activityId, "comments"), {
      user_id: auth.currentUser.uid,
      user_display_name: auth.currentUser.displayName || "User",
      text: newComment.trim(),
      timestamp: serverTimestamp()
    });
    setNewComment("");
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div></div>;
  if (!post) return <div className="text-center py-20">Activity not found</div>;

  return (
    <div className="bg-white min-h-screen dark:bg-gray-900 animate-in slide-in-from-right duration-300">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 p-4 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
          <ArrowLeft size={24} className="text-gray-700 dark:text-gray-200" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Activity Details</h1>
      </div>

      <div className="max-w-3xl mx-auto pb-24">
        {/* Main Content */}
        <div className="p-6">
          {/* User Header */}
          <div className="flex items-center gap-4 mb-6">
            <img 
              src={post.user.avatar} 
              alt={post.user.name} 
              onClick={() => onUserClick(post.user.id)}
              className="w-16 h-16 rounded-full object-cover border-2 border-gray-100 cursor-pointer"
            />
            <div>
              <h2 onClick={() => onUserClick(post.user.id)} className="text-xl font-bold text-gray-900 dark:text-white cursor-pointer hover:underline">
                {post.user.name}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1">
                {post.timestamp} • <MapPin size={12} /> {post.user.location}
              </p>
            </div>
          </div>

          {/* Activity Body */}
          <div className="mb-8">
            <div className="flex gap-2 mb-4">
               <span className="px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-sm font-medium dark:bg-teal-900 dark:text-teal-200 capitalize">
                 {post.type}
               </span>
            </div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">{post.title}</h3>
            <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
              {post.description}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl">
             <div>
                <div className="text-gray-400 text-xs uppercase font-bold mb-1 flex items-center gap-1"><Clock size={12}/> Duration</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{post.stats?.duration || "-"}</div>
             </div>
             <div>
                <div className="text-gray-400 text-xs uppercase font-bold mb-1 flex items-center gap-1"><MapPin size={12}/> Distance</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{post.stats?.distance || "-"}</div>
             </div>
             <div>
                <div className="text-gray-400 text-xs uppercase font-bold mb-1 flex items-center gap-1"><Timer size={12}/> Pace</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{post.stats?.pace || "-"}</div>
             </div>
             <div>
                <div className="text-gray-400 text-xs uppercase font-bold mb-1 flex items-center gap-1"><Flame size={12}/> Calories</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{post.stats?.calories || "-"}</div>
             </div>
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-between border-t border-b border-gray-100 dark:border-gray-800 py-4 mb-8">
             <div className="flex gap-6">
                <button onClick={handleToggleLike} className={`flex items-center gap-2 text-lg font-medium transition-colors ${isLiked ? 'text-red-500' : 'text-gray-600 dark:text-gray-400 hover:text-red-500'}`}>
                   <Heart size={24} className={isLiked ? 'fill-current' : ''} /> {likesCount}
                </button>
                <div className="flex items-center gap-2 text-lg font-medium text-gray-600 dark:text-gray-400">
                   <MessageCircle size={24} /> {comments.length}
                </div>
             </div>
             <button className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <Share2 size={24} />
             </button>
          </div>

          {/* Comments Section (Full View) */}
          <div>
            <h3 className="text-lg font-bold mb-6 text-gray-900 dark:text-white">Comments</h3>
            
            <div className="space-y-6 mb-24">
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 font-bold text-sm shrink-0">
                      {comment.user_display_name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div>
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl rounded-tl-none">
                        <div className="flex justify-between items-baseline mb-1">
                           <span className="font-bold text-gray-900 dark:text-white text-sm">{comment.user_display_name}</span>
                           <span className="text-xs text-gray-400 ml-4">
                             {comment.timestamp?.toDate ? comment.timestamp.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}
                           </span>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300">{comment.text}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  <p className="text-gray-500">No comments yet. Start the conversation!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Comment Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 p-4 md:pl-72">
         <div className="max-w-3xl mx-auto flex gap-3">
            <input 
              type="text" 
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..." 
              className="flex-1 bg-gray-100 dark:bg-gray-800 border-0 rounded-xl px-4 py-3 focus:ring-2 focus:ring-teal-500 dark:text-white"
            />
            <button 
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="bg-teal-500 text-white p-3 rounded-xl hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={20} />
            </button>
         </div>
      </div>
    </div>
  );
};

export default ActivityDetail;