import { useState, useEffect, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { Icon } from '../../components/common/Icon';
import { createWorker } from 'tesseract.js';
import levenshtein from 'fast-levenshtein';
import { collection, onSnapshot, addDoc, query, where, getDocs } from 'firebase/firestore'; 
import { db } from '../../config/firebase'; 
import { aiService } from '../../services/aiService';
import { useAuth } from '../../context/AuthContext';
import { flaggingService } from '../../services/flaggingService';
import { VerificationResultCard } from '../../components/scanner/VerificationResultCard';

export default function ScannerPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [phase, setPhase] = useState('idle'); 
  const [result, setResult] = useState(null);
  
  const [scanTargetUI, setScanTargetUI] = useState('Student');
  const scanTargetRef = useRef('Student');
  
  const videoRef = useRef(null);
  const isScanningRef = useRef(false);
  const workerRef = useRef(null);
  const vehiclesCacheRef = useRef([]);

  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagDetails, setFlagDetails] = useState('');
  const [isFlagging, setIsFlagging] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'approved_vehicles'), (snap) => {
      vehiclesCacheRef.current = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });

    const initWorker = async () => {
      workerRef.current = await createWorker('eng');
    };
    initWorker();

    return () => {
      unsubscribe();
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  useEffect(() => {
    let activeStream = null;

    async function startCamera() {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
        showToast('Camera access denied. Please check your browser permissions.', { type: 'danger' });
      }
    }

    if (phase !== 'result') {
      startCamera();
    }

    return () => {
      isScanningRef.current = false;
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [phase, showToast]);

  const cleanOCRText = (rawText) => {
    let text = rawText.toUpperCase().replace(/\s+/g, '');
    text = text.replace(/L8/g, 'LB');

    const regex = /([A-Z]{2})([0-9OIZS]{4})/;
    const match = text.match(regex);

    if (match) {
      const letters = match[1]; 
      const digits = match[2]
        .replace(/O/g, '0')
        .replace(/I/g, '1')
        .replace(/Z/g, '2')
        .replace(/S/g, '5');
      return letters + digits; 
    }
    return null; 
  };

  const parseCustomDate = (dateStr) => {
    if (!dateStr) return null;
    if (typeof dateStr.toDate === 'function') return dateStr.toDate();
    if (typeof dateStr === 'string' && dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/');
      return new Date(year, parseInt(month) - 1, day);
    }
    return new Date(dateStr);
  };

  const processFrame = async () => {
    if (!isScanningRef.current || !videoRef.current) return;

    const video = videoRef.current;
    
    if (video.videoWidth === 0) {
      setTimeout(processFrame, 300);
      return;
    }

    const canvas = document.createElement('canvas');
    const cropWidth = video.videoWidth * 0.6;
    const cropHeight = video.videoHeight * 0.3;
    const cropX = (video.videoWidth - cropWidth) / 2;
    const cropY = (video.videoHeight - cropHeight) / 2;

    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    try {
      const base64Frame = canvas.toDataURL('image/jpeg', 0.7);
      
      const aiResult = await aiService.verifySticker(base64Frame);

      if (!aiResult.success || !aiResult.isDetected) {
        setTimeout(processFrame, 400); 
        return;
      }

      if (!workerRef.current) {
        setTimeout(processFrame, 400);
        return;
      }

      const { data: { text } } = await workerRef.current.recognize(canvas);
      const cleanedText = cleanOCRText(text);

      if (!cleanedText || cleanedText.length < 4) {
        setTimeout(processFrame, 400);
        return;
      }

      const vehicles = vehiclesCacheRef.current;
      const currentTarget = scanTargetRef.current;

      const matchedVehicle = vehicles.find(v => {
        if (!v.stickerSerial) return false;
        const vType = v.registrantType || 'Student'; 
        if (vType.toLowerCase() !== currentTarget.toLowerCase()) return false;
        return levenshtein.get(cleanedText, v.stickerSerial.toUpperCase()) <= 2;
      });

      let finalResult;
      const today = new Date();
      today.setHours(0, 0, 0, 0); 
      
      // THE FIX: Deep Hunting applied to the Scanner as well
      let orExp = matchedVehicle ? (matchedVehicle.orExpiry || matchedVehicle.nlpExtractedData?.orExpiry || null) : null;
      let licExp = matchedVehicle ? (matchedVehicle.licenseExpiry || matchedVehicle.nlpExtractedData?.licenseExpiry || null) : null;

      if (matchedVehicle && (!orExp || !licExp)) {
        try {
          const targetPlate = (matchedVehicle.plateNumber || '').replace(/\s+/g, '').toUpperCase();
          
          // Hunt in Main Vehicles
          const vSnap = await getDocs(collection(db, 'vehicles'));
          const vDoc = vSnap.docs.map(d => d.data()).find(v => (v.plateNumber || '').replace(/\s+/g, '').toUpperCase() === targetPlate);
          if (vDoc) {
            orExp = orExp || vDoc.orExpiry || vDoc.nlpExtractedData?.orExpiry || null;
            licExp = licExp || vDoc.licenseExpiry || vDoc.nlpExtractedData?.licenseExpiry || null;
          }

          // Hunt in Original Applications
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
      
      if (!matchedVehicle) {
        const pendingQuery = query(collection(db, 'vehicles'), where('stickerSerial', '==', cleanedText));
        const pendingSnap = await getDocs(pendingQuery);
        
        if (!pendingSnap.empty) {
          const pendingVehicle = pendingSnap.docs[0].data();
          finalResult = { 
            id: pendingSnap.docs[0].id,
            status: 'unregistered', 
            plateNumber: pendingVehicle.plateNumber || 'UNKNOWN', 
            owner: `${pendingVehicle.ownerName || 'Unknown'} (${pendingVehicle.registrantType || 'Student'})`, 
            make: `${pendingVehicle.make || ''} ${pendingVehicle.model || ''}`.trim() || 'N/A', 
            serial: cleanedText, 
            alert: `Sticker found, but vehicle application is still PENDING. Entry denied.`,
            orExpiry: pendingVehicle.orExpiry || pendingVehicle.nlpExtractedData?.orExpiry || null,
            licenseExpiry: pendingVehicle.licenseExpiry || pendingVehicle.nlpExtractedData?.licenseExpiry || null
          };
        } else {
          finalResult = { 
            id: null,
            status: 'no_record', 
            plateNumber: 'UNKNOWN', 
            owner: 'N/A', 
            make: 'N/A', 
            serial: cleanedText, 
            alert: `No record found for this sticker. Possible counterfeit.` 
          };
        }
      } else if (matchedVehicle.accreditationStatus === 'Revoked' || matchedVehicle.status === 'revoked') {
        finalResult = { 
          id: matchedVehicle.id,
          status: 'revoked', 
          plateNumber: matchedVehicle.plateNumber || 'N/A', 
          owner: `${matchedVehicle.ownerName || 'Unknown'} (${matchedVehicle.registrantType || 'Student'})`, 
          make: matchedVehicle.vehicleMake || 'N/A', 
          serial: matchedVehicle.stickerSerial, 
          revokeReason: matchedVehicle.revokeReason || 'Multiple Campus Violations',
          vehicleImage: matchedVehicle.vehicleImageUrl || matchedVehicle.imageUrl || null,
          alert: 'Access Denied: Sticker Revoked',
          orExpiry: orExp,
          licenseExpiry: licExp 
        };
      } else if (matchedVehicle.accreditationStatus === 'Expired' || matchedVehicle.status === 'expired' || isOrExpired || isLicenseExpired) {
        
        let expireReason = 'Institutional accreditation expired.';
        if (isOrExpired) expireReason = 'LTO Official Receipt has expired. Entry denied.';
        else if (isLicenseExpired) expireReason = 'Driver\'s License has expired. Entry denied.';

        finalResult = { 
          id: matchedVehicle.id,
          status: 'expired', 
          plateNumber: matchedVehicle.plateNumber || 'N/A', 
          owner: `${matchedVehicle.ownerName || 'Unknown'} (${matchedVehicle.registrantType || 'Student'})`, 
          make: matchedVehicle.vehicleMake || 'N/A', 
          serial: matchedVehicle.stickerSerial, 
          alert: expireReason,
          orExpiry: orExp,
          licenseExpiry: licExp
        };
      } else {
        const issued = matchedVehicle.dateIssued || null;
        let valid = null;
        if (issued) {
          const d = new Date(issued);
          d.setFullYear(d.getFullYear() + 1);
          valid = d.toISOString();
        }

        finalResult = { 
          id: matchedVehicle.id,
          status: 'valid', 
          plateNumber: matchedVehicle.plateNumber || 'N/A', 
          owner: `${matchedVehicle.ownerName || 'Authorized User'} (${matchedVehicle.registrantType || 'Student'})`, 
          make: matchedVehicle.vehicleMake || matchedVehicle.make || 'N/A', 
          serial: matchedVehicle.stickerSerial, 
          vehicleImage: matchedVehicle.vehicleImageUrl || matchedVehicle.imageUrl || matchedVehicle.photoUrl || null, 
          dateIssued: issued,
          validUntil: valid,
          alert: 'Vehicle Authorized.',
          orExpiry: orExp,
          licenseExpiry: licExp
        };
      }

      try {
        await addDoc(collection(db, 'entry_logs'), {
          plateNumber: finalResult.plateNumber,
          serial: finalResult.serial,
          result: finalResult.status,
          owner: finalResult.owner || 'Unknown',
          guardName: user?.fullName || user?.name || 'On-Duty Guard',
          timestamp: new Date().toISOString()
        });
      } catch (dbErr) {
        console.error("Failed to save scan to history:", dbErr);
      }

      isScanningRef.current = false;
      setResult(finalResult);
      setPhase('result');
      
      if (finalResult.status !== 'valid') {
        showToast('Flagged result — review before allowing entry.', { type: 'danger' });
      }

    } catch (error) {
      console.error("Verification Error:", error);
      setTimeout(processFrame, 800);
    }
  };

  async function handleFlagSubmit() {
    if (!flagReason) return;
    setIsFlagging(true);
    
    try {
      if (!result.id) {
        await addDoc(collection(db, 'reports'), {
          type: 'vehicle_violation',
          plateNumber: result.plateNumber,
          serial: result.serial,
          reportedBy: user?.fullName || user?.name || 'On-Duty Guard',
          reason: flagReason,
          details: flagDetails,
          status: 'open',
          timestamp: new Date().toISOString()
        });
        showToast('Violation reported for unregistered sticker.', { type: 'success' });
      } else {
        const guardId = user?.id || user?.uid || 'Guard';
        const newCount = await flaggingService.submitFlag(
          result.id, 
          result.serial, 
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
      handleReset(); 
      
    } catch (err) {
      console.error("Flag Error:", err);
      showToast("Failed to submit flag.", { type: 'danger' });
    } finally {
      setIsFlagging(false);
    }
  }

  function handleTargetSwitch(target) {
    scanTargetRef.current = target;
    setScanTargetUI(target);
  }

  function toggleScan() {
    if (phase === 'scanning') {
      isScanningRef.current = false;
      setPhase('idle');
    } else {
      isScanningRef.current = true;
      setPhase('scanning');
      setResult(null);
      processFrame(); 
    }
  }

  function handleReset() {
    isScanningRef.current = false;
    setPhase('idle');
    setResult(null);
  }

  return (
    <div className="mx-auto flex max-h-screen w-full max-w-lg flex-col bg-slate-900 pb-6 font-sans">
      
      <div className="flex items-center justify-between p-5 z-10">
        <div>
          <h2 className="text-xl font-bold !text-white tracking-wide">Sticker Scanner</h2>
          <p className="text-sm font-medium !text-slate-300 mt-0.5">Point camera at vehicle sticker</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 shadow-lg">
          <Icon name="scan" className="h-6 w-6 text-primary-400" />
        </div>
      </div>

      {phase !== 'result' && (
        <div className="flex flex-1 flex-col px-4 pb-4">
          
          <div className="flex rounded-xl bg-slate-800 p-1 mb-4 shadow-inner">
            <button
              onClick={() => handleTargetSwitch('Student')}
              className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${
                scanTargetUI === 'Student' ? 'bg-primary-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Student
            </button>
            <button
              onClick={() => handleTargetSwitch('Faculty')}
              className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${
                scanTargetUI === 'Faculty' ? 'bg-primary-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Faculty
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-3xl bg-black shadow-2xl border border-slate-800">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />
            
            <div className={`relative z-10 h-56 w-72 border-2 ${phase === 'scanning' ? 'border-primary-400' : 'border-white/50'} transition-colors duration-300 pointer-events-none`}>
              <div className="absolute -left-1.5 -top-1.5 h-8 w-8 border-l-4 border-t-4 border-white"></div>
              <div className="absolute -right-1.5 -top-1.5 h-8 w-8 border-r-4 border-t-4 border-white"></div>
              <div className="absolute -bottom-1.5 -left-1.5 h-8 w-8 border-b-4 border-l-4 border-white"></div>
              <div className="absolute -bottom-1.5 -right-1.5 h-8 w-8 border-b-4 border-r-4 border-white"></div>
              
              {phase === 'scanning' && (
                <div className="absolute left-0 top-0 h-1.5 w-full animate-bounce bg-primary-400 shadow-[0_0_15px_rgba(59,130,246,0.8)]"></div>
              )}
            </div>

            {phase === 'scanning' && (
              <div className="absolute bottom-6 z-10 rounded-full bg-black/80 px-6 py-3 text-base font-bold tracking-wide text-white backdrop-blur-md">
                Scanning {scanTargetUI}s...
              </div>
            )}
          </div>

          <div className="mt-6">
            <button
              onClick={toggleScan}
              className={`flex w-full items-center justify-center gap-3 rounded-2xl py-5 text-xl font-bold text-white shadow-[0_8px_20px_rgba(37,99,235,0.4)] transition-all ${
                phase === 'scanning' ? 'bg-red-600 active:bg-red-700' : 'bg-blue-600 active:bg-blue-700'
              }`}
            >
              <Icon name={phase === 'scanning' ? 'x' : 'camera'} className="h-7 w-7" />
              {phase === 'scanning' ? 'Stop Scanning' : `Start Auto-Scan`}
            </button>
          </div>
        </div>
      )}

      {phase === 'result' && result && (
        <div className="flex flex-1 flex-col px-4 pb-4 animate-in fade-in zoom-in-95 duration-200 overflow-y-auto">
          
          <VerificationResultCard 
            result={result} 
            onFlagClick={() => setIsFlagModalOpen(true)} 
          />

          <button 
            onClick={handleReset} 
            className="mt-6 w-full rounded-2xl bg-white py-5 text-xl font-bold text-slate-900 shadow-xl active:bg-slate-200 transition-colors shrink-0"
          >
            Scan Next Vehicle
          </button>
        </div>
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