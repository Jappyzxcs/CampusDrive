import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { flaggingService } from '../../services/flaggingService';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { Icon } from '../../components/common/Icon';
import { useToast } from '../../context/ToastContext';

export default function FlaggedVehiclesPage() {
  const [flaggedVehicles, setFlaggedVehicles] = useState([]);
  const [offensesMap, setOffensesMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const { showToast } = useToast();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const vQuery = query(collection(db, 'approved_vehicles'), where('offenseCount', '>', 0));
      const vSnap = await getDocs(vQuery);
      const vehicles = vSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFlaggedVehicles(vehicles);

      const vehicleIds = vehicles.map(v => v.id);
      if (vehicleIds.length > 0) {
        const oQuery = query(collection(db, 'offenses'), where('vehicleId', 'in', vehicleIds.slice(0, 10)));
        const oSnap = await getDocs(oQuery);
        
        const map = {};
        oSnap.docs.forEach(doc => {
          const data = doc.data();
          if (!map[data.vehicleId]) map[data.vehicleId] = [];
          map[data.vehicleId].push({ id: doc.id, ...data });
        });
        setOffensesMap(map);
      }
    } catch (error) {
      console.error("Failed to load flagged vehicles:", error);
      showToast('Error loading flagged vehicles.', { type: 'danger' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // THE FIX: Now receives the full vehicle object to build the blacklist
  const handleRevoke = async (vehicle) => {
    if (!window.confirm(`Are you sure you want to REVOKE the sticker for ${vehicle.plateNumber}? This cannot be easily undone.`)) {
      return;
    }

    try {
      await flaggingService.revokeSticker(vehicle);
      showToast(`Sticker for ${vehicle.plateNumber} has been revoked.`, { type: 'success' });
      loadData(); 
    } catch (error) {
      console.error("Revocation failed:", error);
      showToast('Failed to revoke sticker.', { type: 'danger' });
    }
  };

  if (isLoading) return <p className="text-slate-500 p-6">Loading flagged vehicles...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Flagged Vehicles & Offenses</h2>
        <p className="text-sm text-slate-500">Monitor vehicle infractions and manage sticker revocations.</p>
      </div>

      {flaggedVehicles.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
          No vehicles have been flagged for offenses.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {flaggedVehicles.map(vehicle => {
            const offenses = offensesMap[vehicle.id] || [];
            const isRevoked = vehicle.accreditationStatus === 'Revoked';
            const isPendingRevocation = vehicle.offenseCount >= 3 && !isRevoked;

            return (
              <DashboardCard key={vehicle.id} className={isRevoked ? 'opacity-75 grayscale' : ''}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-slate-900">{vehicle.plateNumber}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isRevoked ? 'bg-danger-100 text-danger-700' : 
                        isPendingRevocation ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {isRevoked ? 'REVOKED' : `${vehicle.offenseCount} / 3 Offenses`}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {vehicle.ownerName} &middot; Serial: <span className="font-semibold text-slate-700">{vehicle.stickerSerial}</span>
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setExpandedId(expandedId === vehicle.id ? null : vehicle.id)}
                      className="btn-secondary py-2"
                    >
                      {expandedId === vehicle.id ? 'Hide History' : 'View History'}
                    </button>

                    {isPendingRevocation && (
                      <button 
                        onClick={() => handleRevoke(vehicle)}
                        className="btn-primary bg-danger-600 hover:bg-danger-700 py-2"
                      >
                        Revoke Sticker
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Offense History */}
                {expandedId === vehicle.id && (
                  <div className="mt-4 border-t border-slate-100 pt-4 flex flex-col gap-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Offense History</h4>
                    {offenses.length === 0 ? (
                      <p className="text-sm text-slate-400">Loading details...</p>
                    ) : (
                      <ul className="flex flex-col gap-3">
                        {offenses.map((offense, idx) => (
                          <li key={offense.id} className="rounded-lg bg-slate-50 p-3 text-sm border border-slate-100">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-semibold text-danger-700">Strike {idx + 1}: {offense.reason}</span>
                              <span className="text-xs text-slate-400">
                                {new Date(offense.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                            {offense.details && (
                              <p className="text-slate-600 italic">"{offense.details}"</p>
                            )}
                            <p className="text-xs text-slate-400 mt-2">Reported by Guard ID: {offense.guardId}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </DashboardCard>
            );
          })}
        </div>
      )}
    </div>
  );
}