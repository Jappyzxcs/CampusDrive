import { useState } from 'react';
import { VerificationResultCard } from '../../components/scanner/VerificationResultCard';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { Icon } from '../../components/common/Icon';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useToast } from '../../context/ToastContext';

export default function ManualLookupPage() {
  const [plate, setPlate] = useState('');
  const [result, setResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(event) {
    event.preventDefault();
    if (!plate.trim()) return;
    
    setIsSearching(true);
    setResult(null);
    
    try {
      const searchPlate = plate.replace(/\s+/g, '').toUpperCase();
      
      const approvedSnapshot = await getDocs(collection(db, 'approved_vehicles'));
      const approvedVehicles = approvedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const matchedApproved = approvedVehicles.find(v => 
        (v.plateNumber || '').replace(/\s+/g, '').toUpperCase() === searchPlate
      );
      
      if (matchedApproved) {
        if (matchedApproved.accreditationStatus === 'Revoked' || matchedApproved.status === 'revoked') {
           setResult({ 
             id: matchedApproved.id,
             result: 'revoked', 
             plateNumber: matchedApproved.plateNumber || 'N/A', 
             stickerSerial: matchedApproved.stickerSerial, 
             ownerName: `${matchedApproved.ownerName || 'Unknown'} (${matchedApproved.registrantType || 'Student'})`, 
             vehicleMake: matchedApproved.vehicleMake || 'N/A',
             vehicleImageUrl: matchedApproved.vehicleImageUrl || '',
             revokeReason: matchedApproved.revokeReason || 'Multiple Campus Violations'
           });
        } else if (matchedApproved.accreditationStatus === 'Expired') {
           setResult({ 
             id: matchedApproved.id,
             result: 'expired', 
             plateNumber: matchedApproved.plateNumber || 'N/A', 
             stickerSerial: matchedApproved.stickerSerial, 
             ownerName: `${matchedApproved.ownerName || 'Unknown'} (${matchedApproved.registrantType || 'Student'})`, 
             vehicleMake: matchedApproved.vehicleMake || 'N/A',
             vehicleImageUrl: matchedApproved.vehicleImageUrl || ''
           });
        } else {
           const issued = matchedApproved.dateIssued || null;
           let valid = null;
           if (issued) {
             const d = new Date(issued);
             d.setFullYear(d.getFullYear() + 1);
             valid = d.toISOString();
           }

           setResult({ 
             id: matchedApproved.id,
             result: 'valid', 
             plateNumber: matchedApproved.plateNumber || 'N/A', 
             stickerSerial: matchedApproved.stickerSerial, 
             ownerName: `${matchedApproved.ownerName || 'Authorized User'} (${matchedApproved.registrantType || 'Student'})`, 
             vehicleMake: matchedApproved.vehicleMake || 'N/A',
             vehicleImageUrl: matchedApproved.vehicleImageUrl || '',
             dateIssued: issued, 
             validUntil: valid   
           });
        }
        setIsSearching(false);
        return; 
      }
      
      const vehiclesSnapshot = await getDocs(collection(db, 'vehicles'));
      const allVehicles = vehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const matchedVehicle = allVehicles.find(v => 
        (v.plateNumber || '').replace(/\s+/g, '').toUpperCase() === searchPlate
      );
      
      if (matchedVehicle) {
         setResult({
           id: matchedVehicle.id,
           result: 'unregistered', 
           plateNumber: matchedVehicle.plateNumber || 'N/A',
           stickerSerial: 'Pending Issuance',
           ownerName: `${matchedVehicle.ownerName || 'Unknown'} (${matchedVehicle.registrantType || 'Student'})`, 
           vehicleMake: `${matchedVehicle.make || ''} ${matchedVehicle.model || ''}`.trim() || 'N/A',
           vehicleImageUrl: matchedVehicle.vehicleImageUrl || ''
         });
      } else {
         setResult({
           id: null,
           result: 'no_record',
           plateNumber: plate.toUpperCase(),
           stickerSerial: null,
           ownerName: null,
           vehicleMake: null
         });
      }

    } catch (error) {
      console.error("Lookup Error:", error);
      showToast("Error searching database. Please try again.", { type: 'danger' });
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Manual Sticker Lookup</h2>
        <p className="text-sm text-slate-500">Use this when the sticker is too damaged to be scanned.</p>
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