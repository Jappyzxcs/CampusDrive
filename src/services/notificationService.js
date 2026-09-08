import { db } from '../config/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

export const notificationService = {
  // 1. Fetch notifications specific to the logged-in user
  async getUserNotifications(userId) {
    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', userId)
    );
    
    const snapshot = await getDocs(q);
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort them so the newest notifications appear at the top
    return notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  // 2. Permanently mark a notification as read in the database
  async markAsRead(notificationId) {
    const ref = doc(db, 'notifications', notificationId);
    await updateDoc(ref, { read: true });
  }
};