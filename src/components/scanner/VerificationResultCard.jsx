import { Icon } from '../common/Icon';

// Every possible scanner outcome from the brief, mapped to a tone
// (valid=green, everything else=red — deliberately binary so it reads
// instantly in direct sunlight) plus the icon/label to show.
const RESULT_CONFIG = {
  valid: { tone: 'valid', label: 'VALID', icon: 'check' },
  expired: { tone: 'invalid', label: 'EXPIRED REGISTRATION', icon: 'alert' },
  mismatch: { tone: 'invalid', label: 'STICKER MISMATCH', icon: 'alert' },
  unregistered: { tone: 'invalid', label: 'UNREGISTERED VEHICLE', icon: 'alert' },
  duplicate: { tone: 'invalid', label: 'DUPLICATE STICKER', icon: 'alert' },
  no_record: { tone: 'invalid', label: 'NO RECORD FOUND', icon: 'alert' },
};

const TONE_STYLES = {
  valid: 'bg-accent-600 text-white',
  invalid: 'bg-danger-600 text-white',
};

export function VerificationResultCard({ result }) {
  const config = RESULT_CONFIG[result.result] || RESULT_CONFIG.no_record;

  return (
    <div className={`flex flex-col items-center gap-4 rounded-2xl px-6 py-10 text-center ${TONE_STYLES[config.tone]}`}>
      <Icon name={config.icon} className="h-16 w-16" />
      <p className="text-3xl font-extrabold tracking-tight sm:text-4xl">{config.label}</p>

      <div className="mt-2 w-full max-w-sm rounded-xl bg-white/10 px-5 py-4 text-left backdrop-blur-sm">
        <Row label="Plate" value={result.plateNumber || '—'} />
        <Row label="Sticker Serial" value={result.stickerSerial || '—'} />
        <Row label="Owner" value={result.ownerName || '—'} />
        {result.vehicleMake && <Row label="Vehicle" value={result.vehicleMake} />}
        {result.confidence != null && <Row label="Match Confidence" value={`${Math.round(result.confidence * 100)}%`} />}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-white/15 py-1.5 text-sm last:border-0">
      <span className="text-white/70">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
