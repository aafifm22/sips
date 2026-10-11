import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, updateProfile } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { auth, fs, S, F, $, esc, run, hook, isAdm, isSup, modal, svc, toast, confirmDlg } from './core.js';
import { pendingSlots } from './api.js';
import { homeV, ajukanV, mineV, lacakV, notifV, dashV } from './user.js';
import { queueV, fbV, svcV, usersV, settingsV, auditV, approveV, ledgerV, attentionV, checklistV } from './admin.js';
import { verifyV } from './verify.js';
import { exportV } from './export.js';
import { applyTheme } from './theme.js';

const A = (window.A = window.A || {});
let CL = [], loginMode = 'in', dataUnsub = [], dataKey = '';

/* ---------- navigasi ---------- */
const isOff = () => !!(S.p && S.p.signer);
const ICON = { home: '🏠', ajukan: '＋', mine: '📄', dash: '📊', queue: '📥', svc: '🗂', users: '👥', fb: '⭐', ledger: '🔐', export: '📦', notif: '🔔', set: '⚙️', audit: '🧾', appr: '✍️', verif: '🔎', guide: '❓', ver: 'ℹ️', lacak: '🔍' };
const SHORT = { home: 'Beranda', ajukan: 'Ajukan', mine: 'Permintaan', dash: 'Dashboard', queue: 'Kerjakan', svc: 'Layanan', appr: 'Persetujuan', lacak: 'Lacak' };
const LONG = { home: 'Beranda', ajukan: 'Ajukan surat baru', mine: 'Permintaan saya', dash: 'Dashboard & laporan', queue: 'Kerjakan surat (antrean)', svc: 'Kelola layanan', users: 'Pengguna & akses', fb: 'Feedback', ledger: 'Tanda tangan digital', export: 'Ekspor & cadangan', notif: 'Notifikasi', set: 'Pengaturan & profil', audit: 'Audit log', appr: 'Persetujuan surat', verif: 'Verifikasi dokumen', guide: 'Panduan penggunaan', ver: 'Versi aplikasi', lacak: 'Lacak dengan kode' };
/** Menu utama dibatasi (3-4 item) agar tidak membingungkan; sisanya di "Lainnya". */
function navModel() {
  const off = isOff();
  if (!S.user) return { primary: ['ajukan', 'mine', 'lacak'], more: ['verif', 'guide', 'ver'] };
  if (isAdm()) return { primary: off ? ['queue', 'appr', 'dash', 'svc'] : ['queue', 'dash', 'svc'], more: ['users', 'fb', 'ledger', 'export', 'notif', 'set', ...(isSup() ? ['audit'] : []), 'verif', 'guide', 'ver'] };
  return { primary: off ? ['home', 'appr', 'ajukan', 'mine'] : ['home', 'ajukan', 'mine'], more: ['dash', ...(off ? ['ledger'] : []), 'notif', 'set', 'verif', 'guide', 'ver'] };
}
function badge(k) {
  let n = 0;
  if (k === 'queue') n = S.rq.filter((r) => r.status === 'Diajukan').length;
  else if (k === 'mine') n = S.rq.filter((r) => r.status === 'Menunggu Konfirmasi').length;
  else if (k === 'appr') n = S.appr.filter((r) => r.status === 'Menunggu Persetujuan' && pendingSlots(r, svc(r.sid)).some((x) => x.uid === S.user.uid)).length;
  else if (k === 'notif') n = S.nt.filter((x) => !x.read).length;
  return n ? `<span class="dot">${n > 99 ? '99+' : n}</span>` : '';
}
A.more = () => {
  const { more } = navModel();
  modal(`<h2>Menu</h2>${S.user ? `<p class="mu">${esc(S.p ? S.p.name : '')} · ${S.p && S.p.role === 'superadmin' ? 'Admin Super' : S.p && S.p.role === 'admin' ? 'Admin' : esc(S.p ? S.p.status : '')}</p>` : ''}<div class="menu">${more.map((k) => `<button onclick="A.close();A.nav('${k}')"><i>${ICON[k]}</i>${LONG[k]}${badge(k)}</button>`).join('')}<button onclick="A.themeM()"><i>🎨</i>Tema & warna</button>${S.user ? '<button onclick="A.close();A.logout()"><i>🚪</i>Keluar</button>' : '<button onclick="A.close();A.mode(\'in\')"><i>👤</i>Masuk / Daftar</button>'}</div>`);
};
A.nav = (v) => { S.view = v; if (v === 'audit') A.loadAudit(); if (v === 'ledger') A.loadLedger(); if (v === 'export') A.loadExport(); if (location.hash.startsWith('#/v/')) location.hash = ''; render(); scrollTo(0, 0); };
A.logout = () => signOut(auth);
A.claim = async () => { if (await confirmDlg({ title: 'Jadikan akun ini Admin Super?', msg: 'Hanya bisa dilakukan SEKALI, oleh orang pertama yang mengklaim.', ok: 'Ya, klaim' }) && await run(() => F.claimSuper())) toast('Anda kini Admin Super.', 'ok'); };
A.moreClosed = () => { S.closedLimit += 300; startData(); };

