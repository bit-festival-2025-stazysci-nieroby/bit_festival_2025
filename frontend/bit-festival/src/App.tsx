import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db } from './lib/firebase';
import { MoreHorizontal, Loader2, AlertCircle } from 'lucide-react';

import Sidebar from './components/Sidebar';
import ActivityCard from './components/ActivityCard';
import Login from './components/Login';
import Onboarding from './components/Onboarding';
import Profile from './components/Profile';

import { mockPosts } from './lib/mockData';
import type { ActivityPost } from './types';

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

type View = 'feed' | 'explore' | 'profile' | 'notifications' | 'settings';

function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  const [posts, setPosts] = useState<ActivityPost[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const [usingOfflineData, setUsingOfflineData] = useState(false);

  const [currentView, setCurrentView] = useState<View>('feed');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists() && userDocSnap.data().isOnboardingCompleted) {
            setShowOnboarding(false);
          } else {
            setShowOnboarding(true);
          }
        } catch (error) {
          console.error(error);
          setShowOnboarding(true); 
        }
      } else {
        setUser(null);
        setShowOnboarding(false);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && !showOnboarding && currentView === 'feed') {
      fetchFeed();
    }
  }, [user, showOnboarding, currentView]);

  const fetchFeed = async () => {
    setIsFeedLoading(true);
    setUsingOfflineData(false);

    try {
        const token = await auth.currentUser?.getIdToken();
        const response = await fetch(`${API_URL}/api/feed/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });

        if (!response.ok) {
            throw new Error(`Backend error: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.feed || data.feed.length === 0) {
           setPosts(mockPosts);
           setUsingOfflineData(true); 
        } else {
           const mappedPosts: ActivityPost[] = data.feed.map((item: any) => ({
                id: item.id,
                user: {
                    name: item.participants && item.participants.includes(user?.uid) 
                          ? "You" 
                          : `User ${item.participants?.[0]?.slice(0, 4) || 'Unknown'}`,
                    avatar: `https://ui-avatars.com/api/?name=${item.participants?.[0] || 'U'}&background=random&color=fff`,
                    location: item.location ? "Checked in" : "Unknown Location"
                },
                type: item.tags?.[0] || 'other',
                timestamp: item.time_start ? new Date(item.time_start).toLocaleString() : 'Recently',
                title: item.tags?.length > 0 ? `${item.tags[0].charAt(0).toUpperCase() + item.tags[0].slice(1)} Session` : 'Activity',
                description: item.description || "",
                stats: {
                    duration: item.time_end ? "Completed" : "Active",
                    distance: "-",
                    pace: "-",
                    calories: "-"
                },
                social: {
                    likes: item.likes_count || 0,
                    comments: item.comments_count || 0,
                    taggedUsers: []
                }
           }));
           setPosts(mappedPosts);
        }

    } catch (error) {
        console.warn(error);
        setPosts(mockPosts);
        setUsingOfflineData(true);
    } finally {
        setIsFeedLoading(false);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setCurrentView('feed');
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-teal-500" size={48} />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />
      
      <main className="flex-1 md:ml-64 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="md:hidden flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-gray-800">
              Active<span className="text-teal-500">Connect</span>
            </h1>
            <button className="p-2 text-gray-600">
              <MoreHorizontal size={24} />
            </button>
          </div>

          {currentView === 'feed' && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Activity Feed</h1>
                <p className="text-gray-500 mt-1">
                  Welcome back, {user.displayName?.split(' ')[0] || 'User'}! 
                </p>
                
                {usingOfflineData && (
                    <div className="mt-4 bg-amber-50 border border-amber-100 text-amber-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                        <AlertCircle size={16} />
                        <span>Showing local demo data.</span>
                    </div>
                )}
              </div>
              
              {isFeedLoading ? (
                  <div className="flex justify-center py-20">
                      <Loader2 className="animate-spin text-teal-500" size={32} />
                  </div>
              ) : (
                <div className="space-y-6">
                    {posts.map((post) => (
                      <ActivityCard key={post.id} post={post} />
                    ))}
                    
                    {posts.length === 0 && !isFeedLoading && (
                        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                          <p>No activities found.</p>
                        </div>
                    )}
                </div>
              )}
            </>
          )}

          {currentView === 'explore' && (
             <div className="text-center py-20 text-gray-400">Explore Coming Soon</div>
          )}

          {currentView === 'profile' && (
            <Profile />
          )}

          {(currentView === 'notifications' || currentView === 'settings') && (
            <div className="text-center py-20 text-gray-400">
              <h2 className="text-2xl font-bold mb-2 capitalize">{currentView}</h2>
              <p>This section is coming soon!</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;