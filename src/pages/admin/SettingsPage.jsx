import { useState } from 'react';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { useToast } from '../../context/ToastContext';

const DEFAULT_SETTINGS = {
  autoFlagDuplicates: true,
  requireManualReviewBelowConfidence: true,
  notifyOnExpiringSoon: true,
  ocrConfidenceThreshold: 85,
};

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-9 flex-none appearance-none rounded-full bg-slate-200 transition-colors checked:bg-accent-500
          before:block before:h-4 before:w-4 before:translate-x-0.5 before:translate-y-0.5 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4"
      />
    </label>
  );
}

export default function SettingsPage() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);

  function update(key, value) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function handleSave() {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showToast('Settings saved.', { type: 'success' });
    }, 500);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Settings</h2>
        <p className="text-sm text-slate-500">Configure how CampusDrive verifies documents and flags issues.</p>
      </div>

      <DashboardCard title="Verification">
        <div className="divide-y divide-slate-100">
          <Toggle
            label="Auto-flag duplicate stickers"
            description="Automatically flag a sticker serial scanned on more than one plate."
            checked={settings.autoFlagDuplicates}
            onChange={(v) => update('autoFlagDuplicates', v)}
          />
          <Toggle
            label="Require manual review below OCR confidence"
            description="Route low-confidence document matches to a human reviewer instead of auto-approving."
            checked={settings.requireManualReviewBelowConfidence}
            onChange={(v) => update('requireManualReviewBelowConfidence', v)}
          />
          <Toggle
            label="Notify students on expiring registration"
            description="Send a notification 30 days before a vehicle's accreditation expires."
            checked={settings.notifyOnExpiringSoon}
            onChange={(v) => update('notifyOnExpiringSoon', v)}
          />
        </div>

        <div className="mt-4 flex flex-col gap-1.5 border-t border-slate-100 pt-4">
          <label htmlFor="threshold" className="text-sm font-medium text-slate-700">
            OCR confidence threshold: {settings.ocrConfidenceThreshold}%
          </label>
          <input
            id="threshold"
            type="range"
            min={50}
            max={99}
            value={settings.ocrConfidenceThreshold}
            onChange={(e) => update('ocrConfidenceThreshold', Number(e.target.value))}
            className="accent-primary-600"
          />
        </div>
      </DashboardCard>

      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-primary" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
