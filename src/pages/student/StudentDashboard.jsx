import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService'; 
import { StatCard } from '../../components/cards/StatCard';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { StatusBadge } from '../../components/common/StatusBadge';
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
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold font-sans text-slate-800 tracking-tight">
          Welcome, {(user?.fullName || user?.name || 'User').split(' ')[0]}
        </h2>
        <p className="text-sm font-medium text-slate-500 mt-1">Here's the live status of your vehicle accreditation.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      ) : approvedVehicles.length === 0 ? (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-6 text-center text-slate-500">
          No active or approved vehicles found.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {approvedVehicles.map((vehicle) => {
            const isRevoked = vehicle.status === 'revoked';
            
            return (
              <div key={vehicle.id} className="flex flex-col gap-3">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest pl-1 border-l-4 border-primary-500">
                  {vehicle.plateNumber} &middot; {vehicle.vehicleDetails?.vehicleType || vehicle.make || 'Vehicle'}
                </h3>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <StatCard
                    label="Vehicle Status"
                    value={
                      isRevoked ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-danger-100 text-danger-700">
                          Revoked
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      )
                    }
                    icon="car"
                    tone={isRevoked ? 'danger' : 'accent'}
                  />
                  
                  <StatCard
                    label="Sticker Status"
                    value={vehicle.stickerSerial ?? '—'}
                    hint={vehicle.stickerSerial ? 'Serial number assigned' : 'Not yet assigned'}
                    icon="sticker"
                    tone="secondary"
                  />
                  
                  <div className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm p-4 relative overflow-hidden">
                    {isRevoked && <div className="absolute inset-0 bg-danger-50/50 backdrop-blur-[1px] z-10 flex items-center justify-center font-bold text-danger-700 uppercase tracking-widest">Revoked</div>}
                    
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="alert" className="h-4 w-4 text-slate-400" />
                      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Document Expirations</h3>
                    </div>
                    
                    <div className="flex flex-col">
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

      <div className="w-full mt-4">
        <DashboardCard title="Latest Application Activity">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-1/2" />
            </div>
          ) : latestApplication ? (
            <Timeline steps={generateTimeline(latestApplication)} />
          ) : (
            <EmptyState title="No applications yet" description="Register your vehicle to start the accreditation process." />
          )}
        </DashboardCard>
      </div>
    </div>
  );
}

// STANDARDIZED ROW: No Links, No Hover, Clean Formatting
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
  const isExpiring = days !== null && days <= 30 && days >= 0;
  const isExpired = days !== null && days < 0;
  
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span className={`text-xs font-bold ${isExpiring ? 'text-danger-600 animate-pulse' : isExpired ? 'text-danger-800' : 'text-slate-700'}`}>
        {days !== null ? (isExpired ? 'Expired' : `${days} days left`) : 'N/A'}
      </span>
    </div>
  );
}