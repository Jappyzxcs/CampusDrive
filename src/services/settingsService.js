import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const SETTINGS_DOC_ID = 'config';
const COLLECTION_NAME = 'system_settings';

const DEFAULT_SETTINGS = {
  autoFlagDuplicates: true,
  requireManualReviewBelowConfidence: true,
  notifyOnExpiringSoon: true,
  ocrConfidenceThreshold: 85,
};

export const settingsService = {
  async getSettings() {
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { ...DEFAULT_SETTINGS, ...snap.data() };
      }
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error("Error fetching settings:", error);
      return DEFAULT_SETTINGS;
    }
  },

  async updateSettings(newSettings) {
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      // Using merge: true so we don't accidentally overwrite future setting keys
      await setDoc(docRef, newSettings, { merge: true });
      return true;
    } catch (error) {
      console.error("Error updating settings:", error);
      throw error;
    }
  }
};