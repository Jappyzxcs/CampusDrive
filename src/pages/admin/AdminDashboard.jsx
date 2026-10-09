import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useToast } from '../../context/ToastContext';

// Real Firebase services
import { applicationService } from '../../services/applicationService';
import { reportService } from '../../services/reportService'; 
import { flaggingService } from '../../services/flaggingService';

import { StatusBadge } from '../../components/common/StatusBadge';
import { CardSkeleton, Skeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { BarChart } from '../../components/charts/BarChart';
import { Icon } from '../../components/common/Icon';
import { ROLES } from '../../constants/roles';
import { ROUTES } from '../../constants/routes';
import { DataTable } from '../../components/tables/DataTable';

// Firebase Imports
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

// ----------------------------------------------------------------------
// SHARED AUDIT TRAIL LOGIC (Used by both GSU and BAO)
// ----------------------------------------------------------------------
function useAuditTrail() {
  const [userMap, setUserMap] = useState({});
  const userMapRef = useRef({});
  const [auditEntries, setAuditEntries] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    const fetchUsersForMapping = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const map = {};
        snap.docs.forEach(doc => {
          const u = doc.data();
          map[doc.id] = u.fullName || u.name || u.email || 'Unknown Officer';
        });
        userMapRef.current = map;
        setUserMap(map);
      } catch (error) {
        console.error("Failed to load user dictionary:", error);
      }
    };
    fetchUsersForMapping();
  }, []);

  const loadAuditData = async () => {
    setAuditLoading(true);
    try {
      const [vehSnap, appVehSnap, offSnap] = await Promise.all([
        getDocs(collection(db, 'vehicles')),
        getDocs(collection(db, 'approved_vehicles')),
        getDocs(collection(db, 'offenses'))
      ]);

      const entries = [];
      const currentMap = userMapRef.current;
      
      vehSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.registrationDate) {
          entries.push({
            id: `app_${doc.id}`, timestamp: data.registrationDate, actor: currentMap[data.reviewedBy] || 'System Administrator',
            action: `Application ${data.status}`, target: `${data.ownerName || 'Unknown'} · ${data.plateNumber || 'N/A'}`,
            result: ['rejected', 'revoked', 'expired'].includes((data.status||'').toLowerCase()) ? 'rejected' : 'approved',
          });
        }
        const s = (data.status || '').toLowerCase();
        if (s === 'revoked' || s === 'expired') {
          entries.push({
            id: `dead_veh_${doc.id}`, 
            timestamp: data.revokedDate || data.updatedAt || new Date().toISOString(), 
            actor: 'System Administrator',
            action: s === 'revoked' ? 'Revoked Access' : 'Status Expired', 
            target: `${data.plateNumber} · ${data.ownerName || 'Unknown'}`, 
            result: 'rejected',
          });
        }
      });
      
      appVehSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.dateIssued && data.stickerSerial) {
          entries.push({
            id: `stk_${doc.id}`, timestamp: data.dateIssued, actor: currentMap[data.assignedBy] || 'BAO Officer',
            action: 'Issued Sticker', target: `${data.stickerSerial} → ${data.plateNumber || 'unassigned'}`, result: 'active',
          });
        }
        if ((data.status || '').toLowerCase() === 'revoked' || data.accreditationStatus === 'Revoked') {
          entries.push({
            id: `rev_${doc.id}`, timestamp: data.revokedDate || data.updatedAt || new Date().toISOString(), actor: 'System / Admin',
            action: 'Revoked Access', target: `${data.plateNumber} · ${data.stickerSerial || 'N/A'}`, result: 'rejected',
          });
        }
      });
      
      offSnap.docs.forEach(doc => {
        const data = doc.data();
        entries.push({
          id: `off_${doc.id}`, timestamp: data.timestamp, actor: currentMap[data.guardId] || 'Security Guard',
          action: 'Flagged Offense', target: `${data.stickerSerial || 'Unknown'} · ${data.reason}`, result: 'warning',
        });
      });
      
      const uniqueMap = new Map();
      entries.forEach(entry => {
         const cleanTarget = entry.target.split('·')[0].trim();
         let dateKey = 'unknown';
         if (entry.timestamp) {
           try {
             dateKey = entry.timestamp?.toDate ? entry.timestamp.toDate().toDateString() : new Date(entry.timestamp).toDateString();
           } catch(e) {}
         }
         const key = `${entry.action}_${cleanTarget}_${dateKey}`;
         if (!uniqueMap.has(key)) uniqueMap.set(key, entry);
      });
      
      const finalEntries = Array.from(uniqueMap.values());
      const getTime = (ts) => ts?.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
      finalEntries.sort((a, b) => getTime(b.timestamp) - getTime(a.timestamp));
      setAuditEntries(finalEntries);
    } catch (error) {
      console.error("Failed to load audit logs:", error);
    } finally {
      setAuditLoading(false);
    }
  };

  const auditColumns = [
    { 
      key: 'timestamp', header: 'Date & Time', sortable: true,
      render: (row) => {
        try {
          const d = row.timestamp?.toDate ? row.timestamp.toDate() : new Date(row.timestamp);
          if (isNaN(d.getTime())) throw new Error();
          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-bold text-slate-900">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          );
        } catch {
          return <span className="text-slate-400 text-xs font-medium">Recorded</span>;
        }
      }
    },
    { 
      key: 'actor', header: 'Performed By', sortable: true,
      render: (row) => <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-sm">{row.actor}</span>
    },
    { key: 'action', header: 'Action Taken', render: (row) => <span className="text-[13px] font-bold text-slate-800 capitalize">{row.action}</span> },
    { key: 'target', header: 'Target / Details', render: (row) => <span className="text-[13px] font-medium text-slate-600">{row.target}</span> },
    { 
      key: 'result', header: 'Outcome', 
      render: (row) => {
        let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";
        let label = row.result;
        if (row.result === 'approved') { badgeClass = "bg-emerald-100 text-emerald-700 border-emerald-200"; label = "Approved"; } 
        else if (row.result === 'active') { badgeClass = "bg-blue-100 text-blue-700 border-blue-200"; label = "Issued"; } 
        else if (row.result === 'rejected') { 
          badgeClass = "bg-rose-100 text-rose-700 border-rose-200"; 
          if (row.action.includes('Revoked')) label = "Revoked";
          else if (row.action.includes('Expired')) label = "Expired";
          else label = "Rejected";
        } 
        else if (row.result === 'warning') { badgeClass = "bg-amber-100 text-amber-700 border-amber-200"; label = "Flagged"; }
        return <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-[11px] uppercase tracking-widest font-bold border shadow-sm ${badgeClass}`}>{label}</span>;
      } 
    },
  ];

  return { auditEntries, auditLoading, loadAuditData, auditColumns, userMap };
}

// ----------------------------------------------------------------------
// COMPONENTS
// ----------------------------------------------------------------------
function SmartBadge({ status }) {
  const s = (status || '').toLowerCase();
  
  if (s === 'revoked') return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black bg-rose-100 text-rose-900 border border-rose-200 uppercase tracking-wider shadow-sm">Revoked</span>;
  if (s === 'expired') return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black bg-orange-100 text-orange-900 border border-orange-200 uppercase tracking-wider shadow-sm">Expired</span>;
  if (['visit completed', 'completed', 'visit_completed', 'active'].includes(s)) return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-200 uppercase tracking-wider shadow-sm">Active</span>;
  if (['for_payment', 'approved'].includes(s)) return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black bg-blue-100 text-blue-900 border border-blue-200 uppercase tracking-wider shadow-sm">Approved</span>;
  if (s === 'pending') return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-200 uppercase tracking-wider shadow-sm">Pending</span>;
  if (s === 'under_review') return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black bg-purple-100 text-purple-900 border border-purple-200 uppercase tracking-wider shadow-sm">Manual Review</span>;
  if (s === 'rejected') return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black bg-slate-100 text-slate-900 border border-slate-200 uppercase tracking-wider shadow-sm">Rejected</span>;
  
  return <StatusBadge status={status} />; 
}

export default function AdminDashboard() {
  const { role } = useAuth();
  return role === ROLES.BAO ? <BaoDashboard /> : <GsuDashboard />;
}

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

// ----------------------------------------------------------------------
// GSU DASHBOARD
// ----------------------------------------------------------------------
function GsuDashboard() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: vehicles, isLoading: vLoading } = useAsyncData(() => applicationService.getAllVehicles(), []);
  const { data: applications, isLoading: aLoading } = useAsyncData(() => applicationService.getPendingApplications(), []);
  const { data: reports, isLoading: rLoading } = useAsyncData(() => reportService.getReports(), []);

  const overviewLoading = vLoading || aLoading || rLoading;

  const safeVehicles = Array.isArray(vehicles) ? vehicles : [];
  const safeApps = Array.isArray(applications) ? applications : [];

  const stats = !overviewLoading ? {
    total: safeVehicles.length,
    pending: safeApps.filter((a) => ['pending', 'under_review'].includes((a.status || '').toLowerCase())).length,
    approved: safeVehicles.filter((v) => ['approved', 'for_payment', 'paid', 'active', 'completed', 'visit completed', 'visit_completed'].includes((v.status || '').toLowerCase())).length,
    expired: safeVehicles.filter((v) => ['expired', 'revoked'].includes((v.status || '').toLowerCase())).length,
  } : { total: 0, pending: 0, approved: 0, expired: 0 };

  const recentApplications = !overviewLoading ? [...safeApps].reverse().slice(0, 5) : [];
  const hasGateData = Array.isArray(reports?.dailyEntries) && reports.dailyEntries.some(d => d.valid > 0 || d.flagged > 0);

  // Use the shared hook!
  const { auditEntries, auditLoading, loadAuditData, auditColumns, userMap } = useAuditTrail();

  useEffect(() => {
    if ((activeTab === 'audit' || activeTab === 'overview') && auditEntries.length === 0) loadAuditData();
  }, [activeTab, userMap]);

  const [flaggedVehicles, setFlaggedVehicles] = useState([]);
  const [offensesMap, setOffensesMap] = useState({});
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [flagSearch, setFlagSearch] = useState('');

  const loadFlaggedData = async () => {
    setFlagsLoading(true);
    try {
      const vQuery = query(collection(db, 'approved_vehicles'), where('offenseCount', '>=', 0));
      const vSnap = await getDocs(vQuery);
      const fetchedVehicles = vSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(v => v.offenseCount > 0 || v.accreditationStatus === 'Revoked');
      
      setFlaggedVehicles(fetchedVehicles);

      const vehicleIds = fetchedVehicles.map(v => v.id);
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
    if ((activeTab === 'flagged' || activeTab === 'overview') && flaggedVehicles.length === 0) loadFlaggedData();
  }, [activeTab]);

  const filteredFlaggedVehicles = useMemo(() => {
    const q = flagSearch.toLowerCase();
    if (!q) return flaggedVehicles;
    return flaggedVehicles.filter(v => 
      (v.plateNumber || '').toLowerCase().includes(q) ||
      (v.ownerName || '').toLowerCase().includes(q) ||
      (v.stickerSerial || '').toLowerCase().includes(q)
    );
  }, [flaggedVehicles, flagSearch]);

  const handleRevoke = async (vehicle) => {
    if (!window.confirm(`Are you sure you want to REVOKE the sticker for ${vehicle.plateNumber}?`)) return;
    try {
      await flaggingService.revokeSticker(vehicle);
      showToast(`Sticker for ${vehicle.plateNumber} has been revoked.`, { type: 'success' });
      loadFlaggedData(); loadAuditData(); 
    } catch (error) {
      showToast('Failed to revoke sticker.', { type: 'danger' });
    }
  };

  const handleUndoRevoke = async (vehicle) => {
    if (!window.confirm(`TEST: Wipe offenses and un-revoke ${vehicle.plateNumber}?`)) return;
    try {
      await flaggingService.undoRevoke(vehicle);
      showToast(`Success! Plate ${vehicle.plateNumber} reset to 0 offenses.`, { type: 'success' });
      setFlaggedVehicles(prev => prev.filter(v => v.id !== vehicle.id));
      loadAuditData();
    } catch (error) {
      showToast('Failed to undo revocation.', { type: 'danger' });
    }
  };

  const TABS = ['overview', 'flagged', 'audit'];

  return (
    <div className="flex flex-col gap-8 font-sans text-slate-800 pb-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end justify-between border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold font-sans tracking-tight text-slate-900">
            Administrator Dashboard
          </h1>
          <p className="text-base text-slate-500 font-medium">
            GSU command center for campus-wide vehicle accreditation.
          </p>
        </div>
        
        <div className="flex p-1 bg-slate-100 rounded-xl shadow-inner max-w-full overflow-x-auto">
          {TABS.map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)} 
              className={`flex-1 min-w-[120px] rounded-lg px-5 py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2 capitalize ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {tab === 'flagged' ? 'Security Flags' : tab === 'audit' ? 'Audit Trail' : tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {overviewLoading ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} className="h-32 rounded-2xl" />) : (
              <>
                <DashboardMetricCard title="Total Vehicles" value={stats.total} icon="car" tone="primary" />
                <DashboardMetricCard title="Pending Applications" value={stats.pending} icon="clipboard" tone="secondary" />
                <DashboardMetricCard title="Approved/Active" value={stats.approved} icon="check" tone="accent" />
                <DashboardMetricCard title="Revoked / Expired" value={stats.expired} icon="alert" tone="danger" />
              </>
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:col-span-2 flex flex-col hover:shadow-md transition-shadow">
              <h3 className="text-lg font-extrabold text-slate-900 mb-6">Gate Entries — Last 7 Days</h3>
              <div className="min-h-[250px] flex-1 flex flex-col justify-center">
                {overviewLoading || !reports?.dailyEntries ? <Skeleton className="h-full w-full rounded-xl" /> : !hasGateData ? (
                  <div className="py-8"><EmptyState title="No Gate Data" description="There are no vehicle entries recorded for the past 7 days." /></div>
                ) : (
                  <BarChart data={Array.isArray(reports?.dailyEntries) ? reports.dailyEntries.map((d) => ({ label: d.date.slice(5), value: d.valid, secondaryValue: d.flagged })) : []} />
                )}
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-extrabold text-slate-900">Recent Applications</h3>
                <Link to={ROUTES.ADMIN_PENDING_APPLICATIONS} className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">View all</Link>
              </div>
              {overviewLoading ? (
                <div className="flex flex-col gap-4"><Skeleton className="h-12 w-full rounded-lg" /><Skeleton className="h-12 w-full rounded-lg" /></div>
              ) : (
                <div className="flex flex-col">
                  {recentApplications.map((app, index) => (
                    <div key={app.id} className={`flex items-center justify-between py-4 ${index !== recentApplications.length - 1 ? 'border-b border-slate-100' : ''}`}>
                      <div className="flex flex-col gap-1 pr-4">
                        <span className="text-sm font-bold text-slate-900 truncate max-w-[180px]">{app.applicantName}</span>
                        <span className="text-xs font-medium text-slate-500">{app.type || 'New Registration'}</span>
                      </div>
                      <SmartBadge status={app.status} /> 
                    </div>
                  ))}
                  {recentApplications.length === 0 && <div className="py-8 text-center text-sm font-medium text-slate-500">No recent applications found.</div>}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col hover:shadow-md transition-shadow">
              <h3 className="text-lg font-extrabold text-slate-900 mb-6">Application Processing Overview</h3>
              {overviewLoading ? <Skeleton className="h-48 w-full rounded-xl" /> : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-sm font-bold text-slate-600">Total Processed (This Month)</span>
                    <span className="text-2xl font-black text-slate-900">{(reports?.applicationsSummary?.approved || 0) + (reports?.applicationsSummary?.rejected || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-emerald-50 rounded-xl border border-emerald-100">
                    <span className="text-sm font-bold text-emerald-900">Approval Rate</span>
                    <span className="text-2xl font-black text-emerald-700">
                      {reports?.applicationsSummary?.approved > 0 ? Math.round(((reports?.applicationsSummary?.approved) / ((reports?.applicationsSummary?.approved) + (reports?.applicationsSummary?.rejected))) * 100) : 0}%
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col hover:shadow-md transition-shadow">
              <h3 className="text-lg font-extrabold text-slate-900 mb-6">Security & System Health</h3>
              {flagsLoading || auditLoading ? <Skeleton className="h-48 w-full rounded-xl" /> : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-5 bg-rose-50 rounded-xl border border-rose-100">
                    <span className="text-sm font-bold text-rose-900">Flagged Vehicles</span>
                    <span className="text-2xl font-black text-rose-700">{flaggedVehicles.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-sm font-bold text-slate-600">Total Audit Events</span>
                    <span className="text-xl font-black text-slate-800">{auditEntries.length} Tracked</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
        </div>
      )}

      {activeTab === 'flagged' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search by plate number, owner name, or sticker serial..." 
              value={flagSearch}
              onChange={(e) => setFlagSearch(e.target.value)}
              className="w-full bg-white pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all shadow-sm text-sm font-medium text-slate-800 placeholder:text-slate-400"
            />
          </div>

          {flagsLoading ? (
            <div className="flex flex-col gap-4"><CardSkeleton className="rounded-2xl h-32" /><CardSkeleton className="rounded-2xl h-32" /></div>
          ) : flaggedVehicles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-16 text-center">
              <p className="text-lg font-bold text-slate-500">No vehicles are currently flagged in the system.</p>
            </div>
          ) : filteredFlaggedVehicles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-16 text-center">
              <p className="text-lg font-bold text-slate-500">No flagged vehicles match "{flagSearch}".</p>
            </div>
          ) : (
            filteredFlaggedVehicles.map(vehicle => {
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
                      
                      <p className="text-sm font-medium text-slate-500 flex items-center gap-2 mt-1">
                        {vehicle.ownerName} 
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-widest border border-slate-200">
                          {vehicle.registrantType || 'Student'}
                        </span>
                        <span className="text-slate-300">•</span> 
                        Serial: <span className="font-bold text-slate-700">{vehicle.stickerSerial || 'N/A'}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => setExpandedId(expandedId === vehicle.id ? null : vehicle.id)} className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold tracking-wide hover:bg-slate-200 transition-all border border-slate-200">
                        {expandedId === vehicle.id ? 'Hide History' : 'View History'}
                      </button>
                      {isPendingRevocation && (
                        <button onClick={() => handleRevoke(vehicle)} className="px-6 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold tracking-wide hover:bg-rose-700 transition-all shadow-sm hover:shadow-md">
                          Revoke Sticker
                        </button>
                      )}
                      {isRevoked && (
                        <button onClick={() => handleUndoRevoke(vehicle)} className="px-6 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold tracking-wide hover:bg-amber-600 transition-all shadow-sm hover:shadow-md">
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
                          ) : <span className="font-bold text-slate-900 text-base">{vehicle.revokeReason}</span>}
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

      {activeTab === 'audit' && (
        <div className="animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 hover:shadow-md transition-shadow">
            <h3 className="text-lg font-extrabold text-slate-900 mb-6">Administrative Action Log</h3>
            <DataTable columns={auditColumns} rows={auditEntries} isLoading={auditLoading} />
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// BAO DASHBOARD
// ----------------------------------------------------------------------
function BaoDashboard() {
  const { data: vehicles, isLoading } = useAsyncData(() => applicationService.getAllVehicles(), []);
  
  const safeVehicles = Array.isArray(vehicles) ? vehicles : [];
  const awaitingPayment = !isLoading ? safeVehicles.filter((v) => ['for_payment', 'approved'].includes((v.status || '').toLowerCase())).length : 0;
  const completed = !isLoading ? safeVehicles.filter((v) => ['paid', 'active', 'completed', 'visit completed', 'visit_completed'].includes((v.status || '').toLowerCase())).length : 0;

  // Use the shared hook to pull in the Audit Trail data!
  const { auditEntries, auditLoading, loadAuditData, auditColumns, userMap } = useAuditTrail();

  useEffect(() => {
    if (Object.keys(userMap).length > 0 && auditEntries.length === 0) {
      loadAuditData();
    }
  }, [userMap]);

  return (
    <div className="flex flex-col gap-8 font-sans text-slate-800 pb-10 animate-in fade-in duration-300">
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-3xl font-extrabold font-sans tracking-tight text-slate-900">BAO Dashboard</h1>
        <p className="text-base text-slate-500 font-medium">Payment collection and physical sticker issuance.</p>
      </div>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {isLoading ? Array.from({ length: 2 }).map((_, i) => <CardSkeleton key={i} className="h-32 rounded-2xl" />) : (
          <>
            <DashboardMetricCard title="Awaiting Payment & Pickup" value={awaitingPayment} icon="alert" tone="secondary" />
            <DashboardMetricCard title="Completed Issuances" value={completed} icon="check" tone="accent" />
          </>
        )}
      </div>
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 hover:shadow-md transition-shadow">
        <div>
          <h3 className="text-xl font-extrabold text-slate-900 mb-2">Ready for Payment</h3>
          <p className="text-sm font-medium text-slate-500">
            You currently have <strong className="text-slate-800">{awaitingPayment}</strong> vehicles approved by GSU waiting to pay their fees.
          </p>
        </div>
        <Link to={ROUTES.ADMIN_STICKER_MANAGEMENT} className="shrink-0 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold tracking-wide hover:bg-blue-700 transition-all shadow-sm hover:shadow-md whitespace-nowrap">
          Open BAO Window
        </Link>
      </div>

      {/* NEW: Audit Trail rendered directly inside the BAO view */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 hover:shadow-md transition-shadow mt-4">
        <div className="mb-6 flex flex-col">
          <h3 className="text-lg font-extrabold text-slate-900">Administrative Action Log</h3>
          <p className="text-sm text-slate-500 mt-1">Campus-wide tracking of application approvals, sticker issuances, and offenses.</p>
        </div>
        <DataTable columns={auditColumns} rows={auditEntries} isLoading={auditLoading} />
      </div>
      
    </div>
  );
}