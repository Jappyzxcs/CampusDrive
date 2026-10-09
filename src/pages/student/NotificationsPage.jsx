import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService'; 
import { EmptyState } from '../../components/common/EmptyState';
import { Skeleton } from '../../components/common/LoadingSkeleton';
import { Icon } from '../../components/common/Icon';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

const TYPE_STYLES = {
  info: { icon: 'bell', className: 'bg-blue-50 text-blue-500 border border-blue-100' },
  success: { icon: 'check', className: 'bg-emerald-50 text-emerald-500 border border-emerald-100' },
  warning: { icon: 'alert-triangle', className: 'bg-amber-50 text-amber-500 border border-amber-100' },
  danger: { icon: 'alert-circle', className: 'bg-rose-50 text-rose-500 border border-rose-100' },
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
  const [readIds, setReadIds] = useState(new Set());

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
      console.error("Failed to mark notification as read:", error);
    }
  }

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6 font-sans text-slate-800 pb-10">
      
      <div className="flex flex-col gap-1 mb-2 border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-extrabold font-sans tracking-tight text-slate-900">
          Notifications
        </h1>
        <p className="text-base text-slate-500 font-medium">
          Updates about your applications and accreditation.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-300 p-16 text-center">
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
                className={`relative flex gap-5 rounded-2xl p-6 transition-all duration-200 ${
                  isRead 
                    ? 'bg-slate-50/50 border border-slate-200 opacity-80' 
                    : 'bg-white border border-slate-200 shadow-sm hover:shadow-md'
                }`}
              >
                {!isRead && (
                  <div className="absolute top-6 left-2.5 h-2.5 w-2.5 rounded-full bg-blue-500 shadow-sm border border-white" />
                )}

                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${style.className}`}>
                  <Icon name={style.icon} className="h-5 w-5" />
                </div>
                
                <div className="flex flex-1 flex-col justify-center">
                  <div className="flex items-start justify-between gap-4 mb-1.5">
                    <h3 className={`text-base tracking-tight ${isRead ? 'font-bold text-slate-600' : 'font-extrabold text-slate-900'}`}>
                      {n.title}
                    </h3>
                    <span className="shrink-0 text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                      {timeAgo(n.timestamp)}
                    </span>
                  </div>
                  
                  <p className="text-sm font-medium text-slate-500 leading-relaxed">
                    {n.message}
                  </p>
                  
                  {!isRead && (
                    <div className="mt-3">
                      <button
                        onClick={() => handleMarkAsRead(n.id)}
                        className="inline-flex items-center text-[13px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
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