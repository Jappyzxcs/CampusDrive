import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { DataTable } from '../../components/tables/DataTable';
import { SearchFilterBar } from '../../components/tables/SearchFilterBar';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

const RESULT_OPTIONS = [
  { value: 'valid', label: 'Valid' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'expired', label: 'Expired' },
  { value: 'unregistered', label: 'Unregistered' },
];

export default function ScanHistoryPage() {
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Live Firebase Listener connected to entry_logs
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'entry_logs'), (snap) => {
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetched.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setScans(fetched);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);
  
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const filtered = useMemo(() => {
    return scans
      .filter((s) => (s.plateNumber || '').toLowerCase().includes(debouncedSearch.toLowerCase()))
      .filter((s) => !result || s.result === result);
  }, [scans, debouncedSearch, result]);

  const columns = [
    { 
      key: 'timestamp', 
      header: 'Time', 
      render: (row) => row.timestamp ? new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
      sortable: true
    },
    { 
      key: 'plateNumber', 
      header: 'Plate', 
      render: (row) => <span className="font-bold text-slate-800">{row.plateNumber || '—'}</span>,
      sortable: true
    },
    { 
      key: 'result', 
      header: 'Result', 
      render: (row) => <StatusBadge status={row.result} /> 
    },
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Scan History</h2>
        <p className="text-sm text-slate-500">Live chronological record of all gate scans.</p>
      </div>

      <DashboardCard>
        <SearchFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by plate…"
          filters={[{ key: 'result', label: 'Filter Result', options: RESULT_OPTIONS }]}
          activeFilters={{ result }}
          onFilterChange={(_, value) => setResult(value)}
        />
        <DataTable
          columns={columns}
          rows={filtered}
          isLoading={isLoading}
          // Intentionally removed row click if we don't have a dedicated single-scan page yet, 
          // keeping the table clean and non-interactive.
        />
      </DashboardCard>
    </div>
  );
}