import { Home, Compass, User, Bell, Settings, LogOut, PlusCircle } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

type View = 'feed' | 'explore' | 'profile' | 'notifications' | 'settings';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  onCreateActivity: () => void;
}

const Sidebar = ({ currentView, onNavigate, onCreateActivity }: SidebarProps) => {
  const menuItems: { icon: any; label: string; id: View }[] = [
    { icon: Home, label: 'Feed', id: 'feed' },
    { icon: Compass, label: 'Explore', id: 'explore' },
    { icon: User, label: 'Profile', id: 'profile' },
    { icon: Bell, label: 'Notifications', id: 'notifications' },
    { icon: Settings, label: 'Settings', id: 'settings' },
  ];

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  return (
    // Dodano klasy dark:
    <div className="w-64 h-screen bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 flex flex-col p-6 fixed left-0 top-0 hidden md:flex z-50 transition-colors">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          Active<span className="text-teal-500">Connect</span>
        </h1>
      </div>

      <button 
        onClick={onCreateActivity}
        className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-teal-200 dark:shadow-none transition-all mb-8 flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.02]"
      >
        <PlusCircle size={20} />
        New Activity
      </button>

      <nav className="space-y-2 flex-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              currentView === item.id
                ? 'bg-orange-50 text-orange-600 dark:bg-gray-700 dark:text-orange-400'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <item.icon size={20} className={currentView === item.id ? 'text-orange-500 dark:text-orange-400' : ''} />
            {item.label}
          </button>
        ))}
      </nav>

      <button 
        onClick={handleLogout}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer mt-auto"
      >
        <LogOut size={20} />
        Log Out
      </button>
    </div>
  );
};

export default Sidebar;