import { db } from '../config/firebase';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

export const stickerService = {
  // 1. Fetch all stickers for the BAO master list and dashboard calculations
  async getAllStickers() {
    try {
      const snapshot = await getDocs(collection(db, 'stickers'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error fetching all stickers:", error);
      return [];
    }
  },

  // 2. Assign a blank sticker to a specific vehicle/plate number
  async assignSticker(stickerId, vehicleData) {
    const docRef = doc(db, 'stickers', stickerId);
    await updateDoc(docRef, {
      status: 'active',
      vehicleId: vehicleData.id,
      plateNumber: vehicleData.plateNumber,
      ownerName: vehicleData.ownerName,
      assignedDate: new Date().toISOString()
    });
  },

  // 3. Update the payment status (e.g., from 'unpaid' to 'paid')
  async updatePaymentStatus(stickerId, newPaymentStatus) {
    const docRef = doc(db, 'stickers', stickerId);
    await updateDoc(docRef, { paymentStatus: newPaymentStatus });
  },

  // 4. Update the pickup status (e.g., from 'pending' to 'picked_up')
  async updatePickupStatus(stickerId, newPickupStatus) {
    const docRef = doc(db, 'stickers', stickerId);
    await updateDoc(docRef, { pickupStatus: newPickupStatus });
  },

  // 5. Flag a sticker for anti-fraud (e.g., 'flagged_duplicate' or 'revoked')
  async updateStickerStatus(stickerId, newStatus) {
    const docRef = doc(db, 'stickers', stickerId);
    await updateDoc(docRef, { status: newStatus });
  },

  // 6. (Optional) Fetch only unassigned stickers for dropdown menus
  async getUnassignedStickers() {
    try {
      const q = query(collection(db, 'stickers'), where('status', '==', 'unassigned'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error fetching unassigned stickers:", error);
      return [];
    }
  },

  // 7. NEW: Update any arbitrary fields on a sticker (used for full assignment)
  async updateStickerDetails(stickerId, updateData) {
    const docRef = doc(db, 'stickers', stickerId);
    await updateDoc(docRef, updateData);
  },

  async generateTestInventory() {
    try {
      for (let i = 1; i <= 10; i++) {
        const randomNum = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
        await addDoc(collection(db, 'stickers'), {
          serial: `LSPU-LB-${randomNum}`,
          status: 'unassigned',
          paymentStatus: 'unpaid',
          pickupStatus: 'pending',
          assignedDate: null
        });
      }
      return true;
    } catch (error) {
      console.error("Error generating stickers:", error);
      throw error;
    }
  }
};