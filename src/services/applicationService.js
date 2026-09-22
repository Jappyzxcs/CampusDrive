import { db } from '../config/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion, addDoc } from 'firebase/firestore';

// THE FIX: Better compression that handles PDFs and image loading fallbacks safely
// THE FIX: Aggressive compression (800px, 50% quality) + Debugging Logs
export const compressImageToBase64 = (file, maxDimension = 800, quality = 0.5) => {
  return new Promise((resolve) => {
    if (!file) {
      console.warn("⚠️ Compression skipped: No file provided.");
      return resolve(null);
    }

    console.log(`🔄 Compressing: ${file.name} (Original Size: ${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawData = event.target.result;

      if (file.type === 'application/pdf') {
        console.log("📄 PDF detected, skipping image compression.");
        return resolve(rawData);
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const finalBase64 = canvas.toDataURL('image/jpeg', quality);
        console.log(`✅ Compression Success! New Size approx: ${(finalBase64.length / 1024).toFixed(2)} KB`);
        resolve(finalBase64);
      };
      
      img.onerror = () => {
        console.error("❌ Image canvas error, falling back to raw upload.");
        resolve(rawData);
      };
      img.src = rawData;
    };
    reader.onerror = () => {
      console.error("❌ FileReader failed!");
      resolve(null);
    };
    reader.readAsDataURL(file);
  });
};

export const applicationService = {
  async getPendingApplications() {
    const q = query(
      collection(db, 'applications'), 
      where('status', 'in', ['pending', 'under_review'])
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getApplicationById(id) {
    const docRef = doc(db, 'applications', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Application not found');
    return { id: docSnap.id, ...docSnap.data() };
  },

  async getVehicleById(id) {
    const docRef = doc(db, 'vehicles', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() };
  },

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

  async getAllVehicles() {
    try {
      const snapshot = await getDocs(collection(db, 'vehicles'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error fetching all vehicles:", error);
      return [];
    }
  },

  async updateVehicleStatus(id, newStatus) {
    const docRef = doc(db, 'vehicles', id);
    await updateDoc(docRef, { status: newStatus });
  },

  async createApplication(applicationData) {
    try {
      const docRef = await addDoc(collection(db, 'applications'), applicationData);
      return docRef.id;
    } catch (error) {
      console.error("Error creating application:", error);
      throw error;
    }
  },

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