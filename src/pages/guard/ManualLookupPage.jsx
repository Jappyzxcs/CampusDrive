import { useState } from 'react';
import { VerificationResultCard } from '../../components/scanner/VerificationResultCard';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { Icon } from '../../components/common/Icon';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { flaggingService } from '../../services/flaggingService';

// Helper to parse dates in various formats
const parseCustomDate = (dateStr) => {
  if (!dateStr) return null;
  if (typeof dateStr.toDate === 'function') return dateStr.toDate();
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/');
    return new Date(year, parseInt(month) - 1, day);
  }
  return new Date(dateStr);
};

export default function ManualLookupPage() {
  const [plate, setPlate] = useState('');
  const [result, setResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  
  const { showToast } = useToast();
  const { user } = useAuth();

  // Flag Modal States
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagDetails, setFlagDetails] = useState('');
  const [isFlagging, setIsFlagging] = useState(false);

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
        
        let orExp = matchedApproved.orExpiry || matchedApproved.nlpExtractedData?.orExpiry || null;
        let licExp = matchedApproved.licenseExpiry || matchedApproved.nlpExtractedData?.licenseExpiry || null;

        if (!orExp || !licExp) {
          try {
            const targetPlate = (matchedApproved.plateNumber || '').replace(/\s+/g, '').toUpperCase();
            
            const vSnap = await getDocs(collection(db, 'vehicles'));
            const vDoc = vSnap.docs.map(d => d.data()).find(v => (v.plateNumber || '').replace(/\s+/g, '').toUpperCase() === targetPlate);
            if (vDoc) {
              orExp = orExp || vDoc.orExpiry || vDoc.nlpExtractedData?.orExpiry || null;
              licExp = licExp || vDoc.licenseExpiry || vDoc.nlpExtractedData?.licenseExpiry || null;
            }

            if (!orExp || !licExp) {
              const aSnap = await getDocs(collection(db, 'applications'));
              const aDoc = aSnap.docs.map(d => d.data()).find(a => (a.plateNumber || a.vehicleDetails?.plateNumber || '').replace(/\s+/g, '').toUpperCase() === targetPlate);
              if (aDoc) {
                orExp = orExp || aDoc.orExpiry || aDoc.nlpExtractedData?.orExpiry || null;
                licExp = licExp || aDoc.licenseExpiry || aDoc.nlpExtractedData?.licenseExpiry || null;
              }
            }
          } catch (e) {
            console.error("Deep search for dates failed", e);
          }
        }

        // Live Date Evaluation Logic (Ported from Scanner)
        const today = new Date();
        today.setHours(0, 0, 0, 0); 

        let isOrExpired = false;
        let isLicenseExpired = false;
        
        if (orExp) {
          const orDate = parseCustomDate(orExp);
          if (orDate && orDate < today) isOrExpired = true;
        }
        if (licExp) {
          const licDate = parseCustomDate(licExp);
          if (licDate && licDate < today) isLicenseExpired = true;
        }

        if (matchedApproved.accreditationStatus === 'Revoked' || matchedApproved.status === 'revoked') {
           setResult({ 
             id: matchedApproved.id,
             result: 'revoked', 
             plateNumber: matchedApproved.plateNumber || 'N/A', 
             stickerSerial: matchedApproved.stickerSerial, 
             ownerName: `${matchedApproved.ownerName || 'Unknown'} (${matchedApproved.registrantType || 'Student'})`, 
             vehicleMake: matchedApproved.vehicleMake || 'N/A',
             vehicleImageUrl: matchedApproved.vehicleImageUrl || '',
             revokeReason: matchedApproved.revokeReason || 'Multiple Campus Violations',
             orExpiry: orExp,
             licenseExpiry: licExp,
             alert: 'Access Denied: Sticker Revoked'
           });
        } else if (matchedApproved.accreditationStatus === 'Expired' || matchedApproved.status === 'expired' || isOrExpired || isLicenseExpired) {
           
           let expireReason = 'Institutional accreditation expired.';
           if (isOrExpired) expireReason = 'LTO Official Receipt has expired. Entry denied.';
           else if (isLicenseExpired) expireReason = "Driver's License has expired. Entry denied.";

           setResult({ 
             id: matchedApproved.id,
             result: 'expired', 
             plateNumber: matchedApproved.plateNumber || 'N/A', 
             stickerSerial: matchedApproved.stickerSerial, 
             ownerName: `${matchedApproved.ownerName || 'Unknown'} (${matchedApproved.registrantType || 'Student'})`, 
             vehicleMake: matchedApproved.vehicleMake || 'N/A',
             vehicleImageUrl: matchedApproved.vehicleImageUrl || '',
             orExpiry: orExp,
             licenseExpiry: licExp,
             alert: expireReason
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
             validUntil: valid,
             orExpiry: orExp,
             licenseExpiry: licExp,
             alert: 'Vehicle Authorized.'   
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
           vehicleImageUrl: matchedVehicle.vehicleImageUrl || '',
           orExpiry: matchedVehicle.orExpiry || matchedVehicle.nlpExtractedData?.orExpiry || null,
           licenseExpiry: matchedVehicle.licenseExpiry || matchedVehicle.nlpExtractedData?.licenseExpiry || null,
           alert: 'Sticker found, but vehicle application is still PENDING. Entry denied.'
         });
      } else {
         setResult({
           id: null,
           result: 'no_record',
           plateNumber: plate.toUpperCase(),
           stickerSerial: null,
           ownerName: null,
           vehicleMake: null,
           alert: `No record found for plate "${plate.toUpperCase()}".`
         });
      }

    } catch (error) {
      console.error("Lookup Error:", error);
      showToast("Error searching database. Please try again.", { type: 'danger' });
    } finally {
      setIsSearching(false);
    }
  }

  async function handleFlagSubmit() {
    if (!flagReason) return;
    setIsFlagging(true);
    
    try {
      if (!result.id) {
        await addDoc(collection(db, 'reports'), {
          type: 'vehicle_violation',
          plateNumber: result.plateNumber,
          serial: result.stickerSerial || 'N/A',
          reportedBy: user?.fullName || user?.name || 'On-Duty Guard',
          reason: flagReason,
          details: flagDetails,
          status: 'open',
          timestamp: new Date().toISOString()
        });
        showToast('Violation reported for unregistered vehicle.', { type: 'success' });
      } else {
        const guardId = user?.id || user?.uid || 'Guard';
        const newCount = await flaggingService.submitFlag(
          result.id, 
          result.stickerSerial, 
          guardId, 
          flagReason, 
          flagDetails
        );
        
        if (newCount >= 3) {
          showToast(`Vehicle Auto-Revoked! (Strike ${newCount} of 3)`, { type: 'danger' });
        } else {
          showToast(`Offense recorded. Vehicle now has ${newCount} strike(s).`, { type: 'warning' });
        }
      }
      
      setIsFlagModalOpen(false);
      setFlagReason('');
      setFlagDetails('');
      setResult(null); 
      setPlate('');
      
    } catch (err) {
      console.error("Flag Error:", err);
      showToast("Failed to submit flag.", { type: 'danger' });
    } finally {
      setIsFlagging(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 relative">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Manual Plate Number Lookup</h2>
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

      {result && (
        <VerificationResultCard 
          result={result} 
          onFlagClick={() => setIsFlagModalOpen(true)} 
        />
      )}

      {isFlagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 font-serif">Report Vehicle Offense</h3>
              <button onClick={() => setIsFlagModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6 flex flex-col gap-3">
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${flagReason === 'Sticker Swapping' ? 'border-primary-500 bg-primary-50' : 'border-slate-200'}`}>
                <div className="mt-0.5">
                  <input 
                    type="radio" 
                    name="violation" 
                    value="Sticker Swapping" 
                    checked={flagReason === 'Sticker Swapping'} 
                    onChange={(e) => { setFlagReason(e.target.value); setFlagDetails(''); }} 
                    className="h-4 w-4 text-primary-600" 
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">Sticker Swapping</span>
                  <span className="mt-1 text-xs font-medium text-slate-500 leading-relaxed">The scanned sticker is attached to a vehicle that does not match the registered proof photo.</span>
                </div>
              </label>

              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${flagReason === 'Other Violation' ? 'border-primary-500 bg-primary-50' : 'border-slate-200'}`}>
                <input 
                  type="radio" 
                  name="violation" 
                  value="Other Violation" 
                  checked={flagReason === 'Other Violation'} 
                  onChange={(e) => setFlagReason(e.target.value)} 
                  className="h-4 w-4 text-primary-600" 
                />
                <span className="text-sm font-bold text-slate-900">Other Violation</span>
              </label>

              {flagReason === 'Other Violation' && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                  <textarea 
                    rows={3}
                    value={flagDetails}
                    onChange={(e) => setFlagDetails(e.target.value)}
                    placeholder="Please specify the violation..."
                    className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 focus:border-red-500 focus:outline-none shadow-inner"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-center gap-4">
              <button 
                onClick={() => setIsFlagModalOpen(false)}
                disabled={isFlagging}
                className="w-1/2 rounded-lg border border-primary-200 bg-white py-3 text-sm font-bold text-primary-700 hover:bg-primary-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleFlagSubmit}
                disabled={isFlagging || !flagReason}
                className="w-1/2 rounded-lg bg-[#7A1B1B] py-3 text-sm font-bold text-white shadow-md hover:bg-[#5E1515] disabled:opacity-50 transition-colors"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}