// Ekspor massal (ZIP lokal atau Google Drive milik admin) + konversi Word -> PDF lewat Google Drive.
// Drive memakai OAuth lewat Firebase Auth (scope drive.file: hanya berkas yang dibuat aplikasi ini).
import { S, F, fs, auth, $, esc, fdate, run, saveFile, csv, hook } from './core.js';
import { collection, query, where, orderBy, limit, getDocs, getDoc, doc, setDoc } from 'firebase/firestore';
import { GoogleAuthProvider, reauthenticateWithPopup, linkWithPopup } from 'firebase/auth';
import { sha256, unb64 } from './crypto.js';
import { regen, gunzip, letterHtml } from './api.js';

const A = (window.A = window.A || {});
const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3';
let TOK = null, TOKAT = 0;
const driveOn = () => TOK && Date.now() - TOKAT < 50 * 60e3;
const safe = (s) => String(s || 'x').replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80);
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

/* ---------------- Google Drive ---------------- */
/** Harus dipanggil langsung dari klik tombol (popup diblokir bila tidak ada interaksi pengguna). */
async function driveToken(force) {
  if (driveOn() && !force) return TOK;
  const p = new GoogleAuthProvider(); p.addScope('https://www.googleapis.com/auth/drive.file');
  const u = auth.currentUser, res = u.providerData.some((x) => x.providerId === 'google.com') ? await reauthenticateWithPopup(u, p) : await linkWithPopup(u, p);
  TOK = GoogleAuthProvider.credentialFromResult(res).accessToken; TOKAT = Date.now(); return TOK;
}
async function dfetch(url, opt = {}) {
  if (!driveOn()) throw new Error('Sesi Google Drive berakhir. Klik "Hubungkan Google Drive", lalu ulangi (progres tersimpan).');
  const r = await fetch(url, { ...opt, headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + TOK } });
  if (r.status === 401) { TOK = null; throw new Error('Sesi Google Drive berakhir. Hubungkan ulang lalu lanjutkan.'); }
  if (!r.ok) throw new Error('Google Drive ' + r.status + ': ' + (await r.text()).slice(0, 160));
  return r;
}
const folders = new Map(), names = new Map();
async function ensureFolder(name, parent) {
  const key = (parent || '') + '/' + name; if (folders.has(key)) return folders.get(key);
  const q = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false` + (parent ? ` and '${parent}' in parents` : '');
  const f = (await (await dfetch(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`)).json()).files;
  const id = f[0] ? f[0].id : (await (await dfetch(`${API}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: parent ? [parent] : undefined }) })).json()).id;
  folders.set(key, id); return id;
}
async function folderPath(root, path) { let id = root; for (const p of path.split('/')) id = await ensureFolder(safe(p), id); return id; }
async function existing(fid) {
  if (names.has(fid)) return names.get(fid);
  const set = new Set(); let tok = '';
  do { const j = await (await dfetch(`${API}/files?q=${encodeURIComponent(`'${fid}' in parents and trashed=false`)}&fields=nextPageToken,files(name)&pageSize=1000${tok ? '&pageToken=' + tok : ''}`)).json(); j.files.forEach((f) => set.add(f.name)); tok = j.nextPageToken || ''; } while (tok);
  names.set(fid, set); return set;
}
function multipart(meta, data, mime) {
  const b = 'ly' + Math.random().toString(36).slice(2), enc = new TextEncoder();
  return { b, body: new Blob([enc.encode(`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`), typeof data === 'string' ? enc.encode(data) : data, enc.encode(`\r\n--${b}--`)]) };
}
async function upload(name, data, mime, parent) {
  const s = await existing(parent); if (s.has(name)) return null;
  const m = multipart({ name, parents: [parent] }, data, mime);
  const id = (await (await dfetch(`${UP}/files?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${m.b}` }, body: m.body })).json()).id;
  s.add(name); return id;
}
/** Word/ODT -> Google Dokumen (dikonversi Google) -> ekspor PDF -> hapus berkas sementara. */
async function docToPdf(f) {
  const m = multipart({ name: f.name, mimeType: 'application/vnd.google-apps.document' }, f, f.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const id = (await (await dfetch(`${UP}/files?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${m.b}` }, body: m.body })).json()).id;
  try { return new Uint8Array(await (await dfetch(`${API}/files/${id}/export?mimeType=application%2Fpdf`)).arrayBuffer()); }
  finally { await dfetch(`${API}/files/${id}`, { method: 'DELETE' }).catch(() => {}); }
}

/* ---------------- ekspor massal ---------------- */
const E = () => S.exp || (S.exp = { mode: 'new', from: '', to: '', html: true, proof: true, dest: 'drive', running: false, done: 0, total: 0, msg: '', res: null, cancel: false });
async function collect(e) {
  const b = collection(fs, 'ledger'); let q;
  if (e.mode === 'new') { const x = (await getDoc(doc(fs, 'exports', 'drive'))).data() || { lastSeq: 0 }; q = query(b, where('seq', '>', x.lastSeq || 0), orderBy('seq'), limit(1500)); }
  else if (e.mode === 'range') { if (!e.from || !e.to) throw new Error('Isi rentang tanggal'); q = query(b, where('at', '>=', +new Date(e.from)), where('at', '<', +new Date(e.to) + 864e5), orderBy('at'), limit(1500)); }
  else q = query(b, orderBy('seq'), limit(1500));
  return (await getDocs(q)).docs.map((d) => d.data());
}
async function expRun() {
  const e = E(); if (e.running) return;
  if (e.dest === 'drive') { try { await driveToken(); } catch (x) { return alert('Gagal terhubung ke Google Drive: ' + x.message); } }
  Object.assign(e, { running: true, cancel: false, done: 0, total: 0, msg: 'Mengambil daftar surat…', res: null }); hook.render();
  let zip = null, zn = 0, part = 1, bad = 0, lastOk = 0; const rows = [['seq', 'nomor', 'layanan', 'penandatangan', 'tanggal', 'tipe', 'digantikan_oleh_revisi', 'hash_pdf', 'hash_cocok', 'berkas']], files = [];
  const flush = async () => { if (zip && zn) { saveFile(`arsip-surat-${stamp()}-bagian${part++}.zip`, await zip.generateAsync({ type: 'blob', compression: 'STORE' }), 'application/zip'); zip = null; zn = 0; } };
  const mark = async () => { if (e.mode !== 'range' && lastOk) await setDoc(doc(fs, 'exports', 'drive'), { lastSeq: lastOk, at: Date.now(), by: S.user.uid, dest: e.dest }, { merge: true }); };
  try {
    const entries = await collect(e); e.total = entries.length;
    if (!entries.length) { e.msg = 'Tidak ada surat untuk diekspor.'; return; }
    const sup = new Set(entries.map((x) => x.supersedes).filter(Boolean));
    const root = e.dest === 'drive' ? await ensureFolder('Layanan Surat - Arsip') : null;
    for (let i = 0; i < entries.length && !e.cancel; i++) {
      const en = entries[i]; e.msg = `Memproses ${en.no}…`;
      const L = (await getDoc(doc(fs, 'requests', en.rid, 'letters', String(en.version || 1)))).data();
      const bytes = L.pdfGz ? await gunzip(unb64(L.pdfGz)) : await regen(L.rec), ok = (await sha256(bytes)) === en.docHash; if (!ok) bad++;
      const d = new Date(en.at), dir = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${safe(en.serviceName)}`, base = `${en.seq}-${safe(en.no)}`;
      const list = [[`${base}.pdf`, bytes, 'application/pdf']];
      if (e.html) list.push([`${base}.html`, await letterHtml(L), 'text/html']);
      if (e.dest === 'drive') { const fid = await folderPath(root, dir); for (const [n, data, mime] of list) await upload(n, data, mime, fid); }
      else { zip = zip || new window.JSZip(); for (const [n, data] of list) zip.file(`${dir}/${n}`, data); zn++; if (zn >= 250) await flush(); }
      rows.push([en.seq, en.no, en.serviceName, `${en.signerName} ${en.signerTitle}`.trim(), fdate(en.at), en.type, sup.has(en.seq) ? 'ya' : '', en.docHash, ok ? 'ya' : 'TIDAK', `${dir}/${base}.pdf`]);
      files.push(en.seq); lastOk = en.seq; e.done = i + 1; if (i % 10 === 0) { hook.render(); if (i % 30 === 0) await mark(); }
    }
    // indeks + bukti rantai (rantai penuh agar dapat diverifikasi offline)
    let proof = null; if (e.proof) { e.msg = 'Menyusun bukti rantai…'; hook.render(); const c = await F.chainCheck(); const keys = {}; Object.entries(c.keys).forEach(([k, v]) => { if (v) keys[k] = { pub: v.pub, active: v.active !== false, name: v.name }; }); proof = JSON.stringify({ app: 'layanan-surat-spark', exportedAt: Date.now(), head: c.head, ledger: c.docs, keys }); }
    const idx = csv(rows), tag = stamp();
    if (e.dest === 'drive') { await upload(`indeks-${tag}.csv`, idx, 'text/csv', root); if (proof) await upload(`bukti-rantai-${tag}.json`, proof, 'application/json', root); }
    else { zip = zip || new window.JSZip(); zip.file('indeks.csv', idx); if (proof) zip.file('bukti-rantai.json', proof); zn++; await flush(); }
    e.res = { n: files.length, bad, cancelled: e.cancel, dest: e.dest }; e.msg = e.cancel ? 'Dibatalkan.' : 'Selesai.';
  } catch (x) { e.msg = 'Berhenti: ' + x.message; if (!/Drive/.test(x.message)) alert(x.message); }
  finally { await mark().catch(() => {}); e.running = false; A.loadExport(); }
}

