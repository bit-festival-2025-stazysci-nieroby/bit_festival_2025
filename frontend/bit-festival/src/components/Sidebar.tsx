import { Home, Compass, User, Bell, Settings, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

type View = 'feed' | 'explore' | 'profile' | 'notifications' | 'settings';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  onCreateActivity: () => void;
}

const Sidebar = ({ currentView, onNavigate }: SidebarProps) => {
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
    <div className="w-64 h-screen bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 flex flex-col p-6 fixed left-0 top-0 hidden md:flex z-50 transition-colors">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          Active<span className="text-teal-500">Connect</span>
        </h1>
      </div>
      <nav className="space-y-2 flex-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer group ${
              currentView === item.id
                ? 'bg-teal-50 text-teal-600 dark:bg-gray-700 dark:text-teal-400'
                : 'text-gray-500 hover:bg-teal-50 hover:text-teal-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-teal-400'
            }`}
          >
            <item.icon size={20} className={currentView === item.id ? 'text-teal-500 dark:text-teal-400' : 'group-hover:text-teal-500'} />
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