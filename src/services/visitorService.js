import { db } from '../config/firebase';
import { collection, getDocs, doc, updateDoc, addDoc, query, where } from 'firebase/firestore';

export const visitorService = {
  // 1. Fetch all visitor requests (For GSU Admin)
  async getAllVisits() {
    try {
      const snapshot = await getDocs(collection(db, 'visits'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error fetching visitor data:", error);
      return [];
    }
  },

  // 2. Update the status of a visit (For GSU Admin)
  async updateVisitStatus(id, updateData) {
    const docRef = doc(db, 'visits', id);
    await updateDoc(docRef, updateData);
    return { id, ...updateData };
  },

  // 3. NEW: Fetch visits for a specific logged-in visitor
  async getVisitsByVisitorId(visitorId) {
    try {
      const q = query(collection(db, 'visits'), where('visitorId', '==', visitorId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error fetching user visits:", error);
      return [];
    }
  },

  // 4. NEW: Create a new visit request
  async createVisit(visitData) {
    const newVisit = {
      ...visitData,
      requestedDate: new Date().toISOString().slice(0, 10), // Stamps today's date
      status: 'pending' 
    };
    const docRef = await addDoc(collection(db, 'visits'), newVisit);
    return { id: docRef.id, ...newVisit };
  }
};