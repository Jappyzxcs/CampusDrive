import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { DataTable } from '../../components/tables/DataTable';
import { SearchFilterBar } from '../../components/tables/SearchFilterBar';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Timeline } from '../../components/common/Timeline';
import { Modal } from '../../components/common/Modal';
import { ROUTES } from '../../constants/routes';

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

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
  
  const { data, isLoading } = useAsyncData(async () => {
    if (!user) return { applications: [], vehicles: [] };
    const userId = user.id || user.uid; 
    
    const appQ = query(collection(db, 'applications'), where('userId', '==', userId));
    const appSnap = await getDocs(appQ);
    const fetchedApplications = appSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const vehQ = query(collection(db, 'vehicles'), where('ownerId', '==', userId));
    const vehSnap = await getDocs(vehQ);
    const fetchedVehicles = vehSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return { applications: fetchedApplications, vehicles: fetchedVehicles };
  }, [user]);

  const applications = data?.applications || [];
  const vehicles = data?.vehicles || [];

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const debouncedSearch = useDebouncedValue(search);

  const filtered = useMemo(() => {
    return applications.filter((app) => {
      const typeStr = app.type || 'New Registration';
      const plate = app.vehicleDetails?.plateNumber || '';
      const combinedSearchStr = `${typeStr} ${plate}`.toLowerCase();
      
      const matchesSearch = combinedSearchStr.includes(debouncedSearch.toLowerCase());
      const matchesStatus = !status || app.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [applications, debouncedSearch, status]);

  const columns = [
    { 
      key: 'type', 
      header: 'Application', 
      render: (row) => {
        const make = row.vehicleDetails?.vehicleType || row.vehicleDetails?.make || 'VEHICLE';
        const plate = row.vehicleDetails?.plateNumber || 'NO PLATE';
        const color = row.nlpExtractedData?.color || 'UNKNOWN COLOR';
        
        if (row.vehicleDetails) {
          return (
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 tracking-wide text-sm">
                ({make} - {plate} - {color})
              </span>
              <span className="text-[11px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{row.type || 'New Registration'}</span>
            </div>
          );
        }
        
        return <span className="text-sm font-bold text-slate-900 tracking-wide">{row.type || 'New Registration'}</span>;
      }, 
      sortable: true 
    },
    { key: 'submittedDate', header: 'Submitted', render: (row) => <span className="text-[13px] font-bold text-slate-600">{row.submittedDate || row.createdAt || '—'}</span>, sortable: true },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { 
      key: 'reviewedBy', 
      header: 'Reviewed By', 
      render: (row) => {
        if (row.reviewedBy) return <span className="font-bold text-[13px] text-slate-800">{row.reviewedBy}</span>;
        const status = (row.status || '').toLowerCase();
        if (status === 'pending' || status === 'under_review') {
          return <span className="text-slate-400 italic text-[13px] font-medium">Pending Review...</span>;
        }
        return <span className="font-bold text-[13px] text-slate-700">GSU Admin</span>; 
      } 
    },
  ];

  const isUpdatable = selected ? ['approved', 'completed', 'paid', 'active'].includes((selected.status || '').toLowerCase()) : false;
  const selectedVehicle = selected ? vehicles.find(v => v.applicationId === selected.id) : null;

  return (
    <div className="flex w-full flex-col gap-6 font-sans text-slate-800 pb-10">
      
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-extrabold font-sans tracking-tight text-slate-900">Application Status</h2>
          <p className="text-base text-slate-500 font-medium">Track your registration and renewal applications.</p>
        </div>
        <Link to={ROUTES.STUDENT_VEHICLE_REGISTRATION} className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold tracking-wide hover:bg-slate-800 transition-all shadow-sm">
          New Application
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
        <SearchFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by plate or application type…"
          filters={[{ key: 'status', label: 'Status', options: STATUS_OPTIONS }]}
          activeFilters={{ status }}
          onFilterChange={(_, value) => setStatus(value)}
        />
        <div className="mt-4">
          <DataTable
            columns={columns}
            rows={filtered}
            isLoading={isLoading}
            onRowClick={setSelected}
            emptyTitle="No applications found"
            emptyDescription="Try a different search or filter."
          />
        </div>
      </div>

      <Modal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.type || 'Application Details'} size="lg">
        {selected && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-5">
              <StatusBadge status={selected.status} />
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Submitted {selected.submittedDate || selected.createdAt}
              </span>
            </div>
            
            {selected.reviewNotes && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-5 shadow-inner">
                <span className="font-extrabold uppercase tracking-widest text-[10px] text-amber-700 block mb-2">Review Notes</span>
                <p className="text-sm font-medium text-amber-900 leading-relaxed">
                  {selected.reviewNotes}
                </p>
              </div>
            )}
            
            <div className="py-2">
              <Timeline steps={generateTimeline(selected)} />
            </div>

            {isUpdatable && selectedVehicle && (
              <div className="mt-4 border-t border-slate-100 pt-6">
                <h3 className="text-sm font-bold text-slate-900 mb-2">Document Renewal</h3>
                <p className="text-xs font-medium text-slate-500 mb-5 leading-relaxed">If your documents are expiring, upload your renewed files here to maintain campus access automatically.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link to={`/update-or/${selectedVehicle.id}`} className="flex-1 px-6 py-3 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 font-bold transition-all text-center">
                     Update OR
                  </Link>
                  <Link to={`/update-license/${selectedVehicle.id}`} className="flex-1 px-6 py-3 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 font-bold transition-all text-center">
                     Update License
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}