import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { TextField } from '../../components/forms/TextField';
import { SelectField } from '../../components/forms/SelectField';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { useToast } from '../../context/ToastContext';
import { ROUTES } from '../../constants/routes';
import { applicationService, compressImageToBase64 } from '../../services/applicationService';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'; 

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/* =========================================================================
   NLP & PREPROCESSING HELPERS
   ========================================================================= */

function cleanText(raw) {
  return raw
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\r\t]+/g, ' ')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function normalizeName(raw) {
  if (!raw) return '';
  return raw
    .toUpperCase()
    .replace(/[^A-Z\- ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

function namesMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const ta = na.split(' ').filter(Boolean);
  const tb = nb.split(' ').filter(Boolean);
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const shorterSet = new Set(shorter);
  const longerSet = new Set(longer);

  const missingCoreTokens = shorter.filter((t) => t.length >= 3 && !longerSet.has(t));
  if (missingCoreTokens.length > 0) return false;

  const unexplainedExtraTokens = longer.filter((t) => !shorterSet.has(t) && t.length > 2);
  return unexplainedExtraTokens.length === 0;
}

const MONTH_MAP = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, JUNE: 6,
  JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12
};

function extractAllDates(text) {
  if (!text) return [];
  const found = [];

  const textMonthRegex = /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{1,2})[,\s]+(20\d{2}|19\d{2})\b/gi;
  let tm;
  while ((tm = textMonthRegex.exec(text)) !== null) {
    const month = MONTH_MAP[tm[1].toUpperCase().slice(0, 3)];
    const day = parseInt(tm[2], 10);
    const year = parseInt(tm[3], 10);
    if (month && day >= 1 && day <= 31) {
      found.push({
        year, month, day,
        formatted: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
        iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      });
    }
  }

  const ymdRegex = /(?:^|[^\d])(20\d{2}|19\d{2})[\s/.\-:|Il\\]+(\d{1,2})[\s/.\-:|Il\\]+(\d{1,2})(?=[^\d]|$)/g;
  let m;
  while ((m = ymdRegex.exec(text)) !== null) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      found.push({
        year, month, day,
        formatted: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
        iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      });
    }
  }

  const dmyRegex = /(?:^|[^\d])(\d{1,2})[\s/.\-:|Il\\]+(\d{1,2})[\s/.\-:|Il\\]+(20\d{2}|19\d{2})(?=[^\d]|$)/g;
  while ((m = dmyRegex.exec(text)) !== null) {
    const p1 = parseInt(m[1], 10);
    const p2 = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    let day = p1, month = p2;
    if (p1 <= 12 && p2 > 12) { 
      month = p1;
      day = p2;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      found.push({
        year, month, day,
        formatted: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
        iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      });
    }
  }
  return found;
}

function cleanExtractedName(rawName) {
  if (!rawName) return null;
  let cleaned = rawName.split(/\s{2,}/)[0];
  cleaned = cleaned.replace(/\s+[a-z].*$/, '');
  cleaned = cleaned.replace(/[^A-Z]+$/, '');
  cleaned = cleaned.replace(/\s+[A-Z]$/, '');
  return cleaned.trim();
}

function extractLicenseName(text) {
  const label = text.match(/Last\s*Name[,.]?\s*First\s*Name[,.]?\s*Middle\s*Name/i);
  if (!label) return null;
  const windowText = text.slice(label.index + label[0].length, label.index + label[0].length + 150);
  const m = windowText.match(/([A-Z][A-Z\-. ]+,\s*[A-Z][A-Z\-. ]+)/);
  return m ? cleanExtractedName(m[1]) : null;
}

function extractCrName(text) {
  const label = text.match(/COMPLETE\s*OWN[HE]RS?\s*NAME/i);
  if (!label) return null;
  const windowText = text.slice(label.index + label[0].length, label.index + label[0].length + 150);
  const m = windowText.match(/[:\n]\s*([A-Z][^\n]*)/);
  return m ? cleanExtractedName(m[1]) : null;
}

function extractOrName(text) {
  const label = text.match(/RECEIVED\s*FROM/i);
  if (!label) return null;
  const windowText = text.slice(label.index + label[0].length, label.index + label[0].length + 150);
  const m = windowText.match(/([A-Z][A-Z\- ]+,\s*[A-Z][A-Z\- ]+)/);
  return m ? cleanExtractedName(m[1]) : null;
}

function extractColor(text) {
  const m = text.match(/Color[:.\s]*([A-Z/]+)/i);
  return m ? m[1].trim() : null;
}

function extractLicenseExpiry(text) {
  if (!text) return null;
  const labelBlock = text.match(/(?:Expiration|Expiry|Expires)[\s\S]{0,120}?(?:\d{4}[\s/.\-:|Il\\]+\d{1,2}[\s/.\-:|Il\\]+\d{1,2}|\d{8})/i);
  if (labelBlock) {
    const dates = extractAllDates(labelBlock[0]);
    if (dates.length > 0) return dates[0].formatted;
  }
  const allDates = extractAllDates(text);
  if (!allDates.length) return null;
  allDates.sort((a, b) => a.iso.localeCompare(b.iso));
  return allDates[allDates.length - 1].formatted;
}

