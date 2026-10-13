import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export const backupService = {
  exportCollectionToCSV: async (collectionName, exportMonth = '') => {
    try {
      const snap = await getDocs(collection(db, collectionName));
      let records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (exportMonth) {
        records = records.filter(item => {
          const dateVal = item.timestamp || item.createdAt || item.registrationDate || item.date;
          if (!dateVal) return false;
          const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
          if (isNaN(d.getTime())) return false;
          const recordMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          return recordMonth === exportMonth;
        });
      }

      if (records.length === 0) {
        throw new Error(`No records found for ${collectionName} in ${exportMonth || 'this period'}.`);
      }

      // THE FIX: Filter out nested objects, arrays, and long base64/image URLs to keep columns clean
      const skipKeys = ['documentUrls', 'vehicleImageUrl', 'license', 'or', 'cr', 'output_image', 'predictions'];
      const headers = Array.from(
        new Set(records.flatMap(record => Object.keys(record)))
      ).filter(header => {
        if (skipKeys.includes(header)) return false;
        const sampleVal = records[0][header];
        return typeof sampleVal !== 'object' && sampleVal !== null;
      });

      const csvRows = [];
      csvRows.push(headers.join(',')); // Add Header Row

      for (const row of records) {
        const values = headers.map(header => {
          let val = row[header];
          
          if (val === null || val === undefined) {
            val = '';
          } else if (val.toDate) {
            val = val.toDate().toLocaleString();
          } else if (typeof val === 'string') {
            // Escape double quotes and clean up newlines so CSV cells don't break
            val = `"${val.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
          }
          
          return val;
        });
        csvRows.push(values.join(','));
      }

      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      const fileName = exportMonth 
        ? `${collectionName}_export_${exportMonth}.csv` 
        : `${collectionName}_full_export.csv`;
        
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error("CSV Export Error:", error);
      throw error;
    }
  }
};