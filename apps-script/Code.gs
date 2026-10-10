/**
 * Relay email GRATIS untuk paket Firebase Spark (pengganti Cloud Functions + ekstensi email).
 * Deploy: script.google.com > Proyek baru > tempel kode ini > Deploy > Web app
 *   (Execute as: Me, Who has access: Anyone). Salin URL /exec ke Pengaturan aplikasi > "URL webhook email".
 * Keamanan: hanya token Firebase milik ADMIN yang diterima (peran dibaca dari Firestore dengan token itu sendiri,
 * sehingga aturan keamanan Firestore tetap berlaku) + batas harian. Kuota MailApp: ~100/hari (Gmail biasa), ~1500 (Workspace).
 */
const PROJECT_ID = 'GANTI-PROJECT-ID';
const API_KEY = 'GANTI-WEB-API-KEY';   // apiKey dari firebase-config.js
const DAILY_LIMIT = 80;

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    const uid = lookup(b.idToken);
    if (!uid || ['admin', 'superadmin'].indexOf(roleOf(b.idToken, uid)) < 0) return out('forbidden');
    const props = PropertiesService.getScriptProperties();
    const day = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd'), n = Number(props.getProperty('n' + day) || 0);
    if (n >= DAILY_LIMIT) return out('limit');
    if (!/^\S+@\S+\.\S+$/.test(b.to)) return out('bad');
    MailApp.sendEmail({ to: b.to, subject: String(b.subject).slice(0, 150), body: String(b.body).slice(0, 2000), name: 'Layanan Surat' });
    props.setProperty('n' + day, String(n + 1));
    return out('ok');
  } catch (err) { return out('error'); }
}
function lookup(t) {
  const r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + API_KEY, { method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: t }), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  const u = JSON.parse(r.getContentText()).users; return u && u[0] ? u[0].localId : null;
}
function roleOf(t, uid) {
  const r = UrlFetchApp.fetch('https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/users/' + uid, { headers: { Authorization: 'Bearer ' + t }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  const f = JSON.parse(r.getContentText()).fields; return f && f.role ? f.role.stringValue : null;
}
function out(s) { return ContentService.createTextOutput(s); }
