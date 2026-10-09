import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileUploadCard } from '../../components/forms/FileUploadCard';
import { useToast } from '../../context/ToastContext';
import { ROUTES } from '../../constants/routes';

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
  const vehicleDraft = location.state?.vehicleDraft;

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
    setTimeout(() => {
      setIsProcessing(false);
      setIsSubmitting(false);
      showToast('Application submitted successfully!', { type: 'success' });
      navigate(ROUTES.STUDENT_APPLICATION_STATUS);
    }, 1500);
  }

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6 font-sans text-slate-800 pb-10">
      
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-3xl font-extrabold font-sans tracking-tight text-slate-900">
          Upload Documents
        </h1>
        <p className="text-base text-slate-500 font-medium">
          Step 3 of 3 {vehicleDraft?.plateNumber ? `· For ${vehicleDraft.plateNumber}` : ''} &middot; Please provide clear photos or scans.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 hover:shadow-md transition-shadow">
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

          <div className="flex justify-between border-t border-slate-100 pt-8 mt-2">
            <button type="button" className="px-6 py-2.5 rounded-xl text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 font-bold transition-all" onClick={() => navigate(-1)} disabled={isSubmitting}>
              Back
            </button>
            <button type="submit" className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold tracking-wide hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm" disabled={isSubmitting}>
              {isProcessing ? 'Submitting Application…' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}