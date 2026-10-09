import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '../common/Icon';
import { Seal } from '../common/Seal';
import { NAV_CONFIG } from './navConfig';
import { ROLE_LABELS } from '../../constants/roles';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

export function Sidebar({ role, isOpen, onClose, quickInfo, onSignOut }) {
  const { user } = useAuth();
  
  // THE FIX: Filter out Reports & Hub links if the user is logged in as BAO
  const rawItems = NAV_CONFIG[role] || [];
  const items = rawItems.filter((item) => {
    const isBao = role === 'bao' || role?.toLowerCase() === 'bao';
    if (isBao) {
      const label = (item.label || '').toLowerCase();
      const path = (item.to || '').toLowerCase();
      if (label.includes('report') || label.includes('hub') || label.includes('audit') || path.includes('report')) {
        return false;
      }
    }
    return true;
  });
  
  // Desktop collapse state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!user?.id && !user?.uid) return;
    const uid = user.id || user.uid;

    const q = query(collection(db, 'notifications'), where('userId', '==', uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let unread = false;
      snapshot.forEach((doc) => {
        if (!doc.data().read) unread = true;
      });
      setHasUnread(unread);
    });

    return () => unsubscribe();
  }, [user]);

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
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-primary-900 text-primary-100 transition-all duration-300 ease-in-out
          lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isCollapsed ? 'w-64 lg:w-20' : 'w-64'}
        `}
      >
        {/* Header Area */}
        <div className={`flex items-center border-b border-white/10 py-5 transition-all ${isCollapsed ? 'flex-col gap-4 px-2' : 'justify-between px-5'}`}>
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
            <Seal size="sm" className="flex-none" />
            {!isCollapsed && (
              <div className="leading-tight overflow-hidden whitespace-nowrap">
                <p className="text-sm font-semibold text-white">CampusDrive</p>
                <p className="text-[11px] uppercase tracking-wide text-primary-300">
                  {ROLE_LABELS[role] || 'Administrator'}
                </p>
              </div>
            )}
          </div>
          
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center rounded-md p-1.5 text-primary-400 hover:bg-primary-800/60 hover:text-white transition-colors"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
              <circle 
                cx="8" 
                cy="12" 
                r="3" 
                className="transition-transform duration-300 ease-in-out"
                style={{ transform: isCollapsed ? 'translateX(0)' : 'translateX(8px)' }}
              />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onClose}
                  title={isCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `group relative flex items-center rounded-r-md border-l-[3px] py-2.5 transition-colors ${
                      isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                    } ${
                      isActive
                        ? 'border-[#F5C400] bg-primary-800 text-white'
                        : 'border-transparent text-primary-200 hover:bg-primary-800/60 hover:text-white'
                    }`
                  }
                >
                  <Icon name={item.icon} className="h-5 w-5 flex-none" />
                  
                  {!isCollapsed && (
                    <span className="whitespace-nowrap text-sm font-medium">
                      {item.label}
                    </span>
                  )}
                  
                  {/* Notification Dot */}
                  {item.label === 'Notifications' && hasUnread && (
                    <span 
                      className={`absolute flex-none rounded-full bg-danger-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] ${
                        isCollapsed ? 'top-2.5 right-1/4 h-2 w-2' : 'right-3 h-2 w-2'
                      }`} 
                      aria-hidden="true" 
                    />
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Quick Info */}
        {quickInfo && !isCollapsed && (
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

        {/* Footer & Sign Out */}
        <div className={`flex items-center gap-2 border-t border-white/10 py-4 ${isCollapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
          {!isCollapsed && (
            <p className="text-[11px] leading-snug text-primary-400 whitespace-nowrap overflow-hidden text-ellipsis">
              LSPU &ndash; LB Campus &middot; GSU
            </p>
          )}
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