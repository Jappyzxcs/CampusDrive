import { useState, useMemo, useEffect } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { DataTable } from '../../components/tables/DataTable';
import { SearchFilterBar } from '../../components/tables/SearchFilterBar';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DashboardCard } from '../../components/cards/DashboardCard';

// Firebase Imports
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

const RESULT_OPTIONS = [
  { value: 'valid', label: 'Valid' },
  { value: 'mismatch', label: 'Sticker Mismatch' },
  { value: 'unregistered', label: 'Unregistered' },
  { value: 'expired', label: 'Expired' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'revoked', label: 'Revoked' }
];

export default function EntryLogsPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('');
  const [month, setMonth] = useState(''); // State for month filter
  const debouncedSearch = useDebouncedValue(search);

  // Fetch live entry logs from Firebase
  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const snap = await getDocs(collection(db, 'entry_logs'));
        const fetchedLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort newest first locally
        fetchedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setLogs(fetchedLogs);
      } catch (error) {
        console.error("Error fetching entry logs:", error);
        setLogs([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, []);

  // Dynamically generate available month options based on the actual logs
  const monthOptions = useMemo(() => {
    const months = new Set();
    logs.forEach(l => {
      if (l.timestamp) {
        const d = new Date(l.timestamp);
        if (!isNaN(d)) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          months.add(`${yyyy}-${mm}`);
        }
      }
    });
    
    const sorted = Array.from(months).sort().reverse();
    return sorted.map(m => {
      const [y, mo] = m.split('-');
      const date = new Date(y, parseInt(mo) - 1);
      return { 
        value: m, 
        label: date.toLocaleDateString('default', { month: 'long', year: 'numeric' }) 
      };
    });
  }, [logs]);

  const filtered = useMemo(() => {
    return logs
      .filter((l) => (l.plateNumber || '').toLowerCase().includes(debouncedSearch.toLowerCase()))
      .filter((l) => !result || l.result === result)
      .filter((l) => {
        if (!month) return true; // Show all if no month is selected
        const d = new Date(l.timestamp);
        if (isNaN(d)) return false;
        const lMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return lMonth === month;
      });
  }, [logs, debouncedSearch, result, month]);

  const columns = [
    { key: 'timestamp', header: 'Time', render: (row) => new Date(row.timestamp).toLocaleString(), sortable: true },
    { key: 'plateNumber', header: 'Plate', sortable: true },
    { 
      key: 'entryType', 
      header: 'Entry Status', 
      render: (row) => {
        let label = row.entryType;
        let colorClass = 'bg-blue-100 text-blue-800';

        // Intercept unknown plates and unregistered results before they default to "Registered"
        if (row.result === 'unregistered' || row.plateNumber === 'UNKNOWN' || !row.plateNumber) {
           label = 'Unknown / Unregistered';
           colorClass = 'bg-slate-100 text-slate-600';
        } else if (label === 'Visitor') {
           colorClass = 'bg-purple-100 text-purple-800';
        } else {
           label = label || 'Registered Vehicle';
        }

        return (
          <span className={`px-2 py-1 rounded-md text-xs font-bold ${colorClass}`}>
            {label}
          </span>
        );
      }
    },
    { 
      key: 'guardName', 
      header: 'Guard', 
      render: (row) => <span className="font-medium text-slate-700">{row.guardName || 'Unknown Guard'}</span> 
    },
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
          filters={[
            { key: 'result', label: 'Result', options: RESULT_OPTIONS },
            { key: 'month', label: 'Month', options: monthOptions } // Integrated dynamic month dropdown
          ]}
          activeFilters={{ result, month }} // Pass active states
          onFilterChange={(key, value) => {
            if (key === 'result') setResult(value);
            if (key === 'month') setMonth(value);
          }}
        />
        <DataTable columns={columns} rows={filtered} isLoading={isLoading} />
      </DashboardCard>
    </div>
  );
}