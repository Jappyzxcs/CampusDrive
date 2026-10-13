import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Replace these with your actual Firebase project settings
const firebaseConfig = {
  apiKey: "AIzaSyCcTMlw1BHMp4GEoo-VbDnwwkk6tJC_O7U",
  authDomain: "campusdrive-8421d.firebaseapp.com",
  projectId: "campusdrive-8421d",
  storageBucket: "campusdrive-8421d.firebasestorage.app",
  messagingSenderId: "30089055228",
  appId: "1:30089055228:web:cff16d7f62e3e2a2998079"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Force the app to remember the guard indefinitely
setPersistence(auth, indexedDBLocalPersistence)
  .then(() => {
    console.log("Local persistence enabled: Guard will stay logged in.");
  })
  .catch((error) => {
    console.error("Auth persistence error:", error);
  });

export { auth, db };