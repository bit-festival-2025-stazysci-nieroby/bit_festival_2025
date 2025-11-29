import { 
  MapPin, 
  MoreHorizontal, 
  Clock, 
  Timer, 
  Flame, 
  Heart, 
  MessageCircle, 
  Share2 
} from 'lucide-react';
import type { ActivityPost, User } from '../types';

interface ActivityCardProps {
  post: ActivityPost;
}

const ActivityCard = ({ post }: ActivityCardProps) => {
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
                post.type === 'running' ? 'bg-blue-500' : 'bg-orange-500'
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

      {/* Image */}
      <div className="bg-gray-100 w-full h-64 md:h-80 flex items-center justify-center text-gray-400 relative overflow-hidden group">
        {post.image ? (
           <img 
             src={post.image} 
             alt="Activity" 
             className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
           />
        ) : (
           <span>No image available</span>
        )}
      </div>

      {/* Body */}
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

        {post.partners && post.partners.length > 0 && (
          <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-3 flex items-center gap-3 mb-4">
            <div className="flex -space-x-2">
               {post.partners.map((partner: User, idx: number) => (
                 <img key={idx} src={partner.avatar} alt={partner.name} className="w-8 h-8 rounded-full border-2 border-white ring-1 ring-white" />
               ))}
            </div>
            <div className="text-sm">
                <span className="text-gray-500">Done with </span>
                <span className="text-orange-500 font-medium">
                  {post.social.taggedUsers?.join(', ')}
                </span>
            </div>
          </div>
        )}
        
        <hr className="border-gray-100 mb-4" />

        <div className="flex items-center justify-between text-gray-500 text-sm">
          <div className="flex gap-4">
             <button className="flex items-center gap-1.5 hover:text-red-500 transition-colors cursor-pointer">
               <Heart size={18} /> {post.social.likes}
             </button>
             <button className="flex items-center gap-1.5 hover:text-blue-500 transition-colors cursor-pointer">
               <MessageCircle size={18} /> {post.social.comments}
             </button>
          </div>
          <button className="hover:text-gray-800 transition-colors cursor-pointer">
            <Share2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityCard;