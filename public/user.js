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
  if (r.status === 'Dibatalkan') return '<div class="row" style="gap:4px;margin:6px 0"><span class="tag">Diajukan</span><span class="mu">→</span><span class="tag er">Dibatalkan</span></div>';
  const ST = ['Diajukan', 'Diproses', 'Selesai'], wait = r.status === 'Menunggu Konfirmasi', appr = r.status === 'Menunggu Persetujuan';
  const idx = ST.indexOf(appr ? 'Diproses' : wait ? (r.confirm && r.confirm.prev) || 'Diproses' : r.status), fin = r.status === 'Selesai';
  return `<div class="row" style="gap:4px;margin:6px 0">${ST.map((l, i) => {
    const dn = i < idx || fin, cur = i === idx && !fin;
    return `<span class="tag ${dn ? 'ok' : cur ? 'wa' : ''}" style="${i > idx && !fin ? 'opacity:.5' : ''}">${dn ? '✓ ' : ''}${l}${cur && wait ? ' ⏸ menunggu konfirmasi' : ''}${cur && appr ? ' ✍ menunggu persetujuan pejabat' : ''}</span>${i < 2 ? '<span class="mu">→</span>' : ''}`;
  }).join('')}</div>`;
}
export function stageTable(r) {
  const s = stages(r);
  return `<div class="scroll"><table><tr><th>Tahap</th><th>Mulai</th><th>Durasi</th><th>Oleh / catatan</th></tr>${s.rows.map((x) => {
    const term = ['Selesai', 'Dibatalkan'].includes(x.status);
    return `<tr><td><b>${x.status}</b></td><td>${fdate(x.at)}</td><td>${term ? '⏹ berhenti' : (x.live ? '⏳ ' : '') + fd(x.ms)}</td><td>${by(x.by)}${x.note ? ' · ' + esc(x.note) : ''}</td></tr>`;
  }).join('')}</table></div>
  <p class="mu">${s.done ? '⏹ Timer berhenti' : '⏳ Timer berjalan'} · Total <b>${fd(s.total)}</b> · menunggu klien ${fd(s.wait)} · <b>waktu kerja layanan ${fd(s.proc)}</b> (total dikurangi waktu menunggu klien).</p>`;
}
/** Checklist penandatangan: siapa saja yang diperlukan, sudah/belum, manual atau otomatis (delegasi). */
export function signChecklist(r) {
  const s = svc(r.sid), req = flowOf(s).signers.filter((x) => x.required !== false); if (!req.length) return '';
  const so = (r.approval && r.approval.signoffs) || [];
  return `<div class="mu" style="margin:4px 0">✍ Penandatangan:${req.map((sl) => { const d = so.find((y) => y.key === sl.key), done = !!d; return `<div>${done ? '✅' : sl.mode === 'delegated' ? '🖋' : '⬜'} ${esc(sl.label)}${d ? ` · ${esc(d.name)}${d.delegated ? ' (otomatis, delegasi)' : ''} · ${fdate(d.at)}` : sl.mode === 'delegated' ? ' · otomatis saat terbit' : r.status === 'Dibatalkan' ? ' · -' : ' · menunggu'}</div>`; }).join('')}</div>`;
}
export function reqCard(r, adm) {
  const s = stages(r), q = qinfo(r), last = s.rows[s.rows.length - 1], open = OPEN.includes(r.status);
  return `<div class="item"><div class="row"><div style="flex:1"><b>${esc(r.sname)}</b> <span class="mu">${r.code}</span><div>${tagOf(r)}</div>${stepper(r)}${signChecklist(r)}
  <div class="mu">${adm ? esc(r.requester.name) + ' (' + esc(r.requester.status) + ') · ' : ''}${q ? `Antrean ke-${q.pos} dari ${q.total} (${q.pos - 1} di depan)` : ''}${r.status === 'Menunggu Konfirmasi' ? `Menunggu jawaban klien sebelum ${fdate(r.confirm.deadline)}` : ''}</div>
  <div class="mu">⏱ ${s.done ? 'Total durasi' : 'Sudah berjalan'} <b>${fd(s.total)}</b> · tahap ${r.status}${s.done ? '' : ' ' + fd(last.ms)}${open ? ' · ' + estTxt(r.sid) : ''}</div></div>
  <button class="btn s" onclick="A.${adm ? 'proc' : 'open'}('${r.id}')">${adm ? 'Proses' : 'Detail'}</button></div></div>`;
}

