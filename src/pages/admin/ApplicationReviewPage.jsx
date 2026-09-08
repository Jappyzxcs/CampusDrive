import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAsyncData } from '../../hooks/useAsyncData';
import { applicationService } from '../../services/applicationService';
import { useAuth } from '../../context/AuthContext';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Timeline } from '../../components/common/Timeline';
import { Icon } from '../../components/common/Icon';
import { Skeleton } from '../../components/common/LoadingSkeleton';
import { useToast } from '../../context/ToastContext';
import { ROUTES } from '../../constants/routes';
import { Modal } from '../../components/common/Modal'; // THE FIX: Imported Modal

export default function ApplicationReviewPage() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();

  const { data: application, isLoading } = useAsyncData(
    () => applicationService.getApplicationById(applicationId), 
    [applicationId]
  );

  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decision, setDecision] = useState(null);

  // THE FIX: State to handle the Image Viewer popup
  const [viewingImage, setViewingImage] = useState(null);
  const [viewingTitle, setViewingTitle] = useState('');

  // THE FIX: Function to open the image modal
  const openDoc = (title, url) => {
    if (!url) {
      showToast(`No ${title} was found for this application.`, { type: 'warning' });
      return;
    }
    setViewingTitle(title);
    setViewingImage(url);
  };

  async function handleDecision(nextDecision) {
    if (nextDecision === 'rejected' && !notes.trim()) {
      showToast('Please provide a reason for rejection in the notes.', { type: 'warning' });
      return;
    }

    setDecision(nextDecision);
    setIsSubmitting(true);

    try {
      const reviewerName = user?.fullName || user?.name || 'GSU Admin';

      await applicationService.updateApplicationStatus(
        applicationId,
        nextDecision,
        notes,
        reviewerName 
      );

      if (nextDecision === 'approved') {
        const vehicleData = {
          ownerName: application.applicantName,
          ownerId: application.userId || 'anonymous',
          plateNumber: application.vehicleDetails?.plateNumber || 'N/A',
          make: application.vehicleDetails?.vehicleType || 'N/A',
          model: '', 
          type: application.vehicleDetails?.vehicleType || 'Other',
          status: 'for_payment', 
          applicationId: applicationId,
          registrationDate: new Date().toISOString()
        };
        await applicationService.createVehicle(vehicleData);
      }

      showToast(
        nextDecision === 'approved'
          ? 'Application approved. Forwarded to BAO for payment and sticker release.'
          : 'Application rejected. Applicant has been notified.',
        { type: nextDecision === 'approved' ? 'success' : 'danger' },
      );
      navigate(ROUTES.ADMIN_PENDING_APPLICATIONS);
    } catch (error) {
      console.error("Decision update failed:", error);
      showToast('Failed to process decision. Please try again.', { type: 'danger' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => navigate(ROUTES.ADMIN_PENDING_APPLICATIONS)}
          className="mb-4 text-sm font-medium text-slate-500 hover:text-primary-700 transition-colors"
        >
          &larr; Back to Pending Applications
        </button>
        <p className="text-sm text-slate-500">Application not found.</p>
      </div>
    );
  }

  const vDetails = application.vehicleDetails || {};
  const nlpData = application.nlpExtractedData || {};
  const namesMatched = application.nlpNamesMatched ?? false;
  const docs = application.documentUrls || {}; // THE FIX: Safely grab the Base64 URLs

  const timelineEvents = application.timeline || [
    { 
      title: 'Application Submitted', 
      date: application.submittedDate, 
      description: 'Application received via student portal.',
      actor: 'System'
    }
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <button
          onClick={() => navigate(ROUTES.ADMIN_PENDING_APPLICATIONS)}
          className="mb-3 inline-block text-sm font-medium text-slate-500 hover:text-primary-700 transition-colors"
        >
          &larr; Back to Pending Applications
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-primary-900">{application.applicantName}</h2>
            <p className="text-sm text-slate-500">{application.type} &middot; submitted {application.submittedDate}</p>
          </div>
          <StatusBadge status={application.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardCard title="Vehicle Details">
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Plate Number" value={vDetails.plateNumber || 'N/A'} />
            <Row label="Vehicle Type" value={vDetails.vehicleType || 'N/A'} />
            <Row label="Color (OCR)" value={nlpData.color || 'N/A'} />
            <Row label="Contact No." value={vDetails.contactNo || 'N/A'} />
            <Row label="Address" value={`${vDetails.municipality || ''}, ${vDetails.address || ''}`} />
          </dl>
        </DashboardCard>

        <DashboardCard title="Document Verification (NLP/OCR)">
          <ul className="flex flex-col gap-3">
            <li className="flex items-start justify-between gap-2 rounded-md bg-slate-50 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <Icon
                  name={namesMatched ? 'check' : 'alert'}
                  className={`h-4 w-4 mt-0.5 ${namesMatched ? 'text-accent-600' : 'text-danger-600'}`}
                />
                <div>
                  <p className="text-sm font-medium text-slate-700">Ownership Cross-Check</p>
                  <div className="text-xs text-slate-500 mt-1">
                    <p>License: <span className="font-semibold text-slate-700">{nlpData.licenseName || 'Unreadable'}</span></p>
                    <p>CR Reg: <span className="font-semibold text-slate-700">{nlpData.crName || 'Unreadable'}</span></p>
                  </div>
                </div>
              </div>
              <span className={`text-xs font-semibold whitespace-nowrap ${namesMatched ? 'text-accent-700' : 'text-danger-700'}`}>
                {namesMatched ? 'Auto-Matched' : 'Needs Review'}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2.5">
               <div className="flex items-center gap-2">
                  <Icon name="check" className="h-4 w-4 text-accent-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">License Expiry</p>
                    <p className="text-xs text-slate-400">{nlpData.licenseExpiry || 'Not found'}</p>
                  </div>
                </div>
            </li>
            <li className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2.5">
               <div className="flex items-center gap-2">
                  <Icon name="check" className="h-4 w-4 text-accent-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">OR Validity</p>
                    <p className="text-xs text-slate-400">{nlpData.orExpiry || 'Not found'}</p>
                  </div>
                </div>
            </li>
          </ul>
          {!namesMatched && (
            <p className="mt-3 text-xs text-danger-600">
              Name mismatch detected by AI. Please review the physical authorization documents.
            </p>
          )}
        </DashboardCard>
      </div>

      {/* THE FIX: Replaced Dummy Toast buttons with real openDoc functions */}
      <DashboardCard title="Attached Documents">
        <p className="text-sm text-slate-500 mb-4">
          Review the physical copies submitted by the applicant.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => openDoc("Driver's License", docs.license)} className="btn-secondary text-sm">
             Driver's License
          </button>
          <button type="button" onClick={() => openDoc("Official Receipt (OR)", docs.or)} className="btn-secondary text-sm">
             Official Receipt (OR)
          </button>
          <button type="button" onClick={() => openDoc("Cert. of Registration (CR)", docs.cr)} className="btn-secondary text-sm">
             Cert. of Registration (CR)
          </button>
          
          {/* THESE ONLY SHOW UP IF THEY WERE ACTUALLY UPLOADED */}
          {docs.authLetter && (
             <button type="button" onClick={() => openDoc("Authorization Letter", docs.authLetter)} className="btn-secondary text-sm border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100">
               Authorization Letter
             </button>
          )}
          {docs.deedOfSale && (
             <button type="button" onClick={() => openDoc("Deed of Sale", docs.deedOfSale)} className="btn-secondary text-sm border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100">
               Deed of Sale
             </button>
          )}
          {docs.companyCert && (
             <button type="button" onClick={() => openDoc("Company Certificate", docs.companyCert)} className="btn-secondary text-sm border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100">
               Company Certificate
             </button>
          )}
        </div>
      </DashboardCard>

      <DashboardCard title="Timeline">
        <Timeline steps={timelineEvents} />
      </DashboardCard>

      {['pending', 'under_review'].includes(application.status) && (
        <DashboardCard title="Decision">
          <div className="flex flex-col gap-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add review notes (optional for approval, recommended for rejection)…"
              rows={3}
              className="rounded-md border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-primary-500"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => handleDecision('rejected')}
                disabled={isSubmitting}
                className="rounded-md border border-danger-300 px-4 py-2.5 text-sm font-semibold text-danger-700 hover:bg-danger-50 disabled:opacity-50"
              >
                {isSubmitting && decision === 'rejected' ? 'Rejecting…' : 'Reject'}
              </button>
              <button
                onClick={() => handleDecision('approved')}
                disabled={isSubmitting}
                className="btn-primary bg-accent-600 hover:bg-accent-700 disabled:opacity-50"
              >
                {isSubmitting && decision === 'approved' ? 'Approving…' : 'Approve & Forward to BAO'}
              </button>
            </div>
          </div>
        </DashboardCard>
      )}

      {/* THE FIX: Smart Popup Modal that displays either an image or a PDF viewer */}
      <Modal isOpen={!!viewingImage} onClose={() => setViewingImage(null)} title={viewingTitle} size="xl">
        <div className="flex justify-center bg-slate-100 rounded-lg p-2 min-h-[300px] items-center w-full">
          {viewingImage ? (
            viewingImage.startsWith('data:application/pdf') ? (
              <iframe src={viewingImage} className="w-full h-[70vh] rounded shadow-sm" title={viewingTitle} />
            ) : (
              <img src={viewingImage} alt={viewingTitle} className="max-h-[70vh] object-contain rounded shadow-sm" />
            )
          ) : (
            <p className="text-slate-400 text-sm">Document loading...</p>
          )}
        </div>
      </Modal>

    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800 text-right">{value}</dd>
    </div>
  );
}