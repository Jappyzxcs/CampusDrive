import { Icon } from '../common/Icon';

export function VerificationResultCard({ result, onFlagClick }) {
  if (!result) return null;

  const parseCustomDate = (dateStr) => {
    if (!dateStr) return null;
    if (typeof dateStr.toDate === 'function') return dateStr.toDate();
    if (typeof dateStr === 'string' && dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/');
      return new Date(year, parseInt(month) - 1, day);
    }
    const d = new Date(dateStr);
    return isNaN(d) ? null : d;
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return 'Not Provided';
    const d = parseCustomDate(dateStr);
    if (!d) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isStatusValid = result.status === 'valid' || result.result === 'valid';
  const isStatusRevoked = result.status === 'revoked' || result.result === 'revoked';
  const statusKey = result.status || result.result;
  
  // THE FIX: Always show documents for registered vehicles so the UI doesn't break
  const showDocuments = ['valid', 'revoked', 'expired'].includes(statusKey);

  const alertText = result.alert || (isStatusValid ? 'Allow Entry' : isStatusRevoked ? 'Access Denied: Sticker Revoked' : 'Entry Denied');

  return (
    <div className={`flex flex-col items-center justify-center rounded-[2rem] p-6 text-center shadow-2xl border-4 ${
      isStatusValid ? 'bg-emerald-600 border-emerald-400' : 'bg-red-600 border-red-400'
    }`}>
      
      <div className={`mb-5 flex h-24 w-24 items-center justify-center rounded-full shadow-xl ${
        isStatusValid ? 'bg-emerald-500' : 'bg-red-700'
      }`}>
        <Icon 
          name={isStatusValid ? 'check' : 'alert'} 
          className="h-12 w-12 !text-white" 
        />
      </div>
      
      <h1 className="mb-2 text-5xl font-black uppercase tracking-tight !text-white drop-shadow-md">
        {isStatusValid ? 'ACTIVE' : isStatusRevoked ? 'REVOKED' : 'INVALID'}
      </h1>
      
      <p className="mb-8 text-xl font-bold !text-white/95 drop-shadow-sm">
        {alertText}
      </p>

     <div className="w-full rounded-2xl bg-white p-5 text-left shadow-xl">
        <ResultRow label="Plate Number" value={result.plateNumber} highlight status={isStatusValid ? 'valid' : 'invalid'} />
        <ResultRow label="Sticker Serial" value={result.stickerSerial || result.serial || 'N/A'} />
        <ResultRow label="Owner" value={result.ownerName || result.owner || 'Unknown'} />
        <ResultRow label="Vehicle" value={result.vehicleMake || result.make || 'N/A'} />
        
        {isStatusRevoked && result.revokeReason && (
          <div className="mt-4 rounded-xl bg-red-50 p-4 border border-red-200 flex flex-col mb-2 shadow-sm">
            <span className="text-xs font-bold text-red-500 uppercase tracking-wide mb-1">Reason for Revocation</span>
            {result.revokeReason.includes('. Last violation:') ? (
              <>
                <span className="text-lg font-bold text-red-800 leading-tight">Automatically revoked (3 strikes)</span>
                <span className="text-sm font-medium text-red-700 mt-1">
                  <span className="font-bold">Last violation:</span> {result.revokeReason.split('. Last violation:')[1]?.trim()}
                </span>
              </>
            ) : (
              <span className="text-lg font-bold text-red-800 leading-tight">{result.revokeReason}</span>
            )}
          </div>
        )}
        
        {(result.dateIssued && result.validUntil) && (
          <ResultRow 
            label="Sticker Validity" 
            value={`${formatDisplayDate(result.dateIssued)} → ${formatDisplayDate(result.validUntil)}`} 
          />
        )}

        {/* THE FIX: Guaranteed to show Expiry Dates if the vehicle exists in the system */}
        {showDocuments && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="mb-2 flex items-center gap-2">
              <Icon name="file-text" className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Document Expirations</span>
            </div>
            <ResultRow 
              label="OR Expiry" 
              value={formatDisplayDate(result.orExpiry)} 
            />
            <ResultRow 
              label="License Expiry" 
              value={formatDisplayDate(result.licenseExpiry)} 
            />
          </div>
        )}

        {(result.vehicleImage || result.vehicleImageUrl) && (
          <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Registered Vehicle Proof</span>
            <img 
              src={result.vehicleImage || result.vehicleImageUrl} 
              alt="Vehicle Proof" 
              className="h-36 w-full rounded-xl object-cover border border-slate-300 shadow-inner"
            />
          </div>
        )}
      </div>
      
      {onFlagClick && (
        <button 
          onClick={onFlagClick}
          className={`mt-5 w-full rounded-xl border-2 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-all active:scale-95 shadow-sm ${
            isStatusValid ? 'border-emerald-500 bg-emerald-700/40 hover:bg-emerald-700' : 'border-red-500 bg-red-700/40 hover:bg-red-700'
          }`}
        >
          Flag / Report Vehicle Offense
        </button>
      )}
    </div>
  );
}

function ResultRow({ label, value, highlight, status }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 py-3.5 last:border-0">
      <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">{label}</span>
      <span className={`text-base font-bold text-slate-900 ${
        highlight ? `text-2xl tracking-wide \${status === 'valid' ? '!text-emerald-700' : '!text-red-700'}` : ''
      }`}>
        {value}
      </span>
    </div>
  );
}