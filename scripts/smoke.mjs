// Uji asap: sintaks modul public/, validitas JSON, dan kelengkapan dokumen.
// Jalankan: node scripts/smoke.mjs   (keluar non-0 bila ada yang gagal)
import { execFile } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { promisify } from 'node:util';
const run = promisify(execFile);
let fail = 0;
const ok = (n) => console.log('  ✓ ' + n);
const bad = (n, e) => { fail++; console.log('  ✗ ' + n + (e ? ' — ' + String(e).split('\n')[0] : '')); };

const JS = ['api.js', 'admin.js', 'user.js', 'main.js', 'core.js', 'pdf.js', 'crypto.js', 'theme.js', 'verify.js', 'export.js', 'firebase-config.js'];
console.log('1) sintaks public/*.js');
for (const f of JS) {
  try { await run(process.execPath, ['--check', 'public/' + f]); ok(f); }
  catch (e) { bad(f, e.stderr || e.message); }
}
console.log('2) JSON valid');
for (const f of ['public/changelog.json', 'firebase.json', 'firestore.indexes.json', 'public/manifest.webmanifest', '.firebaserc']) {
  try { JSON.parse(readFileSync(f, 'utf8')); ok(f); }
  catch (e) { bad(f, e.message); }
}
console.log('3) dokumen & aturan');
for (const f of ['docs/DEPLOY-SPARK.md', 'docs/PANDUAN.md', 'docs/KEAMANAN.md', 'docs/DRIVE.md', 'docs/STORAGE.md', 'docs/FRAMEWORK.md', 'public/docs/panduan.md', 'firestore.rules', 'public/env.example.js']) {
  existsSync(f) ? ok(f) : bad(f, 'hilang');
}
try {
  const r = readFileSync('firestore.rules', 'utf8');
  r.includes("rules_version = '2'") && r.includes('allow update: if') ? ok('firestore.rules berisi aturan') : bad('firestore.rules', 'isi tidak wajar');
} catch (e) { bad('firestore.rules', e.message); }
console.log(fail ? `\nGAGAL: ${fail} pemeriksaan` : '\nLOLOS semua pemeriksaan');
process.exit(fail ? 1 : 0);
