import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { applicationService } from '../../services/applicationService';
import { DataTable } from '../../components/tables/DataTable';
import { SearchFilterBar } from '../../components/tables/SearchFilterBar';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { ROUTES } from '../../constants/routes';

export default function PendingApplicationsPage() {
  const navigate = useNavigate();
  
  const { data: applications, isLoading } = useAsyncData(() => applicationService.getPendingApplications(), []);
  
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  // THE FIX: "Pending" and "Under Review" are now fully merged into a single queue
  const filtered = useMemo(() => {
    if (!applications) return [];
    return applications
      .filter((a) => ['pending', 'under_review'].includes(a.status))
      .filter((a) => a.applicantName?.toLowerCase().includes(debouncedSearch.toLowerCase()));
  }, [applications, debouncedSearch]);

  const columns = [
    { key: 'applicantName', header: 'Applicant', sortable: true },
    { key: 'type', header: 'Type', sortable: true },
    { key: 'submittedDate', header: 'Submitted', sortable: true },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { 
      key: 'actions', 
      header: 'Action', 
      render: (row) => (
        <button 
          onClick={(e) => {
            e.stopPropagation(); 
            navigate(ROUTES.ADMIN_APPLICATION_REVIEW.replace(':applicationId', row.id));
          }}
          className="text-sm font-medium text-primary-700 hover:text-primary-900 transition-colors"
        >
          Review &rarr;
        </button>
      ) 
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Application Queue</h2>
        <p className="text-sm text-slate-500">Review and manage vehicle registration applications.</p>
      </div>

      <DashboardCard>
        {/* THE FIX: Removed the Status Filter dropdown completely */}
        <SearchFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by applicant name…"
        />
        <DataTable
          columns={columns}
          rows={filtered}
          isLoading={isLoading}
          onRowClick={(row) => navigate(ROUTES.ADMIN_APPLICATION_REVIEW.replace(':applicationId', row.id))}
          emptyTitle="Queue is empty"
          emptyDescription="You're all caught up."
        />
      </DashboardCard>
    </div>
  );
}