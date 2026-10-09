import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../common/Icon';
import { useAuth } from '../../context/AuthContext';

export function TopNav({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [currentDateTime, setCurrentDateTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      const dateString = now.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
      
      const timeString = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      setCurrentDateTime(`${dateString} • ${timeString}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 10000); 
    return () => clearInterval(interval);
  }, []);

  async function handleLogout() {
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  const displayName = user?.fullName || user?.name || 'Visitor';
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 sm:px-8">
      
      {/* LEFT: Mobile Menu Toggle */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 -ml-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden transition-colors"
          aria-label="Open navigation menu"
        >
          <Icon name="menu" className="h-5 w-5" />
        </button>
      </div>

      {/* RIGHT: Clock, Divider, & Profile */}
      <div className="flex flex-1 items-center justify-end gap-4 sm:gap-6">
        
        {/* Live Date/Time moved to the right */}
        <div className="hidden lg:flex items-center text-sm font-bold text-slate-500 tracking-wide">
          <Icon name="time" className="h-4 w-4 mr-2.5 opacity-60" />
          {currentDateTime}
        </div>

        {/* Subtle Vertical Divider */}
        <div className="hidden lg:block h-6 w-px bg-slate-200"></div>
        
        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all focus:outline-none"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[13px] font-black text-blue-600 shadow-sm border border-blue-100">
              {initials || <Icon name="user" className="h-4 w-4" />}
            </span>
            <span className="hidden text-[13px] font-bold text-slate-700 md:inline">
              {displayName}
            </span>
            <Icon name="chevron-down" className={`hidden md:block h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} aria-hidden="true" />
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-200/50 animate-in fade-in slide-in-from-top-2 duration-200"
              >
                <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
                  <p className="text-[13px] font-bold text-slate-900 truncate">{displayName}</p>
                  <p className="text-[11px] font-medium text-slate-500 truncate">{user?.email || 'Logged in'}</p>
                </div>
                
                <div className="p-1.5">
                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-rose-600 hover:bg-rose-50 transition-colors focus:outline-none"
                  >
                    <Icon name="logout" className="h-4 w-4" />
                    Sign out safely
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}