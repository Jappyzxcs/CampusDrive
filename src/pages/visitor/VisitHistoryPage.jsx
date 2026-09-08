import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { visitorService } from '../../services/visitorService'; // REAL SERVICE
import { DataTable } from '../../components/tables/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { Modal } from '../../components/common/Modal';
import { ROUTES } from '../../constants/routes';

export default function VisitHistoryPage() {
  const { user } = useAuth();
  
  // Fetch from Firebase
  const { data: visits, isLoading } = useAsyncData(
    () => (user?.id ? visitorService.getVisitsByVisitorId(user.id) : Promise.resolve([])),
    [user?.id],
  );
  
  const [selected, setSelected] = useState(null);

  const sorted = visits ? [...visits].sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate)) : [];

  const columns = [
    { key: 'visitDate', header: 'Visit Date', sortable: true },
    { key: 'purpose', header: 'Purpose', render: (row) => <span className="line-clamp-1 max-w-xs">{row.purpose}</span> },
    { key: 'hostName', header: 'Host' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-primary-900">Visit History</h2>
          <p className="text-sm text-slate-500">All your past and upcoming visit requests.</p>
        </div>
        <Link to={ROUTES.VISITOR_REGISTER} className="btn-primary">
          New Visit
        </Link>
      </div>

      <DashboardCard>
        <DataTable
          columns={columns}
          rows={sorted}
          isLoading={isLoading}
          onRowClick={setSelected}
          emptyTitle="No visits yet"
          emptyDescription="Register your first visit to get started."
        />
      </DashboardCard>

      <Modal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.purpose}>
        {selected && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <StatusBadge status={selected.status} />
            </div>
            <Row label="Visit Date" value={selected.visitDate} />
            <Row label="Plate Number" value={selected.plateNumber} />
            <Row label="Vehicle Type" value={selected.vehicleType} />
            <Row label="Host" value={selected.hostName} />
            <Row label="Contact" value={selected.contactNumber} />
            <Row label="Requested" value={selected.requestedDate} />
            {selected.approvedBy && <Row label="Reviewed By" value={selected.approvedBy} />}
            {selected.reviewNotes && (
              <p className="rounded-md bg-slate-50 px-3 py-2 text-slate-600">{selected.reviewNotes}</p>
            )}
            {selected.checkInTime && <Row label="Checked In" value={new Date(selected.checkInTime).toLocaleString()} />}
            {selected.checkOutTime && <Row label="Checked Out" value={new Date(selected.checkOutTime).toLocaleString()} />}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="flex-none text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}