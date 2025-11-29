import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db } from './lib/firebase';
import { MoreHorizontal, Loader2, AlertCircle, Moon, Sun, Eye, Monitor } from 'lucide-react';

import Sidebar from './components/Sidebar';
import ActivityCard from './components/ActivityCard';
import Login from './components/Login';
import Onboarding from './components/OnBoarding';
import Profile from './components/Profile';

import { mockPosts } from './lib/mockdata';
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

  // --- THEME STATE ---
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isHighContrast, setIsHighContrast] = useState(() => localStorage.getItem('contrast') === 'true');

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('contrast', String(isHighContrast));
  }, [isDarkMode, isHighContrast]);

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

  const fetchFeed = async () => {
    setIsFeedLoading(true);
    setUsingOfflineData(false);

    try {
        const { lat, lng } = await getUserLocation();
        const token = await auth.currentUser?.getIdToken();
        
        const response = await fetch(`${API_URL}/api/feed/ai/?lat=${lat}&lng=${lng}`, {
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
           const mappedPosts: ActivityPost[] = data.feed.map((item: any) => ({
                id: item.id,
                user: {
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
                stats: {
                    duration: item.time_end ? "Completed" : "Active",
                    distance: "-",
                    pace: "-",
                    calories: item.ai_score ? `Score: ${Math.round(item.ai_score)}` : "-" 
                },
                social: {
                    likes: item.likes_count || 0,
                    comments: item.comments_count || 0,
                    taggedUsers: [],
                    userLiked: item.user_liked, 
                    lastComment: item.last_comment
                }
           }));
           setPosts(mappedPosts);
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

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-teal-500" size={48} />
      </div>
    );
  }

  if (!user) return <Login />;
  if (showOnboarding) return <Onboarding onComplete={handleOnboardingComplete} />;

  return (
    <div className={`flex min-h-screen font-sans transition-colors duration-200 ${isDarkMode ? 'dark-mode bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} ${isHighContrast ? 'high-contrast' : ''}`}>
      
      {/* GLOBALNE STYLE DLA TRYBÓW (Wstrzyknięte dynamicznie) */}
      <style>{`
        /* DARK MODE OVERRIDES */
        .dark-mode .bg-white { background-color: #1f2937 !important; color: #f3f4f6 !important; }
        .dark-mode .bg-gray-50 { background-color: #111827 !important; }
        .dark-mode .text-gray-900 { color: #f3f4f6 !important; }
        .dark-mode .text-gray-800 { color: #e5e7eb !important; }
        .dark-mode .text-gray-600, .dark-mode .text-gray-500 { color: #9ca3af !important; }
        .dark-mode .border-gray-100, .dark-mode .border-gray-200 { border-color: #374151 !important; }
        .dark-mode .hover\\:bg-gray-50:hover { background-color: #374151 !important; }
        .dark-mode input { background-color: #374151 !important; color: white !important; border-color: #4b5563 !important; }

        /* HIGH CONTRAST OVERRIDES (Black & Yellow) */
        .high-contrast { filter: contrast(120%); }
        .high-contrast .bg-white, .high-contrast .bg-gray-50 { background-color: #000000 !important; }
        .high-contrast, .high-contrast h1, .high-contrast h2, .high-contrast h3, .high-contrast p, .high-contrast span, .high-contrast div { color: #FFFF00 !important; }
        .high-contrast button { border: 2px solid #FFFF00 !important; font-weight: bold !important; }
        .high-contrast .bg-teal-500, .high-contrast .bg-orange-500, .high-contrast .bg-blue-500 { background-color: #000000 !important; border: 2px solid #FFFF00 !important; color: #FFFF00 !important; }
        .high-contrast img { filter: grayscale(100%) contrast(200%); }
        .high-contrast input { background-color: black !important; color: yellow !important; border: 2px solid yellow !important; }
      `}</style>

      <Sidebar 
        currentView={currentView} 
        onNavigate={setCurrentView}
      />
      
      <main className="flex-1 md:ml-64 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold">
              Active<span className="text-teal-500">Connect</span>
            </h1>
            <button className="p-2 text-gray-600 dark:text-gray-300">
              <MoreHorizontal size={24} />
            </button>
          </div>

          {currentView === 'feed' && (
            <>
              <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold">Activity Feed</h1>
                    <p className="text-gray-500 mt-1">
                    Welcome back, {user.displayName?.split(' ')[0] || 'User'}! 
                    </p>
                </div>
              </div>
              
              {usingOfflineData && (
                    <div className="mt-4 mb-6 bg-amber-50 border border-amber-100 text-amber-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
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

          {currentView === 'notifications' && (
             <div className="text-center py-20 text-gray-400">Notifications Coming Soon</div>
          )}

          {/* SETTINGS VIEW */}
          {currentView === 'settings' && (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold mb-8">Settings</h1>
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Monitor size={20} className="text-teal-500"/> Display & Accessibility
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">Customize your viewing experience</p>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Dark Mode Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'}`}>
                        {isDarkMode ? <Moon size={24} /> : <Sun size={24} />}
                      </div>
                      <div>
                        <div className="font-medium">Dark Mode</div>
                        <div className="text-sm text-gray-500">Easier on the eyes in low light</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${isDarkMode ? 'bg-teal-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${isDarkMode ? 'translate-x-7' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* High Contrast Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isHighContrast ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                        <Eye size={24} />
                      </div>
                      <div>
                        <div className="font-medium">High Contrast</div>
                        <div className="text-sm text-gray-500">Increases contrast for better visibility (Yellow/Black)</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsHighContrast(!isHighContrast)}
                      className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${isHighContrast ? 'bg-teal-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${isHighContrast ? 'translate-x-7' : 'translate-x-0'}`} />
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