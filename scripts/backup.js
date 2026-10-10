// Cadangan PENUH via Admin SDK (jalan di laptop/GitHub Actions; gratis di Spark, hanya memakai kuota baca).
// Pakai:  npm i firebase-admin && node scripts/backup.js kunci-service-account.json cadangan.json
const admin = require('firebase-admin'), fs = require('fs'), path = require('path');
const [, , keyFile, outFile = 'cadangan-penuh.json'] = process.argv;
if (!keyFile) { console.error('Pemakaian: node scripts/backup.js <service-account.json> [keluaran.json]'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(require(path.resolve(keyFile))) });
const db = admin.firestore();
async function dump(ref) {
  const out = [];
  for (const d of (await ref.get()).docs) {
    const o = { id: d.id, data: d.data(), sub: {} };
    for (const c of await d.ref.listCollections()) o.sub[c.id] = await dump(c);
    out.push(o);
  }
  return out;
}
(async () => {
  const res = { app: 'layanan-surat-spark', at: Date.now(), data: {} };
  for (const c of await db.listCollections()) res.data[c.id] = await dump(c);
  fs.writeFileSync(outFile, JSON.stringify(res));
  console.log('Selesai ->', outFile);
})();
