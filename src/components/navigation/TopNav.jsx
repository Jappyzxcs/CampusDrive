import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../common/Icon';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../constants/routes';

export function TopNav({ title, onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  const displayName = user?.fullName || user?.name || 'Visitor';

  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Icon name="menu" />
        </button>
        {/* Changed to clean slate-800 and forced font-sans */}
        <h1 className="text-xl font-bold font-sans text-slate-800 tracking-tight">{title}</h1>
      </div>

      <div className="relative">
        <button
          onClick={() => setIsMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-slate-50 transition-colors"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
        >
          {/* Tinted the avatar background with a light Quantum Blue (#E5EDFF) and dark Quantum Blue text */}
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E5EDFF] text-sm font-bold text-[#2457FF] shadow-sm">
            {initials || <Icon name="user" className="h-4 w-4" />}
          </span>
          <span className="hidden text-sm font-semibold text-slate-700 sm:inline">
            {displayName}
          </span>
        </button>

        {isMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} aria-hidden="true" />
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg"
            >
              <button
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-danger-600 hover:bg-danger-50 transition-colors"
              >
                <Icon name="logout" className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}