import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { DataTable } from '../../components/tables/DataTable';
import { SearchFilterBar } from '../../components/tables/SearchFilterBar';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { Timeline } from '../../components/common/Timeline';
import { Modal } from '../../components/common/Modal';
import { ROUTES } from '../../constants/routes';

// THE FIX: Import real Firebase tools instead of mock data
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function ApplicationStatusPage() {
  const { user } = useAuth();
  
  // THE FIX: Query real applications assigned to this specific user's ID
  const { data: applications, isLoading } = useAsyncData(async () => {
    if (!user) return [];
    const userId = user.id || user.uid; // Handle both ID property names
    const q = query(collection(db, 'applications'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }, [user]);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const debouncedSearch = useDebouncedValue(search);

  const filtered = useMemo(() => {
    if (!applications) return [];
    return applications.filter((app) => {
      const matchesSearch = app.type.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesStatus = !status || app.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [applications, debouncedSearch, status]);

  const columns = [
    { key: 'type', header: 'Application', sortable: true },
    { key: 'submittedDate', header: 'Submitted', sortable: true },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'reviewedBy', header: 'Reviewed By', render: (row) => row.reviewedBy || '—' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-primary-900">Application Status</h2>
          <p className="text-sm text-slate-500">Track your registration and renewal applications.</p>
        </div>
        <Link to={ROUTES.STUDENT_VEHICLE_REGISTRATION} className="btn-primary">
          New Application
        </Link>
      </div>

      <DashboardCard>
        <SearchFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by application type…"
          filters={[{ key: 'status', label: 'Status', options: STATUS_OPTIONS }]}
          activeFilters={{ status }}
          onFilterChange={(_, value) => setStatus(value)}
        />
        <DataTable
          columns={columns}
          rows={filtered}
          isLoading={isLoading}
          onRowClick={setSelected}
          emptyTitle="No applications found"
          emptyDescription="Try a different search or filter."
        />
      </DashboardCard>

      <Modal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.type} size="lg">
        {selected && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <StatusBadge status={selected.status} />
              <span className="text-xs text-slate-400">Submitted {selected.submittedDate}</span>
            </div>
            {selected.reviewNotes && (
              <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{selected.reviewNotes}</p>
            )}
            <Timeline steps={selected.timeline} />
          </div>
        )}
      </Modal>
    </div>
  );
}
