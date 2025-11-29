import { MoreHorizontal } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ActivityCard from './components/ActivityCard';
import { mockPosts } from './lib/mockdata';
import './index.css'

function App() {
  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          {/* Mobile Header (tylko na telefonach) */}
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
            <p className="text-gray-500 mt-1">See what your friends are up to</p>
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