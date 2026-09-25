import { useMemo, useState } from 'react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { mockDataService } from '../../services/mockDataService';
import { DataTable } from '../../components/tables/DataTable';
import { SearchFilterBar } from '../../components/tables/SearchFilterBar';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DashboardCard } from '../../components/cards/DashboardCard';

const RESULT_OPTIONS = [
  { value: 'valid', label: 'Valid' },
  { value: 'mismatch', label: 'Sticker Mismatch' },
  { value: 'unregistered', label: 'Unregistered' },
  { value: 'expired', label: 'Expired' },
  { value: 'duplicate', label: 'Duplicate' },
];

export default function EntryLogsPage() {
  const { data: logs, isLoading } = useAsyncData(() => mockDataService.getEntryLogs(), []);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const filtered = useMemo(() => {
    if (!logs) return [];
    return logs
      .filter((l) => l.plateNumber.toLowerCase().includes(debouncedSearch.toLowerCase()))
      .filter((l) => !result || l.result === result)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [logs, debouncedSearch, result]);

  const columns = [
    { key: 'timestamp', header: 'Time', render: (row) => new Date(row.timestamp).toLocaleString(), sortable: true },
    { key: 'plateNumber', header: 'Plate', sortable: true },
    // NEW: Campus Entry Status/Type
    { 
      key: 'entryType', 
      header: 'Entry Status', 
      render: (row) => (
        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
          row.entryType === 'Visitor' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
        }`}>
          {row.entryType || 'Registered Vehicle'}
        </span>
      )
    },
    { key: 'gate', header: 'Gate' },
    { key: 'guardName', header: 'Guard' },
    { key: 'result', header: 'Result', render: (row) => <StatusBadge status={row.result} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Campus Entry Logs</h2>
        <p className="text-sm text-slate-500">Every sticker scan and visitor entry recorded at campus gates.</p>
      </div>

      <DashboardCard>
        <SearchFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by plate number…"
          filters={[{ key: 'result', label: 'Result', options: RESULT_OPTIONS }]}
          activeFilters={{ result }}
          onFilterChange={(_, value) => setResult(value)}
        />
        <DataTable columns={columns} rows={filtered} isLoading={isLoading} />
      </DashboardCard>
    </div>
  );
}