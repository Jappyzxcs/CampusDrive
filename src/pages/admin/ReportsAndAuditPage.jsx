import { useState, useEffect } from 'react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { reportService } from '../../services/reportService'; 
import { DashboardCard } from '../../components/cards/DashboardCard';
import { StatCard } from '../../components/cards/StatCard';
import { BarChart } from '../../components/charts/BarChart';
import { CardSkeleton, Skeleton } from '../../components/common/LoadingSkeleton';
import { DataTable } from '../../components/tables/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
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

  // --- 1. REPORTS DATA ---
  const { data: reports, isLoading: reportsLoading } = useAsyncData(() => reportService.getReports(), []);
  
  const displayViolations = reports?.violationBreakdown?.filter(v => {
    if (role === ROLES.BAO && v.type === 'Mismatched Plate') return false;
    return true; 
  }) || [];

  const maxViolationCount = displayViolations.length > 0 
    ? Math.max(...displayViolations.map((x) => x.count)) : 1; 

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
            actor: 'Administrator',
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
            actor: 'BAO Officer',
            action: 'Assigned sticker serial',
            target: `${data.stickerSerial} → ${data.plateNumber || 'unassigned'}`,
            result: 'active',
          });
        }
        if (data.status === 'revoked' && data.revokeReason) {
          entries.push({
            id: `rev_${doc.id}`,
            timestamp: data.revokedDate || new Date().toISOString(),
            actor: 'System / Admin',
            action: 'Revoked sticker',
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
          actor: `Guard ID: ${data.guardId || 'Unknown'}`,
          action: 'Flagged vehicle offense',
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
  }, [activeTab]);

  const auditColumns = [
    { key: 'timestamp', header: 'Date', render: (row) => new Date(row.timestamp).toLocaleDateString(), sortable: true },
    { key: 'actor', header: 'Actor', sortable: true },
    { key: 'action', header: 'Action' },
    { key: 'target', header: 'Target' },
    { key: 'result', header: 'Outcome', render: (row) => <StatusBadge status={row.result} /> },
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
        
        <div className="flex flex-wrap rounded-lg bg-slate-100 p-1">
          <button onClick={() => setActiveTab('reports')} className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${activeTab === 'reports' ? 'bg-white text-primary-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Analytics</button>
          <button onClick={() => setActiveTab('flagged')} className={`rounded-md px-4 py-2 text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'flagged' ? 'bg-white text-primary-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Flagged Vehicles
            {flaggedVehicles.length > 0 && activeTab !== 'flagged' && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-danger-500 text-[10px] text-white">{flaggedVehicles.length}</span>
            )}
          </button>
          <button onClick={() => setActiveTab('audit')} className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${activeTab === 'audit' ? 'bg-white text-primary-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Audit Trail</button>
        </div>
      </div>

      {activeTab === 'reports' && (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {reportsLoading ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />) : (
              <>
                <StatCard label="Applications This Month" value={reports?.applicationsSummary?.totalThisMonth || 0} icon="clipboard" />
                <StatCard label="Approved" value={reports?.applicationsSummary?.approved || 0} icon="check" tone="accent" />
                <StatCard label="Rejected" value={reports?.applicationsSummary?.rejected || 0} icon="alert" tone="danger" />
                <StatCard label="Still Pending" value={reports?.applicationsSummary?.pending || 0} icon="clipboard" tone="secondary" />
              </>
            )}
          </div>
          <DashboardCard title="Gate Entries per Day (Valid vs. Flagged)">
            {reportsLoading || !reports?.dailyEntries ? <Skeleton className="h-40 w-full" /> : <BarChart data={reports.dailyEntries.map((d) => ({ label: d.date.slice(5), value: d.valid, secondaryValue: d.flagged }))} />}
          </DashboardCard>
        </div>
      )}

      {activeTab === 'flagged' && (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {flagsLoading ? (
            <p className="text-slate-500 p-6">Loading flagged vehicles...</p>
          ) : flaggedVehicles.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
              No vehicles are currently flagged.
            </div>
          ) : (
            flaggedVehicles.map(vehicle => {
              const offenses = offensesMap[vehicle.id] || [];
              const isRevoked = vehicle.accreditationStatus === 'Revoked';
              const isPendingRevocation = vehicle.offenseCount >= 3 && !isRevoked;

              return (
                <DashboardCard key={vehicle.id} className={isRevoked ? 'bg-slate-50 border-danger-200' : ''}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-slate-900">{vehicle.plateNumber}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${isRevoked ? 'bg-danger-100 text-danger-700' : isPendingRevocation ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
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
                        <button onClick={() => handleRevoke(vehicle)} className="btn-primary bg-danger-600 hover:bg-danger-700 py-2">
                          Revoke Sticker
                        </button>
                      )}
                      {isRevoked && (
                        <button onClick={() => handleUndoRevoke(vehicle)} className="btn-primary bg-amber-500 hover:bg-amber-600 py-2 shadow-sm">
                          Undo Revoke (Test)
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedId === vehicle.id && (
                    <div className="mt-4 border-t border-slate-100 pt-4 flex flex-col gap-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Offense History</h4>
                      {isRevoked && vehicle.revokeReason && (
                        <div className="bg-danger-50 border border-danger-100 p-3 rounded-lg text-sm text-danger-800 mb-2">
                          <span className="font-bold uppercase tracking-wide text-xs block mb-1">Revocation Reason</span>
                          {vehicle.revokeReason.includes('. Last violation:') ? (
                            <>
                              <span className="font-bold">{vehicle.revokeReason.split('. Last violation:')[0]}</span><br/>
                              <span className="text-danger-700 mt-1 inline-block">
                                <span className="font-semibold">Last violation:</span> {vehicle.revokeReason.split('. Last violation:')[1]?.trim()}
                              </span>
                            </>
                          ) : (
                            vehicle.revokeReason
                          )}
                        </div>
                      )}
                      {offenses.length === 0 ? <p className="text-sm text-slate-400">No individual logs found.</p> : (
                        <ul className="flex flex-col gap-3">
                          {offenses.map((offense, idx) => (
                            <li key={offense.id} className="rounded-lg bg-white p-3 text-sm border border-slate-200 shadow-sm">
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-danger-700">Strike {idx + 1}: {offense.reason}</span>
                                <span className="text-xs text-slate-400">{new Date(offense.timestamp).toLocaleDateString()}</span>
                              </div>
                              {offense.details && <p className="text-slate-600 italic mt-1 bg-slate-50 p-2 rounded">"{offense.details}"</p>}
                              <p className="text-xs text-slate-400 mt-2">Reported by Guard ID: {offense.guardId}</p>
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