import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';

// ADDED: Real Firebase services
import { applicationService } from '../../services/applicationService';
import { reportService } from '../../services/reportService'; 

import { StatCard } from '../../components/cards/StatCard';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CardSkeleton, Skeleton } from '../../components/common/LoadingSkeleton';
import { BarChart } from '../../components/charts/BarChart';
import { ROLES } from '../../constants/roles';
import { ROUTES } from '../../constants/routes';

export default function AdminDashboard() {
  const { role } = useAuth();
  return role === ROLES.BAO ? <BaoDashboard /> : <GsuDashboard />;
}

function GsuDashboard() {
  const { data: vehicles, isLoading: vLoading } = useAsyncData(() => applicationService.getAllVehicles(), []);
  const { data: applications, isLoading: aLoading } = useAsyncData(() => applicationService.getPendingApplications(), []);
  const { data: reports, isLoading: rLoading } = useAsyncData(() => reportService.getReports(), []);

  const isLoading = vLoading || aLoading || rLoading;

  const stats = !isLoading && vehicles && applications ? {
    total: vehicles.length,
    pending: applications.filter((a) => ['pending', 'under_review'].includes(a.status)).length,
    // THE FIX: Now counts 'paid', 'for_payment', and legacy 'approved' test data
    approved: vehicles.filter((v) => v.status === 'paid' || v.status === 'for_payment' || v.status === 'approved').length,
    expired: vehicles.filter((v) => v.status === 'expired').length,
  } : { total: 0, pending: 0, approved: 0, expired: 0 };

  const recentApplications = !isLoading && applications ? [...applications].reverse().slice(0, 5) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Administrator Dashboard</h2>
        <p className="text-sm text-slate-500">GSU overview &middot; campus-wide vehicle accreditation.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Total Vehicles" value={stats.total} icon="car" tone="primary" />
            <StatCard label="Pending Applications" value={stats.pending} icon="clipboard" tone="secondary" />
            <StatCard label="Approved/Active" value={stats.approved} icon="check" tone="accent" />
            <StatCard label="Expired" value={stats.expired} icon="alert" tone="danger" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DashboardCard title="Gate Entries — Last 7 Days" className="lg:col-span-2">
          {isLoading || !reports?.dailyEntries ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <BarChart data={reports.dailyEntries.map((d) => ({ label: d.date.slice(5), value: d.valid, secondaryValue: d.flagged }))} />
          )}
        </DashboardCard>

        <DashboardCard title="Recent Applications" action={<Link to={ROUTES.ADMIN_PENDING_APPLICATIONS} className="text-xs font-medium text-primary-700 hover:text-primary-800">View all</Link>}>
          {isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {recentApplications.map((app) => (
                <li key={app.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-700">{app.applicantName} &middot; {app.type}</span>
                  <StatusBadge status={app.status} />
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}

// NEW REWRITTEN BAO DASHBOARD
function BaoDashboard() {
  const { data: vehicles, isLoading } = useAsyncData(() => applicationService.getAllVehicles(), []);

  const awaitingPayment = !isLoading && vehicles ? vehicles.filter((v) => v.status === 'for_payment').length : 0;
  // THE FIX: Now counts 'paid' and legacy 'approved' test data instead of 'active'
  const completed = !isLoading && vehicles ? vehicles.filter((v) => v.status === 'paid' || v.status === 'approved').length : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">BAO Dashboard</h2>
        <p className="text-sm text-slate-500">Payment collection and physical sticker issuance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Awaiting Payment & Pickup" value={awaitingPayment} icon="alert" tone="secondary" />
            <StatCard label="Completed Issuances" value={completed} icon="check" tone="accent" />
          </>
        )}
      </div>

      <DashboardCard
        title="Ready for Payment"
        action={
          <Link to={ROUTES.ADMIN_STICKER_MANAGEMENT} className="text-xs font-medium text-primary-700 hover:text-primary-800">
            Open BAO Window
          </Link>
        }
      >
        <p className="text-sm text-slate-600">
          You currently have {awaitingPayment} vehicles approved by GSU waiting to pay their fees.
        </p>
      </DashboardCard>
    </div>
  );
}