function extractOrExpiry(text) {
  if (!text) return null;
  const rangeMatch = text.match(/(?:to|until)\s+([A-Z]{3,9}\s+\d{1,2}[,\s]+\d{4}|\d{1,2}[\s/.\-:|Il\\]+\d{1,2}[\s/.\-:|Il\\]+\d{4})/i);
  if (rangeMatch) {
    const dates = extractAllDates(rangeMatch[0]);
    if (dates.length > 0) return dates[0].formatted;
  }
  const m = text.match(/(?:valid\s*until|renewal\s*on|next\s*reg)[\s\S]{0,60}?([A-Z]{3,9}\s+\d{1,2}[,\s]+\d{4}|\d{1,2}[\s/.\-:|Il\\]+\d{1,2}[\s/.\-:|Il\\]+\d{4}|\d{4}[\s/.\-:|Il\\]+\d{1,2}[\s/.\-:|Il\\]+\d{1,2})/i);
  if (m) {
    const dates = extractAllDates(m[0]);
    if (dates.length > 0) return dates[0].formatted;
  }
  const dates = extractAllDates(text);
  if (dates.length > 0) {
    dates.sort((a, b) => a.iso.localeCompare(b.iso));
    return dates[dates.length - 1].formatted;
  }
  return null;
}

/* =========================================================================
   COMPUTER VISION PROCESSORS
   ========================================================================= */

const grayscaleCanvas = (source) => {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;

  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (g < min) min = g;
    if (g > max) max = g;
  }

  const range = max - min || 1;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const stretched = Math.min(255, Math.max(0, ((g - min) / range) * 255));
    d[i] = d[i + 1] = d[i + 2] = stretched;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
};

const computeOtsuThreshold = (grayValues) => {
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < grayValues.length; i++) histogram[grayValues[i]]++;

  const total = grayValues.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumB = 0, wB = 0, varMax = 0, threshold = 135;
  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }
  return Math.min(200, Math.max(60, threshold));
};

const binarizeCanvas = (source) => {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;

  const grayValues = new Uint8ClampedArray(d.length / 4);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    grayValues[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  const threshold = computeOtsuThreshold(grayValues);

  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const color = grayValues[j] > threshold ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = color;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
};

const TESS_PSM = { AUTO: '3', SPARSE_TEXT: '11' };

const ocrBothPasses = async (sourceCanvas, psm = TESS_PSM.AUTO) => {
  const [gray, binarized] = [grayscaleCanvas(sourceCanvas), binarizeCanvas(sourceCanvas)];
  const options = { tessedit_pageseg_mode: psm };
  const [r1, r2] = await Promise.all([
    Tesseract.recognize(gray.toDataURL('image/png'), 'eng', options),
    Tesseract.recognize(binarized.toDataURL('image/png'), 'eng', options),
  ]);
  return `${r1.data.text}\n${r2.data.text}`;
};

const ocrAlnumPass = async (sourceCanvas, psm = TESS_PSM.SPARSE_TEXT) => {
  const binarized = binarizeCanvas(sourceCanvas);
  const result = await Tesseract.recognize(binarized.toDataURL('image/png'), 'eng', {
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/:,.',
    tessedit_pageseg_mode: psm,
  });
  return result.data.text;
};

const extractPdfTextLayer = async (pdfDoc) => {
  let text = '';
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    text += '\n' + content.items.map((it) => it.str).join(' ');
  }
  return text;
};

const pdfHasEmbeddedImage = async (pdfDoc) => {
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const opList = await page.getOperatorList();
    const hasImage = opList.fnArray.some((fn) =>
      fn === pdfjsLib.OPS.paintImageXObject ||
      fn === pdfjsLib.OPS.paintImageXObjectRepeat ||
      fn === pdfjsLib.OPS.paintJpegXObject
    );
    if (hasImage) return true;
  }
  return false;
};

/* =========================================================================
   CROP / ROTATE / AUTO-DETECT HELPERS
   ========================================================================= */

const rotateCanvas = (source, degrees) => {
  const canvas = document.createElement('canvas');
  if (!degrees) {
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext('2d').drawImage(source, 0, 0);
    return canvas;
  }
  const radians = (degrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const newWidth = Math.round(source.width * cos + source.height * sin);
  const newHeight = Math.round(source.width * sin + source.height * cos);

  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, newWidth, newHeight);
  ctx.translate(newWidth / 2, newHeight / 2);
  ctx.rotate(radians);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
};

const cropCanvas = (source, rect) => {
  const x = Math.max(0, Math.round(rect.x));
  const y = Math.max(0, Math.round(rect.y));
  const w = Math.max(1, Math.min(Math.round(rect.width), source.width - x));
  const h = Math.max(1, Math.min(Math.round(rect.height), source.height - y));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(source, x, y, w, h, 0, 0, w, h);
  return canvas;
};

