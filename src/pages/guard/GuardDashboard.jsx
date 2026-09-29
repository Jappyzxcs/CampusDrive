import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/common/Icon';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { CardSkeleton, Skeleton } from '../../components/common/LoadingSkeleton';
import { ROUTES } from '../../constants/routes';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function GuardDashboard() {
  const [recentScans, setRecentScans] = useState([]);
  const [scansLoading, setScansLoading] = useState(true);
  const [todayOffenses, setTodayOffenses] = useState(0);
  const [offensesLoading, setOffensesLoading] = useState(true);

  useEffect(() => {
    // 1. Live listener for the 5 most recent scans
    const unsubScans = onSnapshot(collection(db, 'entry_logs'), (snap) => {
      const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setRecentScans(logs.slice(0, 5));
      setScansLoading(false);
    });

    // 2. Live listener for Offenses flagged TODAY
    const unsubOffenses = onSnapshot(collection(db, 'offenses'), (snap) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let count = 0;
      
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.timestamp && new Date(data.timestamp) >= today) {
          count++;
        }
      });
      setTodayOffenses(count);
      setOffensesLoading(false);
    });

    return () => {
      unsubScans();
      unsubOffenses();
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      {/* Primary Action Button */}
      <Link
        to={ROUTES.GUARD_SCANNER}
        className="flex flex-col items-center gap-3 rounded-2xl bg-primary-600 px-6 py-10 text-white shadow-card active:bg-primary-700 transition-colors"
      >
        <Icon name="scan" className="h-12 w-12" />
        <span className="text-xl font-bold">Scan Sticker</span>
        <span className="text-sm text-primary-100">Tap to verify a vehicle at the gate</span>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        {offensesLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <div className="card-surface flex flex-col items-center gap-1 p-4 text-center border border-slate-100">
              <span className={`text-2xl font-bold ${todayOffenses > 0 ? 'text-danger-600' : 'text-slate-400'}`}>
                {todayOffenses}
              </span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Flags Today</span>
            </div>
            <div className="card-surface flex flex-col items-center gap-1 p-4 text-center border border-slate-100 bg-emerald-50/30">
              <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 mt-2">
                <Icon name="check" className="h-5 w-5" /> Live Sync
              </span>
              <span className="text-xs font-medium text-emerald-600/70 mt-1">Database Connected</span>
            </div>
          </>
        )}
      </div>

      <DashboardCard
        title="Recent Scans"
        action={
          <Link to={ROUTES.GUARD_SCAN_HISTORY} className="text-xs font-bold text-primary-700 hover:text-primary-800 uppercase tracking-wide">
            View all
          </Link>
        }
      >
        {scansLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : recentScans.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">No scans recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {recentScans.map((scan) => (
              <li key={scan.id} className="flex items-center justify-between gap-2 text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-700">{scan.plateNumber || 'Unknown plate'}</span>
                  <span className="text-xs text-slate-400">{new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <StatusBadge status={scan.result} />
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <Link to={ROUTES.GUARD_MANUAL_LOOKUP} className="btn-secondary justify-center py-3">
        Manual Sticker Lookup
      </Link>
    </div>
  );
}