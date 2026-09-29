import { useState } from 'react';
import { Icon } from '../../components/common/Icon';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { useToast } from '../../context/ToastContext';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase'; 

const OUTCOME_COPY = {
  approved: { tone: 'accent', message: 'Approved visit found. Ready for check-in.' },
  inside_campus: { tone: 'accent', message: 'This visitor is currently on campus.' },
  pending: { tone: 'secondary', message: 'Visit request is still PENDING. Do not allow entry.' },
  rejected: { tone: 'danger', message: 'Visit request REJECTED. Do not allow entry.' },
  completed: { tone: 'primary', message: 'This visitor has already completed their visit.' },
  not_found: { tone: 'danger', message: 'No registered visit found for this plate number.' },
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
      const q = query(
        collection(db, 'visits'), 
        where('plateNumber', '==', plate.toUpperCase().trim())
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Sort to get the most recently created visit if they have multiple
        const docs = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        setVisit(docs[0]);
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
      const visitRef = doc(db, 'visits', visit.id);
      const currentTime = new Date().toISOString();
      
      await updateDoc(visitRef, {
        status: 'inside_campus',
        checkInTime: currentTime,
      });
      
      setVisit(prev => ({ ...prev, status: 'inside_campus', checkInTime: currentTime }));
      showToast(`${visit.visitorName || 'Visitor'} successfully checked in.`, { type: 'success' });
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
      const visitRef = doc(db, 'visits', visit.id);
      const currentTime = new Date().toISOString();
      
      await updateDoc(visitRef, {
        status: 'completed',
        checkOutTime: currentTime,
      });
      
      setVisit(prev => ({ ...prev, status: 'completed', checkOutTime: currentTime }));
      showToast(`${visit.visitorName || 'Visitor'} successfully checked out.`, { type: 'success' });
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
        <p className="text-sm text-slate-500">Check a visitor's plate number against pre-approved GSU visits.</p>
      </div>

      <DashboardCard>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="Enter plate (e.g. ABC 1122)"
              className="w-full rounded-md border border-slate-300 py-2.5 pl-9 pr-3 text-sm uppercase font-bold text-slate-900 placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 focus-visible:border-primary-500 shadow-sm"
            />
          </div>
          <button type="submit" className="btn-primary px-6" disabled={isSearching || !plate.trim()}>
            {isSearching ? '...' : 'Verify'}
          </button>
        </form>
      </DashboardCard>

      {outcome && (
        <div
          className={`flex flex-col gap-4 rounded-3xl px-6 py-8 text-center shadow-lg border-2 animate-in fade-in zoom-in-95 duration-200 ${
            outcome.tone === 'accent'
              ? 'bg-emerald-600 border-emerald-400 text-white'
              : outcome.tone === 'danger'
                ? 'bg-danger-600 border-danger-400 text-white'
                : outcome.tone === 'secondary'
                  ? 'bg-amber-100 border-amber-300 text-amber-900'
                  : 'bg-slate-700 border-slate-500 text-white'
          }`}
        >
          <Icon name={visit && visit.status !== 'rejected' ? 'idcard' : 'alert'} className="mx-auto h-12 w-12 drop-shadow-md" />
          <p className="text-xl font-black uppercase tracking-wide drop-shadow-sm">{outcome.message}</p>

          {visit && (
            <div className="mt-2 w-full rounded-2xl bg-white text-slate-900 px-5 py-4 text-left shadow-xl border border-slate-100">
              <Row label="Visitor Name" value={visit.visitorName || 'N/A'} />
              <Row label="Plate Number" value={visit.plateNumber} highlight />
              <Row label="Purpose" value={visit.purpose} />
              <Row label="Host/Destination" value={visit.hostName} />
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</span>
                <StatusBadge status={visit.status} />
              </div>
            </div>
          )}

          {visit?.status === 'approved' && (
            <button
              onClick={handleCheckIn}
              disabled={isUpdating}
              className="mt-4 rounded-xl bg-white px-6 py-4 text-lg font-black text-emerald-700 shadow-xl active:scale-95 transition-all disabled:opacity-60"
            >
              {isUpdating ? 'Updating Database...' : 'Allow Entry & Check In'}
            </button>
          )}

          {visit?.status === 'inside_campus' && (
            <button
              onClick={handleCheckOut}
              disabled={isUpdating}
              className="mt-4 rounded-xl bg-slate-900 px-6 py-4 text-lg font-black text-white shadow-xl active:scale-95 transition-all disabled:opacity-60 border border-slate-700"
            >
              {isUpdating ? 'Updating Database...' : 'Visitor Exiting (Check Out)'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`font-bold text-right ${highlight ? 'text-lg text-slate-900' : 'text-sm text-slate-700'}`}>{value}</span>
    </div>
  );
}