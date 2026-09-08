import { Icon } from '../common/Icon';

const TONE_STYLES = {
  primary: 'bg-primary-50 text-primary-700',
  accent: 'bg-accent-50 text-accent-700',
  secondary: 'bg-secondary-50 text-secondary-800',
  danger: 'bg-danger-50 text-danger-700',
};

export function StatCard({ label, value, icon, tone = 'primary', hint }) {
  return (
    <div className="card-surface flex items-start justify-between gap-3 p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
      {icon && (
        <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg ${TONE_STYLES[tone]}`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
      )}
    </div>
  );
}
