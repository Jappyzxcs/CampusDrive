import { Link, useParams } from 'react-router-dom';
import { useAsyncData } from '../../hooks/useAsyncData';
import { mockDataService } from '../../services/mockDataService';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Skeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { ROUTES } from '../../constants/routes';

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-4 last:border-0">
      <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{label}</span>
      <span className="text-sm font-extrabold text-slate-900">{value ?? '—'}</span>
    </div>
  );
}

export default function VehicleDetailsPage() {
  const { vehicleId } = useParams();
  const { data: vehicle, isLoading } = useAsyncData(() => mockDataService.getVehicleById(vehicleId), [vehicleId]);

  if (isLoading) {
    return (
      <div className="flex w-full max-w-4xl flex-col gap-6 pb-10">
        <Skeleton className="h-12 w-64 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex w-full max-w-4xl flex-col gap-6 pb-10">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-16 text-center">
          <EmptyState title="Vehicle not found" description="This vehicle record doesn't exist or was removed." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6 font-sans text-slate-800 pb-10">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-extrabold font-sans tracking-tight text-slate-900">{vehicle.plateNumber}</h2>
          <p className="text-base text-slate-500 font-medium">
            {vehicle.make} {vehicle.model} &middot; {vehicle.type}
          </p>
        </div>
        <StatusBadge status={vehicle.status} />
      </div>

      {/* Vehicle Info Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 hover:shadow-md transition-shadow">
        <h3 className="text-lg font-extrabold text-slate-900 mb-4 tracking-tight">Vehicle Information</h3>
        <div className="flex flex-col">
          <DetailRow label="Plate Number" value={vehicle.plateNumber} />
          <DetailRow label="Make & Model" value={`${vehicle.make} ${vehicle.model}`} />
          <DetailRow label="Color" value={vehicle.color} />
          <DetailRow label="OR Number" value={vehicle.orNumber} />
          <DetailRow label="CR Number" value={vehicle.crNumber} />
        </div>
      </div>

      {/* Accreditation Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 hover:shadow-md transition-shadow">
        <h3 className="text-lg font-extrabold text-slate-900 mb-4 tracking-tight">Accreditation Details</h3>
        <div className="flex flex-col">
          <DetailRow label="Sticker Serial" value={vehicle.stickerSerial} />
          <DetailRow label="Registered" value={vehicle.registeredDate} />
          <DetailRow label="Expires" value={vehicle.expiryDate} />
        </div>
      </div>

      {/* Action Buttons */}
      {(vehicle.status === 'expired' || vehicle.status === 'approved') && (
        <div className="pt-2">
          <Link
            to={ROUTES.STUDENT_RENEWAL.replace(':vehicleId', vehicle.id)}
            className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold tracking-wide hover:bg-blue-700 transition-all shadow-sm hover:shadow-md inline-block"
          >
            Request Renewal
          </Link>
        </div>
      )}
    </div>
  );
}