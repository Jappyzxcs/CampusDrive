import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { visitorService } from '../../services/visitorService'; // REAL SERVICE
import { StatCard } from '../../components/cards/StatCard';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { CardSkeleton, Skeleton } from '../../components/common/LoadingSkeleton';
import { ROUTES } from '../../constants/routes';

export default function VisitorDashboard() {
  const { user } = useAuth();
  
  // Fetch from Firebase
  const { data: visits, isLoading } = useAsyncData(
    () => (user?.id ? visitorService.getVisitsByVisitorId(user.id) : Promise.resolve([])),
    [user?.id],
  );

  const sorted = visits ? [...visits].sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate)) : [];
  const currentlyInside = sorted.find((v) => v.status === 'inside_campus');
  const nextUpcoming = sorted.find((v) => v.status === 'approved');
  const pendingCount = sorted.filter((v) => v.status === 'pending').length;
  const approvedCount = sorted.filter((v) => ['approved', 'inside_campus', 'completed'].includes(v.status)).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">
  Welcome, {(user?.fullName || user?.name || 'Visitor').split(' ')[0]}
</h2>
        <p className="text-sm text-slate-500">Track your campus visit requests here.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Current Status"
              value={
                currentlyInside ? (
                  <StatusBadge status="inside_campus" />
                ) : nextUpcoming ? (
                  <StatusBadge status="approved" />
                ) : (
                  'No active visit'
                )
              }
              icon="idcard"
              tone={currentlyInside ? 'accent' : 'primary'}
            />
            <StatCard label="Approved Visits" value={approvedCount} icon="check" tone="accent" />
            <StatCard label="Pending Requests" value={pendingCount} icon="clipboard" tone="secondary" />
          </>
        )}
      </div>

      <DashboardCard title={currentlyInside ? 'You Are Currently On Campus' : 'Next Approved Visit'}>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : currentlyInside ? (
          <VisitSummary visit={currentlyInside} note={`Checked in at ${new Date(currentlyInside.checkInTime).toLocaleTimeString()}`} />
        ) : nextUpcoming ? (
          <VisitSummary visit={nextUpcoming} note={`Scheduled for ${nextUpcoming.visitDate}`} />
        ) : (
          <EmptyState
            title="No upcoming visits"
            description="Register a visit and wait for GSU approval before heading to campus."
            action={
              <Link to={ROUTES.VISITOR_REGISTER} className="btn-primary">
                Register a Visit
              </Link>
            }
          />
        )}
      </DashboardCard>
    </div>
  );
}

function VisitSummary({ visit, note }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-800">{visit.purpose}</p>
        <StatusBadge status={visit.status} />
      </div>
      <p className="text-slate-500">Host: {visit.hostName}</p>
      <p className="text-slate-500">Plate: {visit.plateNumber}</p>
      <p className="text-xs text-slate-400">{note}</p>
    </div>
  );
}