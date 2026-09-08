import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { notificationService } from '../../services/notificationService'; // NEW: Real Service
import { DashboardCard } from '../../components/cards/DashboardCard';
import { EmptyState } from '../../components/common/EmptyState';
import { Skeleton } from '../../components/common/LoadingSkeleton';
import { Icon } from '../../components/common/Icon';

const TYPE_STYLES = {
  info: { icon: 'bell', className: 'bg-primary-50 text-primary-700' },
  success: { icon: 'check', className: 'bg-accent-50 text-accent-700' },
  warning: { icon: 'alert', className: 'bg-secondary-50 text-secondary-800' },
  danger: { icon: 'alert', className: 'bg-danger-50 text-danger-700' },
};

function timeAgo(timestamp) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  
  // UPDATED: Fetch real notifications from Firestore
  const { data, isLoading } = useAsyncData(
    () => (user?.id ? notificationService.getUserNotifications(user.id) : Promise.resolve([])), 
    [user?.id]
  );
  
  const [readIds, setReadIds] = useState(new Set());

  // NEW: Handle database updates
  async function handleMarkAsRead(id) {
    // 1. Instantly update the UI so it feels incredibly fast
    setReadIds((prev) => new Set(prev).add(id));
    
    // 2. Save the change to Firebase in the background
    try {
      await notificationService.markAsRead(id);
    } catch (error) {
      console.error("Failed to mark notification as read in Firebase:", error);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Notifications</h2>
        <p className="text-sm text-slate-500">Updates about your applications and accreditation.</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState title="You're all caught up" description="No notifications right now." />
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((n) => {
            // Checks if it is read in the database OR just clicked right now
            const isRead = n.read || readIds.has(n.id);
            const style = TYPE_STYLES[n.type] || TYPE_STYLES.info;
            
            return (
              <DashboardCard key={n.id} className={isRead ? 'opacity-70' : ''}>
                <div className="flex gap-3">
                  <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${style.className}`}>
                    <Icon name={style.icon} className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                      <span className="whitespace-nowrap text-xs text-slate-400">{timeAgo(n.timestamp)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{n.message}</p>
                    {!isRead && (
                      <button
                        onClick={() => handleMarkAsRead(n.id)}
                        className="mt-2 text-xs font-medium text-primary-700 hover:text-primary-800"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </DashboardCard>
            );
          })}
        </div>
      )}
    </div>
  );
}