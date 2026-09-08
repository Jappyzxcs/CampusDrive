import { Link } from 'react-router-dom';
import { useAsyncData } from '../../hooks/useAsyncData';
import { Icon } from '../../components/common/Icon';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { CardSkeleton, Skeleton } from '../../components/common/LoadingSkeleton';
import { ROUTES } from '../../constants/routes';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase'; // Ensure path is correct

export default function GuardDashboard() {
  
  // Fetch live scans from Firebase
  const fetchScans = async () => {
    const snapshot = await getDocs(collection(db, 'scans'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };

  // Fetch live violations from Firebase
  const fetchViolations = async () => {
    const snapshot = await getDocs(collection(db, 'violations'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };

  const { data: scans, isLoading: scansLoading } = useAsyncData(fetchScans, []);
  const { data: violations, isLoading: violationsLoading } = useAsyncData(fetchViolations, []);

  const recentScans = scans ? [...scans].reverse().slice(0, 5) : [];
  const openAlerts = violations?.filter((v) => v.status === 'under_investigation').length ?? 0;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      {/* Big, thumb-reachable scan action — this is the primary guard action */}
      <Link
        to={ROUTES.GUARD_SCANNER}
        className="flex flex-col items-center gap-3 rounded-2xl bg-primary-600 px-6 py-10 text-white shadow-card
          active:bg-primary-700"
      >
        <Icon name="scan" className="h-12 w-12" />
        <span className="text-xl font-bold">Scan Sticker</span>
        <span className="text-sm text-primary-100">Tap to verify a vehicle at the gate</span>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        {violationsLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <div className="card-surface flex flex-col items-center gap-1 p-4 text-center">
              <span className={`text-2xl font-bold ${openAlerts > 0 ? 'text-danger-600' : 'text-accent-600'}`}>
                {openAlerts}
              </span>
              <span className="text-xs text-slate-500">Open Alerts</span>
            </div>
            <div className="card-surface flex flex-col items-center gap-1 p-4 text-center">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-accent-700">
                <Icon name="check" className="h-4 w-4" /> Synced
              </span>
              <span className="text-xs text-slate-500">All scans uploaded</span>
            </div>
          </>
        )}
      </div>

      <DashboardCard
        title="Recent Scans"
        action={
          <Link to={ROUTES.GUARD_SCAN_HISTORY} className="text-xs font-medium text-primary-700 hover:text-primary-800">
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
        ) : (
          <ul className="flex flex-col gap-3">
            {recentScans.map((scan) => (
              <li key={scan.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-slate-700">{scan.plateNumber || 'Unknown plate'}</span>
                <StatusBadge status={scan.result} />
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <Link to={ROUTES.GUARD_MANUAL_LOOKUP} className="btn-secondary justify-center">
        Manual Sticker Lookup
      </Link>
    </div>
  );
}