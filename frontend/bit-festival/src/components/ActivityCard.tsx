import { useState, useEffect } from 'react';
import { 
  MapPin, 
  MoreHorizontal, 
  Clock, 
  Heart, 
  MessageCircle, 
  Share2,
  Send,
  CornerDownRight,
  Users,
  Check // Import Check icon
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
  onUserClick?: (uid: string) => void;
  onActivityClick?: (activityId: string) => void;
}

interface Comment {
  id: string;
  text: string;
  user_display_name: string;
  user_id: string;
  timestamp: any;
}

const ActivityCard = ({ post, onUserClick = () => {}, onActivityClick = () => {} }: ActivityCardProps) => {
  const [isLiked, setIsLiked] = useState(post.social.userLiked || false);
  const [likesCount, setLikesCount] = useState(post.social.likes);
  const [commentsCount, setCommentsCount] = useState(post.social.comments);
  
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  
  // Stan dla potwierdzenia skopiowania linku
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsLiked(post.social.userLiked || false);
    setLikesCount(post.social.likes);
    setCommentsCount(post.social.comments);
  }, [post]);

  const handleToggleLike = async () => {
    if (!auth.currentUser) return;
    const previousLiked = isLiked;
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
      setLikesCount(likesCount);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation(); // Zapobiegamy otwarciu szczegółów przy kliknięciu Share
    
    const url = `${window.location.origin}?activityId=${post.id}`;
    
    // Fallback dla clipboardu (działa w większości przeglądarek i iframe'ów)
    const textArea = document.createElement("textarea");
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset po 2 sekundach
    } catch (err) {
      console.error('Unable to copy', err);
    }
    document.body.removeChild(textArea);
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const q = query(collection(db, "activities", post.id, "comments"), orderBy("timestamp", "asc"));
      const querySnapshot = await getDocs(q);
      const loadedComments: Comment[] = [];
      querySnapshot.forEach((doc) => loadedComments.push({ id: doc.id, ...doc.data() } as Comment));
      setComments(loadedComments);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoadingComments(false);
    }
  };

  const toggleCommentsSection = () => {
    if (!showComments) fetchComments();
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
      setComments([...comments, { id: docRef.id, ...commentData, timestamp: new Date() }]);
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6 transition-all hover:shadow-md dark:bg-gray-800 dark:border-gray-700">
      <div className="p-4 flex justify-between items-start">
        <div className="flex gap-3">
          <img 
            src={post.user.avatar} 
            alt={post.user.name} 
            onClick={(e) => { e.stopPropagation(); onUserClick && onUserClick(post.user.id || 'unknown'); }}
            className="w-10 h-10 rounded-full object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 
                onClick={(e) => { e.stopPropagation(); onUserClick && onUserClick(post.user.id || 'unknown'); }}
                className="font-semibold text-gray-900 cursor-pointer hover:underline dark:text-gray-100"
              >
                {post.user.name}
              </h3>
              <span className={`text-xs px-2 py-0.5 rounded text-white font-medium capitalize ${
                post.type === 'running' ? 'bg-blue-500' : 
                post.type === 'cycling' ? 'bg-orange-500' : 'bg-teal-500'
              }`}>
                {post.type}
              </span>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 dark:text-gray-400">
              {post.timestamp} • <MapPin size={12} /> {post.user.location}
            </p>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-50 cursor-pointer">
          <MoreHorizontal size={20} />
        </button>
      </div>

      {post.image && (
        <div 
            onClick={() => onActivityClick && onActivityClick(post.id)}
            className="bg-gray-100 w-full h-64 md:h-96 flex items-center justify-center text-gray-400 relative overflow-hidden group cursor-pointer"
        >
           <img src={post.image} alt="Activity" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        </div>
      )}

      <div className="p-5">
        <div onClick={() => onActivityClick && onActivityClick(post.id)} className="cursor-pointer">
            <h2 className="text-lg font-bold text-gray-900 mb-2 dark:text-white hover:text-teal-600 transition-colors">{post.title}</h2>
            <p className="text-gray-600 text-sm mb-4 leading-relaxed dark:text-gray-300">{post.description}</p>

            {post.partners && post.partners.length > 0 && (
                <div className="flex items-center gap-2 mb-4 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-700/50">
                    <div className="flex -space-x-2 overflow-hidden px-1">
                        {post.partners.map((partner) => (
                            <img 
                                key={partner.id} 
                                src={partner.avatar} 
                                alt={partner.name}
                                title={partner.name}
                                onClick={(e) => { e.stopPropagation(); onUserClick && onUserClick(partner.id); }}
                                className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-800 cursor-pointer hover:scale-110 transition-transform object-cover"
                            />
                        ))}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                        Done with {post.partners.length} others
                    </span>
                </div>
            )}

            {post.stats && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                    <Clock size={16} className="text-gray-400"/> 
                    <span className="text-sm text-gray-500 dark:text-gray-400">Duration:</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">{post.stats.duration}</span>
                    </div>
                    {post.stats.calories && post.stats.calories !== '-' && (
                    <div className="text-sm font-medium text-teal-600 dark:text-teal-400">
                        {post.stats.calories}
                    </div>
                    )}
                </div>
            </div>
            )}
        </div>
        
        <hr className="border-gray-100 mb-4 dark:border-gray-700" />

        <div className="flex items-center justify-between text-gray-500 text-sm">
          <div className="flex gap-4">
             <button onClick={handleToggleLike} className={`flex items-center gap-1.5 transition-colors cursor-pointer group ${isLiked ? 'text-red-500' : 'hover:text-red-500'}`}>
               <Heart size={18} className={`transition-transform group-active:scale-125 ${isLiked ? 'fill-current' : ''}`} /> {likesCount}
             </button>
             <button onClick={toggleCommentsSection} className={`flex items-center gap-1.5 transition-colors cursor-pointer hover:text-blue-500 ${showComments ? 'text-blue-500' : ''}`}>
               <MessageCircle size={18} /> {commentsCount}
             </button>
          </div>
          <button 
            onClick={handleShare} 
            className={`flex items-center gap-1 transition-colors cursor-pointer ${copied ? 'text-green-500' : 'hover:text-gray-800'}`}
            title="Copy link"
          >
            {copied ? <Check size={18} /> : <Share2 size={18} />}
          </button>
        </div>

        {!showComments && post.social.lastComment && (
            <div onClick={toggleCommentsSection} className="mt-3 bg-gray-50 rounded-lg p-3 text-sm flex gap-2 items-start cursor-pointer hover:bg-gray-100 transition-colors border-l-4 border-teal-500 dark:bg-gray-700 dark:hover:bg-gray-600">
                <CornerDownRight size={16} className="text-gray-400 mt-1 shrink-0" />
                <div>
                    <span className="font-semibold text-gray-900 mr-2 dark:text-white">{post.social.lastComment.user_display_name}</span>
                    <span className="text-gray-600 line-clamp-1 dark:text-gray-300">{post.social.lastComment.text}</span>
                </div>
                <span className="text-xs text-gray-400 ml-auto shrink-0">{formatTime(post.social.lastComment.timestamp)}</span>
            </div>
        )}

        {showComments && (
          <div className="mt-4 pt-4 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200 dark:border-gray-700">
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-1">
              {loadingComments ? <div className="text-center py-4 text-gray-400 text-xs">Loading comments...</div> : comments.length > 0 ? comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 p-3 rounded-lg text-sm dark:bg-gray-700">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{comment.user_display_name}</span>
                      <span className="text-xs text-gray-400">{formatTime(comment.timestamp)}</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300">{comment.text}</p>
                  </div>
                )) : <div className="text-center py-2 text-gray-400 text-xs italic">No comments yet.</div>}
            </div>
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..." className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              <button type="submit" disabled={!newComment.trim() || submittingComment} className="bg-teal-500 text-white p-2 rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"><Send size={16} /></button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityCard;