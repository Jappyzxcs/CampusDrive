import { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { Icon } from '../../components/common/Icon';
import { backupService } from '../../services/backupService';
import { settingsService } from '../../services/settingsService';

const DEFAULT_SETTINGS = {
  autoFlagDuplicates: true,
  requireManualReviewBelowConfidence: true,
  notifyOnExpiringSoon: true,
  ocrConfidenceThreshold: 85,
};

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 py-4">
      <div className="flex-1 pr-4">
        <p className="text-sm font-bold text-slate-900 mb-0.5">{label}</p>
        {description && <p className="text-[13px] text-slate-500 leading-relaxed">{description}</p>}
      </div>
      <div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/20 peer-checked:bg-blue-600"></div>
        <div className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white border border-slate-200 transition-transform peer-checked:translate-x-full peer-checked:border-white shadow-sm"></div>
      </div>
    </label>
  );
}

export default function SettingsPage() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Backup & Export States
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [csvCollection, setCsvCollection] = useState('vehicles');
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // Fetch settings from Firebase on load
  useEffect(() => {
    async function loadSettings() {
      const data = await settingsService.getSettings();
      setSettings(data);
      setIsLoading(false);
    }
    loadSettings();
  }, []);

  function update(key, value) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await settingsService.updateSettings(settings);
      showToast('Settings saved globally to database.', { type: 'success' });
    } catch (error) {
      showToast('Failed to save settings.', { type: 'danger' });
    } finally {
      setIsSaving(false);
    }
  }

  const handleBackup = async () => {
    setIsBackingUp(true);
    showToast('Compiling JSON database... This may take a moment.', { type: 'success' });
    
    try {
      await backupService.generateAndDownloadBackup();
      showToast('Database backup downloaded successfully!', { type: 'success' });
    } catch (error) {
      showToast('Failed to generate backup. Ensure you have admin permissions.', { type: 'danger' });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleCsvExport = async () => {
    setIsExportingCsv(true);
    showToast(`Generating Excel spreadsheet for ${csvCollection}...`, { type: 'success' });
    
    try {
      await backupService.exportCollectionToCSV(csvCollection);
      showToast('Spreadsheet downloaded successfully!', { type: 'success' });
    } catch (error) {
      showToast(`Failed to export spreadsheet. Ensure the collection has data.`, { type: 'danger' });
    } finally {
      setIsExportingCsv(false);
    }
  };

  if (isLoading) return null; // Prevent UI flicker before settings load

  return (
    <div className="flex w-full max-w-4xl flex-col gap-8 font-sans text-slate-800 pb-10">
      
      {/* Header Section */}
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-3xl font-extrabold font-sans tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="text-base text-slate-500 font-medium">
          Configure how CampusDrive verifies documents and flags issues.
        </p>
      </div>

      {/* Verification Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-extrabold text-slate-900 font-sans tracking-tight">Verification</h3>
        </div>
        
        <div className="px-8 py-4 divide-y divide-slate-100">
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

        {/* Range Slider Section */}
        <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <label htmlFor="threshold" className="text-sm font-bold text-slate-900">
              OCR Confidence Threshold
            </label>
            <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm font-bold text-blue-600 shadow-sm">
              {settings.ocrConfidenceThreshold}%
            </span>
          </div>
          <input
            id="threshold"
            type="range"
            min={50}
            max={99}
            value={settings.ocrConfidenceThreshold}
            onChange={(e) => update('ocrConfidenceThreshold', Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Save Button Row */}
      <div className="flex justify-end pb-4 border-b border-slate-200">
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold tracking-wide hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
        >
          {isSaving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {/* Data Management Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-extrabold text-slate-900 font-sans tracking-tight">Data Management</h3>
        </div>
        
        <div className="p-8 flex flex-col gap-6">
          <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
            Export specific tables as an Excel Spreadsheet (CSV) for easy reading and audits, or generate a full JSON backup for database restoration. Keep these files secure as they contain sensitive user information.
          </p>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border-t border-slate-100 pt-6">
            
            {/* The Excel / CSV Export Area */}
            <div className="flex w-full flex-1 items-center gap-3">
              <select 
                value={csvCollection}
                onChange={(e) => setCsvCollection(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 sm:w-auto"
              >
                <option value="vehicles">Vehicles</option>
                <option value="entry_logs">Entry Logs</option>
                <option value="visitors">Visitors</option>
                <option value="applications">Applications</option>
                <option value="users">User Accounts</option>
              </select>
              
              <button
                onClick={handleCsvExport}
                disabled={isExportingCsv}
                className="shrink-0 flex whitespace-nowrap items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-75 transition-all hover:shadow-md"
              >
                {isExportingCsv ? 'Exporting...' : 'Export to Excel'}
              </button>
            </div>

            <div className="hidden h-10 w-px bg-slate-200 sm:block"></div>

            {/* The Raw Database JSON Backup */}
            <button
              onClick={handleBackup}
              disabled={isBackingUp}
              className="shrink-0 flex whitespace-nowrap items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-75 transition-all w-full sm:w-auto hover:shadow-md"
            >
              {isBackingUp ? (
                <>
                  <Icon name="loader" className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Icon name="download" className="h-4 w-4" />
                  Full JSON Backup
                </>
              )}
            </button>
            
          </div>
        </div>
      </div>
      
    </div>
  );
}