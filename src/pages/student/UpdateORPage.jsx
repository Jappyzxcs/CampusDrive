import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useToast } from '../../context/ToastContext';
import { ROUTES } from '../../constants/routes';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { TextField } from '../../components/forms/TextField';
import { Icon } from '../../components/common/Icon';
import Tesseract from 'tesseract.js';
import levenshtein from 'fast-levenshtein'; // THE FIX: Added fuzzy matching for the plate
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/* =========================================================================
   FURTHEST-DATE EXTRACTION & FUZZY CROSS-MATCH
   ========================================================================= */

const MONTH_MAP = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, JUNE: 6,
  JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12
};

function extractAllDates(rawText) {
  if (!rawText) return [];
  const found = [];
  // Clean structural noise
  const text = rawText.replace(/\|/g, ' ');

  const dateRegex = /(?:^|[^\d])(\d{1,2})[\s/.\-:I\\]+(\d{1,2})[\s/.\-:I\\]+(20\d{2}|19\d{2})(?=[^\d]|$)/g;
  let m;
  while ((m = dateRegex.exec(text)) !== null) {
    const p1 = parseInt(m[1], 10), p2 = parseInt(m[2], 10), year = parseInt(m[3], 10);
    let month = p1, day = p2;
    if (p1 > 12 && p2 <= 12) { month = p2; day = p1; }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      found.push({ year, month, day, formatted: `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` });
    }
  }

  const ymdRegex = /(?:^|[^\d])(20\d{2}|19\d{2})[\s/.\-:I\\]+(\d{1,2})[\s/.\-:I\\]+(\d{1,2})(?=[^\d]|$)/g;
  while ((m = ymdRegex.exec(text)) !== null) {
    const year = parseInt(m[1], 10), p1 = parseInt(m[2], 10), p2 = parseInt(m[3], 10);
    let month = p1, day = p2;
    if (p1 > 12 && p2 <= 12) { month = p2; day = p1; }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      found.push({ year, month, day, formatted: `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` });
    }
  }

  const textMonthRegex = /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{1,2})[,\s]+(20\d{2}|19\d{2})\b/gi;
  while ((m = textMonthRegex.exec(text)) !== null) {
    const month = MONTH_MAP[m[1].toUpperCase().slice(0, 3)];
    const day = parseInt(m[2], 10), year = parseInt(m[3], 10);
    if (month && day >= 1 && day <= 31) {
      found.push({ year, month, day, formatted: `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` });
    }
  }

  return found;
}

function extractOrExpiry(text) {
  const dates = extractAllDates(text);
  if (dates.length > 0) {
    dates.sort((a, b) => b.iso.localeCompare(a.iso));
    return { value: dates[0].formatted, confident: true };
  }
  return null;
}

function getExpiryStatus(str) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((str || '').trim());
  if (!m) return 'unreadable';
  const d = new Date(+m[3], +m[1] - 1, +m[2]); 
  if (d.getMonth() !== +m[1] - 1) return 'unreadable';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today ? 'expired' : 'valid';
}

const extractPdfTextLayer = async (pdfDoc) => {
  let text = '';
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    text += '\n' + content.items.map((it) => it.str).join(' ');
  }
  return text;
};

const renderFileToCanvas = async (file) => {
  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas;
  }
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  img.src = objectUrl;
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
  const scaleFactor = Math.max(1, 1500 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = img.width * scaleFactor;
  canvas.height = img.height * scaleFactor;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(objectUrl);
  return canvas;
};

const ultraCompressFile = async (file) => {
  if (!file) return null;
  try {
    const canvas = await renderFileToCanvas(file);
    const MAX_DIM = 800; 
    let { width, height } = canvas;
    if (width > height && width > MAX_DIM) { height = Math.round(height * (MAX_DIM / width)); width = MAX_DIM; } 
    else if (height > MAX_DIM) { width = Math.round(width * (MAX_DIM / height)); height = MAX_DIM; }
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = width; smallCanvas.height = height;
    const ctx = smallCanvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height); ctx.drawImage(canvas, 0, 0, width, height);
    return smallCanvas.toDataURL('image/jpeg', 0.5); 
  } catch (err) { return null; }
};

/* =========================================================================
   COMPONENT
   ========================================================================= */

