import { useMemo, useState } from 'react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { applicationService } from '../../services/applicationService'; 
import { DataTable } from '../../components/tables/DataTable';
import { SearchFilterBar } from '../../components/tables/SearchFilterBar';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext'; 
// NEW: Import auth and roles to check who is viewing the page
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active/Issued' },
  { value: 'for_payment', label: 'Awaiting BAO Payment' },
  { value: 'expired', label: 'Expired' },
  { value: 'revoked', label: 'Revoked' }, 
];

const TYPE_OPTIONS = [
  { value: 'Car', label: 'Car' },
  { value: 'Motorcycle', label: 'Motorcycle' },
];

export default function VehicleManagementPage() {
  const { showToast } = useToast();
  // NEW: Grab the current user's role
  const { role } = useAuth();
  
  const { data: realVehicles, isLoading, reload } = useAsyncData(() => applicationService.getAllVehicles(), []);
  
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', type: '' });
  const [selected, setSelected] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const vehicles = useMemo(() => {
    return realVehicles || [];
  }, [realVehicles]);

  const filtered = useMemo(() => {
    if (!vehicles) return [];
    return vehicles
      .filter(
        (v) =>
          v.plateNumber?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          v.ownerName?.toLowerCase().includes(debouncedSearch.toLowerCase()),
      )
      .filter((v) => !filters.status || v.status === filters.status)
      .filter((v) => !filters.type || v.type === filters.type);
  }, [vehicles, debouncedSearch, filters]);

  const columns = [
    { key: 'plateNumber', header: 'Plate', sortable: true, render: (row) => <span className="font-semibold text-slate-800">{row.plateNumber}</span> },
    { key: 'ownerName', header: 'Owner', sortable: true },
    { key: 'type', header: 'Type', sortable: true },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  const handleRevoke = async () => {
    if (!selected || selected.status === 'revoked') return;
    if (!confirm(`Are you sure you want to revoke campus access for ${selected.plateNumber}?`)) return;
    
    setIsSubmitting(true);
    try {
      await applicationService.updateVehicleStatus(selected.id, 'revoked');
      showToast(`Access revoked for ${selected.plateNumber}.`, { type: 'success' });
      setSelected(null);
      if (reload) await reload();
    } catch (error) {
      showToast('Failed to update vehicle status.', { type: 'danger' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Vehicle Management</h2>
        <p className="text-sm text-slate-500">All registered vehicles across campus.</p>
      </div>

      <DashboardCard>
        <SearchFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by plate or owner…"
          filters={[
            { key: 'status', label: 'Status', options: STATUS_OPTIONS },
            { key: 'type', label: 'Type', options: TYPE_OPTIONS },
          ]}
          activeFilters={filters}
          onFilterChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
        />
        <DataTable columns={columns} rows={filtered} isLoading={isLoading} onRowClick={setSelected} emptyTitle="No vehicles found" emptyDescription="There are no registered vehicles matching your criteria." />
      </DashboardCard>

      <Modal 
        isOpen={Boolean(selected)} 
        onClose={() => !isSubmitting && setSelected(null)} 
        title={`Vehicle: ${selected?.plateNumber}`}
        footer={
          // THE FIX: Only show the revoke button if the vehicle isn't already revoked AND the user is NOT a BAO
          selected && selected.status !== 'revoked' && role !== ROLES.BAO && (
            <div className="flex justify-end w-full border-t border-slate-100 pt-4 mt-2">
              <button 
                type="button" 
                onClick={handleRevoke} 
                disabled={isSubmitting}
                className="rounded-md bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-700 hover:bg-danger-100 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Revoking...' : 'Revoke Campus Access'}
              </button>
            </div>
          )
        }
      >
        {selected && (
          <div className="flex flex-col gap-3 text-sm">
            <Row label="Owner" value={selected.ownerName} />
            <Row label="Make / Model" value={`${selected.make} ${selected.model}`} />
            <Row label="Type" value={selected.type} />
            <Row label="Registered" value={selected.registrationDate ? new Date(selected.registrationDate).toLocaleDateString() : '—'} />
            <div className="flex justify-between items-center mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-700 font-medium">Current Status</span>
              <StatusBadge status={selected.status} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-1 border-b border-slate-50 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right">{value}</span>
    </div>
  );
}