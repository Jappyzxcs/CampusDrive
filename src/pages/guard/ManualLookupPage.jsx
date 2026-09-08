import { useState } from 'react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { mockDataService } from '../../services/mockDataService';
import { VerificationResultCard } from '../../components/scanner/VerificationResultCard';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { Icon } from '../../components/common/Icon';

function evaluateLookup(plate, vehicles, stickers) {
  const normalized = plate.trim().toUpperCase();
  const vehicle = vehicles.find((v) => v.plateNumber.toUpperCase() === normalized);

  if (!vehicle) {
    return { result: 'no_record', plateNumber: normalized, stickerSerial: null, ownerName: null };
  }

  const sticker = stickers.find((s) => s.vehicleId === vehicle.id);

  if (vehicle.status === 'expired') {
    return {
      result: 'expired',
      plateNumber: vehicle.plateNumber,
      stickerSerial: vehicle.stickerSerial,
      ownerName: vehicle.ownerName,
      vehicleMake: `${vehicle.make} ${vehicle.model}`,
    };
  }

  if (sticker?.status === 'flagged_duplicate') {
    return {
      result: 'duplicate',
      plateNumber: vehicle.plateNumber,
      stickerSerial: vehicle.stickerSerial,
      ownerName: vehicle.ownerName,
      vehicleMake: `${vehicle.make} ${vehicle.model}`,
    };
  }

  if (vehicle.status === 'approved' && vehicle.stickerSerial) {
    return {
      result: 'valid',
      plateNumber: vehicle.plateNumber,
      stickerSerial: vehicle.stickerSerial,
      ownerName: vehicle.ownerName,
      vehicleMake: `${vehicle.make} ${vehicle.model}`,
    };
  }

  return {
    result: 'unregistered',
    plateNumber: vehicle.plateNumber,
    stickerSerial: null,
    ownerName: vehicle.ownerName,
  };
}

export default function ManualLookupPage() {
  const { data: vehicles } = useAsyncData(() => mockDataService.getVehicles(), []);
  const { data: stickers } = useAsyncData(() => mockDataService.getStickers(), []);

  const [plate, setPlate] = useState('');
  const [result, setResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    if (!plate.trim() || !vehicles || !stickers) return;
    setIsSearching(true);
    setTimeout(() => {
      setResult(evaluateLookup(plate, vehicles, stickers));
      setIsSearching(false);
    }, 400);
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Manual Sticker Lookup</h2>
        <p className="text-sm text-slate-500">Use this when the sticker can't be scanned.</p>
      </div>

      <DashboardCard>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="Enter plate number, e.g. NBC 1234"
              className="w-full rounded-md border border-slate-300 py-2.5 pl-9 pr-3 text-sm uppercase text-slate-900
                placeholder:normal-case placeholder:text-slate-400 focus-visible:border-primary-500"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={isSearching}>
            {isSearching ? 'Searching…' : 'Look up'}
          </button>
        </form>
      </DashboardCard>

      {result && <VerificationResultCard result={result} />}
    </div>
  );
}
