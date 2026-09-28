import { db } from '../config/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, setDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { notificationService } from './notificationService';

export const flaggingService = {
  async submitFlag(vehicleId, stickerSerial, guardId, reason, details) {
    const vehicleRef = doc(db, 'approved_vehicles', vehicleId);
    const vSnap = await getDoc(vehicleRef);
    
    if (!vSnap.exists()) return 0;
    
    const vehicleData = vSnap.data();
    const currentCount = vehicleData.offenseCount || 0;
    
    // 🛠️ THE FIX: Deep search for ownerId to handle older test data
    let ownerId = vehicleData.ownerId || vehicleData.userId;
    if (!ownerId) {
      const mainSnap = await getDoc(doc(db, 'vehicles', vehicleId));
      if (mainSnap.exists()) {
        ownerId = mainSnap.data().ownerId || mainSnap.data().userId;
      }
    }

    if (currentCount >= 3) return currentCount;

    await addDoc(collection(db, 'offenses'), {
      vehicleId, stickerSerial, guardId, reason, details: details || '',
      timestamp: new Date().toISOString()
    });

    const newCount = currentCount + 1;
    const updates = { offenseCount: newCount };
    const displayReason = reason === 'Others' && details ? details : reason;
    
    if (newCount >= 3) {
      // 🔴 AUTO-REVOKED (3 Strikes)
      updates.accreditationStatus = 'Revoked';
      updates.status = 'revoked';
      updates.revokedDate = new Date().toISOString(); // <-- ADDED FOR AUDIT TRAIL
      updates.revokeReason = `Automatically revoked (3 strikes). Last violation: ${displayReason}`;

      const cleanPlate = (vehicleData.plateNumber || '').replace(/\s+/g, '').toUpperCase();
      const lockoutExpiry = new Date();
      lockoutExpiry.setFullYear(lockoutExpiry.getFullYear() + 1);

      await setDoc(doc(db, 'revoked_vehicles', cleanPlate), {
        plateNumber: cleanPlate, ownerName: vehicleData.ownerName || 'Unknown',
        ownerId: ownerId || 'unknown', revokedDate: new Date().toISOString(),
        originalVehicleId: vehicleId, revokeReason: updates.revokeReason,
        lockoutUntil: lockoutExpiry.toISOString() 
      });

      if (ownerId) {
        await notificationService.createNotification({
          userId: ownerId,
          title: 'Access Revoked (3 Strikes)',
          message: `URGENT: Access for vehicle ${vehicleData.plateNumber || 'N/A'} has been revoked due to reaching 3 offenses. Last violation: ${displayReason}.`,
          type: 'danger'
        });
      }
    } else {
      // 🟠 STRIKE WARNING (1 or 2)
      if (ownerId) {
        await notificationService.createNotification({
          userId: ownerId,
          title: 'Vehicle Offense Warning',
          message: `Warning: Your vehicle ${vehicleData.plateNumber || 'N/A'} was flagged for an offense (Strike ${newCount} of 3). Reason: ${displayReason}.`,
          type: 'warning'
        });
      } else {
        console.warn("Could not find ownerId for vehicle. Notification skipped.");
      }
    }
    
    await updateDoc(vehicleRef, updates);
    await updateDoc(doc(db, 'vehicles', vehicleId), updates);
    
    return newCount;
  },

  async revokeSticker(vehicle) {
    const vehicleId = vehicle.id;
    const cleanPlate = (vehicle.plateNumber || '').replace(/\s+/g, '').toUpperCase();
    const reason = 'Manually revoked by GSU Administrator.';
    const ownerId = vehicle.ownerId || vehicle.userId;

    const updates = { 
      accreditationStatus: 'Revoked', 
      status: 'revoked', 
      revokeReason: reason,
      revokedDate: new Date().toISOString() // <-- ADDED FOR AUDIT TRAIL
    };
    
    await updateDoc(doc(db, 'approved_vehicles', vehicleId), updates);
    await updateDoc(doc(db, 'vehicles', vehicleId), updates);

    const lockoutExpiry = new Date();
    lockoutExpiry.setFullYear(lockoutExpiry.getFullYear() + 1);

    await setDoc(doc(db, 'revoked_vehicles', cleanPlate), {
      plateNumber: cleanPlate, ownerName: vehicle.ownerName || 'Unknown',
      ownerId: ownerId || 'unknown', revokedDate: new Date().toISOString(),
      originalVehicleId: vehicleId, revokeReason: reason, lockoutUntil: lockoutExpiry.toISOString() 
    });

    if (ownerId) {
      await notificationService.createNotification({
        userId: ownerId,
        title: 'Access Revoked',
        message: `URGENT: Campus access for vehicle ${vehicle.plateNumber || 'N/A'} was manually revoked by the Administrator.`,
        type: 'danger'
      });
    }
  },

  async undoRevoke(vehicle) {
    const vehicleId = vehicle.id;
    const cleanPlate = (vehicle.plateNumber || '').replace(/\s+/g, '').toUpperCase();
    const updates = { accreditationStatus: 'Active', status: 'active', revokeReason: null, offenseCount: 0 };
    
    await updateDoc(doc(db, 'approved_vehicles', vehicleId), updates);
    await updateDoc(doc(db, 'vehicles', vehicleId), updates);
    await deleteDoc(doc(db, 'revoked_vehicles', cleanPlate));

    const q = query(collection(db, 'offenses'), where('vehicleId', '==', vehicleId));
    const snap = await getDocs(q);
    const deletePromises = snap.docs.map(d => deleteDoc(doc(db, 'offenses', d.id)));
    await Promise.all(deletePromises);
  }
};