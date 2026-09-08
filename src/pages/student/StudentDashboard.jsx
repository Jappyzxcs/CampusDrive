import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { mockDataService } from '../../services/mockDataService';
import { StatCard } from '../../components/cards/StatCard';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Timeline } from '../../components/common/Timeline';
import { EmptyState } from '../../components/common/EmptyState';
import { CardSkeleton, Skeleton } from '../../components/common/LoadingSkeleton';
import { ROUTES } from '../../constants/routes';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function StudentDashboard() {
  const { user } = useAuth();
  
  // Directly mapping the fetched data to 'vehicles' and 'applications'
  const { data: vehicles, isLoading: vehiclesLoading } = useAsyncData(
    () => mockDataService.getVehicles({ ownerId: user.id }),
    [user.id],
  );
  
  const { data: applications, isLoading: appsLoading } = useAsyncData(
    () => mockDataService.getApplications({ applicantId: user.id }),
    [user.id],
  );

  const isLoading = vehiclesLoading || appsLoading;
  const approvedVehicle = vehicles?.find((v) => v.status === 'approved');
  const latestApplication = applications?.[applications.length - 1];
  const pendingCount = applications?.filter((a) => ['pending', 'under_review'].includes(a.status)).length ?? 0;

  const expiryDays = approvedVehicle ? daysUntil(approvedVehicle.expiryDate) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        {/* Pulls the first name from fullName or name */}
        <h2 className="text-xl font-semibold text-primary-900">
          Welcome, {(user?.fullName || user?.name || 'User').split(' ')[0]}
        </h2>
        <p className="text-sm text-slate-500">Here's the status of your vehicle accreditation.</p>
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
              value={approvedVehicle ? <StatusBadge status={approvedVehicle.status} /> : 'No Vehicle'}
              icon="car"
              tone={approvedVehicle ? 'accent' : 'primary'}
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
              value={expiryDays != null ? `${expiryDays} days` : '—'}
              hint={approvedVehicle?.expiryDate ? `Expires ${approvedVehicle.expiryDate}` : 'No active accreditation'}
              icon="alert"
              tone={expiryDays != null && expiryDays <= 30 ? 'danger' : 'primary'}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DashboardCard title="Latest Application" className="lg:col-span-2">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : latestApplication ? (
            <Timeline steps={latestApplication.timeline} />
          ) : (
            <EmptyState
              title="No applications yet"
              description="Register your vehicle to start the accreditation process."
            />
          )}
        </DashboardCard>

        {/* SMART QUICK ACTIONS SIDEBAR */}
        <DashboardCard title="Quick Actions">
          <div className="flex flex-col gap-3">
            
            {/* Toggles between Register and Renew depending on vehicle status */}
            {!approvedVehicle ? (
              <Link to={ROUTES.STUDENT_VEHICLE_REGISTRATION} className="btn-primary justify-start">
                Register a Vehicle
              </Link>
            ) : (
              <Link to={ROUTES.STUDENT_RENEWAL.replace(':vehicleId', approvedVehicle.id)} className="btn-primary justify-start bg-accent-600 hover:bg-accent-700">
                Renew Registration
              </Link>
            )}

            <Link to={ROUTES.STUDENT_APPLICATION_STATUS} className="btn-secondary justify-start">
              View Applications {pendingCount > 0 && `(${pendingCount} pending)`}
            </Link>

            {/* Only show View Vehicle Details if they actually have a vehicle */}
            {approvedVehicle && (
              <Link to={ROUTES.STUDENT_VEHICLE_DETAILS.replace(':vehicleId', approvedVehicle.id)} className="btn-secondary justify-start">
                View Vehicle Details
              </Link>
            )}
            
            <Link to={ROUTES.STUDENT_NOTIFICATIONS} className="btn-secondary justify-start">
              Notifications
            </Link>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}