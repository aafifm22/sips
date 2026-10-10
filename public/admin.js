import { S, F, fs, $, esc, fdate, run, stages, modal, saveFile, tagOf, svc, isAdm, isSup, openQ, QUEUE, DAY, FL, SPECIAL, WHO, STATUS_ALL, STATUS_SELF, hook, flowOf } from './core.js';
import { reqCard, stageTable, stepper, signChecklist } from './user.js';
import { doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { putSig, tplBytes, ensureKey, hasKey, cfg, pendingSlots } from './api.js';
import { sha256, b64, dataUrlBytes } from './crypto.js';

const A = (window.A = window.A || {});
const fill = (body, data) => String(body || '').replace(/\{(\w+)\}/g, (_, k) => data[k] || '…');
const log = (action, target, detail) => F.audit({ action, target, detail }).catch(() => {});

/* ---------- Antrean, perhatian, checklist ---------- */
function agentCard() {
  const on = localStorage.getItem('ly-agent') === '1', el = S.rq.filter((r) => r.status === 'Diajukan' && flowOf(svc(r.sid)).issue === 'auto');
  return `<div class="card"><b>🤖 Penerbit otomatis</b> <label class="chk"><input type="checkbox" ${on ? 'checked' : ''} onchange="A.agentToggle(this.checked)">aktif di perangkat ini</label>
  <p class="mu">Memproses layanan berstatus "Terbit otomatis" tanpa cek ulang admin (sesuai jeda & syarat per layanan). Browser/tab ini harus terbuka dan akun admin harus login. ${el.length ? `<b>${el.length}</b> permintaan menunggu giliran otomatis.` : 'Tidak ada permintaan otomatis yang menunggu.'}</p></div>`;
}
Object.assign(A, { async agentToggle(on) { if (on) { try { await ensureKey(); } catch (e) { alert(e.message); localStorage.removeItem('ly-agent'); return hook.render(); } } localStorage.setItem('ly-agent', on ? '1' : '0'); if (on) F.autoRun(); hook.render(); } });
export function queueV() {
  const o = openQ(), w = S.rq.filter((r) => r.status === 'Menunggu Konfirmasi'), p = S.rq.filter((r) => r.status === 'Menunggu Persetujuan'), dn = S.rq.filter((r) => ['Selesai', 'Dibatalkan'].includes(r.status)).slice(0, 15);
  return `${agentCard()}<div class="card"><h2>Antrean aktif (${o.length})</h2>${o.map((r) => reqCard(r, 1)).join('') || '<p class="mu">Kosong 🎉</p>'}</div>
  <div class="card"><h2>Menunggu persetujuan pejabat (${p.length})</h2>${p.map((r) => reqCard(r, 1)).join('') || '<p class="mu">Tidak ada.</p>'}</div>
  <div class="card"><h2>Menunggu konfirmasi klien (${w.length})</h2>${w.map((r) => reqCard(r, 1)).join('') || '<p class="mu">Tidak ada.</p>'}</div>
  <div class="card"><h3>Riwayat terbaru</h3>${dn.map((r) => reqCard(r, 1)).join('')}<button class="btn g s" onclick="A.moreClosed()">Muat riwayat lebih lama</button><p class="mu">Memuat lebih banyak menambah pemakaian kuota baca Firestore (Spark: 50.000 baca/hari).</p></div>`;
}
export function fbV() {
  const l = S.rq.filter((r) => r.feedback);
  return `<div class="card"><h2>Feedback (${l.length})</h2>${l.map((r) => `<div class="item"><b>${esc(r.sname)}</b> <span class="tag">${'★'.repeat(r.feedback.stars)}</span><div class="mu">${Object.entries(r.feedback.aspects || {}).map(([k, v]) => k + ' ' + v).join(' · ')}</div>${esc(r.feedback.note)}</div>`).join('') || '<p class="mu">Belum ada.</p>'}</div>`;
}
/** Pengganti pengingat terjadwal (tidak ada scheduler di Spark): daftar yang perlu perhatian, dihitung langsung. */
export function attentionV() {
  const now = Date.now(), L = S.rq;
  const late = L.filter((r) => QUEUE.includes(r.status) && now - r.createdAt > (r.slaDays || svc(r.sid).sla || 3) * DAY);
  const expired = L.filter((r) => r.status === 'Menunggu Konfirmasi' && r.confirm && !r.confirm.response && now > r.confirm.deadline);
  const appr = L.filter((r) => r.status === 'Menunggu Persetujuan' && now - ((r.approval && r.approval.requestedAt) || r.updatedAt) > 2 * DAY);
  const row = (t, l, c) => (l.length ? `<div class="card" style="border-left:4px solid var(--${c})"><b>${t} (${l.length})</b>${l.slice(0, 5).map((r) => `<div class="mu">${esc(r.sname)} · ${r.code} · <a href="#" onclick="A.proc('${r.id}');return false">buka</a></div>`).join('')}</div>` : '');
  const bk = S.set.lastBackupAt ? Date.now() - S.set.lastBackupAt > 7 * DAY : true;
  return row('⏰ Melewati batas waktu layanan', late, 'er') + row('⌛ Batas konfirmasi lewat tanpa jawaban (boleh dibatalkan)', expired, 'wa') + row('✍ Menunggu persetujuan pejabat > 2 hari', appr, 'wa')
    + (isSup() && bk ? '<div class="card" style="border-left:4px solid var(--wa)"><b>💾 Sudah > 7 hari sejak cadangan terakhir</b> <button class="btn s" onclick="A.nav(\'set\')">Buka Pengaturan</button></div>' : '');
}
export function checklistV() {
  if (!isSup()) return '';
  const it = [[!!S.metaSuper, 'Admin Super terdaftar', ''], [!!S.head, 'Rantai hash diinisialisasi', 'Pengaturan'], [!!S.set.appUrl, 'URL aplikasi diisi (QR & tautan)', 'Pengaturan'], [S.sv.length > 0, 'Layanan awal dimuat', 'Layanan'], [S.keyReady, 'Kunci tanda tangan digital di perangkat ini', 'Rantai']];
  if (it.every((x) => x[0])) return '';
  return `<div class="card"><h3>🚀 Langkah awal</h3>${it.map(([ok, t, go]) => `<div>${ok ? '✅' : '⬜'} ${t} ${!ok && go ? `<button class="btn g s" onclick="A.nav('${{ Pengaturan: 'set', Layanan: 'svc', Rantai: 'ledger' }[go]}')">Buka ${go}</button>` : ''}</div>`).join('')}</div>`;
}
/* ---------- Layanan & template ---------- */
const SEED = [
  ['aktif', 'Surat Keterangan Aktif Kuliah', 'KET-AKT', 2, 'auto', ['nama', 'nim', 'prodi', 'smt', 'ket'], ['Mahasiswa', 'Guest'], 'Yang bertanda tangan di bawah ini menerangkan bahwa:\n\nNama: {nama}\nNIM: {nim}\nProgram Studi: {prodi}\nSemester: {smt}\n\nadalah benar mahasiswa aktif pada tahun akademik berjalan. Surat ini dibuat untuk keperluan {ket}.'],
  ['izin-penelitian', 'Surat Izin Penelitian / Pengambilan Data', 'IZN-PEN', 5, 'template', ['nama', 'nim', 'prodi', 'tujuan', 'ket'], ['Mahasiswa', 'Guest'], 'Dengan hormat,\n\nKami mohon izin bagi mahasiswa kami:\nNama: {nama}\nNIM: {nim}\nProgram Studi: {prodi}\n\nuntuk melakukan penelitian/pengambilan data di {tujuan} dengan topik: {ket}.'],
  ['pkl', 'Surat Pengantar PKL / Observasi', 'PKL', 4, 'template', ['nama', 'nim', 'prodi', 'tujuan', 'ket'], ['Mahasiswa', 'Guest'], 'Dengan hormat,\n\nMahasiswa {nama} (NIM {nim}, {prodi}) akan melaksanakan PKL/observasi di {tujuan}. Keterangan: {ket}.'],
  ['cuti', 'Surat Cuti Akademik', 'CUTI', 3, 'template', ['nama', 'nim', 'prodi', 'smt', 'ket'], ['Mahasiswa'], 'Menyetujui permohonan cuti akademik atas nama {nama} (NIM {nim}, {prodi}) pada semester {smt} dengan alasan: {ket}.'],
  ['lulus', 'Surat Keterangan Lulus', 'KET-LLS', 3, 'auto', ['nama', 'nim', 'prodi', 'ket'], ['Mahasiswa', 'Guest'], 'Menerangkan bahwa {nama} (NIM {nim}) Program Studi {prodi} dinyatakan LULUS. Surat ini dibuat untuk {ket}.'],
  ['beasiswa', 'Surat Rekomendasi Beasiswa', 'REK-BSW', 5, 'ai', ['nama', 'nim', 'prodi', 'ket'], ['Mahasiswa'], 'Surat rekomendasi untuk {nama} (NIM {nim}, {prodi}). Latar belakang: {ket}.'],
  ['legalisir', 'Legalisir Ijazah / Transkrip', 'LEG', 3, 'auto', ['nama', 'nim', 'prodi', 'ket'], ['Mahasiswa', 'Guest'], 'Dokumen atas nama {nama} (NIM {nim}, {prodi}) telah dilegalisir sesuai aslinya untuk keperluan {ket}.'],
  ['kelakuan', 'Surat Keterangan Berkelakuan Baik', 'KET-KLB', 3, 'auto', ['nama', 'nim', 'prodi', 'ket'], ['Mahasiswa', 'Guest'], 'Menerangkan bahwa {nama} (NIM {nim}, {prodi}) berkelakuan baik selama menempuh pendidikan. Untuk keperluan {ket}.'],
  ['dosen-aktif', 'Surat Keterangan Dosen Aktif', 'KET-DSN', 2, 'auto', ['nama', 'nim', 'prodi', 'ket'], ['Dosen', 'Tendik'], 'Menerangkan bahwa {nama} (NIP/NIDN {nim}) adalah dosen/tenaga pendidik aktif di {prodi}. Untuk keperluan {ket}.'],
  ['tugas', 'Surat Tugas Dosen / Tendik', 'ST', 3, 'ai', ['nama', 'nim', 'prodi', 'tujuan', 'ket'], ['Dosen', 'Tendik', 'Ketua STIKES', 'Waket 1', 'Waket 2'], 'Memberi tugas kepada {nama} ({nim}, {prodi}) untuk kegiatan di {tujuan}: {ket}.'],
  ['kegiatan', 'Surat Izin Kegiatan Kemahasiswaan', 'IZN-KGT', 4, 'ai', ['nama', 'nim', 'prodi', 'ket'], ['Mahasiswa'], 'Memberi izin kegiatan yang diajukan oleh {nama} ({nim}, {prodi}): {ket}.'],
];
export function svcV() {
  return `<div class="card"><h2>Kelola Layanan</h2><div class="row"><button class="btn s" onclick="A.addSvc()">+ Tambah layanan</button>${isSup() ? '<button class="btn g s" onclick="A.seedSvc()">Isi layanan awal (11 contoh)</button>' : ''}</div>
  ${S.sv.map((s) => {
    const t = s.template;
    return `<div class="item"><div class="row"><input value="${esc(s.name)}" style="flex:3;margin:0" onchange="A.sv('${s.id}','name',this.value)"><input value="${esc(s.code || '')}" placeholder="Kode" style="flex:1;margin:0" onchange="A.sv('${s.id}','code',this.value)">
    <label>Batas hari<input type="number" min="1" value="${s.sla}" style="width:70px;margin:0 0 0 6px" onchange="A.sv('${s.id}','sla',+this.value)"></label>
    <select style="width:auto;margin:0" onchange="A.sv('${s.id}','mode',this.value)">${[['auto', 'Otomatis'], ['template', 'Template'], ['ai', 'Dibantu AI']].map(([v, l]) => `<option value="${v}" ${s.mode === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div style="margin-top:6px"><span class="mu">Boleh diajukan oleh:</span> ${WHO.map((w) => `<label class="chk"><input type="checkbox" ${(s.who || []).includes(w) ? 'checked' : ''} onchange="A.tg('${s.id}','who','${w}',this.checked)">${w}</label>`).join('')}</div>
    <div><span class="mu">Isian formulir:</span> ${Object.keys(FL).map((k) => `<label class="chk"><input type="checkbox" ${(s.fields || []).includes(k) ? 'checked' : ''} onchange="A.tg('${s.id}','fields','${k}',this.checked)">${FL[k]}</label>`).join('')}</div>
    <div class="row"><label class="chk"><input type="checkbox" ${s.on ? 'checked' : ''} onchange="A.sv('${s.id}','on',this.checked)">Aktif</label><label class="chk"><input type="checkbox" ${s.needSign ? 'checked' : ''} onchange="A.sv('${s.id}','needSign',this.checked)">Perlu TTD</label>
    <input placeholder="Nama penandatangan bawaan" value="${esc(s.signName || '')}" style="width:190px;margin:0" onchange="A.sv('${s.id}','signName',this.value)"><input placeholder="Jabatan" value="${esc(s.signTitle || '')}" style="width:160px;margin:0" onchange="A.sv('${s.id}','signTitle',this.value)"></div>
    ${flowUI(s)}
    <label>Template teks isi surat (gunakan {nama}, {nim}, {prodi}, {smt}, {tujuan}, {ket})</label><textarea rows="3" onchange="A.sv('${s.id}','body',this.value)">${esc(s.body || '')}</textarea>
    <div class="row"><label class="btn g s">📄 ${t && t.id ? 'Ganti template PDF' : 'Unggah template PDF'}<input type="file" accept="application/pdf" hidden onchange="A.upTpl('${s.id}',this)"></label><label class="btn g s">📝 Word → PDF (via Google Drive)<input type="file" accept=".docx,.doc,.odt,.rtf" hidden onchange="A.upDoc('${s.id}',this)"></label>
    ${t && t.id ? `<span class="tag">v${t.version} · ${esc(t.name)} · ${t.mode === 'acroform' ? 'AcroForm' : 'koordinat'}</span><button class="btn s" onclick="A.mapEd('${s.id}')">Atur penempatan</button><button class="btn g s" onclick="A.tplVers('${s.id}')">Riwayat versi</button>` : '<span class="mu">Tanpa template: memakai tata letak surat standar.</span>'}
    <button class="btn r s" onclick="A.delSvc('${s.id}')">Hapus</button></div></div>`;
  }).join('')}</div>
  <div class="card"><h3>Catatan fidelitas PDF (100% mirip unggahan)</h3><p class="mu">Template PDF Anda dipakai sebagai dasar dokumen, bukan digambar ulang. Data diisi lewat field AcroForm (jika PDF punya form) atau ditempel pada koordinat yang Anda tandai pada "Atur penempatan". Font, logo, tabel, dan tata letak asli tetap utuh. Syarat: unggah PDF berkualitas asli (bukan hasil foto), dan tandai posisi tiap isian sekali saja.</p></div>`;
}
/* ---------- Alur penerbitan & checklist penandatangan (dinamis per layanan) ---------- */
function flowUI(s) {
  const f = flowOf(s), id = s.id, sg = S.users.filter((u) => u.signer);
  const row = (sl) => `<div class="row" style="margin:4px 0"><label class="chk"><input type="checkbox" ${sl.required !== false ? 'checked' : ''} onchange="A.signerSet('${id}','${sl.key}',{required:this.checked})">wajib</label>
    <input value="${esc(sl.label)}" placeholder="Label (mis. Ketua)" style="width:140px;margin:0" onchange="A.signerSet('${id}','${sl.key}',{label:this.value})">
    <select style="width:auto;margin:0" onchange="A.signerSet('${id}','${sl.key}',{uid:this.value})"><option value="">— pilih pejabat —</option>${sg.map((u) => `<option value="${u.id}" ${sl.uid === u.id ? 'selected' : ''}>${esc(u.name)}${u.signerTitle ? ' (' + esc(u.signerTitle) + ')' : ''}</option>`).join('')}</select>
    <select style="width:auto;margin:0" onchange="A.signerSet('${id}','${sl.key}',{mode:this.value})"><option value="manual" ${sl.mode !== 'delegated' ? 'selected' : ''}>Manual: pejabat login & menyetujui</option><option value="delegated" ${sl.mode === 'delegated' ? 'selected' : ''}>Otomatis: delegasi tanda tangan</option></select>
    <label class="chk">urutan<input type="number" min="1" value="${sl.order || 1}" style="width:56px;margin:0 0 0 4px" onchange="A.signerSet('${id}','${sl.key}',{order:+this.value})"></label><button class="btn r s" onclick="A.signerDel('${id}','${sl.key}')">×</button></div>`;
  return `<div class="card" style="background:var(--bg)"><b>Alur penerbitan & penandatangan</b>
  <div class="row"><label class="chk"><input type="radio" name="fi_${id}" ${f.issue === 'admin' ? 'checked' : ''} onchange="A.flow('${id}',{issue:'admin'})">Admin cek ulang lalu terbitkan</label><label class="chk"><input type="radio" name="fi_${id}" ${f.issue === 'auto' ? 'checked' : ''} onchange="A.flow('${id}',{issue:'auto'})">Terbit otomatis (tanpa cek ulang admin)</label></div>
  ${f.issue === 'auto' ? `<div class="row">Jeda <input type="number" min="0" value="${f.autoDelayMin}" style="width:70px;margin:0" onchange="A.flow('${id}',{autoDelayMin:+this.value})"> menit sebelum diproses <label class="chk"><input type="checkbox" ${f.autoVerifiedOnly ? 'checked' : ''} onchange="A.flow('${id}',{autoVerifiedOnly:this.checked})">hanya pemohon terverifikasi (bukan tamu)</label></div><p class="mu">Berlaku untuk layanan bermode Otomatis/Template. Dijalankan oleh <b>penerbit otomatis</b> di perangkat admin yang menyala (menu Antrean). Admin dapat menahan per permintaan selama jeda.</p>` : ''}
  <div class="mu" style="margin-top:6px"><b>Checklist penandatangan</b>. Kosong = tanpa pejabat (surat memakai nama bawaan layanan, diterbitkan admin). <i>Manual</i>: pejabat login, meninjau, dan menandatangani digital. <i>Otomatis</i>: tanda tangan gambar pejabat dibubuhkan sesuai delegasi yang ia aktifkan (dicatat di surat). Urutan sama = paralel; urutan berbeda = berjenjang.</div>
  ${f.signers.map(row).join('') || '<div class="mu">(belum ada penandatangan)</div>'}
  <button class="btn g s" onclick="A.signerAdd('${id}')">+ Penandatangan</button></div>`;
}
async function saveFlow(id, flow) {
  const signers = flow.signers.filter((x) => x.required !== false && x.mode !== 'delegated' && x.uid), approverUids = [...new Set(signers.map((x) => x.uid))];
  await run(() => updateDoc(doc(fs, 'services', id), { flow, approverUids, needApproval: approverUids.length > 0, needSign: flow.signers.length > 0 || !!svc(id).needSign }));
  log('service.flow', id, JSON.stringify(flow).slice(0, 200));
}
Object.assign(A, {
  flow(id, patch) { const f = flowOf(svc(id)); return saveFlow(id, { ...f, ...patch }); },
  signerSet(id, key, patch) { const f = flowOf(svc(id)); return saveFlow(id, { ...f, signers: f.signers.map((x) => (x.key === key ? { ...x, ...patch } : x)) }); },
  signerAdd(id) { const f = flowOf(svc(id)); return saveFlow(id, { ...f, signers: [...f.signers, { key: 's' + Date.now().toString(36), label: 'Penandatangan ' + (f.signers.length + 1), uid: '', mode: 'manual', required: true, order: (f.signers.length ? Math.max(...f.signers.map((x) => x.order || 1)) : 0) + 1 }] }); },
  signerDel(id, key) { const f = flowOf(svc(id)); return saveFlow(id, { ...f, signers: f.signers.filter((x) => x.key !== key) }); },
});
const lblOf = (s, k) => { if (FL[k] || SPECIAL[k]) return FL[k] || SPECIAL[k]; const [t, sk] = k.split(':'), sl = flowOf(s).signers.find((x) => x.key === sk); return `${{ _ttd: 'TTD', _ttd_nama: 'Nama', _ttd_jabatan: 'Jabatan' }[t] || t}: ${sl ? sl.label : sk}`; };
let M = null; // state editor penempatan
const DEF = { _isi: { w: 450, size: 11 }, _ttd: { w: 140, h: 60 }, _qr: { w: 70 } };
Object.assign(A, {
  async sv(id, k, v) { await run(() => updateDoc(doc(fs, 'services', id), { [k]: v })); log('service.update', id, k); },
  async tg(id, k, item, on) { const cur = svc(id)[k] || []; await A.sv(id, k, on ? [...new Set([...cur, item])] : cur.filter((x) => x !== item)); },
  async addSvc() {
    const n = prompt('Nama layanan baru?'); if (!n) return;
    const id = 's' + Date.now();
    await run(() => setDoc(doc(fs, 'services', id), { name: n, code: 'SRT', sla: 3, mode: 'template', on: true, fields: ['nama', 'nim', 'prodi', 'ket'], who: ['Mahasiswa'], needSign: true, signName: '', signTitle: 'Ketua STIKES YKY', body: 'Menerangkan bahwa {nama} (NIM {nim}, {prodi}) untuk keperluan {ket}.', order: Date.now() }));
    log('service.create', id, n);
  },
  async delSvc(id) { if (confirm('Hapus layanan ini? Permintaan lama tetap tersimpan.')) { await run(() => deleteDoc(doc(fs, 'services', id))); log('service.delete', id); } },
  async seedSvc() {
    if (!confirm('Menambahkan/menimpa 11 layanan contoh dengan ID yang sama. Lanjutkan?')) return;
    for (const [id, name, code, sla, mode, fields, who, body] of SEED) await setDoc(doc(fs, 'services', id), { name, code, sla, mode, fields, who, body, on: true, needSign: true, signName: '', signTitle: 'Ketua STIKES YKY', order: sla });
    log('service.seed', '', '11 layanan');
  },
  async upTpl(id, inp) {
    const f = inp.files[0]; if (!f) return;
    if (f.type !== 'application/pdf') return alert('Hanya PDF. Untuk Word/ODT pakai tombol "Word → PDF (via Google Drive)".');
    await A.saveTpl(id, f.name, new Uint8Array(await f.arrayBuffer()));
  },
  async saveTpl(id, name, bytes) {
    if (bytes.length > 2.4e6) return alert('Maksimal ±2,4 MB. Kompres PDF (kurangi gambar/font) lalu coba lagi.');
    const s = svc(id), v = ((s.template && s.template.version) || 0) + 1, tid = `${id}_v${v}`, sha = await sha256(bytes), all = b64(bytes), N = Math.ceil(all.length / 850000);
    await run(async () => {
      for (let i = 1; i <= N; i++) { const part = all.slice((i - 1) * 850000, i * 850000); await setDoc(doc(fs, 'templates', i === 1 ? tid : `${tid}_p${i}`), i === 1 ? { sid: id, version: v, name, sha, size: bytes.length, parts: N, b64: part, at: Date.now() } : { b64: part }); }
      const t = { id: tid, version: v, name, sha, mode: (s.template && s.template.mode) || 'stamp', map: (s.template && s.template.map) || {} };
      await setDoc(doc(fs, 'services', id, 'versions', String(v)), { ...t, at: Date.now(), by: S.user.uid });
      await updateDoc(doc(fs, 'services', id), { template: t });
      log('template.upload', id, `v${v} ${name} sha ${sha.slice(0, 12)}`);
    });
  },
  async tplVers(id) {
    const q = await getDocs(query(collection(fs, 'services', id, 'versions'), orderBy('at', 'desc'))), cur = svc(id).template;
    modal(`<h2>Riwayat versi template</h2><table>${q.docs.map((d) => { const x = d.data(); return `<tr><td>v${x.version}</td><td>${esc(x.name)}</td><td>${fdate(x.at)}</td><td>${cur && cur.version === x.version ? '<span class="tag ok">aktif</span>' : `<button class="btn s" onclick="A.tplUse('${id}','${d.id}')">Aktifkan</button>`}</td></tr>`; }).join('')}</table><p class="mu">Surat yang sudah terbit tidak berubah; versi aktif dipakai untuk surat berikutnya.</p><button class="btn g s" onclick="A.close()">Tutup</button>`);
  },
  async tplUse(id, v) {
    const d = await getDocs(collection(fs, 'services', id, 'versions')), x = d.docs.find((y) => y.id === v).data();
    await run(() => updateDoc(doc(fs, 'services', id), { template: { id: x.id, version: x.version, name: x.name, sha: x.sha, mode: x.mode, map: x.map || {} } }));
    log('template.activate', id, 'v' + v); modal('');
  },
  /* editor penempatan: klik pada pratinjau PDF untuk menandai posisi isian */
  async mapEd(id) {
    const s = svc(id); if (!window.pdfjsLib) return alert('pdf.js tidak termuat (periksa koneksi internet).');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const bytes = await run(() => tplBytes(s.template.id)); if (!bytes) return;
    const pdf = await window.pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    M = { id, pdf, page: 0, sel: '', map: JSON.parse(JSON.stringify(s.template.map || {})), mode: s.template.mode || 'stamp', scale: 1.2 };
    const keys = [...(s.fields || []), ...Object.keys(SPECIAL), ...flowOf(s).signers.flatMap((x) => [`_ttd:${x.key}`, `_ttd_nama:${x.key}`, `_ttd_jabatan:${x.key}`])];
    modal(`<h2>Penempatan isian · ${esc(s.name)}</h2>
    <div class="row"><label>Mode<select id="mmode" onchange="A.mMode(this.value)" style="width:auto"><option value="stamp" ${M.mode === 'stamp' ? 'selected' : ''}>Koordinat (PDF datar)</option><option value="acroform" ${M.mode === 'acroform' ? 'selected' : ''}>AcroForm (nama field = kunci isian)</option></select></label>
    <label>Halaman<select id="mpage" onchange="A.mPage(+this.value)" style="width:auto">${Array.from({ length: pdf.numPages }, (_, i) => `<option value="${i}">${i + 1}</option>`).join('')}</select></label>
    <label>Tandai<select id="mkey" onchange="A.mSel(this.value)" style="width:auto"><option value="">— pilih isian lalu klik pada PDF —</option>${keys.map((k) => `<option value="${k}">${lblOf(s, k)}</option>`).join('')}</select></label></div>
    <p class="mu">Klik pada titik awal teks (untuk TTD/QR: pojok kiri-bawah gambar; untuk Isi surat: pojok kiri-atas kotak).</p>
    <div class="scroll"><canvas id="mcv" style="border:1px solid var(--bd);cursor:crosshair"></canvas></div><div id="mlist"></div>
    <div class="row"><button class="btn" onclick="A.mSave()">Simpan penempatan</button><button class="btn g" onclick="A.close()">Batal</button></div>`);
    $('#mcv').onclick = (e) => {
      if (!M.sel) return alert('Pilih isian yang akan ditandai terlebih dahulu.');
      const c = e.target, b = c.getBoundingClientRect(), cx = ((e.clientX - b.left) * c.width) / b.width, cy = ((e.clientY - b.top) * c.height) / b.height;
      M.map[M.sel] = { ...(DEF[M.sel.split(':')[0]] || { size: 11 }), ...(M.map[M.sel] || {}), page: M.page, x: Math.round(cx / M.scale), y: Math.round((c.height - cy) / M.scale) };
      A.mDraw();
    };
    A.mDraw();
  },
  mMode(v) { M.mode = v; }, mSel(v) { M.sel = v; }, mPage(p) { M.page = p; A.mDraw(); },
  mSet(k, f, v) { M.map[k][f] = +v; A.mDraw(); }, mDel(k) { delete M.map[k]; A.mDraw(); },
  async mDraw() {
    const pg = await M.pdf.getPage(M.page + 1), vp = pg.getViewport({ scale: M.scale }), c = $('#mcv'), x = c.getContext('2d');
    c.width = vp.width; c.height = vp.height;
    await pg.render({ canvasContext: x, viewport: vp }).promise;
    x.fillStyle = '#e11d48'; x.font = '12px sans-serif';
    for (const [k, p] of Object.entries(M.map)) if ((p.page || 0) === M.page) { const px = p.x * M.scale, py = c.height - p.y * M.scale; x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill(); x.fillText(lblOf(svc(M.id), k), px + 7, py - 4); }
    $('#mlist').innerHTML = `<table>${Object.entries(M.map).map(([k, p]) => `<tr><td>${lblOf(svc(M.id), k)}</td><td>hal ${p.page + 1}</td><td>x<input type="number" value="${p.x}" style="width:70px" onchange="A.mSet('${k}','x',this.value)"> y<input type="number" value="${p.y}" style="width:70px" onchange="A.mSet('${k}','y',this.value)"></td><td>${p.size != null ? `ukuran<input type="number" value="${p.size}" style="width:60px" onchange="A.mSet('${k}','size',this.value)">` : ''}${p.w != null ? ` lebar<input type="number" value="${p.w}" style="width:70px" onchange="A.mSet('${k}','w',this.value)">` : ''}</td><td><button class="btn r s" onclick="A.mDel('${k}')">×</button></td></tr>`).join('')}</table>`;
  },
  async mSave() {
    const s = svc(M.id), t = { ...s.template, map: M.map, mode: M.mode };
    await run(async () => {
      await updateDoc(doc(fs, 'services', M.id), { template: t });
      await setDoc(doc(fs, 'services', M.id, 'versions', String(t.version)), { map: M.map, mode: M.mode }, { merge: true });
    });
    log('template.map', M.id, `v${t.version} ${M.mode}`); modal('');
  },
});


/* ---------- Tanda tangan (gambar) ---------- */
const keep = (key) => { const d = (S.draft[key] = S.draft[key] || {}); if ($('#lc')) d.content = $('#lc').value; if ($('#sgn')) { d.signName = $('#sgn').value; d.signTitle = $('#sgj').value; } };
const reopen = (k) => (k.startsWith('ap:') ? A.approve(k.slice(3), S.draft[k] && S.draft[k].revise) : proc(k));
async function loadSigners() { S.signers = (await getDocs(query(collection(fs, 'signatures'), where('uid', '==', S.user.uid)))).docs.map((d) => ({ id: d.id, ...d.data() })); }
async function preloadSig(key, sha) { if (!S.sig[key] && sha) { const sd = await getDoc(doc(fs, 'signatures', sha)); if (sd.exists()) S.sig[key] = { sha, url: sd.data().png }; } }
function sigUI(key, sn, jt, req) {
  const cur = S.sig[key];
  return `<h3>Tanda tangan</h3><p class="mu">Tanda tangan digital kriptografis (kunci perangkat Anda) selalu dibubuhkan saat terbit. ${req ? 'Layanan ini juga meminta <b>gambar tanda tangan</b>:' : 'Gambar tanda tangan bersifat opsional:'}</p>
  <div class="row"><input id="sgn" placeholder="Nama penandatangan (tercetak di surat)" value="${esc(sn)}" style="flex:1;margin:0"><input id="sgj" placeholder="Jabatan" value="${esc(jt)}" style="flex:1;margin:0"></div>
  <div style="margin:8px 0">${cur ? `<img src="${cur.url}" style="height:70px;background:#fff;border:1px solid var(--bd)">` : '<span class="mu">Belum ada gambar tanda tangan</span>'}</div>
  <canvas class="sig" id="cv" width="360" height="140"></canvas>
  <div class="row" style="margin-top:6px"><button class="btn g s" onclick="A.cvClear()">Hapus coretan</button><button class="btn s" onclick="A.sigDraw('${key}')">Pakai gambar ini</button><label class="btn g s">Unggah gambar<input type="file" accept="image/*" hidden onchange="A.sigUp('${key}',this)"></label>
  ${S.signers.length ? `<select style="width:auto;margin:0" onchange="A.sigUse('${key}',this.value)"><option value="">Pakai tersimpan…</option>${S.signers.map((x, i) => `<option value="${i}">${esc(x.label || 'TTD ' + (i + 1))}</option>`).join('')}</select>` : ''}<button class="btn r s" onclick="A.sigDel('${key}')">Hapus gambar</button></div>`;
}
Object.assign(A, {
  initCv() {
    const c = $('#cv'); if (!c) return;
    const x = c.getContext('2d'); x.lineWidth = 2.2; x.lineCap = 'round'; x.strokeStyle = '#111'; let d = 0;
    const p = (e) => { const b = c.getBoundingClientRect(); return [((e.clientX - b.left) * c.width) / b.width, ((e.clientY - b.top) * c.height) / b.height]; };
    c.onpointerdown = (e) => { d = 1; c.setPointerCapture(e.pointerId); const [a, b] = p(e); x.beginPath(); x.moveTo(a, b); };
    c.onpointermove = (e) => { if (!d) return; const [a, b] = p(e); x.lineTo(a, b); x.stroke(); };
    c.onpointerup = () => (d = 0);
  },
  cvClear() { const c = $('#cv'); c.getContext('2d').clearRect(0, 0, c.width, c.height); },
  async sigSet(key, url) { keep(key); const sha = await run(() => putSig(url, (S.draft[key] || {}).signName || S.p.name)); if (sha) { S.sig[key] = { sha, url }; reopen(key); } },
  sigDraw(key) {
    const c = $('#cv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let ok = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) { ok = 1; break; }
    if (!ok) return alert('Coretkan tanda tangan terlebih dahulu'); A.sigSet(key, c.toDataURL('image/png'));
  },
  sigUp(key, inp) {
    const f = inp.files[0]; if (!f) return; const fr = new FileReader();
    fr.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 360 / im.width, 140 / im.height), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); A.sigSet(key, c.toDataURL('image/png')); }; im.onerror = () => alert('Gambar tidak valid'); im.src = fr.result; };
    fr.readAsDataURL(f);
  },
  sigUse(key, i) { if (i === '') return; const x = S.signers[i]; keep(key); S.sig[key] = { sha: x.id, url: x.png }; reopen(key); },
  sigDel(key) { keep(key); delete S.sig[key]; reopen(key); },
});

/* ---------- Proses surat (admin) ---------- */
async function proc(id) {
  const r = S.rq.find((x) => x.id === id); if (!r) return;
  await loadSigners();
  const s = svc(r.sid), c = r.confirm, now = Date.now(), D = S.draft[id] || {}, dr = r.draft || {};
  const vs = r.letter ? (await getDocs(query(collection(fs, 'requests', id, 'letters'), orderBy('version', 'desc')))).docs : [], last = vs[0] && vs[0].data();
  await preloadSig(id, dr.sigSha || (last && last.rec.sigSha));
  const content = D.content ?? dr.content ?? (last && last.rec.content) ?? fill(s.body, r.data);
  const sn = D.signName ?? dr.signerName ?? (last && last.rec.signerName) ?? s.signName ?? S.p.name, jt = D.signTitle ?? dr.signerTitle ?? (last && last.rec.signerTitle) ?? s.signTitle ?? 'Ketua STIKES YKY';
  const canCancel = r.status === 'Menunggu Konfirmasi' && c && !c.response && now > c.deadline;
  const editable = ['Diajukan', 'Diproses', 'Selesai'].includes(r.status);
  const fl = flowOf(s), req = fl.signers.filter((x) => x.required !== false), man = req.filter((x) => x.mode !== 'delegated' && x.uid), legacySig = !req.length;
  const direct = !man.length && r.status === 'Diproses', send = man.length > 0 && r.status === 'Diproses', revise = r.status === 'Selesai' && man.length === 0;
  modal(`<h2>${esc(r.sname)} <span class="mu">${r.code}</span></h2>${tagOf(r)}${stepper(r)}
  <table>${Object.entries(r.data || {}).map(([k, v]) => `<tr><th>${FL[k] || k}</th><td>${esc(v)}</td></tr>`).join('')}<tr><th>Pemohon</th><td>${esc(r.requester.name)} · ${esc(r.requester.email)} · ${esc(r.requester.phone || '')} · ${esc(r.requester.status)}</td></tr></table>
  <h3>Durasi tiap tahap</h3>${stageTable(r)}${signChecklist(r)}
  <div class="card"><h3>Tindakan</h3><div class="row">
    ${r.status === 'Diajukan' ? `<button class="btn s" onclick="A.act('${id}','process')">▶ Mulai proses</button>` : ''}
    ${r.status === 'Diajukan' && fl.issue === 'auto' ? `<button class="btn g s" onclick="A.act('${id}','hold')">${r.autoHold ? '▶ Lanjutkan terbit otomatis' : '⏸ Tahan terbit otomatis'}</button>` : ''}
    ${QUEUE.includes(r.status) ? `<button class="btn g s" onclick="A.askConfirm('${id}')">❓ Minta konfirmasi klien</button>` : ''}
    ${['Diajukan', 'Diproses', 'Menunggu Konfirmasi'].includes(r.status) ? `<button class="btn s ${r.priority ? 'r' : ''}" onclick="A.act('${id}','set_priority')">${r.priority ? 'Turunkan prioritas' : '🔥 Sundul / prioritaskan'}</button>` : ''}
    ${r.status === 'Menunggu Konfirmasi' ? `<button class="btn r s" ${canCancel ? '' : 'disabled'} onclick="A.cancelAdm('${id}')">Batalkan (klien tidak menjawab)</button>` : ''}</div>
  ${r.status === 'Menunggu Konfirmasi' ? `<p class="mu">Pertanyaan: ${esc(c.question)} · batas jawaban ${fdate(c.deadline)}. ${c.response ? 'Klien menjawab: ' + c.response : canCancel ? 'Batas lewat tanpa jawaban: admin kini boleh membatalkan.' : 'Admin baru boleh membatalkan setelah batas waktu lewat tanpa jawaban klien.'}</p>` : '<p class="mu">Admin tidak dapat membatalkan langsung. Gunakan "Minta konfirmasi klien"; bila klien tidak menjawab sampai batas waktu, permintaan dapat dibatalkan.</p>'}
  ${r.status === 'Menunggu Persetujuan' ? `<p class="mu">✍ Menunggu persetujuan pejabat. ${r.approval && r.approval.note ? 'Catatan: ' + esc(r.approval.note) : ''}</p>` : r.approval && r.approval.state === 'rejected' ? `<p class="mu" style="color:var(--er)">Pejabat meminta revisi: ${esc(r.approval.note || '-')}</p>` : ''}
  <div class="row"><input id="flg" placeholder="Flag (mis. Urgent Akreditasi)" value="${esc(r.flag)}" style="flex:1;margin:0"><button class="btn g s" onclick="A.flag('${id}')">Simpan flag</button></div></div>
  ${editable ? `<div class="card"><h3>Surat ${r.letter ? `· No. ${esc(r.letter.no)} · v${r.letter.version} · rantai #${r.letter.seq}` : ''}</h3>
    ${s.mode === 'ai' ? `<button class="btn g s" onclick="A.aiDraft('${id}')">✨ Draf dengan AI</button>` : ''}
    <label>Isi surat ${s.template && s.template.id ? '(ditempel ke template PDF sesuai penempatan)' : ''}</label><textarea id="lc" rows="8">${esc(content)}</textarea>
    ${legacySig ? sigUI(id, sn, jt, s.needSign) : `<p class="mu">Penandatangan mengikuti checklist alur layanan (di atas). ${man.length ? 'Pejabat manual menandatangani setelah Anda mengirim; penandatangan terakhir menerbitkan.' : 'Tanda tangan otomatis dibubuhkan sesuai delegasi yang aktif.'}</p>`}
    <label>Catatan (opsional)</label><input id="lnote" placeholder="mis. perbaikan nama">
    <div class="row"><button class="btn g" onclick="A.prev('${id}')">👁 Pratinjau PDF</button>
      ${r.status === 'Diproses' ? `<button class="btn g" onclick="A.saveDraft('${id}')">Simpan draf</button>` : ''}
      ${direct ? `<button class="btn" onclick="A.issue('${id}',false)">✔ Terbitkan & catat ke rantai</button>` : ''}
      ${send ? `<button class="btn" onclick="A.sendAppr('${id}')">✍ Kirim ke pejabat untuk disetujui</button>` : ''}
      ${revise ? `<button class="btn" onclick="A.issue('${id}',true)">Terbitkan revisi (versi baru)</button>` : ''}</div>
    ${r.status === 'Diajukan' ? '<p class="mu">Klik "Mulai proses" dulu sebelum menerbitkan.</p>' : ''}
    ${vs.length ? `<h3 style="margin-top:12px">Riwayat versi surat</h3><table>${vs.map((d) => { const x = d.data(); return `<tr><td>v${x.version}</td><td>#${x.seq}</td><td>${fdate(x.at)}</td><td>${esc(x.note || '')}</td><td><button class="btn g s" onclick="A.dlL('${id}',${x.version})">Unduh</button> <button class="btn g s" onclick="A.viewHtml('${id}',${x.version})">HTML</button> <a class="btn g s" href="#/v/${x.rec.vcode}" onclick="A.close()">Verifikasi</a></td></tr>`; }).join('')}</table>` : ''}</div>` : ''}
  <button class="btn g s" onclick="A.close()">Tutup</button>`);
}
async function previewOf(key) {
  const id = key.replace(/^ap:/, ''), r = S.rq.find((x) => x.id === id) || S.appr.find((x) => x.id === id), s = svc(r.sid); keep(key);
  const D = S.draft[key] || {}, dr = r.draft || {};
  return F.preview({ r, content: D.content ?? dr.content ?? fill(s.body, r.data), signerName: D.signName ?? dr.signerName ?? s.signName ?? S.p.name, signerTitle: D.signTitle ?? dr.signerTitle ?? s.signTitle ?? '', sigSha: (S.sig[key] || {}).sha || null });
}
Object.assign(A, {
  proc,
  async prev(key) { const b = await run(() => previewOf(key)); if (b) window.open(URL.createObjectURL(new Blob([b], { type: 'application/pdf' })), '_blank'); },
  async askConfirm(id) {
    const q = prompt('Tulis pertanyaan/alasan untuk klien (mis. "Data kurang lengkap. Apakah surat ini masih Anda perlukan?")'); if (q === null) return;
    if (await run(() => F.change({ id, action: 'ask_confirm', note: q }))) setTimeout(() => proc(id), 500);
  },
  async cancelAdm(id) { if (confirm('Batalkan permintaan karena klien tidak menjawab konfirmasi? Timer akan berhenti.') && await run(() => F.change({ id, action: 'cancel_admin' }))) modal(''); },
  async flag(id) { if (await run(() => F.change({ id, action: 'set_flag', note: $('#flg').value }))) proc(id); },
  async aiDraft(id) { $('#lc').value = 'Menyusun draf…'; const o = await run(() => F.ai({ id })); const r = S.rq.find((x) => x.id === id); $('#lc').value = o ? o.text : fill(svc(r.sid).body, r.data); keep(id); },
  async saveDraft(id) {
    keep(id); const D = S.draft[id]; if (await run(() => F.saveDraft({ id, draft: { content: D.content, signerName: D.signName || '', signerTitle: D.signTitle || '', sigSha: (S.sig[id] || {}).sha || null, note: ($('#lnote') || {}).value || '' } }))) alert('Draf tersimpan');
  },
  async sendAppr(id) {
    keep(id); const D = S.draft[id];
    if (await run(() => F.change({ id, action: 'send_approval', draft: { content: D.content, signerName: D.signName || '', signerTitle: D.signTitle || '', sigSha: (S.sig[id] || {}).sha || null, note: ($('#lnote') || {}).value || '', at: Date.now() } }))) { modal(''); alert('Dikirim ke pejabat penyetuju.'); }
  },
  async issue(id, revise) {
    keep(id); const D = S.draft[id], r = S.rq.find((x) => x.id === id), s = svc(r.sid);
    if (!flowOf(s).signers.length && s.needSign && !(S.sig[id] || {}).sha && !confirm('Layanan ini memerlukan gambar tanda tangan tetapi belum ada. Terbitkan tanpa gambar?')) return;
    if (!confirm('Menerbitkan surat akan mencatat dokumen ke rantai hash secara PERMANEN. Lanjutkan?')) return;
    const o = await run(() => F.issue({ id, content: D.content, signerName: D.signName || '', signerTitle: D.signTitle || '', sigSha: (S.sig[id] || {}).sha || null, note: ($('#lnote') || {}).value || '', revise }));
    if (o) { modal(''); delete S.sig[id]; delete S.draft[id]; alert(`Surat ${o.no} terbit (rantai #${o.seq}).`); }
  },
});

/* ---------- Persetujuan pejabat ---------- */
export function approveV() {
  const l = S.appr.slice().sort((a, b) => b.updatedAt - a.updatedAt), me = S.user.uid, wait = l.filter((r) => r.status === 'Menunggu Persetujuan'), pend = wait.filter((r) => pendingSlots(r, svc(r.sid)).some((x) => x.uid === me)), other = wait.filter((r) => !pend.includes(r)), done = l.filter((r) => r.status === 'Selesai');
  return `<div class="card"><h2>Menunggu persetujuan Anda (${pend.length})</h2>${pend.map((r) => `<div class="item row"><div style="flex:1"><b>${esc(r.sname)}</b> <span class="mu">${r.code}</span><div class="mu">${esc(r.requester.name)} · ${esc(r.requester.status)} · diajukan ${fdate(r.createdAt)}</div></div><button class="btn s" onclick="A.approve('${r.id}')">Tinjau</button></div>`).join('') || '<p class="mu">Tidak ada.</p>'}</div>
  ${other.length ? `<div class="card"><h3>Sudah Anda tandatangani, menunggu penandatangan lain (${other.length})</h3>${other.map((r) => `<div class="item"><b>${esc(r.sname)}</b> <span class="mu">${r.code}</span>${signChecklist(r)}</div>`).join('')}</div>` : ''}
  <div class="card"><h3>Sudah Anda setujui</h3>${done.map((r) => `<div class="item row"><div style="flex:1"><b>${esc(r.sname)}</b> <span class="mu">${r.letter ? esc(r.letter.no) : ''}</span></div>${r.letter ? `<a class="btn g s" href="#/v/${r.letter.vcode}">Verifikasi</a>` : ''}<button class="btn g s" onclick="A.approve('${r.id}',true)">Revisi</button></div>`).join('') || '<p class="mu">Belum ada.</p>'}</div>`;
}
Object.assign(A, {
  async approve(id, revise) {
    const r = S.appr.find((x) => x.id === id) || S.rq.find((x) => x.id === id); if (!r) return; await loadSigners();
    const key = 'ap:' + id, dr = r.draft || {}, D = (S.draft[key] = S.draft[key] || {}); D.revise = !!revise;
    let content = D.content ?? dr.content ?? '', last = null;
    if (revise && r.letter) { last = (await getDoc(doc(fs, 'requests', id, 'letters', String(r.letter.version)))).data(); content = D.content ?? last.rec.content; }
    await preloadSig(key, dr.sigSha || (last && last.rec.sigSha));
    const sn = D.signName ?? (last && last.rec.signerName) ?? dr.signerName ?? S.p.name, jt = D.signTitle ?? (last && last.rec.signerTitle) ?? dr.signerTitle ?? S.p.signerTitle ?? '';
    modal(`<h2>${revise ? 'Revisi' : 'Persetujuan'}: ${esc(r.sname)} <span class="mu">${r.code}</span></h2>
    <table>${Object.entries(r.data || {}).map(([k, v]) => `<tr><th>${FL[k] || k}</th><td>${esc(v)}</td></tr>`).join('')}</table>
    ${signChecklist(r)}<h3>Isi surat</h3>${revise ? `<textarea id="lc" rows="8">${esc(content)}</textarea>` : `<div class="paper">${esc(content)}</div>`}
    ${dr.note ? `<p class="mu">Catatan admin: ${esc(dr.note)}</p>` : ''}${sigUI(key, sn, jt, true)}
    <label>Catatan (opsional)</label><input id="lnote">
    <div class="row"><button class="btn" onclick="A.apprGo('${id}',${!!revise})">✍ ${revise ? 'Terbitkan revisi' : 'Setujui & tanda tangani digital'}</button><button class="btn g" onclick="A.prev('${key}')">👁 Pratinjau PDF</button>${revise ? '' : `<button class="btn r" onclick="A.apprNo('${id}')">Tolak / minta revisi</button>`}<button class="btn g s" onclick="A.close()">Tutup</button></div>
    <p class="mu">Dengan menyetujui, dokumen diberi tanda tangan digital dari kunci di perangkat ini dan dicatat permanen di rantai hash.</p>`);
  },
  async apprGo(id, revise) {
    const key = 'ap:' + id, r = S.appr.find((x) => x.id === id) || S.rq.find((x) => x.id === id), s = svc(r.sid); keep(key);
    const D = S.draft[key], dr = r.draft || {}, content = D.content ?? dr.content, note = ($('#lnote') || {}).value || '';
    const mine = { name: D.signName || '', title: D.signTitle || '', sigSha: (S.sig[key] || {}).sha || null }, fl = flowOf(s);
    if (!mine.sigSha && !confirm('Belum ada gambar tanda tangan. Setujui tanpa gambar (tanda tangan digital kriptografis tetap dibubuhkan)?')) return;
    const go = async () => {
      if (revise || !fl.signers.length) return F.issue({ id, content, signerName: mine.name, signerTitle: mine.title, sigSha: mine.sigSha, note, revise, mine });
      const pend = pendingSlots(r, s), mineSlots = pend.filter((x) => x.uid === S.user.uid);
      if (!mineSlots.length) throw new Error('Tidak ada tanda tangan Anda yang tertunda');
      for (let i = 0; i < mineSlots.length; i++) {
        if (!pend.some((x) => x.uid !== S.user.uid) && i === mineSlots.length - 1) return F.issue({ id, content, signerName: mine.name, signerTitle: mine.title, sigSha: mine.sigSha, note, mine });
        await F.signoff({ id, content, name: mine.name, title: mine.title, sigSha: mine.sigSha });
      }
      return { signed: true };
    };
    const o = await run(go);
    if (o) { modal(''); delete S.sig[key]; delete S.draft[key]; alert(o.no ? `Disetujui. Surat ${o.no} tercatat di rantai #${o.seq}.` : 'Tanda tangan Anda tercatat. Menunggu penandatangan lain.'); }
  },
  async apprNo(id) { const n = prompt('Alasan penolakan / bagian yang perlu direvisi:'); if (n === null) return; if (await run(() => F.change({ id, action: 'reject_approval', note: n }))) modal(''); },
});

/* ---------- Tanda tangan digital & rantai ---------- */
export function ledgerV() {
  const h = S.head, cc = S.chainRes;
  const mySlots = S.sv.flatMap((s) => flowOf(s).signers.filter((x) => x.uid === S.user.uid && x.mode === 'delegated' && x.required !== false).map((x) => ({ s, x })));
  const delegCard = mySlots.length ? `<div class="card"><h2>🖋 Delegasi tanda tangan otomatis</h2><p class="mu">Layanan berikut menunjuk Anda sebagai penandatangan <b>otomatis</b>. Dengan mengaktifkan, gambar tanda tangan Anda dibubuhkan otomatis pada surat layanan itu (dicatat di surat & rantai sebagai "atas delegasi"). Nonaktifkan kapan saja.</p><label class="btn g s">Unggah gambar TTD baru<input type="file" accept="image/*" hidden onchange="A.dgUp(this)"></label>${mySlots.map(({ s, x }) => { const dg = (S.deleg || {})[s.id] || {}; return `<div class="item"><b>${esc(s.name)}</b> <span class="mu">(${esc(x.label)})</span><div class="row"><input id="dg_n_${s.id}" value="${esc(dg.name || S.p.name)}" style="flex:1;margin:0"><input id="dg_t_${s.id}" value="${esc(dg.title || S.p.signerTitle || '')}" style="flex:1;margin:0"><select id="dg_s_${s.id}" style="width:auto;margin:0"><option value="">tanpa gambar</option>${(S.signers || []).map((g) => `<option value="${g.id}" ${dg.sigSha === g.id ? 'selected' : ''}>${esc(g.label || 'TTD')}</option>`).join('')}</select><label class="chk"><input type="checkbox" id="dg_a_${s.id}" ${dg.active ? 'checked' : ''}>aktif</label><button class="btn s" onclick="A.delegSave('${s.id}')">Simpan</button></div></div>`; }).join('')}</div>` : '';
  return `${delegCard}<div class="card"><h2>🔐 Tanda tangan digital saya</h2>
  <p>${S.keyReady ? '✅ Perangkat ini memiliki kunci tanda tangan digital.' : '⬜ Perangkat ini belum memiliki kunci.'} <span class="mu">Kunci pribadi disimpan di browser ini dan tidak dapat diekspor; kunci publik terdaftar agar siapa pun dapat memverifikasi.</span></p>
  ${S.keyReady ? '' : '<button class="btn" onclick="A.regKey()">Buat & daftarkan kunci</button>'}
  <table>${(S.keys || []).map((k) => `<tr><td><code>${k.id}</code></td><td>${fdate(k.at)}</td><td class="mu">${esc(k.label || '')}</td><td>${k.active === false ? '<span class="tag er">dicabut</span>' : `<span class="tag ok">aktif</span> <button class="btn r s" onclick="A.revKey('${k.id}')">Cabut</button>`}</td></tr>`).join('')}</table></div>
  <div class="card"><h2>⛓ Rantai dokumen (SHA-256 + tanda tangan digital)</h2>
  ${h ? `<p>Entri terakhir: <b>#${h.seq}</b><br><span class="mu">Hash kepala: <code>${h.hash}</code></span></p>` : '<p class="mu">Rantai belum diinisialisasi.</p>'}
  <div class="row">${!h && isSup() ? '<button class="btn" onclick="A.initLedger()">Inisialisasi rantai</button>' : ''}<button class="btn g s" onclick="A.chain()">Verifikasi seluruh rantai</button><button class="btn g s" onclick="A.exportChain()">⬇ Ekspor bukti rantai (JSON)</button></div>
  ${cc ? `<p>${cc.bad.length || !cc.headOk ? `<b style="color:var(--er)">⚠ Rantai TIDAK konsisten pada entri: ${cc.bad.join(', ') || '(kepala tidak cocok)'}</b>` : `<b style="color:var(--ok)">✅ ${cc.n} entri konsisten, hash berantai & tanda tangan valid.</b>`}</p>` : ''}
  <p class="mu">Anchor opsional: catat/publikasikan hash kepala secara berkala (mis. di arsip kampus atau layanan penanda waktu publik) agar perubahan di sisi server mudah terdeteksi.</p>
  <div class="scroll"><table><tr><th>#</th><th>Nomor</th><th>Layanan</th><th>Penandatangan</th><th>Waktu</th><th>Hash dokumen</th><th></th></tr>${(S.ledger || []).map((e) => `<tr><td>${e.seq}</td><td>${esc(e.no)} ${e.type === 'revise' ? '<span class="tag">revisi</span>' : ''}</td><td>${esc(e.serviceName)}</td><td>${esc(e.signerName)}</td><td>${fdate(e.at)}</td><td><code>${e.docHash.slice(0, 12)}…</code></td><td><a href="#/v/${e.vcode}">verifikasi</a></td></tr>`).join('')}</table></div></div>`;
}
Object.assign(A, {
  async loadLedger() {
    try {
      S.ledger = (await getDocs(query(collection(fs, 'ledger'), orderBy('seq', 'desc'), limit(30)))).docs.map((d) => d.data());
      S.keys = (await getDocs(query(collection(fs, 'publicKeys'), where('uid', '==', S.user.uid)))).docs.map((d) => ({ id: d.id, ...d.data() }));
      S.keyReady = await hasKey(); await loadSigners(); S.deleg = {};
      (await getDocs(query(collection(fs, 'delegations'), where('uid', '==', S.user.uid)))).docs.forEach((d) => { S.deleg[d.data().sid] = d.data(); });
    } catch (e) { console.error(e); } hook.render();
  },
  async delegSave(sid) {
    if (await run(() => F.delegate({ sid, sigSha: $('#dg_s_' + sid).value || null, name: $('#dg_n_' + sid).value.trim(), title: $('#dg_t_' + sid).value.trim(), active: $('#dg_a_' + sid).checked }))) { alert('Delegasi disimpan'); A.loadLedger(); }
  },
  dgUp(inp) {
    const f = inp.files[0]; if (!f) return; const fr = new FileReader();
    fr.onload = () => { const im = new Image(); im.onload = async () => { const k = Math.min(1, 360 / im.width, 140 / im.height), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); await run(() => putSig(c.toDataURL('image/png'), S.p.name)); A.loadLedger(); }; im.onerror = () => alert('Gambar tidak valid'); im.src = fr.result; };
    fr.readAsDataURL(f);
  },
  async regKey() { if (await run(() => ensureKey())) A.loadLedger(); },
  async revKey(kid) { if (confirm('Cabut kunci ini? Surat lama tetap valid, tetapi kunci tidak dapat dipakai menandatangani lagi (daftarkan kunci baru).') && await run(() => F.revokeKey(kid))) A.loadLedger(); },
  async initLedger() { if (await run(() => F.initLedger())) A.loadLedger(); },
  async chain() { const r = await run(() => F.chainCheck()); if (r) { S.chainRes = r; hook.render(); } },
  async exportChain() {
    const r = await run(() => F.chainCheck()); if (!r) return;
    const keys = {}; Object.entries(r.keys).forEach(([k, v]) => { if (v) keys[k] = { pub: v.pub, active: v.active !== false, name: v.name }; });
    saveFile('bukti-rantai-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ app: 'layanan-surat-spark', exportedAt: Date.now(), head: r.head, ledger: r.docs, keys }), 'application/json');
  },
});

/* ---------- Pengguna ---------- */
export function usersV() {
  const sup = isSup();
  return `<div class="card"><h2>Pengguna & Akses</h2><p class="mu">Status Ketua/Waket hanya dapat diberikan admin. <b>Pejabat</b> (khusus Admin Super) = dapat login sendiri untuk menyetujui & menandatangani surat pada layanan yang menunjuknya.</p><div class="scroll"><table><tr><th>Pengguna</th><th>Role</th><th>Status</th><th>Verif.</th><th>Aktif</th><th>Pejabat</th></tr>
  ${S.users.map((u) => `<tr><td><b>${esc(u.name)}</b><div class="mu">${esc(u.email)}${u.requestedStatus && u.requestedStatus !== u.status ? `<br>Mengajukan status: ${esc(u.requestedStatus)}` : ''}</div></td>
  <td><select ${sup && u.id !== S.user.uid ? '' : 'disabled'} onchange="A.usr('${u.id}',{role:this.value})">${['klien', 'admin', 'superadmin'].map((r) => `<option ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
  <td><select ${u.role === 'superadmin' && !sup ? 'disabled' : ''} onchange="A.usr('${u.id}',{status:this.value})">${STATUS_ALL.map((r) => `<option ${u.status === r ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
  <td><input type="checkbox" ${u.verified ? 'checked' : ''} ${u.role === 'superadmin' && !sup ? 'disabled' : ''} onchange="A.usr('${u.id}',{verified:this.checked})"></td>
  <td><input type="checkbox" ${u.active !== false ? 'checked' : ''} ${u.id === S.user.uid ? 'disabled' : ''} onchange="A.usr('${u.id}',{active:this.checked})"></td>
  <td>${sup ? `<input type="checkbox" ${u.signer ? 'checked' : ''} onchange="A.usr('${u.id}',{signer:this.checked})"><input placeholder="Jabatan" value="${esc(u.signerTitle || '')}" style="width:130px" onchange="A.usr('${u.id}',{signerTitle:this.value})">` : u.signer ? '✓ ' + esc(u.signerTitle || '') : '-'}</td></tr>`).join('')}</table></div>
  <p class="mu">Menonaktifkan di sini memblokir akses data aplikasi. Untuk memblokir login sepenuhnya, nonaktifkan akun di Firebase Console > Authentication.</p></div>`;
}
A.usr = async (uid, patch) => { await run(() => F.user({ uid, patch })); };

/* ---------- Pengaturan ---------- */
export function settingsV() {
  const p = S.p || {}, s = S.set || {}, sup = isSup();
  return `<div class="card"><h2>Profil & preferensi saya</h2>
  <label>Nama lengkap</label><input id="p_name" value="${esc(p.name)}"><label>HP / WhatsApp</label><input id="p_phone" value="${esc(p.phone)}"><label>NIM / NIP</label><input id="p_id" value="${esc(p.idNumber)}"><label>Program studi / unit</label><input id="p_prodi" value="${esc(p.prodi)}">
  <label>Status yang diajukan (diverifikasi admin; status saat ini: <b>${esc(p.status)}</b> ${p.verified ? '✓ terverifikasi' : '(belum terverifikasi)'})</label><select id="p_req">${STATUS_SELF.map((x) => `<option ${p.requestedStatus === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
  <div class="row"><button class="btn g" onclick="A.themeM()">🎨 Tema & warna</button></div>
  <label class="chk"><input type="checkbox" id="p_mail" ${p.notifEmail !== false ? 'checked' : ''}>Terima notifikasi email (bila webhook email diaktifkan admin)</label><br><button class="btn" onclick="A.saveProfile()">Simpan profil</button></div>
  ${isAdm() ? `<div class="card"><h3>API key AI (opsional)</h3><p class="mu">Disimpan <b>hanya di browser ini</b> (localStorage), dikirim langsung ke Anthropic untuk "Draf dengan AI". Jangan dipakai di komputer bersama.</p><input id="ai_key" type="password" placeholder="sk-ant-..." value="${esc(localStorage.getItem('ly-ai-key') || '')}"><button class="btn g s" onclick="localStorage.setItem('ly-ai-key',$('#ai_key').value.trim());alert('Tersimpan di browser ini')">Simpan</button></div>` : ''}
  ${sup ? `<div class="card"><h2>Pengaturan aplikasi</h2>
  <label>Nama institusi</label><input id="a_inst" value="${esc(s.instName || 'STIKES YKY Yogyakarta')}"><label>Alamat (kop surat)</label><input id="a_addr" value="${esc(s.address || '')}"><label>Kota (tempat tanda tangan)</label><input id="a_city" value="${esc(s.city || 'Yogyakarta')}">
  <label>URL aplikasi, mis. https://project-id.web.app/ (dipakai QR verifikasi di surat)</label><input id="a_url" value="${esc(s.appUrl || '')}">
  <label>Format nomor surat ({n} urut, {kode}, {bln} romawi, {thn})</label><input id="a_fmt" value="${esc(s.letterNoFormat || '{n}/{kode}/STIKES-YKY/{bln}/{thn}')}">
  <label>Batas waktu klien menjawab konfirmasi (hari)</label><input id="a_cd" type="number" min="1" value="${s.confirmDays || 3}">
  <div><span class="mu">Prioritas otomatis untuk status:</span> ${STATUS_ALL.map((x) => `<label class="chk"><input type="checkbox" class="a_ap" value="${x}" ${(s.autoPriority || ['Ketua STIKES', 'Waket 1', 'Waket 2']).includes(x) ? 'checked' : ''}>${x}</label>`).join('')}</div>
  <label>Penyimpanan salinan surat</label><select id="a_arc"><option value="off" ${!s.archive && s.archivePdf !== 'on' || s.archive === 'off' ? 'selected' : ''}>Ringkas: data + hash saja (PDF/HTML dibuat ulang saat dibuka)</option><option value="html" ${s.archive === 'html' ? 'selected' : ''}>Ringkas + salinan HTML tersimpan (≤150 KB, terbaca tanpa PDF viewer)</option><option value="pdf" ${s.archive === 'pdf' || (!s.archive && s.archivePdf === 'on') ? 'selected' : ''}>Arsip: HTML + PDF terkompresi (boros; hanya untuk surat tanpa template)</option></select>
  <label>URL webhook email (Google Apps Script, opsional)</label><input id="a_mail" value="${esc(s.mailWebhook || '')}" placeholder="https://script.google.com/macros/s/.../exec">
  <label>Model AI</label><input id="a_ai" value="${esc(s.aiModel || 'claude-sonnet-5-5')}">
  <button class="btn" onclick="A.saveSet()">Simpan pengaturan</button></div>
  <div class="card"><h2>Cadangan</h2><p class="mu">Spark tidak punya pencadangan terjadwal. Unduh cadangan JSON secara berkala (membaca seluruh data; cukup sebulan beberapa kali untuk skala kampus). Pemulihan memakai <code>scripts/restore.js</code> (Admin SDK). Terakhir: ${s.lastBackupAt ? fdate(s.lastBackupAt) : 'belum pernah'}.</p><button class="btn s" onclick="A.backup()">💾 Cadangkan sekarang (unduh JSON)</button></div>` : ''}`;
}
export function auditV() {
  return `<div class="card"><h2>Audit log (200 terakhir)</h2><div class="scroll"><table>${S.audit.map((a) => `<tr><td>${fdate(a.at)}</td><td>${esc(a.action)}</td><td>${esc(a.target)}</td><td>${esc(a.detail)}</td><td class="mu">${esc(String(a.by).slice(0, 8))}</td></tr>`).join('')}</table></div></div>`;
}
Object.assign(A, {
  async saveProfile() {
    const v = { name: $('#p_name').value.trim(), phone: $('#p_phone').value.trim(), idNumber: $('#p_id').value.trim(), prodi: $('#p_prodi').value.trim(), requestedStatus: $('#p_req').value, notifEmail: $('#p_mail').checked };
    if (!v.name) return alert('Nama wajib diisi');
    if (await run(() => updateDoc(doc(fs, 'users', S.user.uid), v))) alert('Profil disimpan');
  },
  async saveSet() {
    const v = { instName: $('#a_inst').value, address: $('#a_addr').value, city: $('#a_city').value, appUrl: $('#a_url').value.trim(), letterNoFormat: $('#a_fmt').value, confirmDays: +$('#a_cd').value || 3, archive: $('#a_arc').value, mailWebhook: $('#a_mail').value.trim(), aiModel: $('#a_ai').value.trim(), autoPriority: [...document.querySelectorAll('.a_ap:checked')].map((x) => x.value) };
    if (await run(() => setDoc(doc(fs, 'settings', 'app'), v, { merge: true }))) { alert('Pengaturan disimpan'); log('settings.update', 'app', ''); }
  },
  async backup() {
    const o = await run(() => F.bk()); if (!o) return;
    saveFile('cadangan-layanan-surat-' + new Date().toISOString().slice(0, 10) + '.json', o.json, 'application/json');
    await run(() => setDoc(doc(fs, 'settings', 'app'), { lastBackupAt: Date.now() }, { merge: true }));
  },
  async loadAudit() { const q = await getDocs(query(collection(fs, 'audit'), orderBy('at', 'desc'), limit(200))); S.audit = q.docs.map((d) => d.data()); hook.render(); },
});
