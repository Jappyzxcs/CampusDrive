import { useMemo, useState, useEffect } from 'react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { applicationService } from '../../services/applicationService'; 
import { DashboardCard } from '../../components/cards/DashboardCard';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';

export default function StickerManagementPage() {
  const { showToast } = useToast();
  
  // We use real-time vehicles data instead of stickers now
  const { data: vehicleData, isLoading, reload } = useAsyncData(() => applicationService.getAllVehicles(), []);

  // BAO Toggle for physical sticker availability
  const [inStock, setInStock] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  // Filter only vehicles that GSU approved and are waiting to pay BAO
  const awaitingPayment = useMemo(() => {
    if (!vehicleData) return [];
    return vehicleData.filter((v) => v.status === 'for_payment');
  }, [vehicleData]);

  async function handleProcessPayment(vehicle) {
    if (!inStock) {
      showToast('Cannot process payment. You are out of physical stickers!', { type: 'danger' });
      return;
    }

    setProcessingId(vehicle.id);
    try {
      // 1. Send the update to Firebase
      await applicationService.updateVehicleStatus(vehicle.id, 'paid');
      
      // 2. Trigger the green success message
      showToast(`Payment received and sticker physically issued for ${vehicle.plateNumber}.`, { type: 'success' });
      
      // 3. THE FIX: Wait 1.5 seconds so you can read the toast message, 
      // then force the page to refresh so the list clears out!
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error("Firebase Error:", error); // Logs the exact issue if it fails!
      showToast('Failed to process payment. Check console.', { type: 'danger' });
      setProcessingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold text-primary-900">BAO Payment & Issuance</h2>
          <p className="text-sm text-slate-500">Collect payment and hand out physical stickers for approved vehicles.</p>
        </div>
        
        {/* THE STOCK TOGGLE */}
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
          Warning: Physical stock is turned off. You cannot process payments or clear vehicles until stock is replenished.
        </div>
      )}

      <DashboardCard title="Awaiting Payment & Sticker Pick-up">
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : awaitingPayment.length === 0 ? (
          <EmptyState title="Nothing waiting" description="No approved vehicles are waiting to pay right now." />
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {awaitingPayment.map((vehicle) => (
              <li key={vehicle.id} className="flex items-center justify-between gap-3 py-4">
                <div>
                  <p className="text-base font-bold text-slate-900">{vehicle.plateNumber}</p>
                  <p className="text-sm text-slate-500">
                    {vehicle.ownerName} &middot; {vehicle.make}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-slate-700">
                    Fee: ₱{vehicle.type === 'Car' ? '200' : '150'}
                  </span>
                  <button
                    onClick={() => handleProcessPayment(vehicle)}
                    disabled={!inStock || processingId === vehicle.id}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingId === vehicle.id ? 'Processing...' : 'Receive Payment & Issue'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>
    </div>
  );
}