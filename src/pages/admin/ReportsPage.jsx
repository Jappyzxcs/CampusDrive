import { useAsyncData } from '../../hooks/useAsyncData';
import { reportService } from '../../services/reportService'; 
import { DashboardCard } from '../../components/cards/DashboardCard';
import { StatCard } from '../../components/cards/StatCard';
import { BarChart } from '../../components/charts/BarChart';
import { CardSkeleton, Skeleton } from '../../components/common/LoadingSkeleton';

// NEW: Import auth tools to check the user's role
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';

export default function ReportsPage() {
  // Grab the current user's role
  const { role } = useAuth();
  
  const { data: reports, isLoading } = useAsyncData(() => reportService.getReports(), []);

  // Filter out 'Mismatched Plate' if the user is BAO
  const displayViolations = reports?.violationBreakdown?.filter(v => {
    if (role === ROLES.BAO && v.type === 'Mismatched Plate') {
      return false; // Hide this row
    }
    return true; // Keep everything else
  }) || [];

  // Calculate the max count safely based on the filtered list so the progress bars scale correctly
  const maxViolationCount = displayViolations.length > 0 
    ? Math.max(...displayViolations.map((x) => x.count)) 
    : 1; 

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Reports</h2>
        <p className="text-sm text-slate-500">{reports?.range || 'Loading range…'}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Applications This Month" value={reports?.applicationsSummary?.totalThisMonth || 0} icon="clipboard" />
            <StatCard label="Approved" value={reports?.applicationsSummary?.approved || 0} icon="check" tone="accent" />
            <StatCard label="Rejected" value={reports?.applicationsSummary?.rejected || 0} icon="alert" tone="danger" />
            <StatCard label="Still Pending" value={reports?.applicationsSummary?.pending || 0} icon="clipboard" tone="secondary" />
          </>
        )}
      </div>

      <DashboardCard title="Gate Entries per Day (valid vs. flagged)">
        {isLoading || !reports?.dailyEntries ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <BarChart data={reports.dailyEntries.map((d) => ({ label: d.date.slice(5), value: d.valid, secondaryValue: d.flagged }))} />
        )}
      </DashboardCard>

      <DashboardCard title="Violation Breakdown">
        {isLoading || !reports?.violationBreakdown ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <ul className="flex flex-col gap-3">
            {displayViolations.map((v) => (
              <li key={v.type} className="flex items-center gap-3">
                <span className="w-40 flex-none text-sm text-slate-600">{v.type}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-danger-400"
                    style={{ width: `${maxViolationCount > 0 ? (v.count / maxViolationCount) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-6 flex-none text-right text-sm font-medium text-slate-700">{v.count}</span>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>
    </div>
  );
}