/* ---------- login ---------- */
function loginV() {
  const reg = loginMode === 'up';
  return `<div class="card"><h2>${reg ? 'Daftar akun' : 'Masuk'}</h2><button class="btn" onclick="A.google()">G &nbsp;Masuk dengan Google</button>
  <p class="mu" style="margin-top:14px">atau dengan email</p>${reg ? '<input id="l_name" placeholder="Nama lengkap">' : ''}<input id="l_email" type="email" placeholder="Email"><input id="l_pass" type="password" placeholder="Kata sandi (min. 6 karakter)">
  <div class="row"><button class="btn" onclick="A.emailAuth()">${reg ? 'Daftar' : 'Masuk'}</button><button class="btn g" onclick="A.mode('${reg ? 'in' : 'up'}')">${reg ? 'Sudah punya akun' : 'Buat akun baru'}</button>${reg ? '' : '<button class="btn g s" onclick="A.reset()">Lupa sandi</button>'}</div></div>
  <div class="card"><h3>Tanpa login (Tamu)</h3><p class="mu">Anda tetap dapat mengajukan surat dan melacaknya dengan kode + email.</p><button class="btn g" onclick="A.nav('ajukan')">Ajukan surat sebagai tamu</button></div>`;
}
Object.assign(A, {
  mode(m) { loginMode = m; S.view = 'login'; render(); },
  google: () => run(() => signInWithPopup(auth, new GoogleAuthProvider())),
  emailAuth: () => run(async () => {
    const e = $('#l_email').value.trim(), p = $('#l_pass').value;
    if (loginMode === 'up') { const c = await createUserWithEmailAndPassword(auth, e, p); const n = $('#l_name').value.trim(); if (n) await updateProfile(c.user, { displayName: n }); } else await signInWithEmailAndPassword(auth, e, p);
  }),
  reset: () => run(async () => { const e = $('#l_email').value.trim(); if (!e) return toast('Isi email dulu', 'er'); await sendPasswordResetEmail(auth, e); toast('Tautan reset sandi dikirim ke email.', 'ok'); }),
});

