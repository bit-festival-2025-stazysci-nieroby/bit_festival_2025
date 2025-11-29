import { useState, useEffect } from 'react';
import { Search, Loader2, Tag, Frown } from 'lucide-react';
import ActivityCard from './ActivityCard';
import { auth } from '../lib/firebase';
import type { ActivityPost, User } from '../types'; // Zakładam, że masz types.ts, jeśli nie - użyję any tymczasowo

// Upewnij się, że masz VITE_API_URL w .env
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const POPULAR_TAGS = [
  "running", "cycling", "gym", "yoga", "hiking", 
  "football", "tennis", "swimming", "basketball",
  "coffee", "study", "gaming"
];

const Explore = () => {
  const [activeTag, setActiveTag] = useState<string>("running");
  const [activities, setActivities] = useState<ActivityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivitiesByTag(activeTag);
  }, [activeTag]);

  const fetchActivitiesByTag = async (tag: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/activities/by-tag/?tag=${tag}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }

      const data = await response.json();
  
      const mappedActivities: ActivityPost[] = data.activities.map((item: any) => ({
        id: item.id,
        user: {
            name: item.participants && item.participants.length > 0 ? "User " + item.participants[0].slice(0, 5) : "Unknown User",
            avatar: `https://ui-avatars.com/api/?name=${item.participants?.[0] || 'User'}&background=random`,
            location: "Unknown"
        },
        type: item.tags?.[0] || 'other',
        timestamp: item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Recently',
        title: item.tags?.join(', ') || 'Activity',
        description: item.description || 'No description provided.',
        image: undefined,
        stats: undefined, 
        social: {
            likes: item.likes_count || 0,
            comments: item.comments_count || 0,
            taggedUsers: []
        }
      }));

      setActivities(mappedActivities);
    } catch (err) {
      console.error(err);
      setError("Could not load activities. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Explore</h1>
        
        {/* Search / Filter Bar */}
        <div className="relative mb-6">
          <input 
            type="text" 
            placeholder="Search for tags (e.g. yoga, gym)..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    setActiveTag(e.currentTarget.value.toLowerCase());
                }
            }}
          />
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
        </div>

        {/* Horizontal Tags Scroll */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          {POPULAR_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border cursor-pointer ${
                activeTag === tag
                  ? 'bg-teal-600 text-white border-teal-600 shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:bg-teal-50'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 className="animate-spin mb-3 text-teal-500" size={40} />
            <p>Looking for activities...</p>
          </div>
        ) : error ? (
           <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center border border-red-100">
             <p>{error}</p>
             <button 
                onClick={() => fetchActivitiesByTag(activeTag)}
                className="mt-2 text-sm font-bold underline hover:text-red-800"
             >
                Try Again
             </button>
           </div>
        ) : activities.length > 0 ? (
          activities.map((post) => (
            <ActivityCard key={post.id} post={post} />
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="flex justify-center mb-4">
                <div className="bg-gray-50 p-4 rounded-full">
                    <Frown className="text-gray-400" size={48} />
                </div>
            </div>
            <h3 className="text-lg font-bold text-gray-900">No activities found</h3>
            <p className="text-gray-500 mt-1 max-w-xs mx-auto">
              We couldn't find any activities with the tag <span className="font-bold text-teal-600">#{activeTag}</span>.
            </p>
            <p className="text-sm text-gray-400 mt-4">Try searching for something else!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Explore;