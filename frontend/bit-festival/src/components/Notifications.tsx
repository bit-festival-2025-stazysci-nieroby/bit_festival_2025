import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Bell, UserPlus, Activity, Loader2, X } from 'lucide-react';

interface Notification {
  id: string;
  type: 'new_activity' | 'follow';
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar: string;
  activityId?: string; 
  timestamp: any;
  read: boolean;
}

interface NotificationsProps {
  onUserClick: (uid: string) => void;
  onActivityClick: (activityId: string) => void;
}

const Notifications = ({ onUserClick, onActivityClick }: NotificationsProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, "users", auth.currentUser.uid, "notifications"),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: Notification[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
      setNotifications(notifs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.read && auth.currentUser) {
       const notifRef = doc(db, "users", auth.currentUser.uid, "notifications", notif.id);
       updateDoc(notifRef, { read: true }).catch(console.error);
    }

    // 2. Wykonaj akcję
    if (notif.type === 'follow') {
        onUserClick(notif.fromUserId);
    } else if (notif.type === 'new_activity' && notif.activityId) {
        onActivityClick(notif.activityId);
    }
  };

  const handleDelete = async (e: React.MouseEvent, notifId: string) => {
      e.stopPropagation();
      if (!auth.currentUser) return;
      try {
          await deleteDoc(doc(db, "users", auth.currentUser.uid, "notifications", notifId));
      } catch (error) {
          console.error("Error deleting notification:", error);
      }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-teal-500" size={32} /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in duration-500">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Notifications</h1>
        <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            {notifications.filter(n => !n.read).length}
        </div>
      </div>

      <div className="space-y-3">
        {notifications.length > 0 ? (
          notifications.map((notif) => (
            <div 
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md relative group
                ${notif.read 
                  ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700' 
                  : 'bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-800'
                }`}
            >
              {/* Ikona typu */}
              <div className={`p-3 rounded-full shrink-0 ${
                  notif.type === 'follow' 
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' 
                  : 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300'
              }`}>
                  {notif.type === 'follow' ? <UserPlus size={20} /> : <Activity size={20} />}
              </div>

              {/* Treść */}
              <div className="flex-1">
                  <div className="text-sm text-gray-900 dark:text-white">
                      <span className="font-bold">{notif.fromUserName}</span>
                      {notif.type === 'follow' 
                        ? ' started following you.' 
                        : ' added a new activity.'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {notif.timestamp?.toDate ? notif.timestamp.toDate().toLocaleString() : 'Just now'}
                  </div>
              </div>

              {/* Kropka "nieprzeczytane" */}
              {!notif.read && (
                  <div className="w-2 h-2 bg-red-500 rounded-full shrink-0"></div>
              )}

              {/* Przycisk usuwania (pojawia się po najechaniu) */}
              <button 
                onClick={(e) => handleDelete(e, notif.id)}
                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                  <X size={16} />
              </button>
            </div>
          ))
        ) : (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            <Bell size={48} className="mx-auto mb-4 opacity-20" />
            <p>No notifications yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;