import { db } from '../config/firebase';
import { collection, query, where, getDocs, addDoc, orderBy, limit } from 'firebase/firestore';

export const scannerService = {
  
  // 1. Verify a vehicle by its Plate Number or Sticker Serial
  async verifyVehicle(searchTerm) {
    try {
      const normalizedTerm = searchTerm.trim().toUpperCase();
      
      // Query Firebase for a matching plate OR matching serial
      const vehiclesRef = collection(db, 'vehicles');
      const plateQuery = query(vehiclesRef, where('plateNumber', '==', normalizedTerm));
      const serialQuery = query(vehiclesRef, where('stickerSerial', '==', normalizedTerm));
      
      const [plateSnap, serialSnap] = await Promise.all([
        getDocs(plateQuery),
        getDocs(serialQuery)
      ]);

      // Combine results
      let vehicleDoc = null;
      if (!plateSnap.empty) vehicleDoc = plateSnap.docs[0];
      else if (!serialSnap.empty) vehicleDoc = serialSnap.docs[0];

      // Scenerio A: Not found at all
      if (!vehicleDoc) {
        return {
          status: 'unregistered',
          plateNumber: normalizedTerm,
          owner: 'N/A',
          make: 'N/A',
          serial: 'N/A',
          alert: 'No record found in the database.'
        };
      }

      const vehicle = { id: vehicleDoc.id, ...vehicleDoc.data() };

      // Scenerio B: Expired
      if (vehicle.status === 'expired') {
        return {
          status: 'expired',
          plateNumber: vehicle.plateNumber,
          owner: vehicle.ownerName,
          make: `${vehicle.make} ${vehicle.model}`,
          serial: vehicle.stickerSerial || 'N/A',
          alert: 'Institutional accreditation expired.'
        };
      }

      // Scenerio C: Revoked or Rejected
      if (vehicle.status === 'revoked' || vehicle.status === 'rejected') {
        return {
          status: 'mismatch',
          plateNumber: vehicle.plateNumber,
          owner: vehicle.ownerName,
          make: `${vehicle.make} ${vehicle.model}`,
          serial: vehicle.stickerSerial || 'N/A',
          alert: 'Vehicle access has been revoked or denied.'
        };
      }

      // Scenerio D: Valid and Approved
      if (vehicle.status === 'approved') {
        return {
          status: 'valid',
          plateNumber: vehicle.plateNumber,
          owner: vehicle.ownerName,
          make: `${vehicle.make} ${vehicle.model}`,
          serial: vehicle.stickerSerial || 'Pending Issue',
          alert: 'Allow Entry'
        };
      }

      // Fallback
      return {
        status: 'unregistered',
        plateNumber: vehicle.plateNumber,
        owner: vehicle.ownerName,
        alert: `Vehicle status is: ${vehicle.status}`
      };

    } catch (error) {
      console.error("Error verifying vehicle:", error);
      throw error;
    }
  },

  // 2. Save the scan result to the database for the Admin Audit Log
  async logScanAttempt(scanResult, guardName = "Gate Guard") {
    try {
      await addDoc(collection(db, 'scan_logs'), {
        ...scanResult,
        timestamp: new Date().toISOString(),
        scannedBy: guardName
      });
    } catch (error) {
      console.error("Failed to log scan attempt:", error);
    }
  },

  // 3. Fetch recent scans for the Guard Dashboard and History page
  async getRecentScans() {
    try {
      const q = query(collection(db, 'scan_logs'), orderBy('timestamp', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Failed to fetch scan logs:", error);
      return [];
    }
  }
};