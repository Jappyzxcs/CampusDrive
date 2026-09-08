import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { DataTable } from '../../components/tables/DataTable';
import { SearchFilterBar } from '../../components/tables/SearchFilterBar';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { ROUTES } from '../../constants/routes';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase'; // Ensure path is correct

const RESULT_OPTIONS = [
  { value: 'valid', label: 'Valid' },
  { value: 'expired', label: 'Expired' },
  { value: 'mismatch', label: 'Sticker Mismatch' },
  { value: 'unregistered', label: 'Unregistered' },
  { value: 'duplicate', label: 'Duplicate' },
];

export default function ScanHistoryPage() {
  const navigate = useNavigate();
  
  // Fetch live scans from Firebase
  const fetchScans = async () => {
    const snapshot = await getDocs(collection(db, 'scans'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };
  
  const { data: scans, isLoading } = useAsyncData(fetchScans, []);
  
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const filtered = useMemo(() => {
    if (!scans) return [];
    return [...scans]
      .reverse()
      .filter((s) => (s.plateNumber || '').toLowerCase().includes(debouncedSearch.toLowerCase()))
      .filter((s) => !result || s.result === result);
  }, [scans, debouncedSearch, result]);

  const columns = [
    { key: 'timestamp', header: 'Time', render: (row) => row.timestamp ? new Date(row.timestamp).toLocaleTimeString() : '—' },
    { key: 'plateNumber', header: 'Plate', render: (row) => row.plateNumber || '—' },
    { key: 'result', header: 'Result', render: (row) => <StatusBadge status={row.result} /> },
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Scan History</h2>
        <p className="text-sm text-slate-500">Tap a row to view the full verification result.</p>
      </div>

      <DashboardCard>
        <SearchFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by plate…"
          filters={[{ key: 'result', label: 'Result', options: RESULT_OPTIONS }]}
          activeFilters={{ result }}
          onFilterChange={(_, value) => setResult(value)}
        />
        <DataTable
          columns={columns}
          rows={filtered}
          isLoading={isLoading}
          onRowClick={(row) => navigate(ROUTES.GUARD_VERIFICATION_RESULT, { state: { result: row } })}
        />
      </DashboardCard>
    </div>
  );
}