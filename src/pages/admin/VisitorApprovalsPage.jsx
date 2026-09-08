import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { visitorService } from '../../services/visitorService'; // NEW: Real Firebase Service
import { DataTable } from '../../components/tables/DataTable';
import { SearchFilterBar } from '../../components/tables/SearchFilterBar';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'inside_campus', label: 'Inside Campus' },
  { value: 'completed', label: 'Completed' },
];

export default function VisitorApprovalsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // UPDATED: Fetch real data from Firestore
  const { data: realVisits, isLoading } = useAsyncData(() => visitorService.getAllVisits(), []);
  
  const [visits, setVisits] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  // Populate visits state purely from real Firebase data
  useEffect(() => {
    if (realVisits) {
      setVisits([...realVisits]);
    } else {
      setVisits([]);
    }
  }, [realVisits]);

  const filtered = useMemo(() => {
    return visits
      .filter(
        (v) =>
          v.visitorName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          v.plateNumber.toLowerCase().includes(debouncedSearch.toLowerCase()),
      )
      .filter((v) => !status || v.status === status)
      .sort((a, b) => new Date(b.requestedDate) - new Date(a.requestedDate));
  }, [visits, debouncedSearch, status]);

  // Handle real Firebase writes
  async function handleDecision(decision) {
    if (!selected) return;
    setIsSubmitting(true);
    
    try {
      const updatePayload = {
        status: decision,
        approvedBy: user?.name || 'GSU Admin',
        approvedDate: new Date().toISOString().slice(0, 10),
        reviewNotes: notes || null,
      };

      // Real database update
      await visitorService.updateVisitStatus(selected.id, updatePayload);
      
      setVisits((current) => current.map((v) => (v.id === selected.id ? { ...v, ...updatePayload } : v)));
      
      showToast(
        decision === 'approved' ? `Approved ${selected.visitorName}'s visit.` : `Rejected ${selected.visitorName}'s visit.`,
        { type: decision === 'approved' ? 'success' : 'danger' },
      );
      setSelected(null);
      setNotes('');
    } catch (error) {
      showToast('Failed to update visit status.', { type: 'danger' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns = [
    { key: 'visitorName', header: 'Visitor', sortable: true },
    { key: 'plateNumber', header: 'Plate' },
    { key: 'visitDate', header: 'Visit Date', sortable: true },
    { key: 'hostName', header: 'Host' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Visitor Approvals</h2>
        <p className="text-sm text-slate-500">Review and approve or reject visit requests.</p>
      </div>

      <DashboardCard>
        <SearchFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by visitor name or plate…"
          filters={[{ key: 'status', label: 'Status', options: STATUS_OPTIONS }]}
          activeFilters={{ status }}
          onFilterChange={(_, value) => setStatus(value)}
        />
        <DataTable
          columns={columns}
          rows={filtered}
          isLoading={isLoading}
          onRowClick={(row) => {
            setSelected(row);
            setNotes(row.reviewNotes || '');
          }}
          emptyTitle="No visit requests"
        />
      </DashboardCard>

      <Modal isOpen={Boolean(selected)} onClose={() => !isSubmitting && setSelected(null)} title={selected?.visitorName} size="lg">
        {selected && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex items-center justify-between">
              <StatusBadge status={selected.status} />
              <span className="text-xs text-slate-400">Requested {selected.requestedDate}</span>
            </div>

            <dl className="flex flex-col gap-2">
              <Row label="Purpose" value={selected.purpose} />
              <Row label="Host" value={selected.hostName} />
              <Row label="Contact Number" value={selected.contactNumber} />
              <Row label="Plate Number" value={selected.plateNumber} />
              <Row label="Vehicle Type" value={selected.vehicleType} />
              <Row label="Visit Date" value={selected.visitDate} />
            </dl>

            {['pending'].includes(selected.status) ? (
              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Add review notes (optional for approval, recommended for rejection)…"
                  rows={3}
                  className="rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-primary-500"
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => handleDecision('rejected')}
                    disabled={isSubmitting}
                    className="rounded-md border border-danger-300 px-4 py-2.5 text-sm font-semibold text-danger-700 hover:bg-danger-50 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Rejecting...' : 'Reject'}
                  </button>
                  <button 
                    onClick={() => handleDecision('approved')} 
                    disabled={isSubmitting}
                    className="btn-primary bg-accent-600 hover:bg-accent-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Approving...' : 'Approve Visit'}
                  </button>
                </div>
              </div>
            ) : (
              selected.reviewNotes && (
                <p className="rounded-md bg-slate-50 px-3 py-2 text-slate-600 border-l-4 border-slate-300 mt-2">
                  <span className="font-semibold block mb-1">Review Notes:</span>
                  {selected.reviewNotes}
                </p>
              )
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b border-slate-50 last:border-0">
      <dt className="flex-none text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}