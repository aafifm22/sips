import { S, F, fs, $, esc, fd, fdate, run, stages, qinfo, modal, csv, saveFile, saveB64, tagOf, agg, svc, isAdm, OPEN, FL, DAY, hook, flowOf } from './core.js';
import { doc, updateDoc } from 'firebase/firestore';

const A = (window.A = window.A || {});
let sel = '';
const by = (s) => (String(s).startsWith('admin') ? 'Admin' : String(s).startsWith('user') ? 'Pemohon' : s === 'guest' ? 'Tamu' : 'Sistem');
const estTxt = (sid) => {
  const t = S.stats[sid];
  return t ? `rata-rata real ${t.avgProc} hari (${t.n} surat)` : `batas ${svc(sid).sla} hari (belum ada data real)`;
};
const allowed = (s) => s.on && (s.who || []).includes(S.user ? S.p?.status : 'Guest');
const mine = () => (S.user ? S.rq : S.guest);

/* ---------- komponen ---------- */
export function stepper(r) {
  if (r.status === 'Dibatalkan') return '<div class="stp"><span class="tag">Diajukan</span><span class="mu">→</span><span class="tag er">Dibatalkan</span></div>';
  const ST = ['Diajukan', 'Diproses', 'Selesai'], wait = r.status === 'Menunggu Konfirmasi', appr = r.status === 'Menunggu Persetujuan';
  const idx = ST.indexOf(appr ? 'Diproses' : wait ? (r.confirm && r.confirm.prev) || 'Diproses' : r.status), fin = r.status === 'Selesai';
  return `<div class="stp">${ST.map((l, i) => {
    const dn = i < idx || fin, cur = i === idx && !fin;
    return `<span class="tag ${dn ? 'ok' : cur ? 'wa' : ''}" style="${i > idx && !fin ? 'opacity:.5' : ''}">${dn ? '✓ ' : ''}${l}${cur && wait ? ' ⏸' : ''}${cur && appr ? ' ✍' : ''}</span>${i < 2 ? '<span class="mu">→</span>' : ''}`;
  }).join('')}</div>`;
}
export function stageTable(r) {
  const s = stages(r);
  return `<div class="scroll"><table><tr><th>Tahap</th><th>Mulai</th><th>Durasi</th><th>Oleh / catatan</th></tr>${s.rows.map((x) => {
    const term = ['Selesai', 'Dibatalkan'].includes(x.status);
    return `<tr><td><b>${x.status}</b></td><td>${fdate(x.at)}</td><td>${term ? '⏹ berhenti' : (x.live ? '⏳ ' : '') + fd(x.ms)}</td><td>${by(x.by)}${x.note ? ' · ' + esc(x.note) : ''}</td></tr>`;
  }).join('')}</table></div>
  <p class="mu">${s.done ? '⏹ Timer berhenti' : '⏳ Timer berjalan'} · Total <b>${fd(s.total)}</b> · menunggu pemohon ${fd(s.wait)} · <b>waktu kerja layanan ${fd(s.proc)}</b> (total dikurangi waktu menunggu pemohon).</p>`;
}
/** Checklist penandatangan: siapa saja yang diperlukan, sudah/belum, manual atau otomatis (delegasi). */
export function signChecklist(r) {
  const s = svc(r.sid), req = flowOf(s).signers.filter((x) => x.required !== false); if (!req.length) return '';
  const so = (r.approval && r.approval.signoffs) || [];
  return `<div class="mu" style="margin:4px 0">✍ Penandatangan:${req.map((sl) => { const d = so.find((y) => y.key === sl.key), done = !!d; return `<div>${done ? '✅' : sl.mode === 'delegated' ? '🖋' : '⬜'} ${esc(sl.label)}${d ? ` · ${esc(d.name)}${d.delegated ? ' (otomatis, delegasi)' : ''} · ${fdate(d.at)}` : sl.mode === 'delegated' ? ' · otomatis saat terbit' : r.status === 'Dibatalkan' ? ' · -' : ' · menunggu'}</div>`; }).join('')}</div>`;
}
const iconOf = (n) => (/penelitian|izin penel/i.test(n) ? '🔬' : /cuti/i.test(n) ? '🏖️' : /lulus/i.test(n) ? '🎉' : /beasiswa|rekomendasi/i.test(n) ? '💡' : /legalisir|ijazah|transkrip/i.test(n) ? '📜' : /tugas/i.test(n) ? '📋' : /kegiatan/i.test(n) ? '🎪' : /pkl|observasi/i.test(n) ? '🏥' : /aktif|keterangan|kelakuan/i.test(n) ? '🎓' : '📄');
const needAct = (r) => r.status === 'Menunggu Konfirmasi' || (r.status === 'Selesai' && !r.feedback);
/** Kartu permintaan: satu tombol utama yang jelas sesuai keadaan. */
export function reqCard(r, adm) {
  const s = stages(r), q = qinfo(r), last = s.rows[s.rows.length - 1], open = OPEN.includes(r.status), meta = [];
  if (adm) meta.push(`${esc(r.requester.name)} · ${esc(r.requester.status)}`);
  if (q) meta.push(`📍 Antrean ke-<b>${q.pos}</b> dari ${q.total}`);
  if (r.status === 'Menunggu Konfirmasi' && r.confirm) meta.push(`⚠ Menunggu jawaban sebelum ${fdate(r.confirm.deadline)}`);
  meta.push(`⏱ ${s.done ? 'Total' : 'Berjalan'} ${fd(s.total)}${s.done ? '' : ' · tahap ini ' + fd(last.ms)}`);
  if (open && !adm) meta.push(estTxt(r.sid));
  let cta;
  if (adm) cta = `<button class="btn ${['Diajukan', 'Diproses'].includes(r.status) ? '' : 'g'}" onclick="A.proc('${r.id}')">${r.status === 'Diajukan' ? '▶ Mulai proses' : r.status === 'Diproses' ? '✎ Siapkan & terbitkan' : 'Buka'}</button>`;
  else if (r.status === 'Menunggu Konfirmasi') cta = `<button class="btn" onclick="A.open('${r.id}')">Jawab sekarang</button>`;
  else if (r.status === 'Selesai') cta = `<button class="btn" onclick="A.dlL('${r.id}')">⬇ Unduh surat</button><button class="btn g" onclick="A.open('${r.id}')">${r.feedback ? 'Detail' : '⭐ Detail & nilai'}</button>`;
  else cta = `<button class="btn g" onclick="A.open('${r.id}')">Detail</button>`;
  return `<div class="rc"><div class="rc-h"><div><b>${esc(r.sname)}</b><div class="mu">${r.code} · diajukan ${fdate(r.createdAt)}</div></div><div>${tagOf(r, true)}</div></div>${stepper(r)}${signChecklist(r)}<div class="rc-m">${meta.join('<br>')}</div><div class="rc-a">${cta}</div></div>`;
}

/* ---------- dropdown + ketik sendiri (nilai baru tersimpan untuk pilihan berikutnya) ---------- */
export function combo(id, type, val, ph = 'Ketik...') {
  const items = (S.lk && S.lk[type]) || [], v = String(val || ''), inList = items.some((x) => x.toLowerCase() === v.toLowerCase()), typing = !items.length || (v && !inList);
  return `${items.length ? `<select class="cb" onchange="A.cbSel(this,'${id}')"><option value="">— pilih —</option>${items.map((x) => `<option ${v && x.toLowerCase() === v.toLowerCase() ? 'selected' : ''}>${esc(x)}</option>`).join('')}<option value="__o" ${typing ? 'selected' : ''}>➕ Tulis sendiri…</option></select>` : ''}<input id="${id}" value="${esc(v)}" placeholder="${ph}" style="${typing ? '' : 'display:none'}">`;
}
/* ---------- halaman ---------- */
const firstName = () => String((S.p && S.p.name) || 'Anda').split(' ')[0];
const tile = (s) => { const e = S.stats[s.id]; return `<button class="tile" onclick="A.ajukan('${s.id}')"><i>${iconOf(s.name)}</i><span><b>${esc(s.name)}</b><span class="mu">${e ? '±' + e.avgProc + ' hari' : 'maks ' + s.sla + ' hari'}${s.needSign ? ' · bertanda tangan' : ''}</span></span></button>`; };
export function homeV() {
  const l = mine().slice().sort((a, b) => b.createdAt - a.createdAt), p = S.p || {}, act = l.filter(needAct), go = l.filter((r) => OPEN.includes(r.status) && !act.includes(r)), svcs = S.sv.filter(allowed);
  return `<div class="hero"><div><h2>Halo, ${esc(firstName())} 👋</h2><p>Butuh surat? Mulai dari sini.</p></div><button class="btn lg" onclick="A.nav('ajukan')">＋ Ajukan surat baru</button></div>
  ${S.user && p.verified === false ? '<div class="card warn"><b>Akun Anda menunggu verifikasi admin.</b><div class="mu">Anda tetap bisa mengajukan layanan yang tersedia. Layanan khusus dosen/pejabat muncul setelah status Anda diverifikasi.</div></div>' : ''}
  ${l.length ? '' : '<div class="card"><h3>Cara kerjanya</h3><div class="how"><span><b>1</b>Pilih jenis surat</span><span><b>2</b>Isi data singkat</span><span><b>3</b>Pantau progres & antrean</span><span><b>4</b>Unduh surat (PDF)</span></div></div>'}
  ${act.length ? `<div class="card warn"><h3>Perlu tindakan Anda (${act.length})</h3>${act.map((r) => reqCard(r)).join('')}</div>` : ''}
  ${l.length ? `<div class="card"><h3>Sedang berjalan</h3>${go.slice(0, 3).map((r) => reqCard(r)).join('') || '<p class="mu">Tidak ada permintaan yang sedang berjalan.</p>'}<button class="btn g s" onclick="A.nav('mine')">Lihat semua permintaan saya</button></div>` : ''}
  <div class="card"><h3>Pintasan layanan</h3><div class="tiles">${svcs.slice(0, 6).map(tile).join('') || '<p class="mu">Belum ada layanan untuk status Anda.</p>'}</div>${svcs.length > 6 ? '<p><button class="btn g s" onclick="A.nav(\'ajukan\')">Lihat semua layanan</button></p>' : ''}</div>`;
}
function sentV() {
  const x = S.sent;
  return `<div class="card ok-card"><div style="font-size:48px">✅</div><h2 style="padding:0">Permintaan terkirim</h2><p class="mu">${esc(x.name)}</p>
  <p>${x.guest ? '<b>Simpan kode ini bersama email Anda.</b> Keduanya dibutuhkan untuk melacak permintaan.' : 'Kode permintaan Anda:'}</p><div class="code">${esc(x.code)}</div>
  <div class="row" style="justify-content:center"><button class="btn g" onclick="A.copy('${x.code}')">📋 Salin kode</button></div>
  <p class="mu">Selanjutnya: pantau progres, posisi antrean, dan durasi di "Permintaan".</p>
  <div class="row" style="justify-content:center"><button class="btn lg" onclick="A.sentDone('mine')">Lihat permintaan saya</button><button class="btn g" onclick="A.sentDone('ajukan')">Ajukan surat lain</button></div></div>`;
}
const PH = { nama: 'mis. Budi Santoso', nim: 'mis. 2023001', smt: 'mis. 5', ket: 'mis. persyaratan beasiswa / pendaftaran magang', tujuan: 'mis. RSUD Sleman', prodi: 'mis. S1 Keselamatan dan Kesehatan Kerja' };
export function ajukanV() {
  if (S.sent) return sentV();
  const list = S.sv.filter(allowed), g = !S.user, s = list.find((x) => x.id === sel);
  if (!list.length) return '<div class="card"><h2>Ajukan surat</h2><p class="mu">Belum ada layanan yang tersedia untuk status Anda. Hubungi admin bila ini tidak sesuai.</p></div>';
  if (!s) {
    return `${g ? '<div class="card"><b>Tanpa login juga bisa.</b><div class="mu">Isi data dan email Anda; Anda akan mendapat <b>kode lacak</b>. Punya akun? <a href="#" onclick="A.mode(\'in\');return false">Masuk</a> agar riwayat tersimpan.</div></div>' : ''}
    <div class="card"><h2>1. Pilih jenis surat</h2><input type="search" placeholder="🔍 Cari jenis surat…" oninput="A.svcFilter(this.value)"><div class="tiles" id="tl">${list.map(tile).join('')}</div></div>`;
  }
  return `<div class="card"><button class="btn g s" onclick="A.ajukan('')">← Ganti jenis surat</button>
  <h2 style="margin-top:12px">2. Isi data · ${esc(s.name)}</h2>
  <p class="mu">${iconOf(s.name)} Estimasi selesai ${S.stats[s.id] ? '±' + S.stats[s.id].avgProc + ' hari (rata-rata real)' : 'maks ' + s.sla + ' hari'}${s.needSign ? ' · memakai tanda tangan' : ''}. Kolom bertanda * wajib diisi.</p>
  ${g ? '<label>Email * <span class="mu">(untuk kode lacak)</span></label><input id="g_email" type="email" inputmode="email" autocomplete="email" placeholder="nama@email.com"><label>Nomor HP / WhatsApp *</label><input id="g_phone" inputmode="tel" placeholder="08xxxxxxxxxx">' + (s.fields.includes('nama') ? '' : '<label>Nama lengkap *</label><input id="g_name">') : ''}
  ${s.fields.map((k) => `<label>${FL[k] || k} *</label>${['prodi', 'tujuan'].includes(k) ? combo('f_' + k, k, k === 'prodi' && !g ? S.p?.prodi : '', PH[k] || 'Ketik...') : k === 'ket' ? `<textarea id="f_${k}" rows="3" placeholder="${PH[k]}"></textarea>` : `<input id="f_${k}" placeholder="${PH[k] || ''}" ${k === 'smt' ? 'inputmode="numeric"' : ''} value="${k === 'nama' && !g ? esc(S.p?.name) : k === 'nim' && !g ? esc(S.p?.idNumber) : ''}">`}`).join('')}
  <input class="hp" id="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
  <button class="btn lg block" onclick="A.submit()">Kirim permintaan</button><p class="mu" style="text-align:center">Setelah terkirim Anda mendapat kode & bisa memantau progres.</p></div>`;
}
export function mineV() {
  const l = mine().slice().sort((a, b) => b.createdAt - a.createdAt), f = S.mf || 'all';
  const F_ = { all: () => true, run: (r) => OPEN.includes(r.status), act: needAct, done: (r) => r.status === 'Selesai', canc: (r) => r.status === 'Dibatalkan' };
  const chip = (k, n) => `<button class="chip ${f === k ? 'on' : ''} ${k === 'act' && l.filter(F_.act).length ? 'alert' : ''}" onclick="A.mf('${k}')">${n}<b>${l.filter(F_[k]).length}</b></button>`;
  return `<div class="card"><h2>Permintaan saya</h2><div class="chips">${chip('all', 'Semua')}${chip('run', 'Berjalan')}${chip('act', 'Perlu tindakan')}${chip('done', 'Selesai')}${chip('canc', 'Dibatalkan')}</div>
  ${S.user ? '' : '<p class="mu">Sebagai tamu, permintaan yang Anda ajukan/lacak di perangkat ini tampil di sini.</p>'}
  ${l.filter(F_[f]).map((r) => reqCard(r)).join('') || `<p class="mu">${l.length ? 'Tidak ada di kategori ini.' : 'Belum ada permintaan.'}</p>${l.length ? '' : '<button class="btn lg" onclick="A.nav(\'ajukan\')">＋ Ajukan surat pertama</button>'}`}</div>`;
}
export function lacakV() {
  return `<div class="card"><h2>Lacak dengan Kode</h2><p class="mu">Masukkan kode (mis. LY-AB12C) dan email yang dipakai saat mengajukan.</p><input id="lc" placeholder="Kode"><input id="le" type="email" placeholder="Email"><button class="btn" onclick="A.lacak()">Cari</button></div>`;
}
export function notifV() {
  return `<div class="card"><h2>Notifikasi</h2><button class="btn g s" onclick="A.readAll()">Tandai semua dibaca</button>${S.nt.map((n) => `<div class="item" style="${n.read ? 'opacity:.6' : ''}"><b>${esc(n.title)}</b><div>${esc(n.body)}</div><div class="mu">${fdate(n.at)}</div></div>`).join('') || '<p class="mu">Belum ada.</p>'}</div>`;
}
export async function verifyV(code) {
  const r = await run(() => F.verify({ code }));
  if (!r) return '<div class="card">Gagal memeriksa.</div>';
  if (!r.status) return `<div class="card"><h2>❌ Dokumen tidak ditemukan</h2><p>Kode <b>${esc(code)}</b> tidak terdaftar.</p></div>`;
  return `<div class="card"><h2>${r.valid ? '✅ Dokumen sah' : '⚠ Dokumen belum berlaku'}</h2><table><tr><th>Nomor</th><td>${esc(r.no)}</td></tr><tr><th>Layanan</th><td>${esc(r.layanan)}</td></tr><tr><th>Pemohon</th><td>${esc(r.pemohon)}</td></tr><tr><th>Status</th><td>${esc(r.status)}</td></tr><tr><th>Terbit</th><td>${fdate(r.terbit)}</td></tr><tr><th>Versi</th><td>${r.versi}</td></tr></table></div>`;
}

