import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db } from './lib/firebase';
import { MoreHorizontal, Loader2 } from 'lucide-react';

import Sidebar from './components/Sidebar';
import ActivityCard from './components/ActivityCard';
import Login from './components/Login';
import Onboarding from './components/OnBoarding';
import Profile from './components/Profile'; 

import { mockPosts } from './lib/mockdata';

type View = 'feed' | 'explore' | 'profile' | 'notifications' | 'settings';

function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
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
          console.error("Error checking user profile:", error);
          setShowOnboarding(true); 
        }
      } else {
        setUser(null);
        setShowOnboarding(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setCurrentView('feed');
  };

  if (loading) {
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
      {/* Pass state and setter to Sidebar */}
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />
      
      <main className="flex-1 md:ml-64 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-gray-800">
              Active<span className="text-teal-500">Connect</span>
            </h1>
            <button className="p-2 text-gray-600">
              <MoreHorizontal size={24} />
            </button>
          </div>

          {/* Conditional Rendering based on currentView */}
          {currentView === 'feed' && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Activity Feed</h1>
                <p className="text-gray-500 mt-1">
                  Welcome back, {user.displayName?.split(' ')[0] || 'User'}! See what your friends are up to.
                </p>
              </div>
              
              <div className="space-y-6">
                {mockPosts.map((post) => (
                  <ActivityCard key={post.id} post={post} />
                ))}
              </div>
            </>
          )}

          {currentView === 'profile' && (
            <Profile />
          )}

          {/* Placeholders for other views */}
          {(currentView === 'explore' || currentView === 'notifications' || currentView === 'settings') && (
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