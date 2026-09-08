import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAsyncData } from '../../hooks/useAsyncData';
import { mockDataService } from '../../services/mockDataService';
import { FileUploadCard } from '../../components/forms/FileUploadCard';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { Skeleton } from '../../components/common/LoadingSkeleton';
import { useToast } from '../../context/ToastContext';
import { ROUTES } from '../../constants/routes';

export default function RenewalRequestPage() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: vehicle, isLoading } = useAsyncData(() => mockDataService.getVehicleById(vehicleId), [vehicleId]);

  // Changed state to only handle the OR file
  const [orFile, setOrFile] = useState(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    if (!orFile) {
      setError('Please upload an updated OR to continue.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      showToast('Renewal request submitted for admin review.', { type: 'success' });
      navigate(ROUTES.STUDENT_APPLICATION_STATUS);
    }, 600);
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Renew Registration</h2>
        <p className="text-sm text-slate-500">
          {vehicle?.plateNumber} &middot; {vehicle?.make} {vehicle?.model}
        </p>
      </div>

      <DashboardCard>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
          <p className="rounded-md bg-secondary-50 px-3 py-2.5 text-sm text-secondary-900">
            Your LTO registration on file expired {vehicle?.expiryDate}. Upload an updated OR to renew your
            campus accreditation.
          </p>

          <FileUploadCard
            label="Updated OR"
            hint="Must reflect the current LTO renewal."
            file={orFile}
            error={error}
            onFileSelect={setOrFile}
          />

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting…' : 'Submit Renewal Request'}
            </button>
          </div>
        </form>
      </DashboardCard>
    </div>
  );
}