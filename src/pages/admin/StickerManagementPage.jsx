import { useMemo, useState } from 'react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { applicationService } from '../../services/applicationService'; 
import { DashboardCard } from '../../components/cards/DashboardCard';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import { doc, updateDoc, setDoc } from 'firebase/firestore'; 
import { db } from '../../config/firebase'; 

export default function StickerManagementPage() {
  const { showToast } = useToast();
  const { data: vehicleData, isLoading, reload } = useAsyncData(() => applicationService.getAllVehicles(), []);
  
  const [inStock, setInStock] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [formInputs, setFormInputs] = useState({});

  const awaitingPayment = useMemo(() => {
    if (!vehicleData) return [];
    return vehicleData.filter((v) => 
      v.status === 'for_payment' || v.status === 'approved' || v.status === 'paid'
    );
  }, [vehicleData]);

  const getDefaultAmount = (vehicle) => {
    const type = (vehicle.vehicleType || vehicle.type || '').toLowerCase();
    if (['car', 'suv', 'van', 'truck', 'auv'].includes(type)) {
      return 200;
    }
    return 50; // Motorcycle default fee
  };

  const handleInputChange = (vehicleId, field, value) => {
    setFormInputs(prev => ({
      ...prev,
      [vehicleId]: {
        ...prev[vehicleId],
        [field]: value
      }
    }));
  };

  async function handleProcessPayment(vehicle) {
    if (!inStock) {
      showToast('Cannot process payment. You are out of physical stickers!', { type: 'danger' });
      return;
    }

    const vehicleInput = formInputs[vehicle.id] || {};
    const serialNumber = (vehicleInput.serial || '').trim().toUpperCase();
    const amount = vehicleInput.amount !== undefined ? vehicleInput.amount : getDefaultAmount(vehicle);

    if (!serialNumber) {
      showToast('Please enter a Sticker Serial Number before processing.', { type: 'danger' });
      return;
    }

    setProcessingId(vehicle.id);

    try {
      // 1. Update the vehicle status in the 'vehicles' collection
      const vehicleRef = doc(db, 'vehicles', vehicle.id);
      await updateDoc(vehicleRef, {
        status: 'completed',
        paymentStatus: 'paid',
        stickerSerial: serialNumber,
        paidAmount: Number(amount)
      });

      // 2. Sync to 'approved_vehicles' so the Guard Scanner can verify it at the gate
      const approvedRef = doc(db, 'approved_vehicles', vehicle.id);
      await setDoc(approvedRef, {
        plateNumber: vehicle.plateNumber,
        ownerName: vehicle.ownerName || 'Unknown Owner',
        vehicleMake: `${vehicle.make || ''} ${vehicle.model || ''}`.trim(),
        stickerSerial: serialNumber,
        vehicleImageUrl: vehicle.vehicleImageUrl || vehicle.imageUrl || vehicle.photoUrl || '', // Carries over the uploaded photo
        accreditationStatus: 'Active',
        dateIssued: new Date().toISOString()
      }, { merge: true });
      
      showToast(`Payment of ₱${amount} received! Sticker ${serialNumber} issued to ${vehicle.plateNumber}.`, { type: 'success' });
      
      // THE FIX: Cleanly reload data in the background instead of forcing a full browser refresh!
      if (reload) await reload();
      setProcessingId(null);

    } catch (error) {
      console.error("Firebase Error:", error); 
      showToast('Failed to process payment. Check console.', { type: 'danger' });
      setProcessingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold text-primary-900">BAO Payment & Issuance</h2>
          <p className="text-sm text-slate-500">Collect payment, adjust fees, and assign sticker serials.</p>
        </div>
        
        {/* Physical Sticker Stock Toggle */}
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
          <span className={`text-sm font-semibold ${inStock ? 'text-slate-900' : 'text-danger-600'}`}>
            Physical Sticker Stock:
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={inStock} 
              onChange={() => setInStock(!inStock)} 
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-600"></div>
          </label>
          <span className={`text-sm font-bold ${inStock ? 'text-accent-700' : 'text-danger-600'}`}>
            {inStock ? 'AVAILABLE' : 'OUT OF STOCK'}
          </span>
        </div>
      </div>

      {!inStock && (
        <div className="bg-danger-50 text-danger-700 border border-danger-200 p-4 rounded-xl text-sm font-medium flex items-center gap-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Warning: Physical stock is turned off. You cannot process payments or issue stickers.
        </div>
      )}

      <DashboardCard title="Awaiting Payment & Sticker Pick-up">
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : awaitingPayment.length === 0 ? (
          <EmptyState title="Nothing waiting" description="No approved vehicles are waiting to pay right now." />
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {awaitingPayment.map((vehicle) => {
              const currentInput = formInputs[vehicle.id] || {};
              const currentSerial = currentInput.serial || '';
              const currentAmount = currentInput.amount !== undefined ? currentInput.amount : getDefaultAmount(vehicle);

              return (
                <li key={vehicle.id} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-4">
                  <div>
                    <p className="text-base font-bold text-slate-900">{vehicle.plateNumber}</p>
                    <p className="text-sm text-slate-500">
                      {vehicle.ownerName} &middot; <span className="capitalize">{vehicle.vehicleType || vehicle.type || 'Vehicle'}</span>
                    </p>
                  </div>

                  {/* Inline Form Controls for Serial & Amount */}
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex flex-col">
                      <label className="text-xs font-medium text-slate-500 mb-1">Sticker Serial</label>
                      <input
                        type="text"
                        placeholder="e.g. LB0061"
                        value={currentSerial}
                        onChange={(e) => handleInputChange(vehicle.id, 'serial', e.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm uppercase text-slate-900 w-32 focus:border-primary-500"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-xs font-medium text-slate-500 mb-1">Fee (₱)</label>
                      <input
                        type="number"
                        value={currentAmount}
                        onChange={(e) => handleInputChange(vehicle.id, 'amount', e.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 w-24 focus:border-primary-500"
                      />
                    </div>

                    <div className="flex items-end h-full pt-5">
                      <button
                        onClick={() => handleProcessPayment(vehicle)}
                        disabled={!inStock || processingId === vehicle.id}
                        className="btn-primary py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingId === vehicle.id ? 'Processing...' : 'Issue Sticker'}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardCard>
    </div>
  );
}