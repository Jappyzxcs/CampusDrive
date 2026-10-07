import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService'; 
import { DashboardCard } from '../../components/cards/DashboardCard';
import { Timeline } from '../../components/common/Timeline';
import { EmptyState } from '../../components/common/EmptyState';
import { CardSkeleton, Skeleton } from '../../components/common/LoadingSkeleton';
import { Icon } from '../../components/common/Icon';

import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

// Smart Parser: Handles both Legacy DD/MM/YYYY and Standard MM/DD/YYYY
function parseDateSafe(dateStr) {
  if (!dateStr) return null;
  if (dateStr.includes('-')) {
    const d = new Date(dateStr);
    return isNaN(d) ? null : d;
  }
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr.trim());
  if (m) {
    const p1 = +m[1], p2 = +m[2], year = +m[3];
    if (p1 > 12) return new Date(year, p2 - 1, p1);
    return new Date(year, p1 - 1, p2);
  }
  
  const fallback = new Date(dateStr);
  return isNaN(fallback) ? null : fallback;
}

function daysUntilSafe(dateStr) {
  const d = parseDateSafe(dateStr);
  if (!d) return null;
  const diff = d - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDateSafe(dateStr) {
  const d = parseDateSafe(dateStr);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';
}

function generateTimeline(app) {
  const steps = [{ 
    title: 'Application Submitted', 
    label: 'Application Submitted', 
    date: formatDateSafe(app.registrationDate || app.createdAt), 
    status: 'completed' 
  }];
  
  const status = (app.status || '').toLowerCase();

  if (status === 'pending' || status === 'under_review') {
     steps.push({ title: 'Under Review', label: 'Under Review', status: 'current' });
     steps.push({ title: 'Approval', label: 'Approval', status: 'upcoming' });
  } else if (status === 'approved' || status === 'for_payment') {
     steps.push({ title: 'Under Review', label: 'Under Review', status: 'completed' });
     steps.push({ title: 'Approved', label: 'Approved', date: formatDateSafe(app.reviewedDate || app.approvedDate), status: 'completed' });
     steps.push({ title: 'Payment & Issuance', label: 'Payment & Issuance', status: 'current' });
  } else if (status === 'completed' || status === 'paid' || status === 'active') {
     steps.push({ title: 'Under Review', label: 'Under Review', status: 'completed' });
     steps.push({ title: 'Approved', label: 'Approved', date: formatDateSafe(app.reviewedDate || app.approvedDate), status: 'completed' });
     steps.push({ title: 'Sticker Issued', label: 'Sticker Issued', date: formatDateSafe(app.dateIssued || new Date().toISOString()), status: 'completed' });
  } else if (status === 'rejected' || status === 'revoked') {
     steps.push({ title: 'Under Review', label: 'Under Review', status: 'completed' });
     steps.push({ 
       title: status === 'revoked' ? 'Revoked' : 'Rejected', 
       label: status === 'revoked' ? 'Revoked' : 'Rejected',
       date: formatDateSafe(app.revokedDate || app.reviewedDate || new Date().toISOString()), 
       status: 'error', 
       description: app.revokeReason || app.rejectReason 
     });
  }
  return steps;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const qOwner = query(collection(db, 'vehicles'), where('ownerId', '==', user.id));
    const qUser = query(collection(db, 'vehicles'), where('userId', '==', user.id));
    const appsMap = new Map();

    const updateState = () => {
      const fetchedApps = Array.from(appsMap.values());
      fetchedApps.sort((a, b) => new Date(b.registrationDate || b.createdAt || 0) - new Date(a.registrationDate || a.createdAt || 0));
      setApplications(fetchedApps);
      setIsLoading(false);
    };

    const unsubOwner = onSnapshot(qOwner, (snapshot) => {
      snapshot.docs.forEach(doc => appsMap.set(doc.id, { id: doc.id, ...doc.data() }));
      updateState();
    });
    const unsubUser = onSnapshot(qUser, (snapshot) => {
      snapshot.docs.forEach(doc => appsMap.set(doc.id, { id: doc.id, ...doc.data() }));
      updateState();
    });

    return () => { unsubOwner(); unsubUser(); };
  }, [user?.id]);

  const approvedVehicles = useMemo(() => {
    return applications.filter((v) => ['approved', 'completed', 'paid', 'active', 'revoked'].includes((v.status || '').toLowerCase()));
  }, [applications]);
  
  const latestApplication = applications.length > 0 ? applications[0] : null;

  useEffect(() => {
    approvedVehicles.forEach((vehicle) => {
      if (vehicle.status === 'revoked') return;

      const stickerBase = vehicle.dateIssued || vehicle.reviewedDate || vehicle.registrationDate;
      let stickerExpiry = null;
      if (stickerBase) {
        const d = new Date(stickerBase);
        d.setFullYear(d.getFullYear() + 1);
        stickerExpiry = d.toISOString();
      }

      const orExpiry = vehicle.nlpExtractedData?.orExpiry || vehicle.orExpiry;
      const licenseExpiry = vehicle.nlpExtractedData?.licenseExpiry || vehicle.licenseExpiry;

      const checks = [
        { type: 'sticker', name: 'Campus Sticker', date: stickerExpiry },
        { type: 'or', name: 'Official Receipt', date: orExpiry },
        { type: 'license', name: 'Driver\'s License', date: licenseExpiry }
      ];

      checks.forEach(check => {
        const days = daysUntilSafe(check.date);
        if (days !== null && days <= 30 && days >= 0) {
          const flagKey = `notified_${check.type}_expiry_${vehicle.id}`;
          if (!localStorage.getItem(flagKey)) {
            notificationService.createNotification({
              userId: user.id,
              title: `${check.name} Expiring Soon`,
              message: `Your ${check.name} for ${vehicle.plateNumber} expires in ${days} days. Please update it in the system.`,
              type: 'warning'
            }).then(() => localStorage.setItem(flagKey, 'true')).catch(console.error);
          }
        }
      });
    });
  }, [approvedVehicles, user.id]);

  return (
    <div className="flex flex-col gap-8 min-h-screen font-sans text-slate-800">
      {/* Header Section */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Welcome, {(user?.fullName || user?.name || 'User').split(' ')[0]}
        </h1>
        <p className="text-base text-slate-500 font-medium">Here's the live status of your vehicle accreditation.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      ) : approvedVehicles.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center text-slate-500 font-medium">
          No active or approved vehicles found.
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {approvedVehicles.map((vehicle) => {
            const isRevoked = vehicle.status === 'revoked';
            
            return (
              <div key={vehicle.id} className="flex flex-col gap-4">
                
                {/* Vehicle Pill/Identifier */}
                <div className="inline-flex items-center self-start gap-2 px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm">
                  <Icon name="car" className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">
                    {vehicle.plateNumber} <span className="text-slate-300 mx-1">&bull;</span> {vehicle.vehicleDetails?.vehicleType || vehicle.make || 'Vehicle'}
                  </h3>
                </div>
                
                {/* Metrics Grid */}
{/* Metrics Grid - Restored equal heights, but centered the internal content */}
<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
  
  {/* Card 1: Vehicle Status */}
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isRevoked ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
      <Icon name="car" className="w-6 h-6" />
    </div>
    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
      Vehicle Status
    </span>
    <div>
      {isRevoked ? (
        <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-rose-100 text-rose-700 gap-1.5">
          Revoked
        </span>
      ) : (
        <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-emerald-100 text-emerald-700 gap-1.5 shadow-sm border border-emerald-200">
          <Icon name="check-circle" className="w-4 h-4" /> ACTIVE
        </span>
      )}
    </div>
  </div>
  
  {/* Card 2: Sticker Status */}
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-4">
      <Icon name="sticker" className="w-6 h-6" />
    </div>
    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
      Sticker Status
    </span>
    <h2 className="text-3xl font-extrabold font-sans text-slate-900 tracking-tight">
      {vehicle.stickerSerial || '—'}
    </h2>
    <p className="text-xs font-medium text-slate-500 mt-2 flex items-center gap-1.5">
      {vehicle.stickerSerial ? (
        <><Icon name="check" className="w-4 h-4 text-emerald-500" /> Serial assigned</>
      ) : 'Not yet assigned'}
    </p>
  </div>
  
  {/* Card 3: Document Expirations */}
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 relative overflow-hidden flex flex-col justify-center hover:shadow-md transition-shadow">
    {isRevoked && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center font-bold text-rose-700 uppercase tracking-widest">Revoked</div>}
    
    <div className="flex items-center gap-2 mb-5 border-b border-slate-100 pb-3">
      <Icon name="alert-triangle" className="h-4 w-4 text-amber-500" />
      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Document Expirations</h3>
    </div>
    
    <div className="flex flex-col gap-2">
      <ExpiryRow 
        label="Sticker" 
        baseDate={vehicle.dateIssued || vehicle.reviewedDate || vehicle.registrationDate} 
        isSticker 
      />
      <ExpiryRow 
        label="OR Expiry" 
        baseDate={vehicle.nlpExtractedData?.orExpiry || vehicle.orExpiry} 
      />
      <ExpiryRow 
        label="License" 
        baseDate={vehicle.nlpExtractedData?.licenseExpiry || vehicle.licenseExpiry} 
      />
    </div>
  </div>

</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline Section */}
      <div className="w-full mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-6">Latest Application Activity</h3>
        {isLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-4 w-1/3 rounded-md" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
          </div>
        ) : latestApplication ? (
          <Timeline steps={generateTimeline(latestApplication)} />
        ) : (
          <EmptyState title="No applications yet" description="Register your vehicle to start the accreditation process." />
        )}
      </div>
    </div>
  );
}

// Refactored ExpiryRow: Uses clean, colored pill tags for "days left"
function ExpiryRow({ label, baseDate, isSticker = false }) {
  let dateStr = baseDate;
  
  if (isSticker && baseDate) {
    const d = parseDateSafe(baseDate);
    if (d) {
      d.setFullYear(d.getFullYear() + 1);
      dateStr = d.toISOString();
    }
  }

  const days = daysUntilSafe(dateStr);
  
  let statusBadge = (
    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
      N/A
    </span>
  );

  if (days !== null) {
    if (days < 0) {
      statusBadge = (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
          Expired
        </span>
      );
    } else if (days <= 30) {
      statusBadge = (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">
          {days} days left
        </span>
      );
    } else {
      statusBadge = (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">
          {days} days left
        </span>
      );
    }
  }
  
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {statusBadge}
    </div>
  );
}