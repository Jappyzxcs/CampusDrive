import { db } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';

export const reportService = {
  async getReports() {
    try {
      // 1. Fetch ALL applications from Firebase
      const appsSnapshot = await getDocs(collection(db, 'applications'));
      
      let totalThisMonth = 0;
      let approved = 0;
      let rejected = 0;
      let pending = 0;

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      // 2. Tally up the real application data
      appsSnapshot.forEach(doc => {
        const data = doc.data();
        const status = data.status || 'pending';

        if (data.submittedDate) {
          const subDate = new Date(data.submittedDate);
          if (subDate.getMonth() === currentMonth && subDate.getFullYear() === currentYear) {
            totalThisMonth++;
          }
        }

        if (['approved', 'for_payment', 'paid', 'active'].includes(status)) {
          approved++;
        } else if (status === 'rejected') {
          rejected++;
        } else if (['pending', 'under_review'].includes(status)) {
          pending++;
        }
      });

      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const rangeString = `${monthNames[currentMonth]} ${currentYear}`;

      // 3. PREPARE THE 7-DAY CHART STRUCTURE
      const dailyEntriesMap = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dailyEntriesMap[dateStr] = { date: dateStr, valid: 0, flagged: 0 };
      }

      // 4. FETCH REAL GATE LOGS (Using exact collection name 'entry_logs')
      const logsSnapshot = await getDocs(collection(db, 'entry_logs'));
      
      logsSnapshot.forEach(doc => {
        const log = doc.data();
        
        // Parse the ISO string timestamp directly based on the database schema
        if (log.timestamp) {
          const logDate = new Date(log.timestamp);
          
          // Ensure it's a valid date before proceeding
          if (!isNaN(logDate.getTime())) {
            const dateStr = logDate.toISOString().split('T')[0];
            
            // If the log happened in the last 7 days, tally it up
            if (dailyEntriesMap[dateStr]) {
              const isScannedValid = log.result?.toLowerCase() === 'valid';
              
              if (isScannedValid) {
                dailyEntriesMap[dateStr].valid++;
              } else {
                dailyEntriesMap[dateStr].flagged++;
              }
            }
          }
        }
      });

      // Convert the map back into a sorted array for the chart
      const dailyEntries = Object.values(dailyEntriesMap).sort((a, b) => a.date.localeCompare(b.date));

      const violationBreakdown = [
        { type: 'No Sticker', count: 0 },
        { type: 'Expired Sticker', count: 0 },
        { type: 'Mismatched Plate', count: 0 }
      ];

      // 5. Send it all back to the Dashboard
      return {
        range: rangeString,
        applicationsSummary: { totalThisMonth, approved, rejected, pending },
        dailyEntries,
        violationBreakdown
      };
      
    } catch (error) {
      console.error("Error fetching live reports:", error);
      return {
        range: "Error loading data",
        applicationsSummary: { totalThisMonth: 0, approved: 0, rejected: 0, pending: 0 },
        dailyEntries: [],
        violationBreakdown: []
      };
    }
  }
};