const autoDetectCardBounds = (canvas) => {
  const maxDim = 300;
  const scale = Math.min(1, maxDim / Math.max(canvas.width, canvas.height));
  const w = Math.max(2, Math.round(canvas.width * scale));
  const h = Math.max(2, Math.round(canvas.height * scale));

  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const sctx = small.getContext('2d');
  sctx.drawImage(canvas, 0, 0, w, h);
  const { data } = sctx.getImageData(0, 0, w, h);

  const gray = new Float32Array(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const edge = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx = gray[idx + 1] - gray[idx - 1];
      const gy = gray[idx + w] - gray[idx - w];
      edge[idx] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  const rowSum = new Float32Array(h);
  const colSum = new Float32Array(w);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) s += edge[y * w + x];
    rowSum[y] = s;
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = 0; y < h; y++) s += edge[y * w + x];
    colSum[x] = s;
  }

  const boundsFromProjection = (arr, fullLength) => {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const threshold = mean * 0.6;
    let start = 0, end = fullLength - 1;
    for (let i = 0; i < arr.length; i++) { if (arr[i] > threshold) { start = i; break; } }
    for (let i = arr.length - 1; i >= 0; i--) { if (arr[i] > threshold) { end = i; break; } }
    return [start, end];
  };

  const [top, bottom] = boundsFromProjection(rowSum, h);
  const [left, right] = boundsFromProjection(colSum, w);

  const marginX = Math.max(2, (right - left) * 0.03);
  const marginY = Math.max(2, (bottom - top) * 0.03);
  const x0 = Math.max(0, left - marginX);
  const y0 = Math.max(0, top - marginY);
  const x1 = Math.min(w, right + marginX);
  const y1 = Math.min(h, bottom + marginY);

  const inv = 1 / scale;
  return {
    x: x0 * inv,
    y: y0 * inv,
    width: Math.max(1, (x1 - x0) * inv),
    height: Math.max(1, (y1 - y0) * inv),
  };
};

const ocrPdf = async (pdfDoc) => {
  let text = '';
  let alnumText = '';
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 3.2 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;

    const [normal, alnum] = await Promise.all([ocrBothPasses(canvas), ocrAlnumPass(canvas)]);
    text += '\n' + normal;
    alnumText += '\n' + alnum;
  }
  return { text, alnumText };
};

const renderFileToCanvas = async (file) => {
  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 3.2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas;
  }

  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  img.src = objectUrl;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  const scaleFactor = Math.max(1, 2000 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = img.width * scaleFactor;
  canvas.height = img.height * scaleFactor;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(objectUrl);
  return canvas;
};

const processFile = async (file) => {
  if (!file) return { text: '', alnumText: '' };
  
  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const layerText = cleanText(await extractPdfTextLayer(pdfDoc));
    const hasEmbeddedImage = await pdfHasEmbeddedImage(pdfDoc);

    if (layerText.length > 120 && !hasEmbeddedImage) {
      return { text: layerText, alnumText: '' };
    }
    const { text: ocrText, alnumText } = await ocrPdf(pdfDoc);
    const combinedText = cleanText(`${layerText}\n${ocrText}`);
    return { text: combinedText, alnumText: cleanText(alnumText) };
  }

  const canvas = document.createElement('canvas');
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  
  const scaleFactor = Math.max(1, 2000 / Math.max(img.width, img.height));
  canvas.width = img.width * scaleFactor;
  canvas.height = img.height * scaleFactor;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const [text, alnumText] = await Promise.all([ocrBothPasses(canvas), ocrAlnumPass(canvas)]);
  return { text: cleanText(text), alnumText: cleanText(alnumText) };
};

/* =========================================================================
   COMPONENT
   ========================================================================= */

const REGISTRANT_TYPES = [
  { value: 'Student', label: 'Student' },
  { value: 'Faculty', label: 'Faculty' },
];

const VEHICLE_TYPES = [
  { value: 'Motorcycle', label: 'Motorcycle' },
  { value: 'Car', label: 'Car' },
  { value: 'Other', label: 'Other' },
];

