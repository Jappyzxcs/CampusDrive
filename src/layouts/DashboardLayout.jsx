import { useState } from 'react';
import { Outlet, useMatches } from 'react-router-dom';
import { Sidebar } from '../components/navigation/Sidebar';
import { TopNav } from '../components/navigation/TopNav';
import { useAuth } from '../context/AuthContext';

/**
 * Shared shell for every authenticated screen: sidebar (role-aware nav),
 * top bar (page title + user menu), and a scrollable content area. Each
 * route provides its title via `handle: { title }` in AppRoutes so this
 * layout doesn't need a switch statement of its own.
 */
export function DashboardLayout() {
  const { role } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const matches = useMatches();
  const title = [...matches].reverse().find((m) => m.handle?.title)?.handle?.title ?? 'CampusDrive';

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role={role} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex min-h-screen flex-1 flex-col lg:pl-0">
        <TopNav title={title} onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
