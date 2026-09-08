import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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
export const auth = getAuth(app);
export const db = getFirestore(app);