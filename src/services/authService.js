import { auth, db } from '../config/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  getAuth,
  sendPasswordResetEmail // ADDED: For password resets
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore'; // ADDED: collection, getDocs, updateDoc

export const authService = {
  async login(credentials) {
    const { email, password } = credentials;
    
    // 1. Authenticate with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Fetch the user's specific role and details from Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      throw new Error('User profile data not found in the database.');
    }

    // 3. Return the combined user profile
    return {
      id: user.uid,
      email: user.email,
      ...userDoc.data(),
    };
  },

  async register(userData) {
    const { email, password, role, ...extraDetails } = userData;

    // 1. Create the secure account in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Prepare their database profile
    const newUserRecord = {
      email,
      role: role || 'student', // Default fallback
      ...extraDetails,
      dateCreated: new Date().toISOString().slice(0, 10), 
    };

    // 3. Save the profile to Firestore under the 'users' collection
    await setDoc(doc(db, 'users', user.uid), newUserRecord);

    // 4. Return the new user object
    return {
      id: user.uid,
      ...newUserRecord,
    };
  },

  // Specialized function for Admins to create staff accounts without being logged out
  async adminCreateStaffAccount(email, password, userData) {
    // 1. Grab the primary Firebase app configuration
    const primaryApp = auth.app;
    
    // 2. Spin up a secondary Firebase instance
    const secondaryApp = initializeApp(primaryApp.options, 'AdminAccountCreator');
    const secondaryAuth = getAuth(secondaryApp);

    try {
      // 3. Create the user in Firebase Auth using the SECONDARY instance
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUid = userCredential.user.uid;

      // 4. Save their specific Roles and Details into Firestore
      const newUserRecord = {
        uid: newUid,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        type: 'Staff',
        status: 'active',
        dateCreated: new Date().toISOString().slice(0, 10),
      };

      await setDoc(doc(db, 'users', newUid), newUserRecord);

      // 5. Instantly log out of the secondary instance to clean up
      await signOut(secondaryAuth);
      
      return newUid;
    } catch (error) {
      console.error("Firebase Auth Error:", error);
      throw error;
    }
  },

  // --- NEW: Fetch all users for Admin User Management ---
  async getAllUsers() {
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // --- NEW ADMIN ACTIONS ---

  // 1. Update user details (Name & Role)
  async updateUserProfile(uid, data) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      name: data.name,
      role: data.role,
    });
  },

  // 2. Suspend or Reactivate a user
  async toggleUserStatus(uid, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { status: newStatus });
    return newStatus;
  },

  // 3. Send a password reset email
  async sendResetEmail(email) {
    await sendPasswordResetEmail(auth, email);
  },

  async logout() {
    await signOut(auth);
  }
};