import { Home, Compass, User, Bell, Settings, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

const Sidebar = () => {
  const menuItems = [
    { icon: Home, label: 'Feed', active: true },
    { icon: Compass, label: 'Explore', active: false },
    { icon: User, label: 'Profile', active: false },
    { icon: Bell, label: 'Notifications', active: false },
    { icon: Settings, label: 'Settings', active: false },
  ];

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Błąd wylogowania", error);
    }
  };

  return (
    <div className="w-64 h-screen bg-white border-r border-gray-100 flex flex-col p-6 fixed left-0 top-0 hidden md:flex z-50">
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-gray-800">
          Active<span className="text-teal-500">Connect</span>
        </h1>
      </div>

      <nav className="space-y-2 flex-1">
        {menuItems.map((item) => (
          <button
            key={item.label}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              item.active
                ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <item.icon size={20} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Przycisk wylogowania na dole */}
      <button 
        onClick={handleLogout}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors cursor-pointer mt-auto"
      >
        <LogOut size={20} />
        Log Out
      </button>
    </div>
  );
};

export default Sidebar;