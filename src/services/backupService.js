import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTIONS_TO_BACKUP = [
  'vehicles', 
  'approved_vehicles', 
  'entry_logs', 
  'users',
  'visits',
  'applications'
];

export const backupService = {
  // 1. The original JSON backup for system restoration
  async generateAndDownloadBackup() {
    try {
      const backupData = {};
      for (const colName of COLLECTIONS_TO_BACKUP) {
        const snap = await getDocs(collection(db, colName));
        backupData[colName] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      backupData._metadata = { exportedAt: new Date().toISOString(), totalCollections: COLLECTIONS_TO_BACKUP.length };
      const jsonString = JSON.stringify(backupData, null, 2);
      
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `CampusDrive_Database_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (error) {
      console.error('JSON Backup failed:', error);
      throw error;
    }
  },

  // 2. NEW: The Spreadsheet Exporter
  async exportCollectionToCSV(collectionName) {
    try {
      const snap = await getDocs(collection(db, collectionName));
      if (snap.empty) throw new Error('No data found in this collection.');

      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Find every unique column name across all documents
      const headers = Array.from(new Set(docs.flatMap(Object.keys)));

      // Map the data to CSV format
      const csvRows = [
        headers.join(','), // Header row
        ...docs.map(row => 
          headers.map(fieldName => {
            let val = row[fieldName] ?? '';
            // Handle nested objects or arrays (like timestamps)
            if (typeof val === 'object') val = JSON.stringify(val);
            // Escape quotes and commas to prevent Excel from breaking the columns
            val = String(val).replace(/"/g, '""');
            return `"${val}"`;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `CampusDrive_${collectionName}_Spreadsheet_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (error) {
      console.error(`CSV Export failed for ${collectionName}:`, error);
      throw error;
    }
  }
};