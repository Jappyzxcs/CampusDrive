import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';

// Real Firebase services
import { applicationService } from '../../services/applicationService';
import { reportService } from '../../services/reportService'; 

import { StatusBadge } from '../../components/common/StatusBadge';
import { CardSkeleton, Skeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState'; // ADDED THIS
import { BarChart } from '../../components/charts/BarChart';
import { Icon } from '../../components/common/Icon';
import { ROLES } from '../../constants/roles';
import { ROUTES } from '../../constants/routes';

export default function AdminDashboard() {
  const { role } = useAuth();
  return role === ROLES.BAO ? <BaoDashboard /> : <GsuDashboard />;
}

// ----------------------------------------------------------------------
// Custom Metric Card Component
// ----------------------------------------------------------------------
function DashboardMetricCard({ title, value, icon, tone }) {
  const tones = {
    primary: 'bg-blue-50 text-blue-500',
    secondary: 'bg-amber-50 text-amber-500',
    accent: 'bg-emerald-50 text-emerald-500',
    danger: 'bg-rose-50 text-rose-500'
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
        {title}
      </span>
      <div className="flex justify-between items-center mt-2">
        <h2 className="text-4xl font-extrabold font-sans text-slate-900 tracking-tight">
          {value}
        </h2>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${tones[tone] || tones.primary}`}>
          <Icon name={icon} className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// GSU (Head Admin) Dashboard
// ----------------------------------------------------------------------
function GsuDashboard() {
  const { data: vehicles, isLoading: vLoading } = useAsyncData(() => applicationService.getAllVehicles(), []);
  const { data: applications, isLoading: aLoading } = useAsyncData(() => applicationService.getPendingApplications(), []);
  const { data: reports, isLoading: rLoading } = useAsyncData(() => reportService.getReports(), []);

  const isLoading = vLoading || aLoading || rLoading;

  const stats = !isLoading && vehicles && applications ? {
    total: vehicles.length,
    pending: applications.filter((a) => ['pending', 'under_review'].includes(a.status)).length,
    approved: vehicles.filter((v) => v.status === 'paid' || v.status === 'for_payment' || v.status === 'approved').length,
    expired: vehicles.filter((v) => v.status === 'expired').length,
  } : { total: 0, pending: 0, approved: 0, expired: 0 };

  const recentApplications = !isLoading && applications ? [...applications].reverse().slice(0, 5) : [];

  // Check if we actually have gate entry data to show
  const hasGateData = reports?.dailyEntries?.some(d => d.valid > 0 || d.flagged > 0);

  return (
    <div className="flex flex-col gap-8 font-sans text-slate-800 pb-10">
      
      {/* Header Section */}
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-3xl font-extrabold font-sans tracking-tight text-slate-900">
          Administrator Dashboard
        </h1>
        <p className="text-base text-slate-500 font-medium">
          GSU overview &middot; campus-wide vehicle accreditation.
        </p>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <DashboardMetricCard title="Total Vehicles" value={stats.total} icon="car" tone="primary" />
            <DashboardMetricCard title="Pending Applications" value={stats.pending} icon="clipboard" tone="secondary" />
            <DashboardMetricCard title="Approved/Active" value={stats.approved} icon="check" tone="accent" />
            {/* FIXED: Reverted icon="alert-triangle" back to icon="alert" */}
            <DashboardMetricCard title="Expired" value={stats.expired} icon="alert" tone="danger" />
          </>
        )}
      </div>

      {/* Lower Dashboard Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        
        {/* Chart Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:col-span-2 flex flex-col hover:shadow-md transition-shadow">
          <div className="mb-6">
            <h3 className="text-lg font-extrabold text-slate-900 font-sans tracking-tight">Gate Entries — Last 7 Days</h3>
          </div>
          <div className="min-h-[250px] flex-1 flex flex-col justify-center">
            {isLoading || !reports?.dailyEntries ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : !hasGateData ? (
              // FIXED: Shows a clean empty state instead of a broken blank graph
              <div className="py-8">
                <EmptyState 
                  title="No Gate Data" 
                  description="There are no vehicle entries recorded for the past 7 days." 
                />
              </div>
            ) : (
              <BarChart data={reports.dailyEntries.map((d) => ({ label: d.date.slice(5), value: d.valid, secondaryValue: d.flagged }))} />
            )}
          </div>
        </div>

        {/* Recent Applications Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-extrabold text-slate-900 font-sans tracking-tight">Recent Applications</h3>
            <Link to={ROUTES.ADMIN_PENDING_APPLICATIONS} className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">
              View all
            </Link>
          </div>
          
          {isLoading ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : (
            <div className="flex flex-col">
              {recentApplications.map((app, index) => (
                <div 
                  key={app.id} 
                  className={`flex items-center justify-between py-4 ${index !== recentApplications.length - 1 ? 'border-b border-slate-100' : ''}`}
                >
                  <div className="flex flex-col gap-1 pr-4">
                    <span className="text-sm font-bold text-slate-900 truncate max-w-[180px]">
                      {app.applicantName}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {app.type || 'New Registration'}
                    </span>
                  </div>
                  <StatusBadge status={app.status} />
                </div>
              ))}
              
              {recentApplications.length === 0 && (
                <div className="py-8 text-center text-sm font-medium text-slate-500">
                  No recent applications found.
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// BAO Dashboard
// ----------------------------------------------------------------------
function BaoDashboard() {
  const { data: vehicles, isLoading } = useAsyncData(() => applicationService.getAllVehicles(), []);

  const awaitingPayment = !isLoading && vehicles ? vehicles.filter((v) => v.status === 'for_payment').length : 0;
  const completed = !isLoading && vehicles ? vehicles.filter((v) => v.status === 'paid' || v.status === 'approved').length : 0;

  return (
    <div className="flex flex-col gap-8 font-sans text-slate-800 pb-10">
      
      {/* Header Section */}
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-3xl font-extrabold font-sans tracking-tight text-slate-900">
          BAO Dashboard
        </h1>
        <p className="text-base text-slate-500 font-medium">
          Payment collection and physical sticker issuance.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <CardSkeleton key={i} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <DashboardMetricCard title="Awaiting Payment & Pickup" value={awaitingPayment} icon="alert" tone="secondary" />
            <DashboardMetricCard title="Completed Issuances" value={completed} icon="check" tone="accent" />
          </>
        )}
      </div>

      {/* Action Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 hover:shadow-md transition-shadow">
        <div>
          <h3 className="text-xl font-extrabold text-slate-900 font-sans tracking-tight mb-2">
            Ready for Payment
          </h3>
          <p className="text-sm font-medium text-slate-500">
            You currently have <strong className="text-slate-800">{awaitingPayment}</strong> vehicles approved by GSU waiting to pay their fees.
          </p>
        </div>
        <Link 
          to={ROUTES.ADMIN_STICKER_MANAGEMENT} 
          className="shrink-0 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold tracking-wide hover:bg-blue-700 transition-all shadow-sm hover:shadow-md whitespace-nowrap"
        >
          Open BAO Window
        </Link>
      </div>
    </div>
  );
}