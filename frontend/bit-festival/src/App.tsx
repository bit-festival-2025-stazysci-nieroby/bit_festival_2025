import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth'; 
import { auth } from './lib/firebase';
import { MoreHorizontal, Loader2 } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ActivityCard from './components/ActivityCard';
import Login from './components/Login';
import { mockPosts } from './lib/mockdata';

function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <Sidebar />
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

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Activity Feed</h1>
            <p className="text-gray-500 mt-1">
              Hi, {user.displayName || 'Użytkowniku'}! Zobacz co u znajomych.
            </p>
          </div>
          
          <div className="space-y-6">
            {mockPosts.map((post) => (
              <ActivityCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;