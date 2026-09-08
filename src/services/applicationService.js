import { db } from '../config/firebase';
// Notice we added 'addDoc' to the end of this import line!
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion, addDoc } from 'firebase/firestore';

export const applicationService = {
  // 1. Fetch all applications that need GSU review
  async getPendingApplications() {
    const q = query(
      collection(db, 'applications'), 
      where('status', 'in', ['pending', 'under_review'])
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // 2. Fetch a specific application for the Review page
  async getApplicationById(id) {
    const docRef = doc(db, 'applications', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Application not found');
    return { id: docSnap.id, ...docSnap.data() };
  },

  // 3. Fetch the associated vehicle data
  async getVehicleById(id) {
    const docRef = doc(db, 'vehicles', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() };
  },

  // 4. Update status and append to the timeline array
  async updateApplicationStatus(id, newStatus, notes, reviewerName) {
    const docRef = doc(db, 'applications', id);
    
    const newTimelineEvent = {
      status: newStatus,
      date: new Date().toISOString(),
      title: newStatus === 'approved' ? 'Approved by GSU' : 'Rejected by GSU',
      description: notes || `Application was ${newStatus}.`,
      actor: reviewerName || 'GSU Admin'
    };

    await updateDoc(docRef, {
      status: newStatus,
      timeline: arrayUnion(newTimelineEvent)
    });
  },

  // 5. NEW: Fetch all registered vehicles for the Admin master list
  async getAllVehicles() {
    try {
      const snapshot = await getDocs(collection(db, 'vehicles'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error fetching all vehicles:", error);
      return [];
    }
  },

  // 6. NEW: Update a vehicle's campus access status (e.g., revoking it)
  async updateVehicleStatus(id, newStatus) {
    const docRef = doc(db, 'vehicles', id);
    await updateDoc(docRef, { status: newStatus });
  },

  // 7. NEW: Create a brand new application (This is what we were missing!)
  async createApplication(applicationData) {
    try {
      const docRef = await addDoc(collection(db, 'applications'), applicationData);
      return docRef.id;
    } catch (error) {
      console.error("Error creating application:", error);
      throw error;
    }
  },

  // 8. NEW: Hand off an approved application to the BAO by creating a vehicle record
  async createVehicle(vehicleData) {
    try {
      const docRef = await addDoc(collection(db, 'vehicles'), vehicleData);
      return docRef.id;
    } catch (error) {
      console.error("Error creating vehicle:", error);
      throw error;
    }
  }

};