/* ---------------- tampilan ---------------- */
export function exportV() {
  const e = E(), info = S.exportInfo || {}, bk = S.exportBk || {}, dn = e.total ? Math.round((e.done / e.total) * 100) : 0;
  const rd = (k, v, l) => `<label class="chk"><input type="radio" name="x_${k}" ${e[k] === v ? 'checked' : ''} onchange="A.expSet('${k}','${v}')">${l}</label>`;
  return `<div class="card"><h2>📦 Ekspor & cadangan massal</h2>
  <p class="mu">Menyalin banyak surat sekaligus (PDF asli yang dibuat ulang + hash dicocokkan dengan rantai) ke <b>ZIP</b> atau langsung ke <b>Google Drive Anda</b>, tanpa mengunduh satu per satu.</p>
  <div class="row"><b>Google Drive:</b> ${driveOn() ? '<span class="tag ok">terhubung (sesi ±50 menit)</span>' : '<span class="tag">belum terhubung</span>'}<button class="btn g s" onclick="A.driveConnect()">Hubungkan / perbarui</button></div>
  <p class="mu">Ekspor Drive terakhir: ${info.at ? fdate(info.at) + ' · hingga rantai #' + info.lastSeq : 'belum pernah'}.</p>
  <h3>Surat yang diekspor</h3><div>${rd('mode', 'new', 'Hanya yang baru sejak ekspor terakhir')}${rd('mode', 'range', 'Rentang tanggal terbit')}${rd('mode', 'all', 'Semua (maks 1.500 per proses)')}</div>
  ${e.mode === 'range' ? `<div class="row"><input type="date" value="${e.from}" onchange="A.expSet('from',this.value)" style="width:auto"><span>s.d.</span><input type="date" value="${e.to}" onchange="A.expSet('to',this.value)" style="width:auto"></div>` : ''}
  <h3>Tujuan</h3><div>${rd('dest', 'drive', 'Google Drive (folder "Layanan Surat - Arsip/Tahun/Bulan/Layanan")')}${rd('dest', 'zip', 'ZIP di komputer (dipecah per 250 berkas)')}</div>
  <label class="chk"><input type="checkbox" ${e.html ? 'checked' : ''} onchange="A.expSet('html',this.checked)">Sertakan salinan HTML</label>
  <label class="chk"><input type="checkbox" ${e.proof ? 'checked' : ''} onchange="A.expSet('proof',this.checked)">Sertakan bukti rantai (untuk <code>verifikasi-offline.html</code>; membaca seluruh rantai)</label><br>
  <div class="row" style="margin-top:8px"><button class="btn" ${e.running ? 'disabled' : ''} onclick="A.expRun()">▶ Mulai ekspor</button>${e.running ? '<button class="btn r s" onclick="A.expCancel()">Batalkan</button>' : ''}</div>
  ${e.msg ? `<p>${esc(e.msg)}</p>` : ''}${e.total ? `<div class="bar"><i style="width:${dn}%"></i></div><p class="mu">${e.done}/${e.total}</p>` : ''}
  ${e.res ? `<p>${e.res.n} surat diekspor ke ${e.res.dest === 'drive' ? 'Google Drive' : 'ZIP'}. ${e.res.bad ? `<b style="color:var(--er)">⚠ ${e.res.bad} PDF tidak cocok dengan hash rantai</b> (ditandai "TIDAK" di indeks.csv).` : '<b style="color:var(--ok)">Semua hash PDF cocok dengan rantai.</b>'}</p>` : ''}
  <p class="mu">Setiap surat membaca ±2 dokumen Firestore (kuota Spark 50.000 baca/hari). Sesi Drive ±1 jam; bila habis di tengah jalan, hubungkan ulang dan jalankan lagi — mode "baru" melanjutkan dari progres terakhir.</p></div>
  <div class="card"><h3>💾 Cadangan data (JSON)</h3><p class="mu">Terakhir: ${bk.at ? fdate(bk.at) : 'belum pernah'}.</p><div class="row"><button class="btn s" onclick="A.bkDrive()">Cadangkan ke Google Drive</button><button class="btn g s" onclick="A.backup()">⬇ Unduh JSON</button></div></div>`;
}
Object.assign(A, {
  driveConnect: () => run(async () => { await driveToken(true); hook.render(); }),
  expSet(k, v) { E()[k] = v; hook.render(); }, expRun, expCancel() { E().cancel = true; },
  async loadExport() {
    S.exportInfo = (await getDoc(doc(fs, 'exports', 'drive')).catch(() => null))?.data() || {}; S.exportBk = (await getDoc(doc(fs, 'exports', 'backup')).catch(() => null))?.data() || {}; hook.render();
  },
  async bkDrive() {
    try { await driveToken(); } catch (x) { return alert('Gagal terhubung ke Google Drive: ' + x.message); }
    const o = await run(async () => { const j = (await F.bk()).json, fid = await ensureFolder('Layanan Surat - Cadangan'); await upload(`cadangan-${stamp()}.json`, j, 'application/json', fid); return true; });
    if (o) { await setDoc(doc(fs, 'exports', 'backup'), { at: Date.now(), by: S.user.uid }); await setDoc(doc(fs, 'settings', 'app'), { lastBackupAt: Date.now() }, { merge: true }).catch(() => {}); alert('Cadangan tersimpan di Google Drive Anda.'); A.loadExport(); }
  },
  async upDoc(id, inp) {
    const f = inp.files[0]; if (!f) return;
    try { await driveToken(); } catch (x) { return alert('Gagal terhubung ke Google Drive: ' + x.message); }
    const pdf = await run(() => docToPdf(f)); if (pdf) await A.saveTpl(id, f.name.replace(/\.[^.]+$/, '') + '.pdf', pdf);
  },
});
