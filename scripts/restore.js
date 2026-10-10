// Pemulihan dari cadangan (format scripts/backup.js). Admin SDK melewati aturan keamanan: HATI-HATI, menimpa dokumen.
// Pakai:  node scripts/restore.js kunci-service-account.json cadangan.json
const admin = require('firebase-admin'), fs = require('fs'), path = require('path');
const [, , keyFile, file] = process.argv;
if (!keyFile || !file) { console.error('Pemakaian: node scripts/restore.js <service-account.json> <cadangan.json>'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(require(path.resolve(keyFile))) });
const db = admin.firestore(), j = JSON.parse(fs.readFileSync(file, 'utf8'));
const revive = (v) => (v && typeof v === 'object' ? (v._seconds !== undefined ? new admin.firestore.Timestamp(v._seconds, v._nanoseconds) : Array.isArray(v) ? v.map(revive) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)]))) : v);
let n = 0;
// dukung format cadangan dari aplikasi (letters/versions) maupun scripts/backup.js (sub)
for (const docs of Object.values(j.data)) for (const d of docs) { d.sub = d.sub || {}; if (d.letters) d.sub.letters = d.letters; if (d.versions) d.sub.versions = d.versions; }
async function put(ref, docs) {
  for (const d of docs) {
    await ref.doc(d.id).set(revive(d.data)); n++;
    for (const [c, sub] of Object.entries(d.sub || {})) await put(ref.doc(d.id).collection(c), sub);
  }
}
(async () => { for (const [c, docs] of Object.entries(j.data)) await put(db.collection(c), docs); console.log('Dipulihkan:', n, 'dokumen'); })();
