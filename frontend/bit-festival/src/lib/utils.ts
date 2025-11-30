import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export const notifyFollowers = async (activityId: string) => {
  if (!auth.currentUser) return;
  
  const myId = auth.currentUser.uid;
  const myName = auth.currentUser.displayName || 'Someone';
  const myAvatar = auth.currentUser.photoURL || '';

  try {
    const followersRef = collection(db, "users", myId, "followers");
    const snapshot = await getDocs(followersRef);

    if (snapshot.empty) {
        console.log("No followers to notify.");
        return;
    }
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