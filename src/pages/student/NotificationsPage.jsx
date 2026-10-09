import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService'; 
import { EmptyState } from '../../components/common/EmptyState';
import { Skeleton } from '../../components/common/LoadingSkeleton';
import { Icon } from '../../components/common/Icon';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

const TYPE_STYLES = {
  info: { icon: 'bell', className: 'bg-blue-50 text-blue-500' },
  success: { icon: 'check', className: 'bg-emerald-50 text-emerald-500' },
  warning: { icon: 'alert-triangle', className: 'bg-amber-50 text-amber-500' },
  danger: { icon: 'alert-circle', className: 'bg-rose-50 text-rose-500' },
};

function timeAgo(timestamp) {
  if (!timestamp) return 'Just now';
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Local state for optimistic UI rendering (instant visual feedback on click)
  const [readIds, setReadIds] = useState(new Set());

  // THE FIX: Live Firebase listener replaces useAsyncData
  useEffect(() => {
    if (!user?.id && !user?.uid) return;
    const uid = user.id || user.uid;

    const q = query(collection(db, 'notifications'), where('userId', '==', uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      notifs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      
      setData(notifs);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  async function handleMarkAsRead(id) {
    setReadIds((prev) => new Set(prev).add(id));
    try {
      await notificationService.markAsRead(id);
    } catch (error) {
      console.error("Failed to mark notification as read in Firebase:", error);
    }
  }

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6 font-sans text-slate-800 pb-10">
      
      {/* Header Section */}
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-3xl font-extrabold font-sans tracking-tight text-slate-900">
          Notifications
        </h1>
        <p className="text-base text-slate-500 font-medium">
          Updates about your applications and accreditation.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-10 text-center">
          <EmptyState title="You're all caught up" description="No notifications right now." />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {data.map((n) => {
            const isRead = n.read || readIds.has(n.id);
            const style = TYPE_STYLES[n.type] || TYPE_STYLES.info;
            
            return (
              <div 
                key={n.id} 
                className={`relative flex gap-4 rounded-2xl border border-slate-200 p-5 transition-all duration-200 ${
                  isRead 
                    ? 'bg-slate-50/50 shadow-none border-slate-100 opacity-75' 
                    : 'bg-white shadow-sm hover:shadow-md'
                }`}
              >
                {/* Unread Dot Indicator */}
                {!isRead && (
                  <div className="absolute top-5 left-2 h-2 w-2 rounded-full bg-blue-500 shadow-sm" />
                )}

                {/* Status Icon */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.className}`}>
                  <Icon name={style.icon} className="h-5 w-5" />
                </div>
                
                {/* Content Body */}
                <div className="flex flex-1 flex-col justify-center">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <h3 className={`text-sm tracking-wide ${isRead ? 'font-semibold text-slate-600' : 'font-bold text-slate-900'}`}>
                      {n.title}
                    </h3>
                    <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                      {timeAgo(n.timestamp)}
                    </span>
                  </div>
                  
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {n.message}
                  </p>
                  
                  {/* Action Button */}
                  {!isRead && (
                    <div className="mt-2">
                      <button
                        onClick={() => handleMarkAsRead(n.id)}
                        className="inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        Mark as read
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}