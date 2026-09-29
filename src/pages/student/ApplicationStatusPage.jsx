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

// Firebase imports
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

// THE FIX: Dynamically generate the timeline if it's missing from the database
function generateTimeline(app) {
  if (app.timeline && Array.isArray(app.timeline)) return app.timeline;
  
  const steps = [{ 
    title: 'Application Submitted', 
    label: 'Application Submitted', 
    date: app.submittedDate || app.createdAt || new Date().toISOString().split('T')[0], 
    status: 'completed' 
  }];
  
  const status = (app.status || '').toLowerCase();

  if (status === 'pending' || status === 'under_review') {
     steps.push({ title: 'Under Review', label: 'Under Review', status: 'current' });
     steps.push({ title: 'Approval', label: 'Approval', status: 'upcoming' });
  } else if (status === 'approved' || status === 'for_payment') {
     steps.push({ title: 'Under Review', label: 'Under Review', status: 'completed' });
     steps.push({ title: 'Approved', label: 'Approved', date: app.reviewedDate || app.approvedDate, status: 'completed' });
     steps.push({ title: 'Payment & Issuance', label: 'Payment & Issuance', status: 'current' });
  } else if (status === 'completed' || status === 'paid' || status === 'active') {
     steps.push({ title: 'Under Review', label: 'Under Review', status: 'completed' });
     steps.push({ title: 'Approved', label: 'Approved', date: app.reviewedDate || app.approvedDate, status: 'completed' });
     steps.push({ title: 'Sticker Issued', label: 'Sticker Issued', date: app.dateIssued || new Date().toISOString().split('T')[0], status: 'completed' });
  } else if (status === 'rejected' || status === 'revoked') {
     steps.push({ title: 'Under Review', label: 'Under Review', status: 'completed' });
     steps.push({ 
       title: status === 'revoked' ? 'Revoked' : 'Rejected', 
       label: status === 'revoked' ? 'Revoked' : 'Rejected',
       date: app.revokedDate || app.reviewedDate || new Date().toISOString().split('T')[0], 
       status: 'error', 
       description: app.revokeReason || app.rejectReason 
     });
  }
  
  return steps;
}

export default function ApplicationStatusPage() {
  const { user } = useAuth();
  
  const { data: applications, isLoading } = useAsyncData(async () => {
    if (!user) return [];
    const userId = user.id || user.uid; 
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
      const typeStr = app.type || 'New Registration';
      const matchesSearch = typeStr.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesStatus = !status || app.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [applications, debouncedSearch, status]);

  const columns = [
    { key: 'type', header: 'Application', render: (row) => row.type || 'New Registration', sortable: true },
    { key: 'submittedDate', header: 'Submitted', render: (row) => row.submittedDate || row.createdAt || '—', sortable: true },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { 
      key: 'reviewedBy', 
      header: 'Reviewed By', 
      render: (row) => {
        if (row.reviewedBy) return <span className="font-medium text-slate-800">{row.reviewedBy}</span>;
        
        const status = (row.status || '').toLowerCase();
        if (status === 'pending' || status === 'under_review') {
          return <span className="text-slate-400 italic text-xs">Pending Review...</span>;
        }
        
        // Fallback if the application was processed but no specific admin name was saved
        return <span className="font-medium text-slate-700">GSU Admin</span>; 
      } 
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          {/* THE FIX: Modernized Typography to match Sidebar updates */}
          <h2 className="text-2xl font-bold font-sans text-slate-800 tracking-tight">Application Status</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Track your registration and renewal applications.</p>
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

      <Modal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.type || 'Application Details'} size="lg">
        {selected && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <StatusBadge status={selected.status} />
              <span className="text-xs font-semibold text-slate-400">
                Submitted {selected.submittedDate || selected.createdAt}
              </span>
            </div>
            {selected.reviewNotes && (
              <p className="rounded-md bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800">
                <span className="font-bold block mb-1">Review Notes:</span>
                {selected.reviewNotes}
              </p>
            )}
            
            {/* THE FIX: Passing dynamically generated steps */}
            <Timeline steps={generateTimeline(selected)} />
          </div>
        )}
      </Modal>
    </div>
  );
}