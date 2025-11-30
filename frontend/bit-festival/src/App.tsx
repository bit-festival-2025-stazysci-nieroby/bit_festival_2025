import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db } from './lib/firebase';
import { MoreHorizontal, Loader2, AlertCircle, Moon, Sun, Eye, Monitor, Type, Sparkles, Clock } from 'lucide-react';

import Sidebar from './components/Sidebar';
import ActivityCard from './components/ActivityCard';
import Login from './components/Login';
import LandingPage from './components/LandingPage';
import Onboarding from './components/OnBoarding';
import Profile from './components/Profile';
import Explore from './components/Explore';
import ActivityDetail from './components/ActivityDetail';
import Notifications from './components/Notifications';
import HeroSection from './components/HeroSection';

import { mockPosts } from './lib/mockdata';
import type { ActivityPost } from './types';

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const CACHE_DURATION = 5 * 60 * 1000;

type View = 'feed' | 'explore' | 'profile' | 'notifications' | 'settings' | 'activity_detail';
type FeedMode = 'ai' | 'latest';

function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  const [posts, setPosts] = useState<ActivityPost[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const [usingOfflineData, setUsingOfflineData] = useState(false);
  const [lastFeedFetch, setLastFeedFetch] = useState<number>(0);

  const [feedMode, setFeedMode] = useState<FeedMode>('ai');

  const [currentView, setCurrentView] = useState<View>('feed');
  const [profileTargetUid, setProfileTargetUid] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isHighContrast, setIsHighContrast] = useState(() => localStorage.getItem('contrast') === 'true');
  const [isLargeText, setIsLargeText] = useState(() => localStorage.getItem('largeText') === 'true');

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('contrast', String(isHighContrast));
    localStorage.setItem('largeText', String(isLargeText));
  }, [isDarkMode, isHighContrast, isLargeText]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const activityId = params.get('activityId');
    if (activityId) {
      setSelectedActivityId(activityId);
      setCurrentView('activity_detail');
    }
  }, []);

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
      const now = Date.now();
      fetchFeed();
    }
  }, [user, showOnboarding, currentView, feedMode]);

  const getUserLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 52.2297, lng: 21.0122 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        (error) => {
          console.warn("Location error:", error);
          resolve({ lat: 52.2297, lng: 21.0122 });
        }
      );
    });
  };

  const fetchFeed = async (forceRefresh = false) => {
    if (!forceRefresh && posts.length > 0 && (Date.now() - lastFeedFetch < CACHE_DURATION)) {
       // cache logic if needed
    }

    setIsFeedLoading(true);
    setUsingOfflineData(false);

    try {
        const token = await auth.currentUser?.getIdToken();
        let endpoint = '';

        if (feedMode === 'ai') {
            const { lat, lng } = await getUserLocation();
            endpoint = `${API_URL}/api/feed/ai/?lat=${lat}&lng=${lng}`;
        } else {
            endpoint = `${API_URL}/api/feed/`;
        }
        
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });

        if (!response.ok) throw new Error(`Backend error: ${response.status}`);

        const data = await response.json();
        
        if (!data.feed || data.feed.length === 0) {
           setPosts(mockPosts);
           setUsingOfflineData(true); 
        } else {
           const mappedPosts: ActivityPost[] = data.feed.map((item: any) => {
                const partnersList = item.participants && item.participants.length > 1 
                    ? item.participants.slice(1).map((uid: string) => ({
                        id: uid,
                        name: "Participant",
                        avatar: `https://ui-avatars.com/api/?name=${uid}&background=random&color=fff`,
                        location: ""
                    }))
                    : [];

                return {
                    id: item.id,
                    user: {
                        id: item.participants && item.participants[0] ? item.participants[0] : 'unknown',
                        name: item.participants && item.participants.includes(user?.uid) 
                            ? user?.displayName || "You" 
                            : `User ${item.participants?.[0]?.slice(0, 4) || 'Unknown'}`,
                        avatar: `https://ui-avatars.com/api/?name=${item.participants?.[0] || 'U'}&background=random&color=fff`,
                        location: item.location ? "Checked in" : "Unknown Location"
                    },
                    type: item.tags?.[0] || 'other',
                    timestamp: item.time_start ? new Date(item.time_start).toLocaleString() : 'Recently',
                    title: item.tags?.length > 0 ? `${item.tags[0].charAt(0).toUpperCase() + item.tags[0].slice(1)} Session` : 'Activity',
                    description: item.description || "",
                    partners: partnersList,
                    // TUTAJ PRZYPISUJEMY LOKALIZACJĘ
                    coords: item.location && item.location.lat ? item.location : undefined, 
                    stats: {
                        duration: item.time_end ? "Completed" : "Active",
                        distance: "-",
                        pace: "-",
                        calories: (feedMode === 'ai' && item.ai_score) ? `AI Score: ${Math.round(item.ai_score)}` : "-" 
                    },
                    social: {
                        likes: item.likes_count || 0,
                        comments: item.comments_count || 0,
                        taggedUsers: [],
                        userLiked: item.user_liked, 
                        lastComment: item.last_comment
                    }
                };
           });
           setPosts(mappedPosts);
           setLastFeedFetch(Date.now());
        }

    } catch (error) {
        console.warn("Fetch feed error:", error);
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

  const handleSidebarNavigate = (view: View) => {
      if (view === 'profile') setProfileTargetUid(null);
      setCurrentView(view);
  };

  const handleUserClick = (uid: string) => {
      setProfileTargetUid(uid);
      setCurrentView('profile');
  };

  const handleActivityClick = (activityId: string) => {
      setSelectedActivityId(activityId);
      setCurrentView('activity_detail');
  };

  const handleCreateSuccess = () => {
      setIsCreateModalOpen(false);
      fetchFeed(true);
      setCurrentView('feed');
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="animate-spin text-teal-500" size={48} />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  if (showOnboarding) return <Onboarding onComplete={handleOnboardingComplete} />;

  return (
    <div className={`flex min-h-screen font-sans transition-colors duration-200 ${isDarkMode ? 'dark' : ''} ${isHighContrast ? 'high-contrast' : ''}`}>
      
      <style>{`
        ${isLargeText ? 'html { font-size: 115% !important; }' : ''}
        .dark .bg-white { background-color: #1f2937 !important; color: #f3f4f6 !important; }
        .dark .bg-gray-50 { background-color: #111827 !important; }
        .dark .text-gray-900 { color: #f3f4f6 !important; }
        .dark .text-gray-800 { color: #e5e7eb !important; }
        .dark .text-gray-600, .dark .text-gray-500 { color: #9ca3af !important; }
        .dark .border-gray-100, .dark .border-gray-200 { border-color: #374151 !important; }
        .dark .hover\\:bg-gray-50:hover { background-color: #374151 !important; }
        .dark input { background-color: #374151 !important; color: white !important; border-color: #4b5563 !important; }
        .high-contrast { filter: contrast(120%); }
        .high-contrast .bg-white, .high-contrast .bg-gray-50 { background-color: #000000 !important; }
        .high-contrast, .high-contrast h1, .high-contrast h2, .high-contrast h3, .high-contrast p, .high-contrast span, .high-contrast div { color: #FFFF00 !important; }
        .high-contrast button { border: 2px solid #FFFF00 !important; font-weight: bold !important; }
        .high-contrast .bg-teal-500, .high-contrast .bg-orange-500, .high-contrast .bg-blue-500 { background-color: #000000 !important; border: 2px solid #FFFF00 !important; color: #FFFF00 !important; }
        .high-contrast img { filter: grayscale(100%) contrast(200%); }
        .high-contrast input { background-color: black !important; color: yellow !important; border: 2px solid yellow !important; }
      `}</style>

      {currentView !== 'activity_detail' && (
        <Sidebar 
            currentView={currentView} 
            onNavigate={handleSidebarNavigate} 
            onCreateActivity={() => setIsCreateModalOpen(true)} 
        />
      )}
      
      <main className={`flex-1 p-4 md:p-8 ${currentView !== 'activity_detail' ? 'md:ml-64' : ''} bg-gray-50 dark:bg-gray-900 min-h-screen transition-all duration-300`}>
        <div className={currentView === 'activity_detail' ? 'w-full' : 'max-w-2xl mx-auto'}>
          
          {currentView !== 'activity_detail' && (
            <div className="md:hidden flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Active<span className="text-teal-500">Connect</span>
                </h1>
                <div className="flex gap-2">
                    <button onClick={() => setIsCreateModalOpen(true)} className="p-2 text-teal-500 bg-teal-50 dark:bg-teal-900/30 rounded-full">
                        <MoreHorizontal size={24} />
                    </button>
                </div>
            </div>
          )}

          {currentView === 'feed' && (
            <>
              <HeroSection user={user} />

              <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Latest Activity</h2>

                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shrink-0 self-start sm:self-auto">
                    <button 
                        onClick={() => setFeedMode('ai')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            feedMode === 'ai' 
                            ? 'bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-400 shadow-sm' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <Sparkles size={16} /> AI Smart
                    </button>
                    <button 
                        onClick={() => setFeedMode('latest')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            feedMode === 'latest' 
                            ? 'bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-400 shadow-sm' 
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <Clock size={16} /> Latest
                    </button>
                </div>
              </div>
              
              {usingOfflineData && (
                    <div className="mt-4 mb-6 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 text-amber-700 dark:text-amber-200 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                        <AlertCircle size={16} />
                        <span>Backend unreachable. Showing local demo data.</span>
                    </div>
                )}
              
              {isFeedLoading ? (
                  <div className="flex justify-center py-20">
                      <Loader2 className="animate-spin text-teal-500" size={32} />
                  </div>
              ) : (
                <div className="space-y-6">
                    {posts.map((post) => (
                      <ActivityCard 
                        key={post.id} 
                        post={post} 
                        onUserClick={handleUserClick} 
                        onActivityClick={handleActivityClick}
                      />
                    ))}
                    
                    {posts.length === 0 && !isFeedLoading && (
                        <div className="text-center py-20 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                          <p>No activities found.</p>
                        </div>
                    )}
                </div>
              )}
            </>
          )}

          {currentView === 'explore' && <Explore onUserClick={handleUserClick} />}

          {currentView === 'profile' && <Profile targetUid={profileTargetUid} onUserClick={handleUserClick} onActivityClick={handleActivityClick} />}

          {currentView === 'activity_detail' && selectedActivityId && (
             <ActivityDetail 
                activityId={selectedActivityId} 
                onBack={() => setCurrentView('feed')} 
                onUserClick={handleUserClick}
             />
          )}

          {currentView === 'notifications' && (
             <Notifications 
                onUserClick={handleUserClick}
                onActivityClick={handleActivityClick}
             />
          )}

          {currentView === 'settings' && (
            <div className="space-y-6">
               <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Settings</h1>
               
               <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                    <Monitor size={20} className="text-teal-500"/> Display & Accessibility
                  </h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {isDarkMode ? <Moon size={24} /> : <Sun size={24} />}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Dark Mode</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Easier on the eyes</div>
                      </div>
                    </div>
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${isDarkMode ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${isDarkMode ? 'translate-x-7' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isHighContrast ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                        <Eye size={24} />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">High Contrast</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Increase visibility</div>
                      </div>
                    </div>
                    <button onClick={() => setIsHighContrast(!isHighContrast)} className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${isHighContrast ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${isHighContrast ? 'translate-x-7' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isLargeText ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                        <Type size={24} />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">Larger Text</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Increase font size</div>
                      </div>
                    </div>
                    <button onClick={() => setIsLargeText(!isLargeText)} className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${isLargeText ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${isLargeText ? 'translate-x-7' : 'translate-x-0'}`} />
                    </button>
                  </div>

                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;