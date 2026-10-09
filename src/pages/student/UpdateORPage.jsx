import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useToast } from '../../context/ToastContext';
import { ROUTES } from '../../constants/routes';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { TextField } from '../../components/forms/TextField';
import { Icon } from '../../components/common/Icon';
import Tesseract from 'tesseract.js';
import levenshtein from 'fast-levenshtein'; 
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/* =========================================================================
   ADVANCED EXTRACTION & OCR LOGIC
   ========================================================================= */

function cleanText(raw) {
  return raw.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\r\t]+/g, ' ').replace(/[^\x20-\x7E\n]/g, ' ').replace(/ {2,}/g, ' ').trim();
}

const MONTH_MAP = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, JUNE: 6, JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12
};

function extractAllDates(rawText) {
  if (!rawText) return [];
  const found = [];
  const text = rawText.replace(/\|/g, ' ');

  const textMonthRegex = /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{1,2})[,\s]+(20\d{2}|19\d{2})\b/gi;
  let tm;
  while ((tm = textMonthRegex.exec(text)) !== null) {
    const month = MONTH_MAP[tm[1].toUpperCase().slice(0, 3)];
    const day = parseInt(tm[2], 10), year = parseInt(tm[3], 10);
    if (month && day >= 1 && day <= 31) found.push({ year, month, day, formatted: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` });
  }
  const ymdRegex = /(?:^|[^\d])(20\d{2}|19\d{2})[\s/.\-:I\\]+(\d{1,2})[\s/.\-:I\\]+(\d{1,2})(?=[^\d]|\$)/g;
  let m;
  while ((m = ymdRegex.exec(text)) !== null) {
    const year = parseInt(m[1], 10), month = parseInt(m[2], 10), day = parseInt(m[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) found.push({ year, month, day, formatted: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` });
  }
  const dmyRegex = /(?:^|[^\d])(\d{1,2})[\s/.\-:I\\]+(\d{1,2})[\s/.\-:I\\]+(20\d{2}|19\d{2})(?=[^\d]|\$)/g;
  while ((m = dmyRegex.exec(text)) !== null) {
    const p1 = parseInt(m[1], 10), p2 = parseInt(m[2], 10), year = parseInt(m[3], 10);
    let day = p1, month = p2;
    if (p1 <= 12 && p2 > 12) { month = p1; day = p2; }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) found.push({ year, month, day, formatted: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` });
  }
  return found;
}

function extractOrExpiry(text) {
  if (!text) return null;
  const rangeMatch = text.match(/(?:to|until)\s+([A-Z]{3,9}\s+\d{1,2}[,\s]+\d{4}|\d{1,2}[\s/.\-:|Il\\]+\d{1,2}[\s/.\-:|Il\\]+\d{4})/i);
  if (rangeMatch) {
    const dates = extractAllDates(rangeMatch[0]);
    if (dates.length > 0) return { value: dates[0].formatted, confident: true };
  }
  const m = text.match(/(?:valid\s*until|renewal\s*on|next\s*reg)[\s\S]{0,60}?([A-Z]{3,9}\s+\d{1,2}[,\s]+\d{4}|\d{1,2}[\s/.\-:|Il\\]+\d{1,2}[\s/.\-:|Il\\]+\d{4}|\d{4}[\s/.\-:|Il\\]+\d{1,2}[\s/.\-:|Il\\]+\d{1,2})/i);
  if (m) {
    const dates = extractAllDates(m[0]);
    if (dates.length > 0) return { value: dates[0].formatted, confident: true };
  }
  const dates = extractAllDates(text);
  if (dates.length > 0) {
    dates.sort((a, b) => a.iso.localeCompare(b.iso));
    return { value: dates[dates.length - 1].formatted, confident: false };
  }
  return null;
}

function parseDMY(str) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\$/.exec((str || '').trim());
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}

function getExpiryStatus(str) {
  const d = parseDMY(str);
  if (!d) return 'unreadable';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today ? 'expired' : 'valid';
}

const grayscaleCanvas = (source) => {
  const canvas = document.createElement('canvas');
  canvas.width = source.width; canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false; ctx.drawImage(source, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (g < min) min = g; if (g > max) max = g;
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
  let sum = 0, sumB = 0, wB = 0, varMax = 0, threshold = 135;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];
  for (let t = 0; t < 256; t++) {
    wB += histogram[t]; if (wB === 0) continue;
    const wF = total - wB; if (wF === 0) break;
    sumB += t * histogram[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > varMax) { varMax = varBetween; threshold = t; }
  }
  return Math.min(200, Math.max(60, threshold));
};

const binarizeCanvas = (source) => {
  const canvas = document.createElement('canvas');
  canvas.width = source.width; canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false; ctx.drawImage(source, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const grayValues = new Uint8ClampedArray(d.length / 4);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) grayValues[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
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

const processFile = async (file) => {
  if (!file) return { text: '', alnumText: '' };
  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const layerText = cleanText(await extractPdfTextLayer(pdfDoc));
    let text = '', alnumText = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 3.2 });
      const canvas = document.createElement('canvas');
      canvas.height = viewport.height; canvas.width = viewport.width;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const [normal, alnum] = await Promise.all([ocrBothPasses(canvas), ocrAlnumPass(canvas)]);
      text += '\n' + normal; alnumText += '\n' + alnum;
    }
    const combinedText = cleanText(`${layerText}\n${text}`);
    return { text: combinedText, alnumText: cleanText(alnumText) };
  }
  const canvas = document.createElement('canvas');
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
  const scaleFactor = Math.max(1, 2000 / Math.max(img.width, img.height));
  canvas.width = img.width * scaleFactor; canvas.height = img.height * scaleFactor;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const [text, alnumText] = await Promise.all([ocrBothPasses(canvas), ocrAlnumPass(canvas)]);
  return { text: cleanText(text), alnumText: cleanText(alnumText) };
};

const renderFileToCanvas = async (file) => {
  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas;
  }
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  img.src = objectUrl;
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
  const scaleFactor = Math.max(1, 1500 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = img.width * scaleFactor; canvas.height = img.height * scaleFactor;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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
   CROP MODAL LOGIC & COMPONENT
   ========================================================================= */

const rotateCanvas = (source, degrees) => {
  const canvas = document.createElement('canvas');
  if (!degrees) {
    canvas.width = source.width; canvas.height = source.height;
    canvas.getContext('2d').drawImage(source, 0, 0);
    return canvas;
  }
  const radians = (degrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians)), cos = Math.abs(Math.cos(radians));
  const newWidth = Math.round(source.width * cos + source.height * sin);
  const newHeight = Math.round(source.width * sin + source.height * cos);
  canvas.width = newWidth; canvas.height = newHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, newWidth, newHeight);
  ctx.translate(newWidth / 2, newHeight / 2); ctx.rotate(radians);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
};

const cropCanvas = (source, rect) => {
  const x = Math.max(0, Math.round(rect.x)), y = Math.max(0, Math.round(rect.y));
  const w = Math.max(1, Math.min(Math.round(rect.width), source.width - x));
  const h = Math.max(1, Math.min(Math.round(rect.height), source.height - y));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(source, x, y, w, h, 0, 0, w, h);
  return canvas;
};

const autoDetectCardBounds = (canvas) => {
  const maxDim = 300;
  const scale = Math.min(1, maxDim / Math.max(canvas.width, canvas.height));
  const w = Math.max(2, Math.round(canvas.width * scale));
  const h = Math.max(2, Math.round(canvas.height * scale));
  const small = document.createElement('canvas');
  small.width = w; small.height = h;
  const sctx = small.getContext('2d');
  sctx.drawImage(canvas, 0, 0, w, h);
  const { data } = sctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  const edge = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx = gray[idx + 1] - gray[idx - 1], gy = gray[idx + w] - gray[idx - w];
      edge[idx] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  const rowSum = new Float32Array(h), colSum = new Float32Array(w);
  for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x++) s += edge[y * w + x]; rowSum[y] = s; }
  for (let x = 0; x < w; x++) { let s = 0; for (let y = 0; y < h; y++) s += edge[y * w + x]; colSum[x] = s; }
  const boundsFromProjection = (arr, fullLength) => {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const threshold = mean * 0.6;
    let start = 0, end = fullLength - 1;
    for (let i = 0; i < arr.length; i++) { if (arr[i] > threshold) { start = i; break; } }
    for (let i = arr.length - 1; i >= 0; i--) { if (arr[i] > threshold) { end = i; break; } }
    return [start, end];
  };
  const [top, bottom] = boundsFromProjection(rowSum, h), [left, right] = boundsFromProjection(colSum, w);
  const marginX = Math.max(2, (right - left) * 0.03), marginY = Math.max(2, (bottom - top) * 0.03);
  const x0 = Math.max(0, left - marginX), y0 = Math.max(0, top - marginY);
  const x1 = Math.min(w, right + marginX), y1 = Math.min(h, bottom + marginY);
  const inv = 1 / scale;
  return { x: x0 * inv, y: y0 * inv, width: Math.max(1, (x1 - x0) * inv), height: Math.max(1, (y1 - y0) * inv) };
};

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
    setStageSize({ width: workingCanvas.width * scale, height: workingCanvas.height * scale });
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
    if (corner) dragRef.current = { mode: 'corner', corner, startRect: rect };
    else if (isInsideRect(pos)) dragRef.current = { mode: 'move', startPos: pos, startRect: rect };
  }

  function handlePointerMove(e) {
    if (!dragRef.current || !workingCanvas) return;
    e.preventDefault();
    const pos = toStageCoords(e);
    const scale = stageSize.width / workingCanvas.width;
    const MIN = 30;

    if (dragRef.current.mode === 'move') {
      const dx = (pos.x - dragRef.current.startPos.x) / scale, dy = (pos.y - dragRef.current.startPos.y) / scale;
      const { x, y, width, height } = dragRef.current.startRect;
      setRect({ x: clamp(x + dx, 0, workingCanvas.width - width), y: clamp(y + dy, 0, workingCanvas.height - height), width, height });
    } else if (dragRef.current.mode === 'corner') {
      const canvasX = clamp(pos.x / scale, 0, workingCanvas.width), canvasY = clamp(pos.y / scale, 0, workingCanvas.height);
      const { corner, startRect } = dragRef.current;
      let { x, y, width, height } = startRect;
      const right = x + width, bottom = y + height;

      if (corner === 'tl') { x = clamp(canvasX, 0, right - MIN); y = clamp(canvasY, 0, bottom - MIN); width = right - x; height = bottom - y; }
      else if (corner === 'tr') { const newRight = clamp(canvasX, x + MIN, workingCanvas.width); y = clamp(canvasY, 0, bottom - MIN); width = newRight - x; height = bottom - y; }
      else if (corner === 'bl') { x = clamp(canvasX, 0, right - MIN); const newBottom = clamp(canvasY, y + MIN, workingCanvas.height); width = right - x; height = newBottom - y; }
      else if (corner === 'br') { const newRight = clamp(canvasX, x + MIN, workingCanvas.width); const newBottom = clamp(canvasY, y + MIN, workingCanvas.height); width = newRight - x; height = newBottom - y; }
      setRect({ x, y, width, height });
    }
  }

  function handlePointerUp() { dragRef.current = null; }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-5 flex flex-col gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Adjust {docLabel}</h3>
          <p className="text-sm text-slate-500">Drag the corners to fit just the document, then straighten it if needed.</p>
        </div>
        <div className="flex justify-center bg-slate-100 rounded-lg p-2 overflow-hidden">
          <canvas
            ref={stageRef} className="cursor-move rounded" style={{ touchAction: 'none' }}
            onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setQuickRotation((r) => (r + 270) % 360)} className="btn-secondary text-xs px-3 py-1.5">Rotate Left</button>
          <button type="button" onClick={() => setQuickRotation((r) => (r + 90) % 360)} className="btn-secondary text-xs px-3 py-1.5">Rotate Right</button>
          <button type="button" onClick={() => setRect(autoDetectCardBounds(workingCanvas))} className="btn-secondary text-xs px-3 py-1.5">Auto-Detect Edges</button>
          <button type="button" onClick={() => setRect({ x: 0, y: 0, width: workingCanvas.width, height: workingCanvas.height })} className="btn-secondary text-xs px-3 py-1.5">Reset to Full Image</button>
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs text-slate-500">Straighten</label>
            <input type="range" min={-15} max={15} step={0.5} value={fineRotation} onChange={(e) => setFineRotation(parseFloat(e.target.value))} className="w-32" />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
          <button type="button" onClick={() => onConfirm(cropCanvas(workingCanvas, rect))} className="btn-primary">Use This Crop</button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   PAGE COMPONENT
   ========================================================================= */

export default function UpdateORPage() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [vehicle, setVehicle] = useState(null);
  const [file, setFile] = useState(null);
  const [cropTarget, setCropTarget] = useState(null);
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

  async function handleFileSelect(selected) {
    if (!selected) {
      setFile(null);
      return;
    }
    try {
      const canvas = await renderFileToCanvas(selected);
      setCropTarget({ sourceCanvas: canvas, originalFile: selected });
    } catch (err) {
      setFile(selected);
    }
  }

  function handleCropConfirm(croppedCanvas) {
    const { originalFile } = cropTarget;
    croppedCanvas.toBlob((blob) => {
      if (!blob) {
        setFile(originalFile);
      } else {
        const baseName = originalFile.name.replace(/\.[^.]+\$/, '');
        setFile(new File([blob], `${baseName}_cropped.png`, { type: 'image/png' }));
      }
      setCropTarget(null);
    }, 'image/png');
  }

  async function handleExtract(e) {
    e.preventDefault();
    if (!file) return showToast('Please upload an OR document first.', { type: 'warning' });

    setPhase('extracting');
    try {
      const res = await processFile(file);
      const orText = `${res.text}\n${res.alnumText}`;

      // Plate cross-check (anti-fraud)
      const vPlate = vehicle?.plateNumber || vehicle?.vehicleDetails?.plateNumber;
      if (vPlate) {
        const targetPlate = vPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const rawTextCleaned = orText.toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        let plateFound = rawTextCleaned.includes(targetPlate);
        
        if (!plateFound) {
          const words = orText.toUpperCase().replace(/[^A-Z0-9]/g, ' ').split(/\s+/).filter(w => w.length >= 4);
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

      const orExp = extractOrExpiry(orText);
      
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
              Upload your newest LTO Official Receipt. You will be asked to crop it to just the receipt, then the AI cross-checks the plate number against your vehicle and reads the new expiration date.
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Upload New OR (Image or PDF)</label>
              <input 
                type="file" 
                accept="image/*,.pdf" 
                onChange={(e) => handleFileSelect(e.target.files[0])}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
              {file && <p className="text-xs text-slate-500 truncate">Selected: {file.name}</p>}
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
                label="New OR Expiry Date (DD/MM/YYYY)" 
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

      {cropTarget && (
        <DocumentCropModal
          sourceCanvas={cropTarget.sourceCanvas}
          docLabel="Official Receipt"
          onConfirm={handleCropConfirm}
          onCancel={() => setCropTarget(null)}
        />
      )}
    </div>
  );
}