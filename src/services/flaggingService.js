import { db } from '../config/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

export const flaggingService = {
  async submitFlag(vehicleId, stickerSerial, guardId, reason, details) {
    await addDoc(collection(db, 'offenses'), {
      vehicleId, stickerSerial, guardId, reason,
      details: details || '',
      timestamp: new Date().toISOString()
    });

    const vehicleRef = doc(db, 'approved_vehicles', vehicleId);
    const vSnap = await getDoc(vehicleRef);
    
    if (vSnap.exists()) {
      const currentCount = vSnap.data().offenseCount || 0;
      const newCount = currentCount + 1;
      const updates = { offenseCount: newCount };
      
      if (newCount >= 3) {
        updates.accreditationStatus = 'Revocation Pending';
      }
      
      await updateDoc(vehicleRef, updates);
      await updateDoc(doc(db, 'vehicles', vehicleId), updates);
      
      return newCount;
    }
    return 1;
  },

  // NOTES 1 & 8: Move to revoked table, save plate, set 1-year lockout
  async revokeSticker(vehicle) {
    const vehicleId = vehicle.id;
    const cleanPlate = (vehicle.plateNumber || '').replace(/\s+/g, '').toUpperCase();

    // 1. Mark existing records as revoked
    const updates = { accreditationStatus: 'Revoked', status: 'revoked' };
    await updateDoc(doc(db, 'approved_vehicles', vehicleId), updates);
    await updateDoc(doc(db, 'vehicles', vehicleId), updates);

    // 2. Calculate next year's lockout date
    const lockoutExpiry = new Date();
    lockoutExpiry.setFullYear(lockoutExpiry.getFullYear() + 1);

    // 3. Burn it into the revoked_vehicles Blacklist table
    // We use cleanPlate as the document ID so we can search it instantly during registration
    await setDoc(doc(db, 'revoked_vehicles', cleanPlate), {
      plateNumber: cleanPlate,
      ownerName: vehicle.ownerName || 'Unknown',
      ownerId: vehicle.ownerId || vehicle.userId || 'unknown',
      revokedDate: new Date().toISOString(),
      originalVehicleId: vehicleId,
      lockoutUntil: lockoutExpiry.toISOString() 
    });
  }
};