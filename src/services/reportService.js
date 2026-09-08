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

      // 2. Tally up the real data
      appsSnapshot.forEach(doc => {
        const data = doc.data();
        const status = data.status || 'pending';

        // Check if it was submitted this month
        if (data.submittedDate) {
          const subDate = new Date(data.submittedDate);
          if (subDate.getMonth() === currentMonth && subDate.getFullYear() === currentYear) {
            totalThisMonth++;
          }
        }

        // Tally up the current statuses
        if (['approved', 'for_payment', 'paid', 'active'].includes(status)) {
          approved++;
        } else if (status === 'rejected') {
          rejected++;
        } else if (['pending', 'under_review'].includes(status)) {
          pending++;
        }
      });

      // 3. Format the current month for the title (e.g., "September 2026")
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const rangeString = `${monthNames[currentMonth]} ${currentYear}`;

      // 4. SAFE FALLBACKS FOR THE SCANNER (Until your physical hardware is built)
      const dailyEntries = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dailyEntries.push({
          date: d.toISOString().split('T')[0],
          valid: 0,
          flagged: 0,
        });
      }

      const violationBreakdown = [
        { type: 'No Sticker', count: 0 },
        { type: 'Expired Sticker', count: 0 },
        { type: 'Mismatched Plate', count: 0 }
      ];

      // 5. Send it all back to the ReportsPage!
      return {
        range: rangeString,
        applicationsSummary: {
          totalThisMonth,
          approved,
          rejected,
          pending
        },
        dailyEntries,
        violationBreakdown
      };
      
    } catch (error) {
      console.error("Error fetching live reports:", error);
      // Failsafe so the page doesn't crash if offline
      return {
        range: "Error loading data",
        applicationsSummary: { totalThisMonth: 0, approved: 0, rejected: 0, pending: 0 },
        dailyEntries: [],
        violationBreakdown: []
      };
    }
  }
};