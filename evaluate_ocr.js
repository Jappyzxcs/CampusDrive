import { createWorker } from 'tesseract.js';
import levenshtein from 'fast-levenshtein';
import fs from 'fs';
import path from 'path';

// 1. YOUR TEST DATASET
// IMPORTANT: Replace the 'REPLACE_WITH...' strings with the exact text printed on the documents.
const testDataset = [
  // --- DRIVER'S LICENSES (Extracting BOTH Name and Expiry Date) ---
  { filename: 'license_id1', expectedName: 'GARCIA, SEAN DEANIEL ABUCAY', expectedDate: '2029/02/25' },
  { filename: 'license_id2', expectedName: 'MELANTE, C-JAY SISON', expectedDate: '2029/04/26' },
  { filename: 'license_id3', expectedName: 'FAUSTINO, MA. ANGELICA SISON', expectedDate: '2030/12/25' },
  { filename: 'license_id4', expectedName: 'LINGA, DANIELLE SIERRA', expectedDate: '2029/10/02' },
  { filename: 'license_id5', expectedName: 'LERIOS, JEFFERSON LLOBIT', expectedDate: '2033/07/22' },
  { filename: 'license_id6', expectedName: 'SORIANO, DAVE IAN LOUIS PIAMONTE', expectedDate: '2030/01/26' },
  { filename: 'license_id7', expectedName: 'FAUSTINO, MA. ANGELICA SISON', expectedDate: '2030/12/25' },
  { filename: 'license_id8', expectedName: 'GULAY, CRISANTO FLORENTINO', expectedDate: '2032/11/01' },
  { filename: 'license_id9', expectedName: 'MAGDA, RONDALE ANGELO', expectedDate: '2029/10/01' },

  // --- CERTIFICATES OF REGISTRATION / CR (Extracting Name ONLY) ---
  { filename: 'espinelicr', expectedName: 'MARIA FE FELIPE ESPINELI' },
  { filename: 'gecoleacr',  expectedName: 'ELISA JAVIER GECOLEA' },
  { filename: 'jeffcr',     expectedName: 'RIZALINA R LICUANAN' },
  { filename: 'jpcr',       expectedName: 'JOHN PAUL CABALLES EMPALMADO' },
  { filename: 'seancr',     expectedName: 'HERBERT LAUZON BARROZA' },
  { filename: 'yadaocr',    expectedName: 'JAMES ADRAQUE YADAO' },
  { filename: 'gulaycr', expectedName: 'JOHN PAULO LOPEZ MARIANO' },

  // --- OFFICIAL RECEIPTS / OR (Extracting Expiry Date ONLY) ---
  { filename: 'espinelior', expectedDate: '12/1/2025' },
  { filename: 'gecoleaor',  expectedDate: '07/01/2027' },
  { filename: 'jeffor',     expectedDate: '08/08/2027' },
  { filename: 'jpor',       expectedDate: '04/08/2029' },
  { filename: 'seanor',     expectedDate: '04/01/2027' },
  { filename: 'yadaoor',    expectedDate: '04/08/2026' },
  { filename: 'gulayor',    expectedDate: '03/08/2029' }
];

// Helper to find the file regardless of extension
function resolveImagePath(baseName) {
  const jpgPath = path.join('./test_images', `${baseName}.jpg`);
  const pngPath = path.join('./test_images', `${baseName}.png`);
  const jpegPath = path.join('./test_images', `${baseName}.jpeg`);
  
  if (fs.existsSync(jpgPath)) return jpgPath;
  if (fs.existsSync(pngPath)) return pngPath;
  if (fs.existsSync(jpegPath)) return jpegPath;
  return null;
}

// Cleans text for a fair comparison
function cleanText(raw) {
  if (!raw) return '';
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9/ ]/g, '') // Keep letters, numbers, slashes, and spaces
    .replace(/\s+/g, ' ')        // Collapse multiple spaces
    .trim();
}

// Sliding window Levenshtein: Scans the entire OCR block to find the closest matching substring
function getBestMatchDistance(expected, rawText) {
  if (rawText.includes(expected)) return 0; // Perfect match found
  if (rawText.length < expected.length) return levenshtein.get(expected, rawText);

  let minDistance = expected.length; // Baseline max errors
  
  // Slide a window the size of the expected text across the massive OCR string
  for (let i = 0; i <= rawText.length - expected.length; i++) {
    const windowText = rawText.substring(i, i + expected.length);
    const dist = levenshtein.get(expected, windowText);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}

async function runEvaluation() {
  console.log('Starting Advanced OCR Evaluation...\n');
  
  const worker = await createWorker('eng');
  
  let totalCharacters = 0;
  let totalErrors = 0;
  let filesProcessed = 0;

  for (const item of testDataset) {
    const imagePath = resolveImagePath(item.filename);
    
    if (!imagePath) {
      console.log(`❌ Skipped: Could not find ${item.filename} in test_images/`);
      continue;
    }

    // Build array of fields to test for this specific image
    const fieldsToTest = [];
    if (item.expectedName) fieldsToTest.push({ label: 'Name', value: cleanText(item.expectedName) });
    if (item.expectedDate) fieldsToTest.push({ label: 'Date', value: cleanText(item.expectedDate) });

    // Ensure placeholders were replaced
    if (fieldsToTest.some(f => f.value.includes('REPLACE_WITH'))) {
      console.log(`⚠️ Skipped: You need to add the real ground truth text for ${item.filename}`);
      continue;
    }

    try {
      const { data: { text } } = await worker.recognize(imagePath);
      const predictedText = cleanText(text);

      console.log(`✅ Processed: ${item.filename}`);
      filesProcessed++;

      // Evaluate every required field for this document
      for (const field of fieldsToTest) {
        const distance = getBestMatchDistance(field.value, predictedText);
        
        totalCharacters += field.value.length;
        totalErrors += distance;

        if (distance === 0) {
          console.log(`   [${field.label}] Perfect Match: "${field.value}"`);
        } else {
          console.log(`   [${field.label}] Expected: "${field.value}" | Errors: ${distance} char(s) off`);
        }
      }
      console.log('---');

    } catch (err) {
      console.log(`❌ Error processing ${item.filename}: ${err.message}`);
    }
  }

  await worker.terminate();

  if (filesProcessed === 0) {
    console.log('\nNo files were processed. Check your filenames and placeholders.');
    return;
  }

  // Calculate Final Metrics
  const cer = totalErrors / totalCharacters;
  const accuracy = (1 - cer) * 100;

  console.log('\n========================================');
  console.log('🏁 FINAL EVALUATION METRICS');
  console.log('========================================');
  console.log(`Documents Processed     : ${filesProcessed} / ${testDataset.length}`);
  console.log(`Total Characters Tested : ${totalCharacters}`);
  console.log(`Total Character Errors  : ${totalErrors}`);
  console.log(`Character Error Rate (CER): ${(cer * 100).toFixed(2)}%`);
  console.log(`System Accuracy         : ${Math.max(0, accuracy).toFixed(2)}%`);
  console.log('========================================');
}

runEvaluation();