/* ---------- halaman ---------- */
export function homeV() {
  const l = mine(), a = agg(l);
  return `<div class="grid"><div class="card stat"><b>${a.n}</b><span>Total permintaan</span></div><div class="card stat"><b>${a.prog + a.wait}</b><span>On progress</span></div><div class="card stat"><b>${a.done}</b><span>Selesai</span></div><div class="card stat"><b>${a.canc}</b><span>Dibatalkan</span></div></div>
  ${l.filter((r) => r.status === 'Menunggu Konfirmasi').map((r) => `<div class="card" style="border-color:var(--wa)"><b>⚠ Perlu jawaban Anda:</b> ${esc(r.sname)} (${r.code}) <button class="btn s" onclick="A.open('${r.id}')">Jawab</button></div>`).join('')}
  <div class="card"><h2>Layanan untuk Anda</h2>${S.sv.filter(allowed).map((s) => `<div class="item row"><div style="flex:1"><b>${esc(s.name)}</b><div class="mu">${estTxt(s.id)}</div></div><button class="btn s" onclick="A.ajukan('${s.id}')">Ajukan</button></div>`).join('') || '<p class="mu">Belum ada layanan.</p>'}</div>`;
}
export function ajukanV() {
  const list = S.sv.filter(allowed), s = list.find((x) => x.id === sel) || list[0];
  if (!s) return '<div class="card">Belum ada layanan yang tersedia untuk status Anda.</div>';
  sel = s.id;
  const g = !S.user;
  return `<div class="card"><h2>Ajukan Surat</h2><label>Jenis surat</label><select onchange="A.ajukan(this.value)">${list.map((x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
  <p class="mu">Estimasi: ${estTxt(s.id)} · mode ${s.mode === 'auto' ? 'otomatis' : s.mode === 'ai' ? 'dibantu AI' : 'template'}${s.needSign ? ' · memerlukan tanda tangan' : ''}</p>
  ${g ? '<label>Email *</label><input id="g_email" type="email"><label>Kontak (HP/WA) *</label><input id="g_phone">' + (s.fields.includes('nama') ? '' : '<label>Nama lengkap *</label><input id="g_name">') : ''}
  ${s.fields.map((k) => `<label>${FL[k] || k} *</label>${k === 'ket' ? `<textarea id="f_${k}" rows="3"></textarea>` : `<input id="f_${k}" value="${k === 'nama' && !g ? esc(S.p?.name) : k === 'nim' && !g ? esc(S.p?.idNumber) : k === 'prodi' && !g ? esc(S.p?.prodi) : ''}">`}`).join('')}
  <input class="hp" id="hp" tabindex="-1" autocomplete="off">
  <button class="btn" onclick="A.submit()">Kirim Permintaan</button></div>`;
}
export function mineV() {
  const l = mine().slice().sort((a, b) => b.createdAt - a.createdAt);
  return `<div class="card"><h2>Permintaan Saya</h2>${S.user ? '' : '<p class="mu">Sebagai tamu, permintaan yang Anda ajukan/lacak di perangkat ini ditampilkan di sini.</p>'}${l.map((r) => reqCard(r)).join('') || '<p class="mu">Belum ada.</p>'}</div>`;
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

/* ---------- dashboard (admin: semua data; klien/tamu: data sendiri) ---------- */
export const scoped = () => (isAdm() || S.user ? S.rq : S.guest);
export function filtered() {
  const f = S.DF.from ? new Date(S.DF.from).getTime() : 0, t = S.DF.to ? new Date(S.DF.to).getTime() + DAY : Infinity;
  return scoped().filter((r) => (!S.DF.sid || r.sid === S.DF.sid) && r.createdAt >= f && r.createdAt < t);
}
export function dashV() {
  const L = filtered(), a = agg(L), adm = isAdm();
  const mx = Math.max(1, ...S.sv.map((s) => L.filter((r) => r.sid === s.id).length));
  const rt = L.filter((r) => r.feedback), d = (v) => (v == null ? '–' : v + ' hr');
  return `<div class="card"><h3>Filter</h3><div class="row"><div style="flex:2;min-width:180px"><label>Jenis surat</label><select onchange="A.df('sid',this.value)"><option value="">Semua jenis</option>${S.sv.map((s) => `<option value="${s.id}" ${S.DF.sid === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
  <div style="flex:1;min-width:140px"><label>Dari tanggal</label><input type="date" value="${S.DF.from}" onchange="A.df('from',this.value)"></div><div style="flex:1;min-width:140px"><label>Sampai tanggal</label><input type="date" value="${S.DF.to}" onchange="A.df('to',this.value)"></div><button class="btn g s" onclick="A.df('reset')">Reset</button></div></div>
  <div class="grid"><div class="card stat"><b>${a.n}</b><span>Total</span></div><div class="card stat"><b>${a.prog}</b><span>On progress</span></div><div class="card stat"><b>${a.wait}</b><span>Menunggu konfirmasi</span></div><div class="card stat"><b>${a.done}</b><span>Selesai</span></div><div class="card stat"><b>${a.canc}</b><span>Dibatalkan</span></div>
  <div class="card stat"><b>${d(a.avgProc)}</b><span>Rata-rata kecepatan layanan</span></div><div class="card stat"><b>${d(a.avgTotal)}</b><span>Rata-rata total (termasuk menunggu klien)</span></div><div class="card stat"><b>${a.done ? Math.round((a.onTime / a.done) * 100) : 0}%</b><span>Tepat waktu</span></div><div class="card stat"><b>${rt.length ? (rt.reduce((x, r) => x + r.feedback.stars, 0) / rt.length).toFixed(1) : '–'} ★</b><span>Rating</span></div></div>
  <div class="card"><h2>Rincian per Jenis Surat</h2>${S.sv.filter((s) => !S.DF.sid || s.id === S.DF.sid).map((s) => {
    const l = L.filter((r) => r.sid === s.id), g = agg(l);
    if (!adm && !l.length) return '';
    return `<div class="item"><div class="row"><b style="flex:1">${esc(s.name)}</b><span class="tag wa">Progress ${g.prog + g.wait}</span><span class="tag ok">Selesai ${g.done}</span><span class="tag er">Batal ${g.canc}</span></div>
    <div class="mu">${g.n} permintaan · batas ${s.sla} hari · kecepatan layanan ${d(g.avgProc)} · total ${d(g.avgTotal)} · menunggu klien ${d(g.avgWait)}</div><div class="bar"><i style="width:${(g.n / mx) * 100}%"></i></div></div>`;
  }).join('')}</div>
  <div class="card"><h3>Unduh</h3><p class="mu">Mengikuti filter di atas.</p><div class="row"><button class="btn s" onclick="A.expDet()">⬇ Rincian (CSV)</button><button class="btn s" onclick="A.expSum()">⬇ Ringkasan (CSV)</button></div></div>`;
}
const st = () => new Date().toISOString().slice(0, 10);
const dd = (ms) => (ms == null ? '' : +(ms / DAY).toFixed(2));

/* ---------- aksi ---------- */
Object.assign(A, {
  close: () => modal(''),
  ajukan(id) { sel = id; S.view = 'ajukan'; hook.render(); },
  df(k, v) { if (k === 'reset') S.DF = { sid: '', from: '', to: '' }; else S.DF[k] = v; hook.render(); },
  async submit() {
    const s = svc(sel), data = {}, g = !S.user;
    for (const k of s.fields) { data[k] = $('#f_' + k).value.trim(); if (!data[k]) return alert('Lengkapi: ' + (FL[k] || k)); }
    const body = { sid: s.id, data, hp: $('#hp').value };
    if (g) body.requester = { name: data.nama || ($('#g_name') && $('#g_name').value) || '', email: $('#g_email').value, phone: $('#g_phone').value };
    const r = await run(() => F.submit(body));
    if (!r) return;
    if (g) { A.rememberGuest(r.code, body.requester.email); await A.loadGuest(); }
    alert('Terkirim! Kode lacak: ' + r.code + (g ? '\n\nSimpan kode ini BERSAMA email Anda; keduanya dibutuhkan untuk melacak.' : ''));
    S.view = 'mine'; A.refresh(); hook.render();
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
    const q = qinfo(r), c = r.confirm;
    modal(`<h2>${esc(r.sname)} <span class="mu">${r.code}</span></h2>${tagOf(r)}${stepper(r)}
    ${signChecklist(r)}${q ? `<p>Antrean ke-<b>${q.pos}</b> dari ${q.total} (${q.pos - 1} surat di depan Anda). Estimasi: ${estTxt(r.sid)}.</p>` : ''}
    ${r.status === 'Menunggu Konfirmasi' && c ? `<div class="card" style="border-color:var(--wa)"><b>Admin bertanya:</b><p>${esc(c.question)}</p><p class="mu">Mohon jawab sebelum ${fdate(c.deadline)}. Tanpa jawaban, admin dapat membatalkan permintaan.</p><div class="row"><button class="btn" onclick="A.act('${r.id}','respond_continue')">Masih butuh, lanjutkan</button><button class="btn r" onclick="A.act('${r.id}','cancel_user')">Tidak perlu, batalkan</button></div></div>` : ''}
    <h3>Durasi tiap tahap</h3>${stageTable(r)}
    <h3>Data permintaan</h3><table>${Object.entries(r.data || {}).map(([k, v]) => `<tr><th>${FL[k] || k}</th><td>${esc(v)}</td></tr>`).join('')}</table>
    <div class="row" style="margin-top:12px">${r.status === 'Selesai' ? `<button class="btn" onclick="A.dlL('${r.id}')">⬇ Unduh surat (PDF bertanda tangan digital)</button><button class="btn g" onclick="A.viewHtml('${r.id}')">Lihat HTML</button>${r.letter ? `<a class="btn g" href="#/v/${r.letter.vcode}" onclick="A.close()">Verifikasi</a>` : ''}${r.feedback ? '' : `<button class="btn g" onclick="A.fbM('${r.id}')">Beri feedback</button>`}` : ''}
    ${['Diajukan', 'Diproses'].includes(r.status) ? `<button class="btn r s" onclick="A.act('${r.id}','cancel_user',true)">Batalkan permintaan</button>` : ''}<button class="btn g s" onclick="A.close()">Tutup</button></div>`);
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
    const h = ['Kode', 'Jenis surat', 'Pemohon', 'Status pemohon', 'Email', 'Status', 'Prioritas', 'Diajukan', 'Berakhir', 'Total (hari)', 'Menunggu klien (hari)', 'Kecepatan layanan (hari)', 'Batas (hari)', 'Tepat waktu', 'Rating'];
    saveFile('rincian-surat-' + st() + '.csv', csv([h, ...filtered().map((r) => { const s = stages(r); return [r.code, r.sname, r.requester.name, r.requester.status, r.requester.email, r.status, r.priority ? 'Ya' : '', fdate(r.createdAt), fdate(r.endedAt), dd(s.total), dd(s.wait), dd(s.proc), r.slaDays, r.status === 'Selesai' ? (s.proc <= r.slaDays * DAY ? 'Ya' : 'Tidak') : '', r.feedback ? r.feedback.stars : '']; })]), 'text/csv');
  },
  expSum() {
    const L = filtered();
    saveFile('ringkasan-surat-' + st() + '.csv', csv([['Periode', S.DF.from || 'awal', S.DF.to || 'sekarang'], ['Jenis surat', 'Total', 'On progress', 'Menunggu konfirmasi', 'Selesai', 'Dibatalkan', 'Batas (hari)', 'Rata-rata kecepatan layanan (hari)', 'Rata-rata total (hari)', 'Rata-rata menunggu klien (hari)'],
      ...S.sv.filter((s) => !S.DF.sid || s.id === S.DF.sid).map((s) => { const g = agg(L.filter((r) => r.sid === s.id)); return [s.name, g.n, g.prog, g.wait, g.done, g.canc, s.sla, g.avgProc ?? '', g.avgTotal ?? '', g.avgWait ?? '']; })]), 'text/csv');
  },
});
