import { useState, useEffect, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { Icon } from '../../components/common/Icon';
import Tesseract from 'tesseract.js';
import levenshtein from 'fast-levenshtein';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase'; 
import { aiService } from '../../services/aiService'; // THE FIX: Imported Roboflow

export default function ScannerPage() {
  const { showToast } = useToast();
  const [phase, setPhase] = useState('idle'); 
  const [result, setResult] = useState(null);
  
  const videoRef = useRef(null);
  const isScanningRef = useRef(false);

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
      isScanningRef.current = false; // Kill loop on unmount
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [phase, showToast]);

  const cleanOCRText = (rawText) => {
    // 1. Remove all spaces and make uppercase so "LB 0061" becomes "LB0061"
    let text = rawText.toUpperCase().replace(/\s+/g, '');

    // 2. Fix the known hallucination where Tesseract sees "B" as "8"
    text = text.replace(/L8/g, 'LB');

    // 3. The Strict Pattern Hunter
    // This looks for EXACTLY 2 letters followed by EXACTLY 4 characters that are numbers
    // (We also include O, I, Z, and S because blurry OCR often confuses 0, 1, 2, and 5)
    const regex = /([A-Z]{2})([0-9OIZS]{4})/;
    const match = text.match(regex);

    if (match) {
      const letters = match[1]; // e.g., "LB"
      
      // Auto-correct common blurry number hallucinations back into pure digits
      const digits = match[2]
        .replace(/O/g, '0')
        .replace(/I/g, '1')
        .replace(/Z/g, '2')
        .replace(/S/g, '5');

      return letters + digits; // Returns perfect "LB0061"
    }

    // 4. THE MAGIC BULLET: If it doesn't find the exact pattern, return null.
    // This forces the scanner to ignore the noise (like "VEHICLEPASS") and keep looping!
    return null; 
  };
  const processFrame = async () => {
    // 1. Are we supposed to be scanning?
    if (!isScanningRef.current || !videoRef.current) return;

    const video = videoRef.current;
    
    // DEBUG: See if the loop is running at all
    console.log(`📹 Camera Check -> Width: ${video.videoWidth}, State: ${video.readyState}`);

    // THE FIX: Relaxed the check. Just make sure the video has width!
    if (video.videoWidth === 0) {
      setTimeout(processFrame, 500);
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

      console.log("📷 Snapped photo. Sending to Roboflow...");

      const aiResult = await aiService.verifySticker(base64Frame);

      console.log("🤖 Roboflow Response:", aiResult);

      if (!aiResult.success || !aiResult.isDetected) {
        setTimeout(processFrame, 800);
        return;
      }

      console.log("✅ STICKER DETECTED! Running OCR...");

      const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
      const cleanedText = cleanOCRText(text);
      console.log("📝 OCR Read:", cleanedText);

      if (!cleanedText || cleanedText.length < 4) {
        console.log("⚠️ OCR Text too short or blurry. Retrying...");
        setTimeout(processFrame, 1000);
        return;
      }

      const querySnapshot = await getDocs(collection(db, 'approved_vehicles'));
      const vehicles = querySnapshot.docs.map(doc => doc.data());

      const matchedVehicle = vehicles.find(v => {
        if (!v.stickerSerial) return false;
        return levenshtein.get(cleanedText, v.stickerSerial.toUpperCase()) <= 2;
      });

      let finalResult;
      
      if (!matchedVehicle) {
        finalResult = { 
          status: 'unregistered', 
          plateNumber: 'UNKNOWN', 
          owner: 'N/A', 
          make: 'N/A', 
          serial: cleanedText, 
          alert: 'No record found in the database.' 
        };
      } else if (matchedVehicle.accreditationStatus === 'Expired') {
        finalResult = { 
          status: 'expired', 
          plateNumber: matchedVehicle.plateNumber || 'N/A', 
          owner: matchedVehicle.ownerName || 'Unknown', 
          make: matchedVehicle.vehicleMake || 'N/A', 
          serial: matchedVehicle.stickerSerial, 
          alert: 'Institutional accreditation expired.' 
        };
      } else {
        // Calculate expiration (1 year from issue date)
        const issued = matchedVehicle.dateIssued || null;
        let valid = null;
        if (issued) {
          const d = new Date(issued);
          d.setFullYear(d.getFullYear() + 1);
          valid = d.toISOString();
        }

        finalResult = { 
          status: 'valid', 
          plateNumber: matchedVehicle.plateNumber || 'N/A', 
          owner: matchedVehicle.ownerName || 'Authorized User', 
          make: matchedVehicle.vehicleMake || matchedVehicle.make || 'N/A', 
          serial: matchedVehicle.stickerSerial, 
          vehicleImage: matchedVehicle.vehicleImageUrl || matchedVehicle.imageUrl || matchedVehicle.photoUrl || null, 
          dateIssued: issued, // NEW
          validUntil: valid,  // NEW
          alert: 'Vehicle Authorized.' 
        };
      }

      isScanningRef.current = false;
      setResult(finalResult);
      setPhase('result');
      
      if (finalResult.status !== 'valid') {
        showToast('Flagged result — review before allowing entry.', { type: 'danger' });
      }

    } catch (error) {
      console.error("Verification Error:", error);
      setTimeout(processFrame, 1500);
    }
  };

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
                Scanning... Please hold still.
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
              {phase === 'scanning' ? 'Stop Scanning' : 'Start Auto-Scan'}
            </button>
          </div>
        </div>
      )}

      {phase === 'result' && result && (
        <div className="flex flex-1 flex-col px-4 pb-4 animate-in fade-in zoom-in-95 duration-200">
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
              {result.status === 'valid' ? 'Valid' : 'Invalid'}
            </h1>
            
            <p className="mb-8 text-xl font-bold !text-white/95 drop-shadow-sm">
              {result.status === 'valid' ? 'Allow Entry' : result.alert}
            </p>

           <div className="w-full rounded-2xl bg-white p-5 text-left shadow-xl">
              <ResultRow label="Plate Number" value={result.plateNumber} highlight status={result.status} />
              <ResultRow label="Sticker Serial" value={result.serial} />
              <ResultRow label="Owner" value={result.owner} />
              <ResultRow label="Vehicle" value={result.make} />
              
             {/* COMBINED: Validity Period (Short Numeric Format) */}
              {(result.dateIssued && result.validUntil) && (
                <ResultRow 
                  label="Validity" 
                  value={`${new Date(result.dateIssued).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })} → ${new Date(result.validUntil).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}`} 
                />
              )}

              {/* Vehicle Registration Photo Proof Preview */}
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
            className="mt-6 w-full rounded-2xl bg-white py-5 text-xl font-bold text-slate-900 shadow-xl active:bg-slate-200 transition-colors"
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
        highlight ? `text-2xl tracking-wide ${status === 'valid' ? '!text-emerald-700' : '!text-red-700'}` : ''
      }`}>
        {value}
      </span>
    </div>
  );
}