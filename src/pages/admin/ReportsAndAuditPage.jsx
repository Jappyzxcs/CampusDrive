import { useState, useMemo, useEffect } from 'react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { reportService } from '../../services/reportService'; 
import { mockDataService } from '../../services/mockDataService';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { StatCard } from '../../components/cards/StatCard';
import { BarChart } from '../../components/charts/BarChart';
import { CardSkeleton, Skeleton } from '../../components/common/LoadingSkeleton';
import { DataTable } from '../../components/tables/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';

// Flagging System Imports
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { flaggingService } from '../../services/flaggingService';
import { useToast } from '../../context/ToastContext';

export default function ReportsAndAuditPage() {
  const { role } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('reports'); // 'reports' | 'flagged' | 'audit'

  // --- 1. REPORTS DATA ---
  const { data: reports, isLoading: reportsLoading } = useAsyncData(() => reportService.getReports(), []);
  
  const displayViolations = reports?.violationBreakdown?.filter(v => {
    if (role === ROLES.BAO && v.type === 'Mismatched Plate') return false;
    return true; 
  }) || [];

  const maxViolationCount = displayViolations.length > 0 
    ? Math.max(...displayViolations.map((x) => x.count)) 
    : 1; 

  // --- 2. AUDIT DATA ---
  const { data: applications, isLoading: appsLoading } = useAsyncData(() => mockDataService.getApplications(), []);
  const { data: stickers, isLoading: stickersLoading } = useAsyncData(() => mockDataService.getStickers(), []);

  const auditEntries = useMemo(() => {
    if (appsLoading || stickersLoading) return [];
    
    const appEntries = (applications || [])
      .filter((a) => a.reviewedBy)
      .map((a) => ({
        id: `audit_app_${a.id}`,
        timestamp: a.reviewedDate,
        actor: a.reviewedBy,
        action: a.status === 'approved' ? 'Approved application' : 'Rejected application',
        target: `${a.applicantName} · ${a.type}`,
        result: a.status,
      }));

    const stickerEntries = (stickers || [])
      .filter((s) => s.assignedBy)
      .map((s) => ({
        id: `audit_stk_${s.id}`,
        timestamp: s.assignedDate,
        actor: s.assignedBy,
        action: 'Assigned sticker serial',
        target: `${s.serial} → ${s.plateNumber || 'unassigned'}`,
        result: 'active',
      }));

    return [...appEntries, ...stickerEntries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [applications, stickers, appsLoading, stickersLoading]);

  const auditColumns = [
    { key: 'timestamp', header: 'Date', sortable: true },
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
      const vQuery = query(collection(db, 'approved_vehicles'), where('offenseCount', '>', 0));
      const vSnap = await getDocs(vQuery);
      const vehicles = vSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
      showToast('Error loading flagged vehicles.', { type: 'danger' });
    } finally {
      setFlagsLoading(false);
    }
  };

  // Only load flag data when the user switches to the tab (saves database reads)
  useEffect(() => {
    if (activeTab === 'flagged') {
      loadFlaggedData();
    }
  }, [activeTab]);

  const handleRevoke = async (vehicle) => {
    if (!window.confirm(`Are you sure you want to REVOKE the sticker for ${vehicle.plateNumber}? This cannot be easily undone.`)) {
      return;
    }
    try {
      await flaggingService.revokeSticker(vehicle);
      showToast(`Sticker for ${vehicle.plateNumber} has been revoked.`, { type: 'success' });
      loadFlaggedData(); 
    } catch (error) {
      console.error("Revocation failed:", error);
      showToast('Failed to revoke sticker.', { type: 'danger' });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-primary-900">Reports & Hub</h2>
          <p className="text-sm text-slate-500">Analytics, security flags, and administrative audit trails.</p>
        </div>
        
        {/* Unified 3-Tab Navigation */}
        <div className="flex flex-wrap rounded-lg bg-slate-100 p-1">
          <button
            onClick={() => setActiveTab('reports')}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === 'reports' ? 'bg-white text-primary-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('flagged')}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'flagged' ? 'bg-white text-primary-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Flagged Vehicles
            {flaggedVehicles.length > 0 && activeTab !== 'flagged' && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-danger-500 text-[10px] text-white">
                {flaggedVehicles.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === 'audit' ? 'bg-white text-primary-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Audit Trail
          </button>
        </div>
      </div>

      {activeTab === 'reports' && (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {reportsLoading ? (
              Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
            ) : (
              <>
                <StatCard label="Applications This Month" value={reports?.applicationsSummary?.totalThisMonth || 0} icon="clipboard" />
                <StatCard label="Approved" value={reports?.applicationsSummary?.approved || 0} icon="check" tone="accent" />
                <StatCard label="Rejected" value={reports?.applicationsSummary?.rejected || 0} icon="alert" tone="danger" />
                <StatCard label="Still Pending" value={reports?.applicationsSummary?.pending || 0} icon="clipboard" tone="secondary" />
              </>
            )}
          </div>

          <DashboardCard title="Gate Entries per Day (Valid vs. Flagged)">
            {reportsLoading || !reports?.dailyEntries ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <BarChart data={reports.dailyEntries.map((d) => ({ label: d.date.slice(5), value: d.valid, secondaryValue: d.flagged }))} />
            )}
          </DashboardCard>

          <DashboardCard title="Violation Breakdown">
            {reportsLoading || !reports?.violationBreakdown ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <ul className="flex flex-col gap-3">
                {displayViolations.map((v) => (
                  <li key={v.type} className="flex items-center gap-3">
                    <span className="w-40 flex-none text-sm text-slate-600">{v.type}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-danger-400"
                        style={{ width: `${maxViolationCount > 0 ? (v.count / maxViolationCount) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-6 flex-none text-right text-sm font-medium text-slate-700">{v.count}</span>
                  </li>
                ))}
              </ul>
            )}
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
                <DashboardCard key={vehicle.id} className={isRevoked ? 'opacity-75 grayscale' : ''}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-slate-900">{vehicle.plateNumber}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isRevoked ? 'bg-danger-100 text-danger-700' : 
                          isPendingRevocation ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {isRevoked ? 'REVOKED' : `${vehicle.offenseCount} / 3 Offenses`}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        {vehicle.ownerName} &middot; Serial: <span className="font-semibold text-slate-700">{vehicle.stickerSerial}</span>
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setExpandedId(expandedId === vehicle.id ? null : vehicle.id)}
                        className="btn-secondary py-2"
                      >
                        {expandedId === vehicle.id ? 'Hide History' : 'View History'}
                      </button>

                      {isPendingRevocation && (
                        <button 
                          onClick={() => handleRevoke(vehicle)}
                          className="btn-primary bg-danger-600 hover:bg-danger-700 py-2"
                        >
                          Revoke Sticker
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedId === vehicle.id && (
                    <div className="mt-4 border-t border-slate-100 pt-4 flex flex-col gap-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Offense History</h4>
                      {offenses.length === 0 ? (
                        <p className="text-sm text-slate-400">Loading details...</p>
                      ) : (
                        <ul className="flex flex-col gap-3">
                          {offenses.map((offense, idx) => (
                            <li key={offense.id} className="rounded-lg bg-slate-50 p-3 text-sm border border-slate-100">
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-danger-700">Strike {idx + 1}: {offense.reason}</span>
                                <span className="text-xs text-slate-400">
                                  {new Date(offense.timestamp).toLocaleDateString()}
                                </span>
                              </div>
                              {offense.details && (
                                <p className="text-slate-600 italic">"{offense.details}"</p>
                              )}
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
            <DataTable columns={auditColumns} rows={auditEntries} isLoading={appsLoading || stickersLoading} />
          </DashboardCard>
        </div>
      )}
    </div>
  );
}