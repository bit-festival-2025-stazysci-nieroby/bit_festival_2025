import { useState } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Search, Loader2, User as UserIcon, ChevronRight } from 'lucide-react';

interface ExploreProps {
  onUserClick: (uid: string) => void;
}

interface SearchResult {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string;
}

const Explore = ({ onUserClick }: ExploreProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setResults([]);

    try {
      // Proste wyszukiwanie prefiksowe w Firestore (Case-sensitive)
      // Szuka displayName zaczynającego się od searchTerm
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where('displayName', '>=', searchTerm),
        where('displayName', '<=', searchTerm + '\uf8ff'),
        limit(10)
      );

      const querySnapshot = await getDocs(q);
      const foundUsers: SearchResult[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        foundUsers.push({
          uid: doc.id,
          displayName: data.displayName || 'Unknown User',
          photoURL: data.photoURL || '',
          email: data.email || ''
        });
      });
      
      setResults(foundUsers);
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Explore</h1>
        <p className="text-gray-500 mt-1 dark:text-gray-400">Find friends and athletes by name</p>
      </div>

      <form onSubmit={handleSearch} className="relative mb-8">
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-24 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all dark:text-white text-lg"
        />
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={24} />
        
        <button
          type="submit"
          disabled={loading || !searchTerm.trim()}
          className="absolute right-2 top-2 bottom-2 px-6 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : 'Search'}
        </button>
      </form>

      <div className="space-y-4">
        {results.map((user) => (
          <div
            key={user.uid}
            onClick={() => onUserClick(user.uid)}
            className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-700 hover:shadow-md transition-all cursor-pointer group"
          >
            <img
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
              alt={user.displayName}
              className="w-14 h-14 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm"
            />
            <div className="flex-1">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                {user.displayName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
            </div>
            <div className="p-2 text-gray-300 dark:text-gray-600 group-hover:text-teal-500 group-hover:translate-x-1 transition-all">
                <ChevronRight size={24} />
            </div>
          </div>
        ))}

        {hasSearched && results.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <UserIcon size={64} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg">No users found matching "{searchTerm}"</p>
            <p className="text-sm mt-2 opacity-70">Try typing the exact name (case-sensitive).</p>
          </div>
        )}
        
        {!hasSearched && (
            <div className="text-center py-20 text-gray-300 dark:text-gray-600">
                <Search size={64} className="mx-auto mb-4 opacity-10" />
                <p>Start typing to search for people...</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Explore;