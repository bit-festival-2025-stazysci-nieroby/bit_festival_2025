import { useState, useEffect } from 'react';
import { 
  MapPin, 
  MoreHorizontal, 
  Clock, 
  Timer, 
  Flame, 
  Heart, 
  MessageCircle, 
  Share2,
  Send,
  CornerDownRight
} from 'lucide-react';
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { ActivityPost } from '../types';

interface ActivityCardProps {
  post: ActivityPost;
}

interface Comment {
  id: string;
  text: string;
  user_display_name: string;
  user_id: string;
  timestamp: any;
}

const ActivityCard = ({ post }: ActivityCardProps) => {
  const [isLiked, setIsLiked] = useState(post.social.userLiked || false);
  const [likesCount, setLikesCount] = useState(post.social.likes);
  const [commentsCount, setCommentsCount] = useState(post.social.comments);
  
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    setIsLiked(post.social.userLiked || false);
    setLikesCount(post.social.likes);
    setCommentsCount(post.social.comments);
  }, [post]);

  const handleToggleLike = async () => {
    if (!auth.currentUser) return;

    const previousLiked = isLiked;
    const previousCount = likesCount;

    setIsLiked(!isLiked);
    setLikesCount(prev => isLiked ? prev - 1 : prev + 1);

    try {
      const likeRef = doc(db, "activities", post.id, "likes", auth.currentUser.uid);

      if (previousLiked) {
        await deleteDoc(likeRef);
      } else {
        await setDoc(likeRef, {
          user_id: auth.currentUser.uid,
          user_display_name: auth.currentUser.displayName || "User",
          timestamp: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const q = query(
        collection(db, "activities", post.id, "comments"),
        orderBy("timestamp", "asc")
      );
      const querySnapshot = await getDocs(q);
      const loadedComments: Comment[] = [];
      querySnapshot.forEach((doc) => {
        loadedComments.push({ id: doc.id, ...doc.data() } as Comment);
      });
      setComments(loadedComments);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoadingComments(false);
    }
  };

  const toggleCommentsSection = () => {
    if (!showComments) {
      fetchComments();
    }
    setShowComments(!showComments);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !auth.currentUser) return;

    setSubmittingComment(true);
    try {
      const commentData = {
        user_id: auth.currentUser.uid,
        user_display_name: auth.currentUser.displayName || "User",
        text: newComment.trim(),
        timestamp: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, "activities", post.id, "comments"), commentData);

      const newCommentObj: Comment = {
        id: docRef.id,
        ...commentData,
        timestamp: new Date()
      };

      setComments([...comments, newCommentObj]);
      setCommentsCount(prev => prev + 1);
      setNewComment("");
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatTime = (ts: any) => {
    if (!ts) return '';
    if (ts.toDate) return ts.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    if (typeof ts === 'string') return new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    return ts.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6 transition-all hover:shadow-md">
      {/* Header */}
      <div className="p-4 flex justify-between items-start">
        <div className="flex gap-3">
          <img 
            src={post.user.avatar} 
            alt={post.user.name} 
            className="w-10 h-10 rounded-full object-cover border border-gray-200"
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{post.user.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded text-white font-medium capitalize ${
                post.type === 'running' ? 'bg-blue-500' : 
                post.type === 'cycling' ? 'bg-orange-500' : 'bg-teal-500'
              }`}>
                {post.type}
              </span>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              {post.timestamp} • <MapPin size={12} /> {post.user.location}
            </p>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-50 cursor-pointer">
          <MoreHorizontal size={20} />
        </button>
      </div>

      {post.image && (
        <div className="bg-gray-100 w-full h-64 md:h-96 flex items-center justify-center text-gray-400 relative overflow-hidden group">
           <img 
             src={post.image} 
             alt="Activity" 
             className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
           />
        </div>
      )}

      <div className="p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-2">{post.title}</h2>
        <p className="text-gray-600 text-sm mb-4 leading-relaxed">
          {post.description}
        </p>

        {post.stats && (
          <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-400 flex items-center gap-1 mb-1"><Clock size={12}/> Duration</div>
              <div className="font-bold text-gray-800">{post.stats.duration}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 flex items-center gap-1 mb-1"><MapPin size={12}/> Distance</div>
              <div className="font-bold text-gray-800">{post.stats.distance}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 flex items-center gap-1 mb-1"><Timer size={12}/> Pace</div>
              <div className="font-bold text-gray-800">{post.stats.pace}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 flex items-center gap-1 mb-1"><Flame size={12}/> Calories</div>
              <div className="font-bold text-gray-800">{post.stats.calories}</div>
            </div>
          </div>
        )}
        
        <hr className="border-gray-100 mb-4" />

        <div className="flex items-center justify-between text-gray-500 text-sm">
          <div className="flex gap-4">
             <button 
                onClick={handleToggleLike}
                className={`flex items-center gap-1.5 transition-colors cursor-pointer group ${
                    isLiked ? 'text-red-500' : 'hover:text-red-500'
                }`}
             >
               <Heart size={18} className={`transition-transform group-active:scale-125 ${isLiked ? 'fill-current' : ''}`} /> 
               {likesCount}
             </button>

             <button 
                onClick={toggleCommentsSection}
                className={`flex items-center gap-1.5 transition-colors cursor-pointer hover:text-blue-500 ${showComments ? 'text-blue-500' : ''}`}
             >
               <MessageCircle size={18} /> {commentsCount}
             </button>
          </div>
          <button className="hover:text-gray-800 transition-colors cursor-pointer">
            <Share2 size={18} />
          </button>
        </div>

        {/* --- LATEST COMMENT PREVIEW (Jeśli sekcja zwinięta) --- */}
        {!showComments && post.social.lastComment && (
            <div 
                onClick={toggleCommentsSection}
                className="mt-3 bg-gray-50 rounded-lg p-3 text-sm flex gap-2 items-start cursor-pointer hover:bg-gray-100 transition-colors border-l-4 border-teal-500"
            >
                <CornerDownRight size={16} className="text-gray-400 mt-1 shrink-0" />
                <div>
                    <span className="font-semibold text-gray-900 mr-2">
                        {post.social.lastComment.user_display_name}
                    </span>
                    <span className="text-gray-600 line-clamp-1">
                        {post.social.lastComment.text}
                    </span>
                </div>
                <span className="text-xs text-gray-400 ml-auto shrink-0">
                    {formatTime(post.social.lastComment.timestamp)}
                </span>
            </div>
        )}

        {/* --- SEKCJA KOMENTARZY (ROZWIJANA) --- */}
        {showComments && (
          <div className="mt-4 pt-4 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
            
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-1">
              {loadingComments ? (
                <div className="text-center py-4 text-gray-400 text-xs">Loading comments...</div>
              ) : comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 p-3 rounded-lg text-sm">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-semibold text-gray-800">{comment.user_display_name}</span>
                      <span className="text-xs text-gray-400">
                         {formatTime(comment.timestamp)}
                      </span>
                    </div>
                    <p className="text-gray-600">{comment.text}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-2 text-gray-400 text-xs italic">No comments yet. Be the first!</div>
              )}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2">
              <input 
                type="text" 
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..." 
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all"
              />
              <button 
                type="submit" 
                disabled={!newComment.trim() || submittingComment}
                className="bg-teal-500 text-white p-2 rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

export default ActivityCard;