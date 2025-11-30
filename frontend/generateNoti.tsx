
import { collection, getDocs, addDoc, serverTimestamp } from './bit-festival/src/lib/firebase'
import { db, auth } from './bit-festival/src/lib/firebase';

const notifyFollowers = async (activityId: string) => {
  if (!auth.currentUser) return;
  
  const myId = auth.currentUser.uid;
  const myName = auth.currentUser.displayName || 'Someone';
  const myAvatar = auth.currentUser.photoURL || '';

  try {
    // 1. Pobierz listę moich followersów
    const followersRef = collection(db, "users", myId, "followers");
    const snapshot = await getDocs(followersRef);

    // 2. Dla każdego followera dodaj powiadomienie
    const notificationsPromises = snapshot.docs.map(doc => {
      const followerId = doc.id;
      return addDoc(collection(db, "users", followerId, "notifications"), {
        type: 'new_activity',
        fromUserId: myId,
        fromUserName: myName,
        fromUserAvatar: myAvatar,
        activityId: activityId,
        read: false,
        timestamp: serverTimestamp()
      });
    });

    await Promise.all(notificationsPromises);
    console.log(`Sent notifications to ${snapshot.size} followers.`);
  } catch (error) {
    console.error("Error sending notifications:", error);
  }
};