/* ---------- dashboard (admin: semua data; pemohon/tamu: data sendiri) ---------- */
export const scoped = () => (isAdm() || S.user ? S.rq : S.guest);
export function filtered() {
  const f = S.DF.from ? new Date(S.DF.from).getTime() : 0, t = S.DF.to ? new Date(S.DF.to).getTime() + DAY : Infinity;
  return scoped().filter((r) => (!S.DF.sid || r.sid === S.DF.sid) && r.createdAt >= f && r.createdAt < t);
}
export function dashV() {
  const L = filtered(), a = agg(L), adm = isAdm();
  const mx = Math.max(1, ...S.sv.map((s) => L.filter((r) => r.sid === s.id).length));
  const rt = L.filter((r) => r.feedback), d = (v) => (v == null ? '–' : v + ' hr');
  return `<details class="card"${S.DF.sid || S.DF.from || S.DF.to ? ' open' : ''}><summary>🔎 Filter jenis surat & tanggal${S.DF.sid || S.DF.from || S.DF.to ? ' (aktif)' : ''}</summary><div class="row" style="margin-top:8px"><div style="flex:2;min-width:180px"><label>Jenis surat</label><select onchange="A.df('sid',this.value)"><option value="">Semua jenis</option>${S.sv.map((s) => `<option value="${s.id}" ${S.DF.sid === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
  <div style="flex:1;min-width:140px"><label>Dari tanggal</label><input type="date" value="${S.DF.from}" onchange="A.df('from',this.value)"></div><div style="flex:1;min-width:140px"><label>Sampai tanggal</label><input type="date" value="${S.DF.to}" onchange="A.df('to',this.value)"></div><button class="btn g s" onclick="A.df('reset')">Reset</button></div></details>
  <div class="grid"><div class="card stat"><b>${a.n}</b><span>Total</span></div><div class="card stat"><b>${a.prog}</b><span>On progress</span></div><div class="card stat"><b>${a.wait}</b><span>Menunggu konfirmasi</span></div><div class="card stat"><b>${a.done}</b><span>Selesai</span></div><div class="card stat"><b>${a.canc}</b><span>Dibatalkan</span></div>
  <div class="card stat"><b>${d(a.avgProc)}</b><span>Rata-rata kecepatan layanan</span></div><div class="card stat"><b>${d(a.avgTotal)}</b><span>Rata-rata total (termasuk menunggu pemohon)</span></div><div class="card stat"><b>${a.done ? Math.round((a.onTime / a.done) * 100) : 0}%</b><span>Tepat waktu</span></div><div class="card stat"><b>${rt.length ? (rt.reduce((x, r) => x + r.feedback.stars, 0) / rt.length).toFixed(1) : '–'} ★</b><span>Rating</span></div></div>
  <div class="card"><h2>Rincian per Jenis Surat</h2>${S.sv.filter((s) => !S.DF.sid || s.id === S.DF.sid).map((s) => {
    const l = L.filter((r) => r.sid === s.id), g = agg(l);
    if (!adm && !l.length) return '';
    return `<div class="item"><div class="row"><b style="flex:1">${esc(s.name)}</b><span class="tag wa">Progress ${g.prog + g.wait}</span><span class="tag ok">Selesai ${g.done}</span><span class="tag er">Batal ${g.canc}</span></div>
    <div class="mu">${g.n} permintaan · batas ${s.sla} hari · kecepatan layanan ${d(g.avgProc)} · total ${d(g.avgTotal)} · menunggu pemohon ${d(g.avgWait)}</div><div class="bar"><i style="width:${(g.n / mx) * 100}%"></i></div></div>`;
  }).join('')}</div>
  <div class="card"><h3>Unduh</h3><p class="mu">Mengikuti filter di atas.</p><div class="row"><button class="btn s" onclick="A.expDet()">⬇ Rincian (CSV)</button><button class="btn s" onclick="A.expSum()">⬇ Ringkasan (CSV)</button></div></div>`;
}
const st = () => new Date().toISOString().slice(0, 10);
const dd = (ms) => (ms == null ? '' : +(ms / DAY).toFixed(2));

/* ---------- aksi ---------- */
Object.assign(A, {
  close: () => modal(''),
  cbSel(sel, id) { const i = document.getElementById(id); if (sel.value === '__o') { i.style.display = ''; i.value = ''; i.focus(); } else { i.style.display = 'none'; i.value = sel.value; } },
  ajukan(id) { sel = id; S.sent = null; S.view = 'ajukan'; hook.render(); scrollTo(0, 0); },
  svcFilter(q) { const k = q.toLowerCase(); document.querySelectorAll('#tl .tile').forEach((e) => { e.style.display = e.textContent.toLowerCase().includes(k) ? '' : 'none'; }); },
  mf(k) { S.mf = k; hook.render(); },
  copy(x) { (navigator.clipboard ? navigator.clipboard.writeText(x) : Promise.reject()).then(() => alert('Kode disalin'), () => prompt('Salin kode:', x)); },
  sentDone(v) { S.sent = null; sel = ''; A.nav(v); },
  df(k, v) { if (k === 'reset') S.DF = { sid: '', from: '', to: '' }; else S.DF[k] = v; hook.render(); },
  async submit() {
    const s = svc(sel), data = {}, g = !S.user;
    for (const k of s.fields) { data[k] = $('#f_' + k).value.trim(); if (!data[k]) return alert('Lengkapi: ' + (FL[k] || k)); }
    const body = { sid: s.id, data, hp: $('#hp').value };
    if (g) body.requester = { name: data.nama || ($('#g_name') && $('#g_name').value) || '', email: $('#g_email').value, phone: $('#g_phone').value };
    const r = await run(() => F.submit(body));
    if (!r) return;
    F.saveLookups(['prodi', 'tujuan'].filter((k) => data[k]).map((k) => ({ type: k, label: data[k] })));
    if (g) { A.rememberGuest(r.code, body.requester.email); await A.loadGuest(); }
    S.sent = { code: r.code, name: s.name, guest: g }; sel = ''; A.refresh(); hook.render(); scrollTo(0, 0);
  },
  rememberGuest(code, email) { const l = JSON.parse(localStorage.getItem('gl') || '[]'); if (!l.some((x) => x.code === code)) l.push({ code, email }); localStorage.setItem('gl', JSON.stringify(l.slice(-30))); },
  async loadGuest() {
    const l = JSON.parse(localStorage.getItem('gl') || '[]');
    S.guest = (await Promise.all(l.map((x) => F.track(x).catch(() => null)))).filter(Boolean); hook.render();
  },
  async lacak() {
    const code = $('#lc').value.trim(), email = $('#le').value.trim();
    const r = await run(() => F.track({ code, email }));
    if (r) { A.rememberGuest(r.code, email); await A.loadGuest(); S.view = 'mine'; hook.render(); }
  },
  async refresh() { try { const o = await F.over(); S.stats = o.stats || {}; S.queue = o.queue || {}; if (!S.user) await A.loadGuest(); hook.render(); } catch (e) { /* abaikan */ } },
  open(id) {
    const r = mine().find((x) => x.id === id); if (!r) return;
    const q = qinfo(r), c = r.confirm, s = stages(r), cancellable = ['Diajukan', 'Diproses', 'Menunggu Konfirmasi', 'Menunggu Persetujuan'].includes(r.status);
    const foot = r.status === 'Selesai' ? `<button class="btn" onclick="A.dlL('${r.id}')">⬇ Unduh surat (PDF)</button>${r.feedback ? '' : `<button class="btn g" onclick="A.fbM('${r.id}')">⭐ Beri nilai</button>`}` : '';
    modal(`<h2>${esc(r.sname)}</h2><div class="mu">${r.code} · diajukan ${fdate(r.createdAt)}</div><div style="margin-top:6px">${tagOf(r)}</div>${stepper(r)}${signChecklist(r)}
    ${q ? `<div class="card"><b>📍 Antrean ke-${q.pos} dari ${q.total}</b><div class="mu">${q.pos - 1} surat di depan Anda · ${estTxt(r.sid)}</div></div>` : ''}
    ${r.status === 'Menunggu Konfirmasi' && c ? `<div class="card warn"><b>Admin bertanya:</b><p>${esc(c.question)}</p><p class="mu">Mohon jawab sebelum ${fdate(c.deadline)}. Tanpa jawaban, admin dapat membatalkan permintaan.</p><div class="row"><button class="btn" onclick="A.act('${r.id}','respond_continue')">Masih butuh, lanjutkan</button><button class="btn r" onclick="A.act('${r.id}','cancel_user')">Tidak perlu, batalkan</button></div></div>` : ''}
    ${r.status === 'Selesai' ? `<div class="card"><b>✅ Surat sudah terbit</b><div class="mu">Nomor ${esc(r.letter ? r.letter.no : '')}. Bertanda tangan digital dan dapat diverifikasi siapa pun.</div><div class="row" style="margin-top:8px"><button class="btn g s" onclick="A.viewHtml('${r.id}')">Lihat sebagai HTML</button>${r.letter ? `<a class="btn g s" href="#/v/${r.letter.vcode}" onclick="A.close()">Verifikasi keaslian</a>` : ''}</div></div>` : ''}
    <details><summary>⏱ Durasi tiap tahap · total ${fd(s.total)}</summary>${stageTable(r)}</details>
    <details open><summary>Data permintaan</summary><table>${Object.entries(r.data || {}).map(([k, v]) => `<tr><th>${FL[k] || k}</th><td>${esc(v)}</td></tr>`).join('')}</table></details>
    ${cancellable ? `<details><summary>Lainnya</summary><p class="mu">Tidak jadi membutuhkan surat ini? Pembatalan menghentikan timer dan tidak dapat dibuka kembali.</p><button class="btn r s" onclick="A.act('${r.id}','cancel_user',true)">Batalkan permintaan</button></details>` : ''}`, foot);
  },
  async act(id, action, ask) {
    if (action === 'cancel_user' && ask && !confirm('Batalkan permintaan ini? Timer akan berhenti dan tidak dapat dibuka kembali.')) return;
    if (action === 'cancel_user' && !ask && !confirm('Yakin batalkan permintaan?')) return;
    const r = mine().find((x) => x.id === id) || S.rq.find((x) => x.id === id);
    const ok = await run(() => F.change({ id, action, }));
    if (ok) { modal(''); await A.refresh(); }
  },
  async viewHtml(id, version) { const h = await run(() => F.html({ id, version })); if (h) window.open(URL.createObjectURL(new Blob([h], { type: 'text/html' })), '_blank'); },
  async dlL(id, version) {
    const o = await run(() => F.dl({ id, version })); if (!o) return;
    if (!o.ok) alert('Peringatan: hash PDF yang dibuat ulang tidak sama dengan hash di rantai. Dokumen ini TIDAK dapat diverifikasi; hubungi admin.');
    saveFile(o.name, o.bytes, 'application/pdf');
  },
  fbM(id) {
    const sel5 = (k) => `<div class="row"><b style="width:110px">${k}</b><select id="fb_${k}" style="width:auto">${[5, 4, 3, 2, 1].map((n) => `<option>${n}</option>`).join('')}</select></div>`;
    modal(`<h2>Feedback</h2>${['Kerapihan', 'Kecepatan', 'Keramahan'].map(sel5).join('')}<label>Komentar</label><textarea id="fb_note" rows="3"></textarea><button class="btn" onclick="A.fbSend('${id}')">Kirim</button>`);
  },
  async fbSend(id) {
    const aspects = {}; ['Kerapihan', 'Kecepatan', 'Keramahan'].forEach((k) => (aspects[k] = +$('#fb_' + k).value));
    const stars = Math.round(Object.values(aspects).reduce((a, b) => a + b, 0) / 3);
    const r = mine().find((x) => x.id === id);
    if (await run(() => F.fb({ id, stars, aspects, note: $('#fb_note').value }))) { modal(''); A.refresh(); }
  },
  async readAll() { for (const n of S.nt.filter((x) => !x.read)) await updateDoc(doc(fs, 'notifications', n.id), { read: true }); },
  expDet() {
    const h = ['Kode', 'Jenis surat', 'Pemohon', 'Status pemohon', 'Email', 'Status', 'Prioritas', 'Diajukan', 'Berakhir', 'Total (hari)', 'Menunggu pemohon (hari)', 'Kecepatan layanan (hari)', 'Batas (hari)', 'Tepat waktu', 'Rating'];
    saveFile('rincian-surat-' + st() + '.csv', csv([h, ...filtered().map((r) => { const s = stages(r); return [r.code, r.sname, r.requester.name, r.requester.status, r.requester.email, r.status, r.priority ? 'Ya' : '', fdate(r.createdAt), fdate(r.endedAt), dd(s.total), dd(s.wait), dd(s.proc), r.slaDays, r.status === 'Selesai' ? (s.proc <= r.slaDays * DAY ? 'Ya' : 'Tidak') : '', r.feedback ? r.feedback.stars : '']; })]), 'text/csv');
  },
  expSum() {
    const L = filtered();
    saveFile('ringkasan-surat-' + st() + '.csv', csv([['Periode', S.DF.from || 'awal', S.DF.to || 'sekarang'], ['Jenis surat', 'Total', 'On progress', 'Menunggu konfirmasi', 'Selesai', 'Dibatalkan', 'Batas (hari)', 'Rata-rata kecepatan layanan (hari)', 'Rata-rata total (hari)', 'Rata-rata menunggu pemohon (hari)'],
      ...S.sv.filter((s) => !S.DF.sid || s.id === S.DF.sid).map((s) => { const g = agg(L.filter((r) => r.sid === s.id)); return [s.name, g.n, g.prog, g.wait, g.done, g.canc, s.sla, g.avgProc ?? '', g.avgTotal ?? '', g.avgWait ?? '']; })]), 'text/csv');
  },
});
