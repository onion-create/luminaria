#!/usr/bin/env node
/**
 * Luminaria v2 Build Script
 *
 * Reads source/app.html as template, inlines word bank + halo data,
 * outputs index.html. Minimal build — CSS/JS stay in the source file.
 *
 * Usage: node scripts/build.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'source', 'app.html');
const OUTPUT = path.join(ROOT, 'index.html');
const WB_DATA = path.join(ROOT, 'data', 'wb_data.json');
const HALO_DATA = path.join(ROOT, 'data', 'halo_data.json');

console.log('🔨 Luminaria Build');
console.log('  Source:', path.relative(ROOT, SOURCE));
console.log('  Output:', path.relative(ROOT, OUTPUT));

// Read source file
let html = fs.readFileSync(SOURCE, 'utf8');

// Inline word bank data
if (html.includes('__WB_DATA_PLACEHOLDER__')) {
  const wb = JSON.parse(fs.readFileSync(WB_DATA, 'utf8'));
  const wbJson = JSON.stringify(wb);
  html = html.replace('__WB_DATA_PLACEHOLDER__', wbJson);
  const wordCount = Object.values(wb).reduce((a, b) => a + b.length, 0);
  console.log(`  ✓ Inlined word bank (${wbJson.length} bytes, ${Object.keys(wb).length} banks, ${wordCount} words)`);
} else {
  console.log('  ⚠ WB_DATA placeholder not found — source may have inline data');
}

// Inline halo data
if (html.includes('__HALO_DATA_PLACEHOLDER__')) {
  const halo = JSON.parse(fs.readFileSync(HALO_DATA, 'utf8'));
  const haloWords = halo.words || halo;
  const haloJson = JSON.stringify(haloWords);
  html = html.replace('__HALO_DATA_PLACEHOLDER__', haloJson);
  console.log(`  ✓ Inlined halo data (${haloJson.length} bytes, ${Object.keys(haloWords).length} entries)`);
} else {
  console.log('  ⚠ HALO_DATA placeholder not found — source may have inline data');
}

// Write output
fs.writeFileSync(OUTPUT, html);
console.log(`  ✓ Built index.html (${html.length} bytes)`);
console.log('✅ Done');
