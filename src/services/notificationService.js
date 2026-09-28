import { db } from '../config/firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';

export const notificationService = {
  // 1. Fetch notifications and auto-delete old ones
  async getUserNotifications(userId) {
    if (!userId) return [];

    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', userId)
    );
    
    const snapshot = await getDocs(q);
    
    // Calculate the exact time 10 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 10);

    const validNotifications = [];
    const deletePromises = [];

    // Separate fresh notifications from expired ones
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const notifDate = new Date(data.timestamp);

      if (notifDate < cutoffDate) {
        // If older than 10 days, queue it for permanent deletion
        deletePromises.push(deleteDoc(doc(db, 'notifications', docSnap.id)));
      } else {
        // Otherwise, keep it for the UI
        validNotifications.push({ id: docSnap.id, ...data });
      }
    });

    // Fire off the deletions silently in the background (so the UI doesn't freeze waiting for it)
    if (deletePromises.length > 0) {
      Promise.all(deletePromises).catch(err => console.error("Failed to auto-delete old notifications:", err));
    }
    
    // Sort the valid ones so the newest notifications appear at the top
    return validNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  // 2. Permanently mark a notification as read in the database
  async markAsRead(notificationId) {
    const ref = doc(db, 'notifications', notificationId);
    await updateDoc(ref, { read: true });
  },

  // 3. Create a notification (Triggered by Admin/BAO/Guard actions)
  async createNotification({ userId, title, message, type = 'info' }) {
    if (!userId || userId === 'unknown' || userId === 'anonymous') {
      console.warn("Attempted to send notification to unknown user.");
      return null;
    }

    try {
      const docRef = await addDoc(collection(db, 'notifications'), {
        userId,
        title,
        message,
        type, 
        read: false,
        timestamp: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      console.error("Failed to create notification:", error);
      throw error;
    }
  }
};