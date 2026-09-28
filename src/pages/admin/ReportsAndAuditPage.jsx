import { useState, useEffect } from 'react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { reportService } from '../../services/reportService'; 
import { DashboardCard } from '../../components/cards/DashboardCard';
import { StatCard } from '../../components/cards/StatCard';
import { CardSkeleton, Skeleton } from '../../components/common/LoadingSkeleton';
import { DataTable } from '../../components/tables/DataTable';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';

// Firebase Imports
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { flaggingService } from '../../services/flaggingService';
import { useToast } from '../../context/ToastContext';

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

  // 🎨 REDESIGNED AUDIT TABLE COLUMNS
  const auditColumns = [
    { 
      key: 'timestamp', 
      header: 'Date & Time', 
      render: (row) => {
        const d = new Date(row.timestamp);
        return (
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-800">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span className="text-xs font-medium text-slate-500">{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
        );
      },
      sortable: true 
    },
    { 
      key: 'actor', 
      header: 'Performed By', 
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-sm">
          {row.actor}
        </span>
      ),
      sortable: true 
    },
    { 
      key: 'action', 
      header: 'Action Taken',
      render: (row) => <span className="text-sm font-semibold text-slate-700 capitalize">{row.action}</span>
    },
    { 
      key: 'target', 
      header: 'Target / Details',
      render: (row) => <span className="text-sm text-slate-600">{row.target}</span>
    },
    { 
      key: 'result', 
      header: 'Outcome', 
      render: (row) => {
        // Custom Styled Badges specifically for the Audit Trail
        let badgeClass = "bg-slate-50 text-slate-700 border-slate-200";
        let label = row.result;
        
        if (row.result === 'approved') { 
          badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200"; 
          label = "Approved"; 
        } else if (row.result === 'active') { 
          badgeClass = "bg-blue-50 text-blue-700 border-blue-200"; 
          label = "Issued"; 
        } else if (row.result === 'rejected') { 
          badgeClass = "bg-danger-50 text-danger-700 border-danger-200"; 
          label = row.action.includes('Revoked') ? "Revoked" : "Rejected"; 
        } else if (row.result === 'warning') { 
          badgeClass = "bg-amber-50 text-amber-700 border-amber-200"; 
          label = "Flagged"; 
        }
        
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold border shadow-sm ${badgeClass}`}>
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-primary-900">Reports & Hub</h2>
          <p className="text-sm text-slate-500">Analytics, security flags, and administrative audit trails.</p>
        </div>
        
        <div className="flex flex-wrap rounded-lg bg-slate-100 p-1 shadow-inner">
          <button onClick={() => setActiveTab('reports')} className={`rounded-md px-5 py-2 text-sm font-semibold transition-all ${activeTab === 'reports' ? 'bg-white text-primary-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Analytics</button>
          <button onClick={() => setActiveTab('flagged')} className={`rounded-md px-5 py-2 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'flagged' ? 'bg-white text-primary-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Flagged Vehicles
            {flaggedVehicles.length > 0 && activeTab !== 'flagged' && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-danger-500 text-[10px] text-white">{flaggedVehicles.length}</span>
            )}
          </button>
          <button onClick={() => setActiveTab('audit')} className={`rounded-md px-5 py-2 text-sm font-semibold transition-all ${activeTab === 'audit' ? 'bg-white text-primary-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Audit Trail</button>
        </div>
      </div>

      {activeTab === 'reports' && (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {reportsLoading ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />) : (
              <>
                <StatCard label="Total Applications" value={(reports?.applicationsSummary?.approved || 0) + (reports?.applicationsSummary?.rejected || 0) + (reports?.applicationsSummary?.pending || 0)} icon="clipboard" />
                <StatCard label="Approved" value={reports?.applicationsSummary?.approved || 0} icon="check" tone="accent" />
                <StatCard label="Rejected" value={reports?.applicationsSummary?.rejected || 0} icon="alert" tone="danger" />
                <StatCard label="Pending Review" value={reports?.applicationsSummary?.pending || 0} icon="time" tone="secondary" />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DashboardCard title="Application Processing Overview">
              {reportsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <div className="flex flex-col gap-3 py-2">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-sm font-semibold text-slate-600">Total Processed (This Month)</span>
                    <span className="text-2xl font-bold text-slate-900">
                      {(reports?.applicationsSummary?.approved || 0) + (reports?.applicationsSummary?.rejected || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-accent-50 rounded-xl border border-accent-100">
                    <span className="text-sm font-semibold text-accent-900">Approval Rate</span>
                    <span className="text-2xl font-bold text-accent-700">
                      {reports?.applicationsSummary?.approved > 0 
                        ? Math.round(((reports?.applicationsSummary?.approved) / ((reports?.applicationsSummary?.approved) + (reports?.applicationsSummary?.rejected))) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-xl border border-secondary-100">
                    <span className="text-sm font-semibold text-secondary-900">Current Queue Workload</span>
                    <span className="text-xl font-bold text-secondary-800">{reports?.applicationsSummary?.pending || 0} Pending</span>
                  </div>
                </div>
              )}
            </DashboardCard>

            <DashboardCard title="Security & System Health">
              {reportsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <div className="flex flex-col gap-3 py-2">
                  <div className="flex items-center justify-between p-4 bg-danger-50 rounded-xl border border-danger-100">
                    <span className="text-sm font-semibold text-danger-900">Flagged Vehicles</span>
                    <span className="text-2xl font-bold text-danger-700">{flaggedVehicles.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-sm font-semibold text-slate-600">Total Audit Events Recorded</span>
                    <span className="text-xl font-bold text-slate-800">{auditEntries.length} Tracked</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <span className="text-sm font-semibold text-emerald-900">System Connection</span>
                    <span className="text-xs font-bold uppercase tracking-wide bg-emerald-600 text-white px-3 py-1.5 rounded-lg shadow-sm">Live Firestore</span>
                  </div>
                </div>
              )}
            </DashboardCard>
          </div>
        </div>
      )}

      {activeTab === 'flagged' && (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {flagsLoading ? (
            <div className="flex flex-col gap-3"><CardSkeleton /><CardSkeleton /></div>
          ) : flaggedVehicles.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center text-slate-500">
              No vehicles are currently flagged in the system.
            </div>
          ) : (
            flaggedVehicles.map(vehicle => {
              const offenses = offensesMap[vehicle.id] || [];
              const isRevoked = vehicle.accreditationStatus === 'Revoked';
              const isPendingRevocation = vehicle.offenseCount >= 3 && !isRevoked;

              return (
                <DashboardCard key={vehicle.id} className={isRevoked ? 'bg-red-50/30 border-danger-200' : ''}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-slate-900">{vehicle.plateNumber}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm ${isRevoked ? 'bg-danger-600 text-white' : isPendingRevocation ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                          {isRevoked ? 'REVOKED' : `${vehicle.offenseCount} / 3 Offenses`}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{vehicle.ownerName} &middot; Serial: <span className="font-semibold text-slate-700">{vehicle.stickerSerial}</span></p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setExpandedId(expandedId === vehicle.id ? null : vehicle.id)} className="btn-secondary py-2">
                        {expandedId === vehicle.id ? 'Hide History' : 'View History'}
                      </button>
                      {isPendingRevocation && (
                        <button onClick={() => handleRevoke(vehicle)} className="btn-primary bg-danger-600 hover:bg-danger-700 py-2 shadow-md">
                          Revoke Sticker
                        </button>
                      )}
                      {isRevoked && (
                        <button onClick={() => handleUndoRevoke(vehicle)} className="btn-primary bg-amber-500 hover:bg-amber-600 py-2 shadow-md">
                          Undo Revoke (Test)
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedId === vehicle.id && (
                    <div className="mt-5 border-t border-slate-200 pt-5 flex flex-col gap-3">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Offense History</h4>
                      {isRevoked && vehicle.revokeReason && (
                        <div className="bg-danger-100/50 border border-danger-200 p-4 rounded-xl text-sm text-danger-900 mb-2 shadow-inner">
                          <span className="font-bold uppercase tracking-wider text-[10px] block mb-1 text-danger-600">Revocation Reason</span>
                          {vehicle.revokeReason.includes('. Last violation:') ? (
                            <>
                              <span className="font-bold text-base">{vehicle.revokeReason.split('. Last violation:')[0]}</span><br/>
                              <span className="text-danger-700 mt-1.5 inline-block">
                                <span className="font-semibold">Last violation:</span> {vehicle.revokeReason.split('. Last violation:')[1]?.trim()}
                              </span>
                            </>
                          ) : (
                            vehicle.revokeReason
                          )}
                        </div>
                      )}
                      {offenses.length === 0 ? <p className="text-sm text-slate-400 italic">No individual logs found.</p> : (
                        <ul className="flex flex-col gap-3">
                          {offenses.map((offense, idx) => (
                            <li key={offense.id} className="rounded-xl bg-white p-4 text-sm border border-slate-200 shadow-sm">
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-danger-700 text-base">Strike {idx + 1}: {offense.reason}</span>
                                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{new Date(offense.timestamp).toLocaleDateString()}</span>
                              </div>
                              {offense.details && <p className="text-slate-600 mt-1 bg-slate-50 p-3 rounded-lg border border-slate-100">"{offense.details}"</p>}
                              
                              <p className="text-xs font-medium text-slate-400 mt-3 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                Reported by: {userMap[offense.guardId] || 'Security Officer'}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </DashboardCard>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <DashboardCard title="Administrative Action Log">
            <DataTable columns={auditColumns} rows={auditEntries} isLoading={auditLoading} />
          </DashboardCard>
        </div>
      )}
    </div>
  );
}