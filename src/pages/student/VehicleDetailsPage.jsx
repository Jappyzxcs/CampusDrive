import { Link, useParams } from 'react-router-dom';
import { useAsyncData } from '../../hooks/useAsyncData';
import { mockDataService } from '../../services/mockDataService';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Skeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { ROUTES } from '../../constants/routes';

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value ?? '—'}</span>
    </div>
  );
}

export default function VehicleDetailsPage() {
  const { vehicleId } = useParams();
  const { data: vehicle, isLoading } = useAsyncData(() => mockDataService.getVehicleById(vehicleId), [vehicleId]);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!vehicle) {
    return <EmptyState title="Vehicle not found" description="This vehicle record doesn't exist or was removed." />;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-primary-900">{vehicle.plateNumber}</h2>
          <p className="text-sm text-slate-500">
            {vehicle.make} {vehicle.model} &middot; {vehicle.type}
          </p>
        </div>
        <StatusBadge status={vehicle.status} />
      </div>

      <DashboardCard title="Vehicle Information">
        <DetailRow label="Plate Number" value={vehicle.plateNumber} />
        <DetailRow label="Make & Model" value={`${vehicle.make} ${vehicle.model}`} />
        <DetailRow label="Color" value={vehicle.color} />
        <DetailRow label="OR Number" value={vehicle.orNumber} />
        <DetailRow label="CR Number" value={vehicle.crNumber} />
      </DashboardCard>

      <DashboardCard title="Accreditation">
        <DetailRow label="Sticker Serial" value={vehicle.stickerSerial} />
        <DetailRow label="Registered" value={vehicle.registeredDate} />
        <DetailRow label="Expires" value={vehicle.expiryDate} />
      </DashboardCard>

      {(vehicle.status === 'expired' || vehicle.status === 'approved') && (
        <Link
          to={ROUTES.STUDENT_RENEWAL.replace(':vehicleId', vehicle.id)}
          className="btn-primary self-start"
        >
          Request Renewal
        </Link>
      )}
    </div>
  );
}
