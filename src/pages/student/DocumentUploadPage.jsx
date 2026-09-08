import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileUploadCard } from '../../components/forms/FileUploadCard';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { useToast } from '../../context/ToastContext';
import { ROUTES } from '../../constants/routes';

// Updated Requirements based on your specifications
const REQUIRED_DOCS = [
  { key: 'license', label: "Driver's License", hint: 'Clear photo or scan, all corners visible.' },
  { key: 'ltoOr', label: 'LTO Official Receipt (OR)', hint: 'Must be current and updated.' },
  { key: 'ltoCr', label: 'Certificate of Registration (CR)', hint: 'Clear photo or scan.' },
  { key: 'authorization', label: 'Authorization Letter', hint: 'If vehicle is not registered under your name.', optional: true },
  { key: 'deedOfSale', label: 'Notarized Deed of Sale', hint: 'If 2nd hand vehicle.', optional: true },
  { key: 'companyCert', label: 'Company Certification', hint: 'Notarized certification if Company Vehicle.', optional: true },
];

export default function DocumentUploadPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const vehicleDraft = location.state?.vehicleDraft; // Data from Step 1 & 2

  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  function validate() {
    const next = {};
    for (const doc of REQUIRED_DOCS) {
      if (!doc.optional && !files[doc.key]) next[doc.key] = 'Please upload this document.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setIsProcessing(true);
    // Stub: real flow uploads to storage, then the NLP/OCR pipeline
    setTimeout(() => {
      setIsProcessing(false);
      setIsSubmitting(false);
      showToast('Application submitted successfully!', { type: 'success' });
      navigate(ROUTES.STUDENT_APPLICATION_STATUS);
    }, 1500);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Upload Documents</h2>
        <p className="text-sm text-slate-500">
          Step 3 of 3 {vehicleDraft?.plateNumber ? `· For ${vehicleDraft.plateNumber}` : ''} &middot; Please provide clear photos or scans of the following.
        </p>
      </div>

      <DashboardCard>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
          {REQUIRED_DOCS.map((doc) => (
            <FileUploadCard
              key={doc.key}
              label={doc.optional ? `${doc.label} (Optional)` : doc.label}
              hint={doc.hint}
              file={files[doc.key]}
              error={errors[doc.key]}
              onFileSelect={(file) => setFiles((f) => ({ ...f, [doc.key]: file }))}
            />
          ))}

          <div className="flex justify-between border-t border-slate-100 pt-5">
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)} disabled={isSubmitting}>
              Back
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isProcessing ? 'Submitting Application…' : 'Submit Application'}
            </button>
          </div>
        </form>
      </DashboardCard>
    </div>
  );
}