import { useState } from 'react';
import { Icon } from '../../components/common/Icon';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { useToast } from '../../context/ToastContext';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase'; 

const OUTCOME_COPY = {
  approved: { tone: 'accent', message: 'Approved visit found. Verify to check the visitor in.' },
  inside_campus: { tone: 'accent', message: 'This visitor is already checked in.' },
  pending: { tone: 'secondary', message: 'This visit hasn\u2019t been approved by GSU yet. Do not allow entry.' },
  rejected: { tone: 'danger', message: 'This visit request was rejected. Do not allow entry.' },
  completed: { tone: 'primary', message: 'This visitor already completed their visit and checked out.' },
  not_found: { tone: 'danger', message: 'No visit request found for this plate number.' },
};

export default function VisitorVerificationPage() {
  const { showToast } = useToast();
  const [plate, setPlate] = useState('');
  const [visit, setVisit] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleSearch(event) {
    event.preventDefault();
    if (!plate.trim()) return;
    
    setIsSearching(true);
    setNotFound(false);
    setVisit(null);
    
    try {
      // UPDATED: Now queries the 'visits' collection
      const q = query(
        collection(db, 'visits'), 
        where('plateNumber', '==', plate.toUpperCase().trim())
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const visitDoc = querySnapshot.docs[0];
        setVisit({ id: visitDoc.id, ...visitDoc.data() });
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error("Error fetching visitor:", error);
      showToast('Database connection failed.', { type: 'danger' });
    } finally {
      setIsSearching(false);
    }
  }

  async function handleCheckIn() {
    if (!visit) return;
    setIsUpdating(true);
    
    try {
      // UPDATED: Now updates the 'visits' collection
      const visitRef = doc(db, 'visits', visit.id);
      const currentTime = new Date().toISOString();
      
      await updateDoc(visitRef, {
        status: 'inside_campus',
        checkInTime: currentTime,
      });
      
      setVisit(prev => ({ ...prev, status: 'inside_campus', checkInTime: currentTime }));
      showToast(`${visit.visitorName || 'Visitor'} verified and checked in.`, { type: 'success' });
    } catch (error) {
      console.error("Error checking in:", error);
      showToast('Failed to check in visitor.', { type: 'danger' });
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleCheckOut() {
    if (!visit) return;
    setIsUpdating(true);
    
    try {
      // UPDATED: Now updates the 'visits' collection
      const visitRef = doc(db, 'visits', visit.id);
      const currentTime = new Date().toISOString();
      
      await updateDoc(visitRef, {
        status: 'completed',
        checkOutTime: currentTime,
      });
      
      setVisit(prev => ({ ...prev, status: 'completed', checkOutTime: currentTime }));
      showToast(`${visit.visitorName || 'Visitor'} checked out.`, { type: 'success' });
    } catch (error) {
      console.error("Error checking out:", error);
      showToast('Failed to check out visitor.', { type: 'danger' });
    } finally {
      setIsUpdating(false);
    }
  }

  const outcome = notFound ? OUTCOME_COPY.not_found : visit ? OUTCOME_COPY[visit.status] : null;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Visitor Verification</h2>
        <p className="text-sm text-slate-500">Check a visitor's plate number against approved visits.</p>
      </div>

      <DashboardCard>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="Enter plate number, e.g. ABC 1122"
              className="w-full rounded-md border border-slate-300 py-2.5 pl-9 pr-3 text-sm uppercase text-slate-900
                placeholder:normal-case placeholder:text-slate-400 focus-visible:border-primary-500"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={isSearching}>
            {isSearching ? 'Checking…' : 'Check'}
          </button>
        </form>
      </DashboardCard>

      {outcome && (
        <div
          className={`flex flex-col gap-4 rounded-2xl px-6 py-8 text-center ${
            outcome.tone === 'accent'
              ? 'bg-accent-600 text-white'
              : outcome.tone === 'danger'
                ? 'bg-danger-600 text-white'
                : outcome.tone === 'secondary'
                  ? 'bg-secondary-500 text-slate-900'
                  : 'bg-slate-700 text-white'
          }`}
        >
          <Icon name={visit && visit.status !== 'rejected' ? 'idcard' : 'alert'} className="mx-auto h-12 w-12" />
          <p className="text-lg font-bold">{outcome.message}</p>

          {visit && (
            <div className="mt-2 w-full rounded-xl bg-white/10 px-5 py-4 text-left backdrop-blur-sm">
              <Row label="Visitor" value={visit.visitorName || 'N/A'} />
              <Row label="Plate" value={visit.plateNumber} />
              <Row label="Purpose" value={visit.purpose} />
              <Row label="Host" value={visit.hostName} />
              <div className="flex items-center justify-between border-b border-white/15 py-1.5 text-sm last:border-0">
                <span className="text-current/70">Status</span>
                <StatusBadge status={visit.status} />
              </div>
            </div>
          )}

          {visit?.status === 'approved' && (
            <button
              onClick={handleCheckIn}
              disabled={isUpdating}
              className="mt-2 rounded-lg bg-white px-5 py-3 text-base font-bold text-accent-700 active:bg-accent-50 disabled:opacity-60"
            >
              {isUpdating ? 'Verifying…' : 'Verify & Check In'}
            </button>
          )}

          {visit?.status === 'inside_campus' && (
            <button
              onClick={handleCheckOut}
              disabled={isUpdating}
              className="mt-2 rounded-lg bg-white px-5 py-3 text-base font-bold text-accent-700 active:bg-accent-50 disabled:opacity-60"
            >
              {isUpdating ? 'Updating…' : 'Mark as Exited'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-white/15 py-1.5 text-sm last:border-0">
      <span className="text-current/70">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}