/* ---------- panduan & versi ---------- */
function md(t) {
  const inl = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
  let out = '', ul = false;
  for (const l of t.split('\n')) {
    const li = /^\s*[-*] (.*)/.exec(l);
    if (li) { if (!ul) { out += '<ul>'; ul = true; } out += `<li>${inl(li[1])}</li>`; continue; }
    if (ul) { out += '</ul>'; ul = false; }
    const h = /^(#{1,3}) (.*)/.exec(l);
    out += h ? `<h${h[1].length}>${inl(h[2])}</h${h[1].length}>` : l.trim() ? `<p>${inl(l)}</p>` : '';
  }
  return out + (ul ? '</ul>' : '');
}
let guide = null;
async function guideV() { if (guide == null) { try { guide = md(await (await fetch('docs/panduan.md')).text()); } catch (e) { guide = '<p>Panduan tidak dapat dimuat.</p>'; } } return `<div class="card guide">${guide}</div>`; }
const verV = () => `<div class="card"><h2>Versi aplikasi & riwayat perubahan</h2>${CL.map((c, i) => `<div class="item"><b>v${c.v}</b> ${i === 0 ? '<span class="tag ok">terpasang</span>' : ''} <span class="mu">${c.date}</span><ul>${c.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`).join('')}</div>`;

/* ---------- render ---------- */
async function render() {
  if (!S.ready) return;
  $('#brand').textContent = '📮 ' + (S.set.instName || 'Layanan Surat');
  const ini = S.p && S.p.name ? S.p.name.trim()[0].toUpperCase() : '?';
  $('#who').innerHTML = S.user ? `<button class="ibtn" onclick="A.nav('notif')" aria-label="Notifikasi">🔔${badge('notif')}</button><button class="ibtn av" onclick="A.more()" aria-label="Akun & menu">${esc(ini)}</button>` : '<button class="btn s" onclick="A.mode(\'in\')">Masuk / Daftar</button><button class="ibtn" onclick="A.more()" aria-label="Menu">☰</button>';
  if (location.hash.startsWith('#/v/')) S.view = 'verif';
  const { primary, more } = navModel(), all = [...primary, ...more, 'login'];
  if (!all.includes(S.view)) S.view = S.user ? (isAdm() ? 'queue' : 'home') : 'ajukan';
  const inMore = more.includes(S.view);
  $('#nav').innerHTML = primary.map((k) => `<button class="${S.view === k ? 'on' : ''}" onclick="A.nav('${k}')">${SHORT[k]}${badge(k)}</button>`).join('') + `<button class="${inMore ? 'on' : ''}" onclick="A.more()">⋯ Lainnya</button>`;
  $('#bnav').innerHTML = primary.map((k) => `<button class="${k === 'ajukan' ? 'cta ' : ''}${S.view === k ? 'on' : ''}" onclick="A.nav('${k}')"><i>${ICON[k]}</i>${SHORT[k]}${badge(k)}</button>`).join('') + `<button class="${inMore ? 'on' : ''}" onclick="A.more()"><i>☰</i>Lainnya</button>`;
  const code = location.hash.startsWith('#/v/') ? decodeURIComponent(location.hash.slice(4)) : '';
  const views = { home: homeV, ajukan: ajukanV, mine: mineV, lacak: lacakV, dash: () => (isAdm() ? checklistV() + attentionV() : '') + dashV(), queue: queueV, svc: svcV, users: usersV, fb: fbV, notif: notifV, set: settingsV, audit: auditV, appr: approveV, ledger: ledgerV, export: exportV, verif: () => verifyV(code), guide: guideV, ver: verV, login: loginV };
  const claim = S.user && S.metaSuper === false ? '<div class="card" style="border-left:4px solid var(--wa)"><b>Belum ada Admin Super.</b> Jika Anda pemilik/pengelola aplikasi ini, klaim sekarang (sekali saja).<br><button class="btn s" onclick="A.claim()">Jadikan saya Admin Super</button></div>' : '';
  const errB = S.err ? `<div class="card" style="border-left:4px solid var(--er)"><b>Gagal memuat sebagian data</b><div class="mu" style="word-break:break-all">${esc(S.err)}</div><div class="mu">Jika menyebut "index", buka tautan di pesan itu atau jalankan <code>firebase deploy --only firestore:indexes</code> (indeks butuh beberapa menit). Jika menyebut "permission", deploy aturan terbaru: <code>firebase deploy --only firestore:rules</code>.</div></div>` : '';
  $('#app').innerHTML = errB + claim + await views[S.view]();
  $('#foot').textContent = `Layanan Surat v${CL[0] ? CL[0].v : ''} · ${S.set.instName || ''}`;
}
hook.render = render;
window.addEventListener('hashchange', render);

/* ---------- data realtime (hemat baca: hanya yang dibutuhkan) ---------- */
function publicSubs() {
  onSnapshot(doc(fs, 'settings', 'app'), (d) => { S.set = d.data() || {}; applyTheme(); render(); });
  onSnapshot(collection(fs, 'services'), (q) => { S.sv = q.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')); render(); });
  onSnapshot(collection(fs, 'lookups'), (q) => {
    S.lkDocs = q.docs.map((d) => ({ id: d.id, ...d.data() })); S.lk = { prodi: [], tujuan: [] };
    S.lkDocs.forEach((x) => S.lk[x.type] && S.lk[x.type].push(x.label)); Object.values(S.lk).forEach((l) => l.sort((a, b) => a.localeCompare(b))); render();
  }, () => {});
  onSnapshot(doc(fs, 'meta', 'ledgerHead'), (d) => { S.head = d.exists() ? d.data() : null; render(); }, () => {});
  onSnapshot(doc(fs, 'meta', 'super'), (d) => { S.metaSuper = d.exists(); render(); }, () => {});
}
function startData() {
  dataUnsub.forEach((f) => f()); dataUnsub = [];
  const u = S.user, adm = isAdm(), err = (e) => { console.error(e); S.err = (e.code || '') + ': ' + (e.message || e); render(); }, on = (q, fn) => dataUnsub.push(onSnapshot(q, fn, err));
  if (adm) {
    const m = { open: [], closed: [] }, merge = () => { S.rq = [...m.open, ...m.closed].sort((a, b) => b.createdAt - a.createdAt); render(); };
    on(query(collection(fs, 'requests'), where('status', 'in', ['Diajukan', 'Diproses', 'Menunggu Konfirmasi', 'Menunggu Persetujuan'])), (q) => { m.open = q.docs.map((d) => ({ id: d.id, ...d.data() })); merge(); F.sweepQueue(); });
    on(query(collection(fs, 'requests'), where('status', 'in', ['Selesai', 'Dibatalkan']), orderBy('createdAt', 'desc'), limit(S.closedLimit)), (q) => { m.closed = q.docs.map((d) => ({ id: d.id, ...d.data() })); merge(); });
    on(collection(fs, 'users'), (q) => { S.users = q.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')); render(); });
  } else on(query(collection(fs, 'requests'), where('ownerUid', '==', u.uid)), (q) => { S.err = ''; S.rq = q.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt); render(); A.refresh(); });
  if (isOff()) on(query(collection(fs, 'requests'), where('approvers', 'array-contains', u.uid)), (q) => { S.appr = q.docs.map((d) => ({ id: d.id, ...d.data() })); render(); });
  on(query(collection(fs, 'notifications'), where('toUid', 'in', adm ? [u.uid, 'admin'] : [u.uid]), orderBy('at', 'desc'), limit(50)), (q) => { S.nt = q.docs.map((d) => ({ id: d.id, ...d.data() })); render(); });
  A.refresh();
}
A.restart = startData;
onAuthStateChanged(auth, async (u) => {
  S.unsub.forEach((f) => f()); S.unsub = []; dataUnsub.forEach((f) => f()); dataUnsub = []; dataKey = '';
  S.user = u; S.p = null; S.rq = []; S.nt = []; S.users = []; S.appr = []; S.ready = true;
  if (!u) { S.view = 'ajukan'; applyTheme(); await A.loadGuest(); A.refresh(); render(); return; }
  try { await F.ensure(); } catch (e) { toast('Gagal memuat profil: ' + e.message, 'er'); signOut(auth); return; }
  S.unsub.push(onSnapshot(doc(fs, 'users', u.uid), (d) => {
    const first = !S.p; S.p = d.data(); applyTheme();
    const k = [S.p.role, !!S.p.signer, S.p.active].join('|');
    if (k !== dataKey) { dataKey = k; startData(); if (first) S.view = isAdm() ? 'queue' : 'home'; }
    render();
  }));
});

/* ---------- boot ---------- */
(async () => {
  try { CL = await (await fetch('changelog.json')).json(); } catch (e) { CL = []; }
  publicSubs();
  setInterval(() => A.refresh(), 120000);
  // penerbit otomatis (hanya bila diaktifkan admin di perangkat ini)
  setInterval(() => { if (S.ready && isAdm() && localStorage.getItem('ly-agent') === '1') F.autoRun().then((n) => n && console.log('terbit otomatis:', n)); }, 30000);
  setInterval(() => { const a = document.activeElement; if (S.ready && !$('#md').innerHTML && !(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) && ['home', 'mine', 'queue', 'dash', 'appr'].includes(S.view)) render(); }, 60000);
})();
