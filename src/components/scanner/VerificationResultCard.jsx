import { useState } from 'react';
import { Icon } from '../common/Icon';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { flaggingService } from '../../services/flaggingService';
import { Modal } from '../common/Modal'; 

const RESULT_CONFIG = {
  valid: { tone: 'valid', label: 'ACTIVE', icon: 'check' },
  revoked: { tone: 'invalid', label: 'REVOKED / INACTIVE', icon: 'alert' },
  expired: { tone: 'invalid', label: 'EXPIRED REGISTRATION', icon: 'alert' },
  mismatch: { tone: 'invalid', label: 'STICKER MISMATCH', icon: 'alert' },
  unregistered: { tone: 'invalid', label: 'UNREGISTERED VEHICLE', icon: 'alert' },
  duplicate: { tone: 'invalid', label: 'DUPLICATE STICKER', icon: 'alert' },
  no_record: { tone: 'invalid', label: 'NO RECORD FOUND', icon: 'alert' },
};

const TONE_STYLES = {
  valid: 'bg-emerald-600 text-white',
  invalid: 'bg-danger-600 text-white',
};

const formatDate = (isoString) => {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
};

export function VerificationResultCard({ result }) {
  const config = RESULT_CONFIG[result.result] || RESULT_CONFIG.no_record;
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagDetails, setFlagDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFlagSubmit = async (e) => {
    e.preventDefault();
    if (!flagReason) return showToast('Please select a reason.', { type: 'danger' });
    if (flagReason === 'Others' && !flagDetails.trim()) return showToast('Please specify the details.', { type: 'danger' });

    setIsSubmitting(true);
    try {
      const vehicleId = result.id || result.vehicleId || 'unknown_id'; 
      const count = await flaggingService.submitFlag(
        vehicleId, 
        result.stickerSerial || 'Unknown', 
        user?.uid || 'guard', 
        flagReason, 
        flagDetails
      );
      
      if (count >= 3) {
        showToast(`Vehicle has reached 3 offenses and access is now REVOKED.`, { type: 'danger' });
      } else {
        showToast(`Vehicle flagged successfully. Offense count: ${count} of 3`, { type: 'success' });
      }
      
      setIsFlagModalOpen(false);
      setFlagReason('');
      setFlagDetails('');
      
      setTimeout(() => window.location.reload(), 1500);
      
    } catch (error) {
      console.error(error);
      showToast('Failed to submit flag.', { type: 'danger' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`flex flex-col items-center gap-4 rounded-2xl px-6 py-10 text-center ${TONE_STYLES[config.tone]}`}>
      <Icon name={config.icon} className="h-16 w-16" />
      <p className="text-3xl font-extrabold tracking-tight sm:text-4xl">{config.label}</p>

      <div className="mt-2 w-full max-w-sm rounded-xl bg-white/10 px-5 py-4 text-left backdrop-blur-sm">
        <Row label="Plate" value={result.plateNumber || '—'} />
        <Row label="Sticker Serial" value={result.stickerSerial || '—'} />
        <Row label="Owner" value={result.ownerName || '—'} />
        {result.vehicleMake && <Row label="Vehicle" value={result.vehicleMake} />}
        
        {(result.dateIssued && result.validUntil) && (
          <Row label="Sticker Validity" value={`${formatDate(result.dateIssued)} → ${formatDate(result.validUntil)}`} />
        )}
        
    {/* Render the Revocation Reason if present */}
        {result.revokeReason && (
          <div className="mt-3 rounded-lg bg-black/20 p-3 text-left border border-white/20">
            <span className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">Reason for Revocation</span>
            {result.revokeReason.includes('. Last violation:') ? (
              <>
                <span className="block text-sm font-bold text-white">Automatically revoked (3 strikes)</span>
                <span className="block text-xs text-white/80 mt-1">
                  <span className="font-semibold text-white/90">Last violation:</span> {result.revokeReason.split('. Last violation:')[1]?.trim()}
                </span>
              </>
            ) : (
              <span className="block text-sm font-bold text-white">{result.revokeReason}</span>
            )}
          </div>
        )}
        
        {(result.vehicleImage || result.vehicleImageUrl) && (
          <div className="mt-4 pt-3 border-t border-white/20 flex flex-col items-center">
            <span className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2">Vehicle Proof Photo</span>
            <img 
              src={result.vehicleImage || result.vehicleImageUrl} 
              alt="Registered Vehicle" 
              className="h-36 w-full rounded-lg object-cover border border-white/30 shadow-md"
            />
          </div>
        )}
      </div>

      {result.result !== 'no_record' && result.result !== 'revoked' && (
        <button 
          onClick={() => setIsFlagModalOpen(true)}
          className="mt-4 w-full max-w-sm rounded-xl bg-black/20 py-3 text-sm font-bold text-white hover:bg-black/40 border border-white/20 transition-all shadow-sm"
        >
          Flag / Report Vehicle Offense
        </button>
      )}

      {isFlagModalOpen && (
        <Modal isOpen={isFlagModalOpen} onClose={() => !isSubmitting && setIsFlagModalOpen(false)} title="Report Vehicle Offense">
          <form onSubmit={handleFlagSubmit} className="flex flex-col gap-4 p-2 text-slate-800 text-left">
            <div className="flex flex-col gap-3">
              <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                <input type="radio" name="reason" value="Sticker swapping" className="mt-0.5" onChange={(e) => setFlagReason(e.target.value)} />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">Sticker Swapping</span>
                  <span className="text-xs text-slate-500">The scanned sticker is attached to a vehicle that does not match the registered proof photo.</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                <input type="radio" name="reason" value="Others" onChange={(e) => setFlagReason(e.target.value)} />
                <span className="text-sm font-bold text-slate-900">Other Violation</span>
              </label>
            </div>
            {flagReason === 'Others' && (
              <textarea placeholder="Specify the offense details..." value={flagDetails} onChange={(e) => setFlagDetails(e.target.value)} className="w-full rounded-md border border-slate-300 p-3 text-sm focus:border-danger-500 outline-none focus:ring-1 focus:ring-danger-500" rows={3} required />
            )}
            <div className="flex justify-end gap-3 mt-4 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setIsFlagModalOpen(false)} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
              <button type="submit" className="btn-primary bg-danger-600 hover:bg-danger-700" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-white/15 py-1.5 text-sm last:border-0">
      <span className="text-white/70">{label}</span>
      <span className="font-semibold text-right">{value}</span>
    </div>
  );
}