import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Icon } from '../common/Icon';

export function VehicleOffensesCard({ vehicle }) {
  const [offenses, setOffenses] = useState([]);
  const offenseCount = vehicle.offenseCount || 0;
  const isRevoked = vehicle.accreditationStatus === 'Revoked';

  useEffect(() => {
    if (offenseCount > 0 && vehicle.id) {
      const fetchOffenses = async () => {
        const q = query(collection(db, 'offenses'), where('vehicleId', '==', vehicle.id));
        const snap = await getDocs(q);
        setOffenses(snap.docs.map(doc => doc.data()));
      };
      fetchOffenses();
    }
  }, [vehicle.id, offenseCount]);

  if (offenseCount === 0) return null;

  return (
    <div className={`rounded-xl border p-5 shadow-sm ${
      isRevoked ? 'bg-danger-50 border-danger-200' : 
      offenseCount === 2 ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'
    }`}>
      <div className="flex items-start gap-3 mb-4">
        <Icon name="alert" className={`h-6 w-6 mt-0.5 ${
          isRevoked ? 'text-danger-600' : offenseCount === 2 ? 'text-orange-600' : 'text-amber-600'
        }`} />
        <div>
          <h3 className={`text-base font-bold ${
            isRevoked ? 'text-danger-900' : 'text-slate-900'
          }`}>
            {isRevoked ? 'Sticker Revoked' : `Active Offenses: ${offenseCount} of 3`}
          </h3>
          <p className={`text-sm mt-1 ${isRevoked ? 'text-danger-700' : 'text-slate-600'}`}>
            {isRevoked 
              ? 'Your vehicle sticker has been revoked due to repeated infractions. It is no longer valid at the gate.'
              : offenseCount === 2 
                ? 'Warning: One more offense will result in permanent sticker revocation.'
                : 'Your vehicle has been flagged by security. Please adhere to campus rules.'}
          </p>
        </div>
      </div>

      <div className="border-t border-black/10 pt-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Infraction History</h4>
        <ul className="flex flex-col gap-3">
          {offenses.map((offense, idx) => (
            <li key={idx} className="flex flex-col bg-white/60 p-3 rounded-lg text-sm border border-white/20">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-slate-800">{offense.reason}</span>
                <span className="text-xs font-medium text-slate-500">
                  {new Date(offense.timestamp).toLocaleDateString()}
                </span>
              </div>
              {offense.details && <p className="text-slate-600">{offense.details}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}