export default function VehicleRegistrationPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth(); 
  
  const [currentStep, setCurrentStep] = useState(1);
  const defaultRegistrantType = user?.role === 'faculty' ? 'Faculty' : 'Student';
  
  const [form, setForm] = useState({
    lastName: '', firstName: '', middleName: '', contactNo: '', address: '', municipality: '',
    registrantType: defaultRegistrantType, vehicleType: '', yearAndSection: '', 
    employeeId: '', companyId: '', studentId: '', plateNumber: ''
  });
  
  const [vehiclePhotos, setVehiclePhotos] = useState([]);
  const [docs, setDocs] = useState({
    license: null, or: null, cr: null, authLetter: null, deedOfSale: null, companyCert: null
  });

  const [extractedData, setExtractedData] = useState({
    licenseName: '', crName: '', color: '', licenseExpiry: '', orExpiry: ''
  });
  const [nameMatchResult, setNameMatchResult] = useState(true);

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cropTarget, setCropTarget] = useState(null);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: null }));
  }

  function updateExtracted(key, value) {
    setExtractedData((f) => ({ ...f, [key]: value }));
  }

  function handlePhotoSelect(e) {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setVehiclePhotos((prev) => [...prev, ...newFiles]);
      if (errors.vehiclePhotos) setErrors((err) => ({ ...err, vehiclePhotos: null }));
    }
  }

  function removePhoto(indexToRemove) {
    setVehiclePhotos((prev) => prev.filter((_, index) => index !== indexToRemove));
  }

  const OCR_DOC_KEYS = ['license', 'or', 'cr'];

  async function handleDocSelect(key, file) {
    if (!file) return;
    if (errors[key]) setErrors((err) => ({ ...err, [key]: null }));

    if (OCR_DOC_KEYS.includes(key)) {
      try {
        const canvas = await renderFileToCanvas(file);
        setCropTarget({ key, sourceCanvas: canvas, originalFile: file });
      } catch (err) {
        setDocs((prev) => ({ ...prev, [key]: file }));
      }
      return;
    }

    setDocs((prev) => ({ ...prev, [key]: file }));
  }

  function handleCropConfirm(croppedCanvas) {
    if (!cropTarget) return;
    const { key, originalFile } = cropTarget;
    croppedCanvas.toBlob((blob) => {
      if (!blob) {
        setDocs((prev) => ({ ...prev, [key]: originalFile }));
        setCropTarget(null);
        return;
      }
      const baseName = originalFile.name.replace(/\.[^.]+$/, '');
      const croppedFile = new File([blob], `${baseName}_cropped.png`, { type: 'image/png' });
      setDocs((prev) => ({ ...prev, [key]: croppedFile }));
      setCropTarget(null);
    }, 'image/png');
  }

  function handleCropCancel() {
    setCropTarget(null);
  }

  function validateStep1() {
    const next = {};
    if (!form.lastName.trim()) next.lastName = 'Required';
    if (!form.firstName.trim()) next.firstName = 'Required';
    if (!form.contactNo.trim()) next.contactNo = 'Required';
    if (!form.address.trim()) next.address = 'Required';
    if (!form.municipality.trim()) next.municipality = 'Required';
    if (!form.registrantType) next.registrantType = 'Required';
    if (!form.vehicleType) next.vehicleType = 'Required';
    if (!form.plateNumber.trim()) next.plateNumber = 'Required';

    if (form.registrantType === 'Student') {
      if (!form.studentId.trim()) next.studentId = 'Required';
      if (!form.yearAndSection.trim()) next.yearAndSection = 'Required';
    } else if (form.registrantType === 'Faculty') {
      if (!form.employeeId.trim()) next.employeeId = 'Required';
      if (!form.companyId.trim()) next.companyId = 'Required'; 
    }

    if (vehiclePhotos.length < 1) {
      next.vehiclePhotos = 'Please upload at least 1 photo of the vehicle.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateStep2() {
    const next = {};
    if (!docs.license) next.license = 'Driver\'s License is required.';
    if (!docs.or) next.or = 'Official Receipt is required.';
    if (!docs.cr) next.cr = 'Certificate of Registration is required.';
    
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleNextStep1(event) {
    event.preventDefault();
    if (validateStep1()) {
      setCurrentStep(2);
      window.scrollTo(0, 0);
    }
  }

  async function handleNextStep2(event) {
    event.preventDefault();
    if (!validateStep2()) return;

    setIsSubmitting(true);
    showToast('Starting AI extraction. This may take a few moments...', { type: 'info' });

    try {
      const [licenseRes, crRes, orRes] = await Promise.all([
        processFile(docs.license),
        processFile(docs.cr),
        processFile(docs.or)
      ]);

      const licenseText = `${licenseRes.text}\n${licenseRes.alnumText}`;
      const crText = `${crRes.text}\n${crRes.alnumText}`;
      const orText = `${orRes.text}\n${orRes.alnumText}`;

      const licenseName = extractLicenseName(licenseText) || '';
      const rawCrName = extractCrName(crText) || '';
      const orName = extractOrName(orText) || '';
      const color = extractColor(orText) || '';
      const licenseExpiry = extractLicenseExpiry(licenseText) || '';
      const orExpiry = extractOrExpiry(orText) || '';

      const bestCrName = (orName.length > rawCrName.length) ? orName : rawCrName;
      const isMatch = namesMatch(licenseName, bestCrName);

      setExtractedData({
        licenseName,
        crName: bestCrName,
        color,
        licenseExpiry,
        orExpiry
      });
      setNameMatchResult(isMatch);
      
      setCurrentStep(3);
      window.scrollTo(0, 0);
      showToast('Documents processed! Please review extracted data.', { type: 'success' });

    } catch (error) {
      console.error('OCR Extraction failed:', error);
      showToast(`Failed: ${error.message || 'Unknown error. Check console.'}`, { type: 'danger' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitFinal(event) {
    event.preventDefault();
    
    // Check if the AI extracted name matches their actual LSPU account name
    const accountName = user?.fullName || user?.name || '';
    const matchesAccountName = namesMatch(accountName, extractedData.licenseName) || namesMatch(accountName, extractedData.crName);
    
    // THE FIX: Included Company Certificate as a valid override document
    if (!matchesAccountName && !docs.authLetter && !docs.deedOfSale && !docs.companyCert) {
      showToast('Document names do not match your account name. You MUST upload an Authorization Letter, Deed of Sale, or Company Certificate below.', { type: 'danger' });
      return; 
    }

    setIsSubmitting(true);
    showToast('Processing documents... Please wait.', { type: 'info' });
    
    try {
      // Compress documents to lightweight Base64 strings (No Blaze plan needed!)
      const [licenseUrl, orUrl, crUrl, authLetterUrl, deedOfSaleUrl, companyCertUrl] = await Promise.all([
        compressImageToBase64(docs.license),
        compressImageToBase64(docs.or),
        compressImageToBase64(docs.cr),
        compressImageToBase64(docs.authLetter),
        compressImageToBase64(docs.deedOfSale),
        compressImageToBase64(docs.companyCert),
      ]);

      const documentUrls = {
        license: licenseUrl,
        or: orUrl,
        cr: crUrl,
        authLetter: authLetterUrl,
        deedOfSale: deedOfSaleUrl,
        companyCert: companyCertUrl,
      };

      const applicationData = {
        applicantName: `${form.firstName} ${form.lastName}`.trim(),
        type: form.registrantType === 'Student' ? 'New Registration - Student' : 'New Registration - Faculty',
        submittedDate: new Date().toISOString().split('T')[0], 
        status: 'pending',
        vehicleDetails: form,
        nlpExtractedData: extractedData,
        nlpNamesMatched: nameMatchResult,
        userId: user?.uid || user?.id || 'anonymous',
        documentUrls: documentUrls // Stored directly in Firestore!
      };

      await applicationService.createApplication(applicationData);

      showToast('Registration submitted for admin review.', { type: 'success' });
      navigate(ROUTES.STUDENT_APPLICATION_STATUS);
      
    } catch (error) {
      console.error("Submission failed:", error);
      showToast('Failed to submit application to the database.', { type: 'danger' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const stepTitles = {
    1: 'Registrant & Vehicle Basics',
    2: 'Upload Documents',
    3: 'Verify & Finalize'
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-12">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Vehicle Registration</h2>
        <p className="text-sm text-slate-500">
          Step {currentStep} of 3 &middot; {stepTitles[currentStep]}
        </p>
      </div>

      <DashboardCard>
        <form onSubmit={currentStep === 1 ? handleNextStep1 : currentStep === 2 ? handleNextStep2 : handleSubmitFinal} className="flex flex-col gap-6" noValidate>
          
          {/* STEP 1: REGISTRANT DETAILS & VEHICLE PICTURE */}
          {currentStep === 1 && (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <TextField id="lastName" label="Last Name" required value={form.lastName} error={errors.lastName} onChange={(e) => update('lastName', e.target.value)} />
                <TextField id="firstName" label="First Name" required value={form.firstName} error={errors.firstName} onChange={(e) => update('firstName', e.target.value)} />
                <TextField id="middleName" label="Middle Name" placeholder="NA if none" value={form.middleName} onChange={(e) => update('middleName', e.target.value)} />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TextField id="contactNo" label="Contact No." required value={form.contactNo} error={errors.contactNo} onChange={(e) => update('contactNo', e.target.value)} />
                <TextField id="municipality" label="Municipality" required value={form.municipality} error={errors.municipality} onChange={(e) => update('municipality', e.target.value)} />
              </div>

              <TextField id="address" label="Full Address" required value={form.address} error={errors.address} onChange={(e) => update('address', e.target.value)} />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <SelectField id="registrantType" label="Registrant Type" required options={REGISTRANT_TYPES} value={form.registrantType} disabled={true} error={errors.registrantType} onChange={(e) => update('registrantType', e.target.value)} />
                <SelectField id="vehicleType" label="Vehicle Type" required options={VEHICLE_TYPES} value={form.vehicleType} error={errors.vehicleType} onChange={(e) => update('vehicleType', e.target.value)} />
              </div>

              {form.registrantType === 'Student' && (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <TextField id="studentId" label="Student ID" required value={form.studentId} error={errors.studentId} onChange={(e) => update('studentId', e.target.value)} />
                  <TextField id="yearAndSection" label="Year and Section" placeholder="e.g. BSIT 4A" required value={form.yearAndSection} error={errors.yearAndSection} onChange={(e) => update('yearAndSection', e.target.value)} />
                </div>
              )}
              {form.registrantType === 'Faculty' && (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <TextField id="employeeId" label="Employee ID" required value={form.employeeId} error={errors.employeeId} onChange={(e) => update('employeeId', e.target.value)} />
                  <TextField id="companyId" label="Company ID" required value={form.companyId} error={errors.companyId} onChange={(e) => update('companyId', e.target.value)} />
                </div>
              )}

              <hr className="border-slate-100" />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                 <TextField id="plateNumber" label="License Plate Number" required value={form.plateNumber} error={errors.plateNumber} onChange={(e) => update('plateNumber', e.target.value)} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Picture of Vehicle <span className="text-danger-500">*</span>
                  <span className="ml-2 text-xs font-normal text-slate-500">(Must include the Plate Number)</span>
                </label>
                
                <div className={`mt-1 flex justify-center rounded-lg border border-dashed px-6 py-8 transition-colors ${errors.vehiclePhotos ? 'border-danger-300 bg-danger-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                  <div className="text-center">
                    <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div className="mt-4 flex text-sm leading-6 text-slate-600 justify-center">
                      <label htmlFor="vehiclePhotos" className="relative cursor-pointer rounded-md font-semibold text-primary-700 hover:text-primary-800">
                        <span>Upload files</span>
                        <input id="vehiclePhotos" name="vehiclePhotos" type="file" multiple accept="image/*" className="sr-only" onChange={handlePhotoSelect} />
                      </label>
                    </div>
                  </div>
                </div>

                {vehiclePhotos.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-2">
                    {vehiclePhotos.map((file, idx) => (
                      <li key={idx} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm">
                        <span className="truncate">{file.name}</span>
                        <button type="button" onClick={() => removePhoto(idx)} className="ml-4 text-slate-400 hover:text-danger-500 font-bold text-lg">&times;</button>
                      </li>
                    ))}
                  </ul>
                )}
                {errors.vehiclePhotos && <p className="text-sm text-danger-600">{errors.vehiclePhotos}</p>}
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-5">
                <button type="submit" className="btn-primary">
                  Next: Upload Documents
                </button>
              </div>
            </>
          )}

          {/* STEP 2: UPLOAD DOCUMENTS (LICENSE, OR, CR) */}
          {currentStep === 2 && (
            <>
              <p className="text-sm text-slate-600 mb-2">
                Upload clear images of your documents. Our system will automatically extract and verify the details.
              </p>

              <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl text-sm mb-2 flex gap-3 items-start">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <strong className="block mb-1">📸 Tips for fast AI Verification:</strong>
                  <ul className="list-disc pl-4 space-y-1 text-blue-700/90">
                    <li>Place your document on a flat, dark surface.</li>
                    <li>Ensure good lighting and avoid camera flash glare.</li>
                    <li>Do not cover any text with your fingers.</li>
                    <li>All Documents should be taken on PORTRAIT, and not crumpled.</li>
                    <li>Use the LTMS Portal’s Digital ID if possible.</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <DocumentUploader label="Driver's License ID" id="license" required file={docs.license} error={errors.license} onChange={(e) => handleDocSelect('license', e.target.files[0])} />
                <DocumentUploader label="Official Receipt (OR)" id="or" required file={docs.or} error={errors.or} onChange={(e) => handleDocSelect('or', e.target.files[0])} />
                <DocumentUploader label="Certificate of Registration (CR)" id="cr" required file={docs.cr} error={errors.cr} onChange={(e) => handleDocSelect('cr', e.target.files[0])} />
              </div>

              <div className="flex justify-between border-t border-slate-100 pt-5 mt-4">
                <button type="button" className="btn-secondary" onClick={() => setCurrentStep(1)}>
                  Back
                </button>
                <button type="submit" className="btn-primary flex items-center gap-2" disabled={isSubmitting}>
                  {isSubmitting && (
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isSubmitting ? 'Extracting & Verifying...' : 'Verify Documents'}
                </button>
              </div>
            </>
          )}

          {/* STEP 3: VERIFICATION & AUTO-FILL */}
          {currentStep === 3 && (
            <>
              <div className="rounded-lg bg-primary-50 p-4 border border-primary-100 mb-2">
                <h3 className="text-sm font-bold text-primary-900 mb-1">Extracted Information</h3>
                <p className="text-xs text-primary-700 mb-4">Please verify the details extracted from your documents. Update if necessary.</p>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField id="licenseName" label="License Owner Name" value={extractedData.licenseName} onChange={(e) => updateExtracted('licenseName', e.target.value)} />
                  <TextField id="crName" label="CR Registrant Name" value={extractedData.crName} onChange={(e) => updateExtracted('crName', e.target.value)} />
                  <TextField id="color" label="Vehicle Color (from OR)" value={extractedData.color} onChange={(e) => updateExtracted('color', e.target.value)} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
                  <TextField id="licenseExpiry" type="text" label="License Expiry Date" value={extractedData.licenseExpiry} onChange={(e) => updateExtracted('licenseExpiry', e.target.value)} />
                  <TextField id="orExpiry" type="text" label="OR Expiry / Validity" value={extractedData.orExpiry} onChange={(e) => updateExtracted('orExpiry', e.target.value)} />
                </div>
              </div>

              {!nameMatchResult && (
                <div className="rounded-lg bg-amber-50 p-5 border border-amber-200">
                  <div className="flex items-start gap-3 mb-4">
                    <svg className="h-6 w-6 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-bold text-amber-900">Name Mismatch Detected</h3>
                      <p className="text-xs text-amber-700 mt-1">The name on the Driver's License does not exactly match the Certificate of Registration. Please provide supporting documents (Optional).</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <DocumentUploader label="Authorization Letter (Optional)" id="authLetter" file={docs.authLetter} onChange={(e) => handleDocSelect('authLetter', e.target.files[0])} />
                    <DocumentUploader label="Notarized Deed of Sale (Optional)" id="deedOfSale" file={docs.deedOfSale} onChange={(e) => handleDocSelect('deedOfSale', e.target.files[0])} />
                    <DocumentUploader label="Company Certification (Optional)" id="companyCert" file={docs.companyCert} onChange={(e) => handleDocSelect('companyCert', e.target.files[0])} />
                  </div>
                </div>
              )}

              <div className="flex justify-between border-t border-slate-100 pt-5 mt-4">
                <button type="button" className="btn-secondary" onClick={() => setCurrentStep(2)}>
                  Back
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Registration'}
                </button>
              </div>
            </>
          )}

        </form>
      </DashboardCard>

      {cropTarget && (
        <DocumentCropModal
          sourceCanvas={cropTarget.sourceCanvas}
          docLabel={
            cropTarget.key === 'license' ? "Driver's License"
              : cropTarget.key === 'or' ? 'Official Receipt'
              : 'Certificate of Registration'
          }
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}

function DocumentUploader({ label, id, required, file, error, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-danger-500">*</span>}
      </label>
      <div className={`relative flex items-center justify-between rounded-lg border px-4 py-3 bg-white ${error ? 'border-danger-300' : 'border-slate-300'}`}>
        <span className={`text-sm truncate mr-4 ${file ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
          {file ? file.name : 'No file selected'}
        </span>
        <label htmlFor={id} className="cursor-pointer rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
          Browse
          <input id={id} name={id} type="file" accept="image/*,.pdf" className="sr-only" onChange={onChange} />
        </label>
      </div>
      {error && <p className="text-xs text-danger-600">{error}</p>}
    </div>
  );
}

const HANDLE_SIZE = 14;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function DocumentCropModal({ sourceCanvas, docLabel, onConfirm, onCancel }) {
  const [quickRotation, setQuickRotation] = useState(0);
  const [fineRotation, setFineRotation] = useState(0);
  const [workingCanvas, setWorkingCanvas] = useState(null);
  const [rect, setRect] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const stageRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const totalDegrees = quickRotation + fineRotation;
    const rotated = rotateCanvas(sourceCanvas, totalDegrees);
    setWorkingCanvas(rotated);
    setRect(autoDetectCardBounds(rotated));
  }, [sourceCanvas, quickRotation, fineRotation]);

  useEffect(() => {
    if (!workingCanvas) return;
    const maxW = Math.min(720, window.innerWidth - 48);
    const maxH = Math.min(520, window.innerHeight - 280);
    const scale = Math.min(1, maxW / workingCanvas.width, maxH / workingCanvas.height);
    setStageSize({
      width: workingCanvas.width * scale,
      height: workingCanvas.height * scale,
    });
  }, [workingCanvas]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !workingCanvas || !rect || stageSize.width === 0) return;
    stage.width = stageSize.width;
    stage.height = stageSize.height;
    const ctx = stage.getContext('2d');
    ctx.clearRect(0, 0, stage.width, stage.height);
    ctx.drawImage(workingCanvas, 0, 0, stage.width, stage.height);

    const scale = stageSize.width / workingCanvas.width;
    const rx = rect.x * scale, ry = rect.y * scale, rw = rect.width * scale, rh = rect.height * scale;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fillRect(0, 0, stage.width, ry);
    ctx.fillRect(0, ry + rh, stage.width, stage.height - (ry + rh));
    ctx.fillRect(0, ry, rx, rh);
    ctx.fillRect(rx + rw, ry, stage.width - (rx + rw), rh);

    ctx.strokeStyle = '#F5C400';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);

    ctx.fillStyle = '#0B0E8C';
    [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]].forEach(([cx, cy]) => {
      ctx.fillRect(cx - HANDLE_SIZE / 2, cy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    });
  }, [workingCanvas, rect, stageSize]);

  function toStageCoords(e) {
    const bounds = stageRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - bounds.left, y: clientY - bounds.top };
  }

  function hitTestCorner(pos) {
    if (!rect || !workingCanvas) return null;
    const scale = stageSize.width / workingCanvas.width;
    const rx = rect.x * scale, ry = rect.y * scale, rw = rect.width * scale, rh = rect.height * scale;
    const corners = { tl: [rx, ry], tr: [rx + rw, ry], bl: [rx, ry + rh], br: [rx + rw, ry + rh] };
    for (const [name, [cx, cy]] of Object.entries(corners)) {
      if (Math.abs(pos.x - cx) <= HANDLE_SIZE && Math.abs(pos.y - cy) <= HANDLE_SIZE) return name;
    }
    return null;
  }

  function isInsideRect(pos) {
    if (!rect || !workingCanvas) return false;
    const scale = stageSize.width / workingCanvas.width;
    const rx = rect.x * scale, ry = rect.y * scale, rw = rect.width * scale, rh = rect.height * scale;
    return pos.x >= rx && pos.x <= rx + rw && pos.y >= ry && pos.y <= ry + rh;
  }

  function handlePointerDown(e) {
    e.preventDefault();
    const pos = toStageCoords(e);
    const corner = hitTestCorner(pos);
    if (corner) {
      dragRef.current = { mode: 'corner', corner, startRect: rect };
    } else if (isInsideRect(pos)) {
      dragRef.current = { mode: 'move', startPos: pos, startRect: rect };
    }
  }

  function handlePointerMove(e) {
    if (!dragRef.current || !workingCanvas) return;
    e.preventDefault();
    const pos = toStageCoords(e);
    const scale = stageSize.width / workingCanvas.width;
    const MIN = 30;

    if (dragRef.current.mode === 'move') {
      const dx = (pos.x - dragRef.current.startPos.x) / scale;
      const dy = (pos.y - dragRef.current.startPos.y) / scale;
      const { x, y, width, height } = dragRef.current.startRect;
      setRect({
        x: clamp(x + dx, 0, workingCanvas.width - width),
        y: clamp(y + dy, 0, workingCanvas.height - height),
        width, height,
      });
    } else if (dragRef.current.mode === 'corner') {
      const canvasX = clamp(pos.x / scale, 0, workingCanvas.width);
      const canvasY = clamp(pos.y / scale, 0, workingCanvas.height);
      const { corner, startRect } = dragRef.current;
      let { x, y, width, height } = startRect;
      const right = x + width, bottom = y + height;

      if (corner === 'tl') {
        x = clamp(canvasX, 0, right - MIN); y = clamp(canvasY, 0, bottom - MIN);
        width = right - x; height = bottom - y;
      } else if (corner === 'tr') {
        const newRight = clamp(canvasX, x + MIN, workingCanvas.width);
        y = clamp(canvasY, 0, bottom - MIN);
        width = newRight - x; height = bottom - y;
      } else if (corner === 'bl') {
        x = clamp(canvasX, 0, right - MIN);
        const newBottom = clamp(canvasY, y + MIN, workingCanvas.height);
        width = right - x; height = newBottom - y;
      } else if (corner === 'br') {
        const newRight = clamp(canvasX, x + MIN, workingCanvas.width);
        const newBottom = clamp(canvasY, y + MIN, workingCanvas.height);
        width = newRight - x; height = newBottom - y;
      }
      setRect({ x, y, width, height });
    }
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleConfirm() {
    if (!workingCanvas || !rect) return;
    onConfirm(cropCanvas(workingCanvas, rect));
  }

  function handleAutoDetect() {
    if (!workingCanvas) return;
    setRect(autoDetectCardBounds(workingCanvas));
  }

  function handleResetToFull() {
    if (!workingCanvas) return;
    setRect({ x: 0, y: 0, width: workingCanvas.width, height: workingCanvas.height });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-5 flex flex-col gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Adjust {docLabel}</h3>
          <p className="text-sm text-slate-500">Drag the corners to fit just the document, then straighten it if needed.</p>
        </div>

        <div className="flex justify-center bg-slate-100 rounded-lg p-2 overflow-hidden">
          <canvas
            ref={stageRef}
            className="cursor-move rounded"
            style={{ touchAction: 'none' }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setQuickRotation((r) => (r + 270) % 360)} className="btn-secondary text-xs px-3 py-1.5">
            Rotate Left
          </button>
          <button type="button" onClick={() => setQuickRotation((r) => (r + 90) % 360)} className="btn-secondary text-xs px-3 py-1.5">
            Rotate Right
          </button>
          <button type="button" onClick={handleAutoDetect} className="btn-secondary text-xs px-3 py-1.5">
            Auto-Detect Edges
          </button>
          <button type="button" onClick={handleResetToFull} className="btn-secondary text-xs px-3 py-1.5">
            Reset to Full Image
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs text-slate-500">Straighten</label>
            <input
              type="range" min={-15} max={15} step={0.5} value={fineRotation}
              onChange={(e) => setFineRotation(parseFloat(e.target.value))}
              className="w-32"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
          <button type="button" onClick={handleConfirm} className="btn-primary">Use This Crop</button>
        </div>
      </div>
    </div>
  );
}