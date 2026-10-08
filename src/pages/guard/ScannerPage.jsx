import { useState, useEffect, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { Icon } from '../../components/common/Icon';
import { createWorker } from 'tesseract.js';
import levenshtein from 'fast-levenshtein';
import { collection, onSnapshot, addDoc } from 'firebase/firestore'; 
import { db } from '../../config/firebase'; 
import { aiService } from '../../services/aiService';
import { useAuth } from '../../context/AuthContext';

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
      
      // Real-time Expiration Check
      const today = new Date();
      today.setHours(0, 0, 0, 0); 
      
      let isOrExpired = false;
      let isLicenseExpired = false;
      
      if (matchedVehicle) {
        if (matchedVehicle.orExpiry) {
          const orDate = new Date(matchedVehicle.orExpiry);
          if (orDate < today) isOrExpired = true;
        }
        if (matchedVehicle.licenseExpiry) {
          const licDate = new Date(matchedVehicle.licenseExpiry);
          if (licDate < today) isLicenseExpired = true;
        }
      }
      
      if (!matchedVehicle) {
        finalResult = { 
          id: null,
          status: 'unregistered', 
          plateNumber: 'UNKNOWN', 
          owner: 'N/A', 
          make: 'N/A', 
          serial: cleanedText, 
          alert: `No ${currentTarget} record found for this sticker.` 
        };
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
          alert: 'Access Denied: Sticker Revoked' 
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
          // THE FIX: Pass dates even on expired so the Guard sees exactly when it expired
          orExpiry: matchedVehicle.orExpiry || null,
          licenseExpiry: matchedVehicle.licenseExpiry || null,
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
          // THE FIX: Pass dates to valid results to display on screen
          orExpiry: matchedVehicle.orExpiry || null,
          licenseExpiry: matchedVehicle.licenseExpiry || null,
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

  // Quick helper to format dates purely for the UI
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return 'Not Provided';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

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
          <div className={`flex flex-1 flex-col items-center justify-center rounded-[2rem] p-6 text-center shadow-2xl border-4 ${
            result.status === 'valid' ? 'bg-emerald-600 border-emerald-400' : 'bg-red-600 border-red-400'
          }`}>
            
            <div className={`mb-5 flex h-24 w-24 items-center justify-center rounded-full shadow-xl ${
              result.status === 'valid' ? 'bg-emerald-500' : 'bg-red-700'
            }`}>
              <Icon 
                name={result.status === 'valid' ? 'check' : 'alert'} 
                className="h-12 w-12 !text-white" 
              />
            </div>
            
            <h1 className="mb-2 text-5xl font-black uppercase tracking-tight !text-white drop-shadow-md">
              {result.status === 'valid' ? 'ACTIVE' : result.status === 'revoked' ? 'REVOKED' : 'INVALID'}
            </h1>
            
            <p className="mb-8 text-xl font-bold !text-white/95 drop-shadow-sm">
              {result.status === 'valid' ? 'Allow Entry' : result.alert}
            </p>

           <div className="w-full rounded-2xl bg-white p-5 text-left shadow-xl">
              <ResultRow label="Plate Number" value={result.plateNumber} highlight status={result.status} />
              <ResultRow label="Sticker Serial" value={result.serial} />
              <ResultRow label="Owner" value={result.owner} />
              <ResultRow label="Vehicle" value={result.make} />
              
              {result.status === 'revoked' && result.revokeReason && (
                <div className="mt-4 rounded-xl bg-red-50 p-4 border border-red-200 flex flex-col mb-2 shadow-sm">
                  <span className="text-xs font-bold text-red-500 uppercase tracking-wide mb-1">Reason for Revocation</span>
                  {result.revokeReason.includes('. Last violation:') ? (
                    <>
                      <span className="text-lg font-bold text-red-800 leading-tight">Automatically revoked (3 strikes)</span>
                      <span className="text-sm font-medium text-red-700 mt-1">
                        <span className="font-bold">Last violation:</span> {result.revokeReason.split('. Last violation:')[1]?.trim()}
                      </span>
                    </>
                  ) : (
                    <span className="text-lg font-bold text-red-800 leading-tight">{result.revokeReason}</span>
                  )}
                </div>
              )}
              
              {(result.dateIssued && result.validUntil) && (
                <ResultRow 
                  label="Sticker Validity" 
                  value={`${formatDisplayDate(result.dateIssued)} → ${formatDisplayDate(result.validUntil)}`} 
                />
              )}

              {/* THE FIX: Added OR and License fields directly below the Sticker Validity */}
              {(result.orExpiry || result.licenseExpiry) && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="mb-2 flex items-center gap-2">
                    <Icon name="file-text" className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Document Expirations</span>
                  </div>
                  <ResultRow 
                    label="OR Expiry" 
                    value={formatDisplayDate(result.orExpiry)} 
                  />
                  <ResultRow 
                    label="License Expiry" 
                    value={formatDisplayDate(result.licenseExpiry)} 
                  />
                </div>
              )}

              {result.vehicleImage && (
                <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Registered Vehicle Proof</span>
                  <img 
                    src={result.vehicleImage} 
                    alt="Vehicle Proof" 
                    className="h-36 w-full rounded-xl object-cover border border-slate-300 shadow-inner"
                  />
                </div>
              )}
            </div>

          </div>

          <button 
            onClick={handleReset} 
            className="mt-6 w-full rounded-2xl bg-white py-5 text-xl font-bold text-slate-900 shadow-xl active:bg-slate-200 transition-colors shrink-0"
          >
            Scan Next Vehicle
          </button>
        </div>
      )}
    </div>
  );
}

function ResultRow({ label, value, highlight, status }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 py-3.5 last:border-0">
      <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">{label}</span>
      <span className={`text-base font-bold text-slate-900 ${
        highlight ? `text-2xl tracking-wide \${status === 'valid' ? '!text-emerald-700' : '!text-red-700'}` : ''
      }`}>
        {value}
      </span>
    </div>
  );
}