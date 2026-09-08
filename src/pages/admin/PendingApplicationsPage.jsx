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

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under Review' },
];

export default function PendingApplicationsPage() {
  const navigate = useNavigate();
  
  // Fetch real data from Firestore
  const { data: realApplications, isLoading } = useAsyncData(() => applicationService.getPendingApplications(), []);
  
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  // INJECT DUMMY DATA: We combine the real Firebase data with our fake test rows
  const applications = useMemo(() => {
    const dummyApplication1 = {
      id: 'test-app-001',
      applicantName: 'Juan Dela Cruz',
      type: 'New Registration',
      submittedDate: '2026-08-28',
      status: 'pending'
    };

    const dummyApplication2 = {
      id: 'test-app-002',
      applicantName: 'Maria Santos',
      type: 'Renewal',
      submittedDate: '2026-08-29', 
      status: 'under_review'
    };

    return [dummyApplication1, dummyApplication2, ...(realApplications || [])];
  }, [realApplications]);

  const filtered = useMemo(() => {
    if (!applications) return [];
    return applications
      .filter((a) => ['pending', 'under_review'].includes(a.status))
      .filter((a) => a.applicantName.toLowerCase().includes(debouncedSearch.toLowerCase()))
      .filter((a) => !status || a.status === status);
  }, [applications, debouncedSearch, status]);

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
            e.stopPropagation(); // Prevents the row click from firing twice
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
        <h2 className="text-xl font-semibold text-primary-900">Pending Applications</h2>
        <p className="text-sm text-slate-500">Review and approve or reject vehicle registration applications.</p>
      </div>

      <DashboardCard>
        <SearchFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by applicant name…"
          filters={[{ key: 'status', label: 'Status', options: STATUS_OPTIONS }]}
          activeFilters={{ status }}
          onFilterChange={(_, value) => setStatus(value)}
        />
        <DataTable
          columns={columns}
          rows={filtered}
          isLoading={isLoading}
          onRowClick={(row) => navigate(ROUTES.ADMIN_APPLICATION_REVIEW.replace(':applicationId', row.id))}
          emptyTitle="No pending applications"
          emptyDescription="You're all caught up."
        />
      </DashboardCard>
    </div>
  );
}