export default function UpdateORPage() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [vehicle, setVehicle] = useState(null);
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState('idle'); 
  const [extractedExpiry, setExtractedExpiry] = useState('');
  
  useEffect(() => {
    async function loadVehicle() {
      try {
        const docSnap = await getDoc(doc(db, 'vehicles', vehicleId));
        if (docSnap.exists()) setVehicle(docSnap.data());
        else showToast('Vehicle not found.', { type: 'danger' });
      } catch (e) {
        showToast('Failed to load vehicle data.', { type: 'danger' });
      }
    }
    loadVehicle();
  }, [vehicleId, showToast]);

  async function handleExtract(e) {
    e.preventDefault();
    if (!file) return showToast('Please upload an OR document first.', { type: 'warning' });

    setPhase('extracting');
    try {
      let extractedText = '';

      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        extractedText = await extractPdfTextLayer(pdfDoc);
      }

      if (!extractedText || extractedText.trim().length < 50) {
        const canvas = await renderFileToCanvas(file);
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < imgData.data.length; i += 4) {
          const g = 0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2];
          imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = g;
        }
        ctx.putImageData(imgData, 0, 0);

        const { data } = await Tesseract.recognize(canvas.toDataURL('image/jpeg'), 'eng');
        extractedText += '\n' + data.text;
      }
      
      // THE FIX: Smart Fuzzy Plate Matching
      const vPlate = vehicle?.plateNumber || vehicle?.vehicleDetails?.plateNumber;
      if (vPlate) {
        const targetPlate = vPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const rawTextCleaned = extractedText.toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        let plateFound = rawTextCleaned.includes(targetPlate);
        
        if (!plateFound) {
          // Break into chunks and check if any word is a close match (e.g. 2240MG instead of 224DMG)
          const words = extractedText.toUpperCase().replace(/[^A-Z0-9]/g, ' ').split(/\s+/).filter(w => w.length >= 4);
          for (const word of words) {
            if (levenshtein.get(word, targetPlate) <= 2) {
              plateFound = true;
              break;
            }
          }
        }

        if (!plateFound) {
          showToast(`Security Alert: Plate number ${vPlate} was not found on this document.`, { type: 'danger' });
          setPhase('idle');
          return;
        }
      }

      const orExp = extractOrExpiry(extractedText);
      
      if (!orExp || !orExp.value) {
        showToast('AI could not detect a valid date. Please re-upload a clearer image.', { type: 'danger' });
        setPhase('idle');
        return;
      }

      setExtractedExpiry(orExp.value);
      setPhase('review');
      showToast('Extraction and Plate Verification complete.', { type: 'success' });
    } catch (error) {
      console.error(error);
      showToast('AI Extraction failed. Please re-upload a clearer image.', { type: 'danger' });
      setPhase('idle');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    const status = getExpiryStatus(extractedExpiry);
    if (status === 'expired') return showToast('This Official Receipt is expired.', { type: 'danger' });
    if (status === 'unreadable') return showToast('The AI extracted an invalid date format. Please re-upload.', { type: 'danger' });

    setPhase('submitting');
    try {
      const compressedUrl = await ultraCompressFile(file);
      
      await updateDoc(doc(db, 'vehicles', vehicleId), {
        'documentUrls.or': compressedUrl,
        'nlpExtractedData.orExpiry': extractedExpiry,
        'orExpiry': extractedExpiry 
      });

      const approvedRef = doc(db, 'approved_vehicles', vehicleId);
      const approvedSnap = await getDoc(approvedRef);
      
      if (approvedSnap.exists()) {
        await updateDoc(approvedRef, {
          dateIssued: new Date().toISOString(), 
          accreditationStatus: 'Active',
          orExpiry: extractedExpiry 
        });
      }

      showToast('Official Receipt updated successfully!', { type: 'success' });
      navigate(ROUTES.STUDENT_DASHBOARD); 
    } catch (error) {
      console.error(error);
      showToast('Failed to save update to database.', { type: 'danger' });
      setPhase('review');
    }
  }

  if (!vehicle) return <div className="p-8 text-center text-slate-500">Loading vehicle data...</div>;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 pb-12">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Renew Official Receipt</h2>
        <p className="text-sm text-slate-500">Update the OR for plate <span className="font-bold text-slate-800">{vehicle.plateNumber || vehicle.vehicleDetails?.plateNumber}</span></p>
      </div>

      <DashboardCard>
        {phase === 'idle' || phase === 'extracting' ? (
          <form onSubmit={handleExtract} className="flex flex-col gap-5">
            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm border border-blue-100">
              Upload your newest LTO Official Receipt. The AI will cross-check the plate number against your vehicle and verify the new expiration date automatically. Manual editing is disabled.
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Upload New OR (Image or PDF)</label>
              <input 
                type="file" 
                accept="image/*,.pdf" 
                onChange={(e) => setFile(e.target.files[0])}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
            </div>

            <button 
              type="submit" 
              disabled={!file || phase === 'extracting'} 
              className="btn-primary mt-2 flex justify-center items-center gap-2"
            >
              {phase === 'extracting' ? (
                <>
                  <Icon name="scan" className="animate-pulse" /> Extracting Date...
                </>
              ) : (
                'Extract Date with AI'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 animate-in fade-in duration-300">
            <div className="rounded-lg bg-primary-50 p-5 border border-primary-100">
              <h3 className="text-sm font-bold text-primary-900 mb-2">Extracted Data (Locked)</h3>
              <p className="text-xs text-primary-700 mb-4">Make sure the date matches the receipt exactly. If the AI misread it, please click Re-upload and use a clearer image.</p>
              
              <TextField 
                id="orExpiry" 
                label="New OR Expiry Date (MM/DD/YYYY)" 
                value={extractedExpiry} 
                onChange={() => {}} 
                disabled={true} 
                error={getExpiryStatus(extractedExpiry) === 'expired' ? 'This date is in the past.' : null}
              />
            </div>

            <div className="flex justify-between gap-3">
              <button type="button" onClick={() => setPhase('idle')} className="btn-secondary" disabled={phase === 'submitting'}>
                Re-upload Image
              </button>
              <button type="submit" className="btn-primary" disabled={phase === 'submitting' || getExpiryStatus(extractedExpiry) === 'expired'}>
                {phase === 'submitting' ? 'Saving Update...' : 'Confirm & Renew'}
              </button>
            </div>
          </form>
        )}
      </DashboardCard>
    </div>
  );
}