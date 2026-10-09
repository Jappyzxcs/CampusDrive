import { useMemo, useState, useEffect } from 'react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { applicationService } from '../../services/applicationService'; 
import { DataTable } from '../../components/tables/DataTable';
import { SearchFilterBar } from '../../components/tables/SearchFilterBar';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext'; 
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';

// Database imports for fetching the original application documents on-the-fly
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'for_payment', label: 'Awaiting Payment' },
  { value: 'expired', label: 'Expired' },
  { value: 'revoked', label: 'Revoked' }, 
];

const TYPE_OPTIONS = [
  { value: 'Car', label: 'Car' },
  { value: 'Motorcycle', label: 'Motorcycle' },
];

const ROLE_OPTIONS = [
  { value: 'Student', label: 'Student' },
  { value: 'Faculty', label: 'Faculty' },
];

export default function VehicleManagementPage() {
  const { showToast } = useToast();
  const { role } = useAuth();
  
  const { data: realVehicles, isLoading, reload } = useAsyncData(() => applicationService.getAllVehicles(), []);
  
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', type: '', registrantType: '' });
  const [selected, setSelected] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  // THE FIX: State to hold the documents fetched from the original application
  const [appDocs, setAppDocs] = useState(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  // THE FIX: Automatically hunt down the license photo from the Applications collection when a modal opens
  useEffect(() => {
    let isMounted = true;

    async function fetchOriginalDocuments() {
      if (!selected) {
        if (isMounted) setAppDocs(null);
        return;
      }

      // If the vehicle was recently updated, it might already have the docs directly
      if (selected.documentUrls?.license) {
        if (isMounted) setAppDocs(selected.documentUrls);
        return;
      }

      if (isMounted) setIsLoadingDocs(true);
      
      try {
        // Attempt 1: Fetch directly if we have the applicationId saved
        if (selected.applicationId) {
          const appSnap = await getDoc(doc(db, 'applications', selected.applicationId));
          if (appSnap.exists() && appSnap.data().documentUrls) {
            if (isMounted) setAppDocs(appSnap.data().documentUrls);
            setIsLoadingDocs(false);
            return;
          }
        }

        // Attempt 2: Safety fallback - Find the application by checking the owner's ID and plate number
        const ownerId = selected.ownerId || selected.userId;
        if (ownerId) {
          const q = query(collection(db, 'applications'), where('userId', '==', ownerId));
          const appSnaps = await getDocs(q);
          
          const targetPlate = (selected.plateNumber || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
          let foundDocs = null;
          
          appSnaps.forEach(d => {
            const data = d.data();
            const aPlate = (data.plateNumber || data.vehicleDetails?.plateNumber || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (aPlate === targetPlate && data.documentUrls) {
              foundDocs = data.documentUrls;
            }
          });
          
          if (foundDocs && isMounted) {
            setAppDocs(foundDocs);
            return;
          }
        }
        
        if (isMounted) setAppDocs(null);
      } catch (error) {
        console.error("Error fetching application docs:", error);
        if (isMounted) setAppDocs(null);
      } finally {
        if (isMounted) setIsLoadingDocs(false);
      }
    }

    fetchOriginalDocuments();
    return () => { isMounted = false; };
  }, [selected]);

  const vehicles = useMemo(() => {
    return realVehicles || [];
  }, [realVehicles]);

  const filtered = useMemo(() => {
    if (!vehicles) return [];
    return vehicles
      .filter((v) => {
        const type = (v.registrantType || '').toLowerCase();
        return type !== 'visitor'; 
      })
      .filter(
        (v) =>
          v.plateNumber?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          v.ownerName?.toLowerCase().includes(debouncedSearch.toLowerCase()),
      )
      .filter((v) => {
        if (!filters.status) return true;
        const vStatus = (v.status || '').toLowerCase();
        
        if (filters.status === 'active') {
          return ['active', 'completed', 'visit completed', 'visit_completed'].includes(vStatus);
        }
        if (filters.status === 'for_payment') {
          return ['for_payment', 'approved'].includes(vStatus);
        }
        
        return vStatus === filters.status;
      })
      .filter((v) => !filters.type || v.type === filters.type)
      .filter((v) => !filters.registrantType || v.registrantType === filters.registrantType); 
  }, [vehicles, debouncedSearch, filters]);

  const columns = [
    { key: 'plateNumber', header: 'Plate', sortable: true, render: (row) => <span className="font-semibold text-slate-800">{row.plateNumber}</span> },
    { key: 'ownerName', header: 'Owner', sortable: true },
    { key: 'registrantType', header: 'Role', render: (row) => <span className="text-sm font-medium text-slate-600">{row.registrantType || 'Student'}</span> },
    { key: 'type', header: 'Type', sortable: true },
    { key: 'status', header: 'Status', render: (row) => {
        let fixedStatus = row.status || '';
        const lowerStatus = fixedStatus.toLowerCase();
        
        if (['visit completed', 'completed', 'visit_completed'].includes(lowerStatus)) {
          fixedStatus = 'active'; 
        }
        
        return <StatusBadge status={fixedStatus} />;
      } 
    },
  ];

  const handleRevoke = async () => {
    if (!selected || selected.status === 'revoked') return;
    if (!window.confirm(`Are you sure you want to revoke campus access for ${selected.plateNumber}?`)) return;
    
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

  // Check the vehicle first, then fall back to the newly fetched appDocs
  const getVehiclePhoto = (vehicle) => {
    if (!vehicle) return null;
    return vehicle.vehicleImageUrl || appDocs?.vehiclePhoto || vehicle.documentUrls?.vehiclePhoto || null;
  };

  const getLicensePhoto = (vehicle) => {
    if (!vehicle) return null;
    return appDocs?.license || vehicle.documentUrls?.license || null;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Vehicle Management</h2>
        <p className="text-sm text-slate-500">All registered student and staff vehicles across campus.</p>
      </div>

      <DashboardCard>
        <SearchFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by plate or owner…"
          filters={[
            { key: 'status', label: 'Status', options: STATUS_OPTIONS },
            { key: 'registrantType', label: 'Role', options: ROLE_OPTIONS },
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
        title={`Security Check: ${selected?.plateNumber}`}
        size="lg"
        footer={
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
          <div className="flex flex-col gap-5 text-sm">
            
            {/* Split Photo Gallery: Vehicle and License */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* Vehicle Photo Panel */}
              <div className="flex flex-col bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="bg-slate-100 border-b border-slate-200 py-1.5 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vehicle</span>
                </div>
                <div className="flex-1 flex items-center justify-center p-3 bg-white min-h-[160px]">
                  <MediaViewer url={getVehiclePhoto(selected)} alt={`Vehicle ${selected.plateNumber}`} />
                </div>
              </div>

              {/* Driver's License Panel */}
              <div className="flex flex-col bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="bg-slate-100 border-b border-slate-200 py-1.5 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Driver's License</span>
                </div>
                <div className="flex-1 flex items-center justify-center p-3 bg-white min-h-[160px]">
                  {isLoadingDocs ? (
                    <div className="py-6 text-center text-slate-400 flex flex-col items-center gap-2">
                      <svg className="w-6 h-6 animate-spin text-slate-300" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Retrieving...</span>
                    </div>
                  ) : (
                    <MediaViewer url={getLicensePhoto(selected)} alt={`License for ${selected.ownerName}`} />
                  )}
                </div>
              </div>

            </div>

            {/* Vehicle Details */}
            <div className="flex flex-col gap-1 mt-2">
              <Row label="Owner" value={`${selected.ownerName} (${selected.registrantType || 'Student'})`} />
              <Row label="Make / Model" value={`${selected.make || selected.vehicleDetails?.make || ''} ${selected.model || selected.vehicleDetails?.model || ''}`.trim() || '—'} />
              <Row label="Type" value={selected.type || selected.vehicleDetails?.vehicleType || '—'} />
              <Row label="Registered" value={selected.registrationDate ? new Date(selected.registrationDate).toLocaleDateString() : '—'} />
            </div>
            
            {/* Status Section */}
            <div className="flex justify-between items-center mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-slate-700 font-medium">Current Status</span>
              <StatusBadge status={
                ['visit completed', 'completed', 'visit_completed'].includes((selected.status || '').toLowerCase()) 
                ? 'active' 
                : selected.status
              } />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right">{value}</span>
    </div>
  );
}

// Smart Media Viewer to safely handle raw PDFs or Image Links
function MediaViewer({ url, alt }) {
  if (!url) {
    return (
      <div className="py-6 text-center text-slate-400 flex flex-col items-center gap-2">
        <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-4m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-wider">No Photo</span>
      </div>
    );
  }

  // Detect if the file is a raw PDF
  const isPdf = url.toLowerCase().includes('.pdf') || url.startsWith('data:application/pdf');

  if (isPdf) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-36 bg-slate-50 rounded-md">
        <svg className="w-8 h-8 text-rose-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary-600 hover:text-primary-800 underline underline-offset-2 transition-colors">
          View PDF Document
        </a>
      </div>
    );
  }

  // Handle standard images / base64
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block w-full h-full cursor-pointer" title="Click to view full size">
      <img 
        src={url} 
        alt={alt} 
        className="w-full h-36 object-contain rounded-md hover:opacity-80 transition-opacity bg-slate-50"
      />
    </a>
  );
}