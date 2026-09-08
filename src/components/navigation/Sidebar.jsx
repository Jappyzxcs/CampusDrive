import { NavLink } from 'react-router-dom';
import { Icon } from '../common/Icon';
import { Seal } from '../common/Seal';
import { NAV_CONFIG } from './navConfig';
import { ROLE_LABELS } from '../../constants/roles';

// quickInfo and onSignOut are both optional so this stays a drop-in
// replacement for every existing caller (GSU/BAO/Guard shells that don't
// pass them render exactly as before).
export function Sidebar({ role, isOpen, onClose, quickInfo, onSignOut }) {
  const items = NAV_CONFIG[role] || [];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-primary-900 text-primary-100 transition-transform duration-200
          lg:static lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <Seal size="sm" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">CampusDrive</p>
            <p className="text-[11px] uppercase tracking-wide text-primary-300">
              {ROLE_LABELS[role]}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-r-md border-l-[3px] px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-[#F5C400] bg-primary-800 text-white'
                        : 'border-transparent text-primary-200 hover:bg-primary-800/60 hover:text-white'
                    }`
                  }
                >
                  <Icon name={item.icon} className="h-5 w-5 flex-none" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Optional quick-status card — e.g. { label: 'Sticker status',
            value: 'Active · expires Jun 2027', tone: 'success' } for a
            student, or a pending-count summary for staff roles. Pass
            nothing to omit it entirely. */}
        {quickInfo && (
          <div className="mx-3 mb-3 rounded-lg bg-primary-800/60 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-primary-400">
              {quickInfo.label}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 flex-none rounded-full ${
                  quickInfo.tone === 'warning'
                    ? 'bg-amber-400'
                    : quickInfo.tone === 'danger'
                    ? 'bg-danger-500'
                    : 'bg-emerald-400'
                }`}
                aria-hidden="true"
              />
              <span className="text-xs text-primary-100">{quickInfo.value}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-5 py-4">
          <p className="text-[11px] leading-snug text-primary-400">
            LSPU &ndash; Los Ba&ntilde;os Campus &middot; General Services Utility
          </p>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="flex-none rounded-md p-1.5 text-primary-400 transition-colors hover:bg-primary-800/60 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}