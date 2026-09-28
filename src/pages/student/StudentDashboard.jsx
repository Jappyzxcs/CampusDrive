import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService'; 
import { StatCard } from '../../components/cards/StatCard';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Timeline } from '../../components/common/Timeline';
import { EmptyState } from '../../components/common/EmptyState';
import { CardSkeleton, Skeleton } from '../../components/common/LoadingSkeleton';
import { ROUTES } from '../../constants/routes';

// Firebase Imports
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(isoString) {
  if (!isoString) return undefined;
  const d = new Date(isoString);
  return isNaN(d) ? undefined : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function generateTimeline(app) {
  const steps = [{ 
    title: 'Application Submitted', 
    label: 'Application Submitted', 
    date: formatDate(app.registrationDate || app.createdAt), 
    status: 'completed' 
  }];
  
  const status = (app.status || '').toLowerCase();

  if (status === 'pending' || status === 'under_review') {
     steps.push({ title: 'Under Review', label: 'Under Review', status: 'current' });
     steps.push({ title: 'Approval', label: 'Approval', status: 'upcoming' });
  } else if (status === 'approved' || status === 'for_payment') {
     steps.push({ title: 'Under Review', label: 'Under Review', status: 'completed' });
     steps.push({ title: 'Approved', label: 'Approved', date: formatDate(app.reviewedDate || app.approvedDate), status: 'completed' });
     steps.push({ title: 'Payment & Issuance', label: 'Payment & Issuance', status: 'current' });
  } else if (status === 'completed' || status === 'paid' || status === 'active') {
     steps.push({ title: 'Under Review', label: 'Under Review', status: 'completed' });
     steps.push({ title: 'Approved', label: 'Approved', date: formatDate(app.reviewedDate || app.approvedDate), status: 'completed' });
     steps.push({ title: 'Sticker Issued', label: 'Sticker Issued', date: formatDate(app.dateIssued || new Date().toISOString()), status: 'completed' });
  } else if (status === 'rejected' || status === 'revoked') {
     steps.push({ title: 'Under Review', label: 'Under Review', status: 'completed' });
     steps.push({ 
       title: status === 'revoked' ? 'Revoked' : 'Rejected', 
       label: status === 'revoked' ? 'Revoked' : 'Rejected',
       date: formatDate(app.revokedDate || app.reviewedDate || new Date().toISOString()), 
       status: 'error', 
       description: app.revokeReason || app.rejectReason 
     });
  }
  
  return steps;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  
  // 🟢 LIVE FIREBASE STATE
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Real-time Database Listener 
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

    return () => {
      unsubOwner();
      unsubUser();
    };
  }, [user?.id]);

  // 2. Derived Live Data
  const approvedVehicle = useMemo(() => {
    return applications.find((v) => ['approved', 'completed', 'paid', 'active', 'revoked'].includes((v.status || '').toLowerCase()));
  }, [applications]);
  
  const latestApplication = applications.length > 0 ? applications[0] : null;
  const pendingCount = applications.filter((a) => ['pending', 'under_review'].includes((a.status || '').toLowerCase())).length;

  // 3. Expiration Math (With Revocation Override)
  const isRevoked = approvedVehicle?.status === 'revoked';
  let expiryDays = null;
  let computedExpiry = approvedVehicle?.expiryDate || approvedVehicle?.validUntil;
  
  if (isRevoked) {
    computedExpiry = null; 
  } else if (!computedExpiry && approvedVehicle) {
    const baseDate = approvedVehicle.dateIssued || approvedVehicle.reviewedDate || approvedVehicle.registrationDate || new Date().toISOString();
    const d = new Date(baseDate);
    d.setFullYear(d.getFullYear() + 1);
    computedExpiry = d.toISOString();
  }
  
  if (computedExpiry) {
    expiryDays = daysUntil(computedExpiry);
  }

  // 🔵 AUTOMATED SYSTEM REMINDER (Expiration Warning)
  useEffect(() => {
    if (approvedVehicle && expiryDays !== null && expiryDays <= 30 && expiryDays >= 0 && !isRevoked) {
      const flagKey = `notified_expiry_${approvedVehicle.id}`;
      if (!localStorage.getItem(flagKey)) {
        notificationService.createNotification({
          userId: user.id,
          title: 'Expiration Warning',
          message: `Reminder: Your campus sticker for ${approvedVehicle.plateNumber || 'your vehicle'} expires in ${expiryDays} days. Please prepare for renewal.`,
          type: 'warning'
        }).then(() => {
          localStorage.setItem(flagKey, 'true'); 
        }).catch(err => console.error(err));
      }
    }
  }, [approvedVehicle, expiryDays, user.id, isRevoked]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        {/* Removed text-primary-900 and forced clean sans-serif typography */}
        <h2 className="text-2xl font-bold font-sans text-slate-800 tracking-tight">
          Welcome, {(user?.fullName || user?.name || 'User').split(' ')[0]}
        </h2>
        <p className="text-sm font-medium text-slate-500 mt-1">Here's the live status of your vehicle accreditation.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Vehicle Status"
              value={
                approvedVehicle ? (
                  isRevoked ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-danger-100 text-danger-700 border border-danger-200 shadow-sm">
                      Revoked: {approvedVehicle.plateNumber}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <StatusBadge status={approvedVehicle.status} />
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wider">
                        {approvedVehicle.plateNumber}
                      </span>
                    </div>
                  )
                ) : (
                  'No Vehicle'
                )
              }
              icon="car"
              tone={approvedVehicle ? (isRevoked ? 'danger' : 'accent') : 'primary'}
            />
            <StatCard
              label="Sticker Status"
              value={approvedVehicle?.stickerSerial ?? '—'}
              hint={approvedVehicle?.stickerSerial ? 'Serial number' : 'Not yet assigned'}
              icon="sticker"
              tone="secondary"
            />
            <StatCard
              label="Expiration"
              value={isRevoked ? `Revoked (${approvedVehicle?.stickerSerial || 'No Sticker'})` : (expiryDays != null ? `${expiryDays} days` : '—')}
              hint={isRevoked ? 'Your sticker has been invalidated.' : (computedExpiry ? `Expires ${formatDate(computedExpiry)}` : 'No active accreditation')}
              icon="alert"
              tone={isRevoked || (expiryDays != null && expiryDays <= 30) ? 'danger' : 'primary'}
            />
          </>
        )}
      </div>

      <div className="w-full">
        <DashboardCard title="Latest Application">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : latestApplication ? (
            <Timeline steps={generateTimeline(latestApplication)} />
          ) : (
            <EmptyState
              title="No applications yet"
              description="Register your vehicle to start the accreditation process."
            />
          )}
        </DashboardCard>
      </div>
    </div>
  );
}