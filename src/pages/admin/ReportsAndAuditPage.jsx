import { useState, useEffect } from 'react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { reportService } from '../../services/reportService'; 
import { DataTable } from '../../components/tables/DataTable';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';

// Firebase Imports
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { flaggingService } from '../../services/flaggingService';
import { useToast } from '../../context/ToastContext';
import { CardSkeleton, Skeleton } from '../../components/common/LoadingSkeleton';
import { Icon } from '../../components/common/Icon';

// ----------------------------------------------------------------------
// Custom Metric Card Component (Matching Dashboard UI)
// ----------------------------------------------------------------------
function DashboardMetricCard({ title, value, icon, tone }) {
  const tones = {
    primary: 'bg-blue-50 text-blue-500',
    secondary: 'bg-amber-50 text-amber-500',
    accent: 'bg-emerald-50 text-emerald-500',
    danger: 'bg-rose-50 text-rose-500'
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
        {title}
      </span>
      <div className="flex justify-between items-center mt-2">
        <h2 className="text-4xl font-extrabold font-sans text-slate-900 tracking-tight">
          {value}
        </h2>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${tones[tone] || tones.primary}`}>
          <Icon name={icon} className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

export default function ReportsAndAuditPage() {
  const { role } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('reports'); 

  // --- 0. MASTER USER DIRECTORY (ACCURATE NAME RESOLUTION) ---
  const [userMap, setUserMap] = useState({});
  
  useEffect(() => {
    const fetchUsersForMapping = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const map = {};
        snap.docs.forEach(doc => {
          const u = doc.data();
          map[doc.id] = u.fullName || u.name || u.email || 'Unknown Officer';
        });
        setUserMap(map);
      } catch (error) {
        console.error("Failed to load user dictionary:", error);
      }
    };
    fetchUsersForMapping();
  }, []);

  // --- 1. REPORTS DATA ---
  const { data: reports, isLoading: reportsLoading } = useAsyncData(() => reportService.getReports(), []);

  // --- 2. AUDIT DATA (LIVE FROM FIREBASE) ---
  const [auditEntries, setAuditEntries] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const loadAuditData = async () => {
    setAuditLoading(true);
    try {
      const [vehSnap, appVehSnap, offSnap] = await Promise.all([
        getDocs(collection(db, 'vehicles')),
        getDocs(collection(db, 'approved_vehicles')),
        getDocs(collection(db, 'offenses'))
      ]);

      const entries = [];

      vehSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.registrationDate) {
          entries.push({
            id: `app_${doc.id}`,
            timestamp: data.registrationDate,
            actor: userMap[data.reviewedBy] || 'System Administrator',
            action: `Application ${data.status}`,
            target: `${data.ownerName || 'Unknown'} · ${data.plateNumber || 'N/A'}`,
            result: data.status === 'rejected' ? 'rejected' : 'approved',
          });
        }
      });

      appVehSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.dateIssued && data.stickerSerial) {
          entries.push({
            id: `stk_${doc.id}`,
            timestamp: data.dateIssued,
            actor: userMap[data.assignedBy] || 'BAO Officer',
            action: 'Issued Sticker',
            target: `${data.stickerSerial} → ${data.plateNumber || 'unassigned'}`,
            result: 'active',
          });
        }
        if (data.status === 'revoked') {
          entries.push({
            id: `rev_${doc.id}`,
            timestamp: data.revokedDate || new Date().toISOString(),
            actor: 'System / Admin',
            action: 'Revoked Access',
            target: `${data.plateNumber} · ${data.stickerSerial || 'N/A'}`,
            result: 'rejected',
          });
        }
      });

      offSnap.docs.forEach(doc => {
        const data = doc.data();
        entries.push({
          id: `off_${doc.id}`,
          timestamp: data.timestamp,
          actor: userMap[data.guardId] || 'Security Guard',
          action: 'Flagged Offense',
          target: `${data.stickerSerial || 'Unknown'} · ${data.reason}`,
          result: 'warning',
        });
      });

      entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setAuditEntries(entries);
    } catch (error) {
      console.error("Failed to load audit logs:", error);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit' && auditEntries.length === 0) {
      loadAuditData();
    }
  }, [activeTab, userMap]); 

  const auditColumns = [
    { 
      key: 'timestamp', 
      header: 'Date & Time', 
      render: (row) => {
        const d = new Date(row.timestamp);
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-bold text-slate-900">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
        );
      },
      sortable: true 
    },
    { 
      key: 'actor', 
      header: 'Performed By', 
      render: (row) => (
        <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-sm">
          {row.actor}
        </span>
      ),
      sortable: true 
    },
    { 
      key: 'action', 
      header: 'Action Taken',
      render: (row) => <span className="text-[13px] font-bold text-slate-800 capitalize">{row.action}</span>
    },
    { 
      key: 'target', 
      header: 'Target / Details',
      render: (row) => <span className="text-[13px] font-medium text-slate-600">{row.target}</span>
    },
    { 
      key: 'result', 
      header: 'Outcome', 
      render: (row) => {
        let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";
        let label = row.result;
        
        if (row.result === 'approved') { 
          badgeClass = "bg-emerald-100 text-emerald-700 border-emerald-200"; 
          label = "Approved"; 
        } else if (row.result === 'active') { 
          badgeClass = "bg-blue-100 text-blue-700 border-blue-200"; 
          label = "Issued"; 
        } else if (row.result === 'rejected') { 
          badgeClass = "bg-rose-100 text-rose-700 border-rose-200"; 
          label = row.action.includes('Revoked') ? "Revoked" : "Rejected"; 
        } else if (row.result === 'warning') { 
          badgeClass = "bg-amber-100 text-amber-700 border-amber-200"; 
          label = "Flagged"; 
        }
        
        return (
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-[11px] uppercase tracking-widest font-bold border shadow-sm ${badgeClass}`}>
            {label}
          </span>
        );
      } 
    },
  ];

  // --- 3. FLAGGED VEHICLES DATA ---
  const [flaggedVehicles, setFlaggedVehicles] = useState([]);
  const [offensesMap, setOffensesMap] = useState({});
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const loadFlaggedData = async () => {
    setFlagsLoading(true);
    try {
      const vQuery = query(collection(db, 'approved_vehicles'), where('offenseCount', '>=', 0));
      const vSnap = await getDocs(vQuery);
      const vehicles = vSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(v => v.offenseCount > 0 || v.accreditationStatus === 'Revoked');
      
      setFlaggedVehicles(vehicles);

      const vehicleIds = vehicles.map(v => v.id);
      if (vehicleIds.length > 0) {
        const oQuery = query(collection(db, 'offenses'), where('vehicleId', 'in', vehicleIds.slice(0, 10)));
        const oSnap = await getDocs(oQuery);
        
        const map = {};
        oSnap.docs.forEach(doc => {
          const data = doc.data();
          if (!map[data.vehicleId]) map[data.vehicleId] = [];
          map[data.vehicleId].push({ id: doc.id, ...data });
        });
        setOffensesMap(map);
      }
    } catch (error) {
      console.error("Failed to load flagged vehicles:", error);
    } finally {
      setFlagsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'flagged') loadFlaggedData();
  }, [activeTab]);

  const handleRevoke = async (vehicle) => {
    if (!window.confirm(`Are you sure you want to REVOKE the sticker for ${vehicle.plateNumber}?`)) return;
    try {
      await flaggingService.revokeSticker(vehicle);
      showToast(`Sticker for ${vehicle.plateNumber} has been revoked.`, { type: 'success' });
      loadFlaggedData(); 
      loadAuditData(); 
    } catch (error) {
      showToast('Failed to revoke sticker.', { type: 'danger' });
    }
  };

  const handleUndoRevoke = async (vehicle) => {
    if (!window.confirm(`TEST: Are you sure you want to completely wipe the offenses and un-revoke ${vehicle.plateNumber}?`)) return;
    try {
      await flaggingService.undoRevoke(vehicle);
      showToast(`Success! Plate ${vehicle.plateNumber} has been reset to 0 offenses.`, { type: 'success' });
      setFlaggedVehicles(prev => prev.filter(v => v.id !== vehicle.id));
      loadAuditData();
    } catch (error) {
      showToast('Failed to undo revocation.', { type: 'danger' });
    }
  };

  return (
    <div className="flex w-full flex-col gap-8 font-sans text-slate-800 pb-10">
      
      {/* Header Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end justify-between border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold font-sans tracking-tight text-slate-900">
            Reports & Hub
          </h1>
          <p className="text-base text-slate-500 font-medium">
            Analytics, security flags, and administrative audit trails.
          </p>
        </div>
        
        {/* Segmented Control Tabs */}
        <div className="flex p-1 bg-slate-100 rounded-xl shadow-inner max-w-full overflow-x-auto">
          <button 
            onClick={() => setActiveTab('reports')} 
            className={`flex-1 min-w-[120px] rounded-lg px-6 py-2.5 text-sm font-bold transition-all ${activeTab === 'reports' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Analytics
          </button>
          <button 
            onClick={() => setActiveTab('flagged')} 
            className={`flex-1 min-w-[150px] rounded-lg px-6 py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'flagged' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Flagged Vehicles
            {flaggedVehicles.length > 0 && activeTab !== 'flagged' && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white shadow-sm">{flaggedVehicles.length}</span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('audit')} 
            className={`flex-1 min-w-[120px] rounded-lg px-6 py-2.5 text-sm font-bold transition-all ${activeTab === 'audit' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Audit Trail
          </button>
        </div>
      </div>

      {/* TAB CONTENT: REPORTS */}
      {activeTab === 'reports' && (
        <div className="flex flex-col gap-8 animate-in fade-in duration-300">
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {reportsLoading ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} className="h-32 rounded-2xl" />) : (
              <>
                {/* Changed to "car" (Guaranteed to work) */}
                <DashboardMetricCard label="Total Processed" title="Total Applications" value={(reports?.applicationsSummary?.approved || 0) + (reports?.applicationsSummary?.rejected || 0) + (reports?.applicationsSummary?.pending || 0)} icon="car" tone="primary" />
                
                <DashboardMetricCard title="Approved" value={reports?.applicationsSummary?.approved || 0} icon="check" tone="accent" />
                <DashboardMetricCard title="Rejected" value={reports?.applicationsSummary?.rejected || 0} icon="alert" tone="danger" />
                
                {/* Changed to "clipboard" (Guaranteed to work) */}
                <DashboardMetricCard title="Pending Review" value={reports?.applicationsSummary?.pending || 0} icon="clipboard" tone="secondary" />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Overview Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col hover:shadow-md transition-shadow">
              <h3 className="text-lg font-extrabold text-slate-900 font-sans tracking-tight mb-6">Application Processing Overview</h3>
              {reportsLoading ? (
                <Skeleton className="h-48 w-full rounded-xl" />
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-sm font-bold text-slate-600">Total Processed (This Month)</span>
                    <span className="text-2xl font-black text-slate-900 tracking-tight">
                      {(reports?.applicationsSummary?.approved || 0) + (reports?.applicationsSummary?.rejected || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-emerald-50 rounded-xl border border-emerald-100">
                    <span className="text-sm font-bold text-emerald-900">Approval Rate</span>
                    <span className="text-2xl font-black text-emerald-700 tracking-tight">
                      {reports?.applicationsSummary?.approved > 0 
                        ? Math.round(((reports?.applicationsSummary?.approved) / ((reports?.applicationsSummary?.approved) + (reports?.applicationsSummary?.rejected))) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-amber-50 rounded-xl border border-amber-100">
                    <span className="text-sm font-bold text-amber-900">Current Queue Workload</span>
                    <span className="text-xl font-black text-amber-700 tracking-tight">{reports?.applicationsSummary?.pending || 0} Pending</span>
                  </div>
                </div>
              )}
            </div>

            {/* Health Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col hover:shadow-md transition-shadow">
              <h3 className="text-lg font-extrabold text-slate-900 font-sans tracking-tight mb-6">Security & System Health</h3>
              {reportsLoading ? (
                <Skeleton className="h-48 w-full rounded-xl" />
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-5 bg-rose-50 rounded-xl border border-rose-100">
                    <span className="text-sm font-bold text-rose-900">Flagged Vehicles</span>
                    <span className="text-2xl font-black text-rose-700 tracking-tight">{flaggedVehicles.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-sm font-bold text-slate-600">Total Audit Events</span>
                    <span className="text-xl font-black text-slate-800 tracking-tight">{auditEntries.length} Tracked</span>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-emerald-50 rounded-xl border border-emerald-100">
                    <span className="text-sm font-bold text-emerald-900">System Connection</span>
                    <span className="text-[11px] font-bold uppercase tracking-widest bg-emerald-600 text-white px-3 py-1.5 rounded-full shadow-sm">Live Firestore</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* TAB CONTENT: FLAGGED VEHICLES */}
      {activeTab === 'flagged' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          {flagsLoading ? (
            <div className="flex flex-col gap-4"><CardSkeleton className="rounded-2xl h-32" /><CardSkeleton className="rounded-2xl h-32" /></div>
          ) : flaggedVehicles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-16 text-center">
              <p className="text-lg font-bold text-slate-500">No vehicles are currently flagged in the system.</p>
            </div>
          ) : (
            flaggedVehicles.map(vehicle => {
              const offenses = offensesMap[vehicle.id] || [];
              const isRevoked = vehicle.accreditationStatus === 'Revoked';
              const isPendingRevocation = vehicle.offenseCount >= 3 && !isRevoked;

              return (
                <div key={vehicle.id} className={`bg-white rounded-2xl border shadow-sm p-6 sm:p-8 transition-shadow hover:shadow-md ${isRevoked ? 'bg-rose-50/30 border-rose-200' : 'border-slate-200'}`}>
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-4 mb-1">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{vehicle.plateNumber}</h3>
                        <span className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-widest uppercase shadow-sm ${isRevoked ? 'bg-rose-600 text-white' : isPendingRevocation ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                          {isRevoked ? 'REVOKED' : `${vehicle.offenseCount} / 3 Offenses`}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                        {vehicle.ownerName} <span className="text-slate-300">•</span> Serial: <span className="font-bold text-slate-700">{vehicle.stickerSerial}</span>
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap gap-3">
                      <button 
                        onClick={() => setExpandedId(expandedId === vehicle.id ? null : vehicle.id)} 
                        className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold tracking-wide hover:bg-slate-200 transition-all border border-slate-200"
                      >
                        {expandedId === vehicle.id ? 'Hide History' : 'View History'}
                      </button>
                      
                      {isPendingRevocation && (
                        <button 
                          onClick={() => handleRevoke(vehicle)} 
                          className="px-6 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold tracking-wide hover:bg-rose-700 transition-all shadow-sm hover:shadow-md"
                        >
                          Revoke Sticker
                        </button>
                      )}
                      
                      {isRevoked && (
                        <button 
                          onClick={() => handleUndoRevoke(vehicle)} 
                          className="px-6 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold tracking-wide hover:bg-amber-600 transition-all shadow-sm hover:shadow-md"
                        >
                          Undo Revoke (Test)
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedId === vehicle.id && (
                    <div className="mt-8 border-t border-slate-100 pt-6 flex flex-col gap-4">
                      <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Offense History</h4>
                      
                      {isRevoked && vehicle.revokeReason && (
                        <div className="bg-rose-50 border border-rose-200 p-5 rounded-xl text-sm mb-2 shadow-inner">
                          <span className="font-bold uppercase tracking-widest text-[10px] block mb-2 text-rose-600">Revocation Reason</span>
                          {vehicle.revokeReason.includes('. Last violation:') ? (
                            <>
                              <span className="font-extrabold text-slate-900 text-base">{vehicle.revokeReason.split('. Last violation:')[0]}</span><br/>
                              <span className="text-rose-700 mt-2 inline-block font-medium">
                                <span className="font-bold text-rose-800">Last violation:</span> {vehicle.revokeReason.split('. Last violation:')[1]?.trim()}
                              </span>
                            </>
                          ) : (
                            <span className="font-bold text-slate-900 text-base">{vehicle.revokeReason}</span>
                          )}
                        </div>
                      )}
                      
                      {offenses.length === 0 ? <p className="text-sm font-medium text-slate-500 italic p-4 bg-slate-50 rounded-xl border border-slate-100">No individual logs found.</p> : (
                        <div className="flex flex-col gap-4">
                          {offenses.map((offense, idx) => (
                            <div key={offense.id} className="rounded-xl bg-white p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400"></div>
                              <div className="flex justify-between items-start mb-3">
                                <span className="font-extrabold text-slate-900 text-base">Strike {idx + 1}: {offense.reason}</span>
                                <span className="text-[11px] font-bold tracking-wider text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full uppercase">{new Date(offense.timestamp).toLocaleDateString()}</span>
                              </div>
                              {offense.details && <p className="text-sm font-medium text-slate-600 mt-2 bg-slate-50 p-4 rounded-xl border border-slate-100">"{offense.details}"</p>}
                              
                              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-4 flex items-center gap-2">
                                <Icon name="user" className="w-3.5 h-3.5" />
                                Reported by: <span className="text-slate-600">{userMap[offense.guardId] || 'Security Officer'}</span>
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB CONTENT: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 hover:shadow-md transition-shadow">
            <div className="mb-6">
              <h3 className="text-lg font-extrabold text-slate-900 font-sans tracking-tight">Administrative Action Log</h3>
            </div>
            <DataTable columns={auditColumns} rows={auditEntries} isLoading={auditLoading} />
          </div>
        </div>
      )}
    </div>
  );
}