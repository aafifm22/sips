import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app), fs = getFirestore(app);
export const F = {}; // diisi oleh api.js

export const DAY = 864e5;
export const OPEN = ['Diajukan', 'Diproses', 'Menunggu Konfirmasi', 'Menunggu Persetujuan'];
export const QUEUE = ['Diajukan', 'Diproses'];
export const STATUS_ALL = ['Mahasiswa', 'Dosen', 'Tendik', 'Ketua STIKES', 'Waket 1', 'Waket 2'];
export const STATUS_SELF = ['Mahasiswa', 'Dosen', 'Tendik'];
export const WHO = ['Guest', ...STATUS_ALL];
export const FL = { nama: 'Nama lengkap', nim: 'NIM / NIP', prodi: 'Program studi / unit', smt: 'Semester', tujuan: 'Instansi tujuan', ket: 'Keperluan / deskripsi' };
export const SPECIAL = { _isi: 'Isi surat (kotak)', _nomor: 'Nomor surat', _tanggal: 'Tanggal', _ttd: 'Tanda tangan (gambar)', _ttd_nama: 'Nama penandatangan', _ttd_jabatan: 'Jabatan penandatangan', _qr: 'QR verifikasi', _cap: 'Cap / stempel (gambar)' };

export const S = {
  user: null, p: null, set: {}, sv: [], rq: [], nt: [], users: [], stats: {}, queue: {},
  guest: [], audit: [], signers: [], appr: [], wiz: {}, lc: {}, closedLimit: 150, ledger: [], keyReady: false, gauth: null, view: 'home', DF: { sid: '', from: '', to: '' }, unsub: [], draft: {}, sig: {},
};
export const hook = { render() {} };

export const isAdm = () => !!S.p && ['admin', 'superadmin'].includes(S.p.role);
export const isSup = () => !!S.p && S.p.role === 'superadmin';
export const svc = (id) => S.sv.find((s) => s.id === id) || { id, name: '(dihapus)', sla: 0, fields: [], who: [] };
/** Alur penerbitan per layanan (dinamis): issue 'admin' | 'auto', penandatangan[] {key,label,uid,mode:'manual'|'delegated',required,order}. */
export const flowOf = (s) => { const f = (s && s.flow) || {}; return { issue: f.issue === 'auto' ? 'auto' : 'admin', autoDelayMin: +f.autoDelayMin || 0, autoVerifiedOnly: f.autoVerifiedOnly !== false, signers: (f.signers || []).slice().sort((a, b) => (a.order || 1) - (b.order || 1)) }; };
export const $ = (s) => document.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const fdate = (t) => (t ? new Date(t).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
export function fd(ms) {
  const m = Math.max(0, Math.round(ms / 6e4));
  if (m < 1) return '< 1 mnt';
  if (m < 60) return m + ' mnt';
  if (m < 1440) return Math.floor(m / 60) + ' jam ' + (m % 60) + ' mnt';
  return Math.floor(m / 1440) + ' hr ' + Math.floor((m % 1440) / 60) + ' jam';
}
export async function run(f) {
  loading(true);
  try { return await f(); } catch (e) {
    const m = e && e.message ? e.message : String(e);
    toast(/permission|insufficient/i.test(m) ? 'Tindakan ditolak oleh aturan keamanan (mis. batas waktu konfirmasi belum lewat, status sudah berubah, atau Anda tidak berwenang). Muat ulang lalu coba lagi.' : m, 'er');
  } finally { loading(false); }
}

/* ---------- Kit UX (adopsi framework: toast, loading, dialog konfirmasi, empty, validasi) ---------- */
/** Toast non-blokir pengganti alert(). type: 'ok' | 'er' | 'info'. */
export function toast(msg, type = 'info', ms = 4200) {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'ok' ? 'ok' : type === 'er' ? 'er' : '');
  el.innerHTML = `<span>${type === 'ok' ? '✅' : type === 'er' ? '⚠️' : 'ℹ️'}</span><span style="flex:1">${esc(msg)}</span><button aria-label="Tutup">✕</button>`;
  el.querySelector('button').onclick = () => el.remove();
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
  return true;
}
/** Overlay loading dengan jeda (tidak berkedip untuk operasi cepat). Mendukung bersarang via counter. */
let loadN = 0, loadT = null;
export function loading(on) {
  loadN = Math.max(0, loadN + (on ? 1 : -1));
  if (loadN > 0 && !document.getElementById('ld')) {
    clearTimeout(loadT);
    loadT = setTimeout(() => {
      if (loadN > 0 && !document.getElementById('ld')) {
        const d = document.createElement('div'); d.id = 'ld'; d.innerHTML = '<div class="spin" role="status" aria-label="Memuat"></div>';
        document.body.appendChild(d);
      }
    }, 220);
  }
  if (loadN === 0) { clearTimeout(loadT); document.getElementById('ld')?.remove(); }
}
/**
 * Dialog konfirmasi pengganti confirm() bawaan. Render di overlay sendiri (#cf)
 * agar tidak menimpa modal #md yang sedang terbuka. HANYA panggil saat tidak ada
 * modal #md yang terbuka (aksi destruktif dari halaman: hapus layanan, cabut kunci, klaim, dsb).
 */
export function confirmDlg({ title = 'Yakin?', msg = '', ok = 'Ya, lanjutkan', danger = false } = {}) {
  document.getElementById('cf')?.remove();
  return new Promise((res) => {
    const d = document.createElement('div'); d.id = 'cf';
    d.innerHTML = `<div class="cf-box" role="alertdialog" aria-modal="true"><h2>${esc(title)}</h2>${msg ? `<p class="mu">${esc(msg)}</p>` : ''}<div class="row"><button class="btn g" data-x="no">Batal</button><button class="btn ${danger ? 'r' : ''}" data-x="yes">${esc(ok)}</button></div></div>`;
    const done = (v) => { d.remove(); document.removeEventListener('keydown', esc2); res(v); };
    const esc2 = (e) => { if (e.key === 'Escape') done(false); };
    d.querySelector('[data-x=no]').onclick = () => done(false);
    d.querySelector('[data-x=yes]').onclick = () => done(true);
    d.addEventListener('click', (e) => { if (e.target === d) done(false); });
    document.addEventListener('keydown', esc2);
    document.body.appendChild(d);
    d.querySelector('[data-x=yes]').focus();
  });
}
/** Status kosong yang konsisten untuk daftar. */
export const empty = (icon, text) => `<p class="empty">${icon} ${esc(text)}</p>`;
/** Validator form terpusat. Kembalikan '' bila valid, atau pesan galat. */
export const vReq = (v, name) => (String(v ?? '').trim() ? '' : name + ' wajib diisi');
export const vEmail = (v) => (/^\S+@\S+\.\S+$/.test(String(v || '').trim()) ? '' : 'Email tidak valid');
export const vPhone = (v) => (/^08\d{7,13}$/.test(String(v || '').trim().replace(/[\s-]/g, '')) ? '' : 'Nomor HP diawali 08, 9–15 digit');
export const vUrl = (v) => (!String(v || '').trim() || /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(String(v).trim()) ? '' : 'URL harus diawali https:// (atau kosongkan)');
export const vMin = (v, n, name) => (String(v ?? '').trim().length >= n ? '' : (name || 'Isian') + ' minimal ' + n + ' karakter');
/** Tunda eksekusi hingga jeda tanpa panggilan baru (pencarian, filter). */
export const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/** Durasi per tahap. Timer berhenti pada status akhir (Selesai/Dibatalkan). */
export function stages(r) {
  const h = [...(r.history || [])].sort((a, b) => a.at - b.at), end = r.endedAt, now = end || Date.now(), rows = [];
  h.forEach((e, i) => {
    const nx = h[i + 1], terminal = ['Selesai', 'Dibatalkan'].includes(e.status);
    const to = terminal ? e.at : nx ? nx.at : now;
    rows.push({ status: e.status, at: e.at, by: e.by, note: e.note, ms: Math.max(0, to - e.at), live: !nx && !terminal });
  });
  const total = now - r.createdAt, wait = rows.filter((x) => x.status === 'Menunggu Konfirmasi').reduce((a, x) => a + x.ms, 0);
  return { rows, total, wait, proc: total - wait, done: !!end };
}
export const openQ = () => S.rq.filter((r) => QUEUE.includes(r.status)).sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.createdAt - b.createdAt);
export function qinfo(r) {
  if (!QUEUE.includes(r.status)) return null;
  if (isAdm()) { const q = openQ(); return { pos: q.findIndex((x) => x.id === r.id) + 1, total: q.length }; }
  return r.queue || S.queue[r.id] || null;
}
export function modal(h, foot = '') {
  $('#md').innerHTML = h ? `<div class="modal" onclick="if(event.target===this)A.close()"><div class="sheet" role="dialog" aria-modal="true"><button class="x" onclick="A.close()" aria-label="Tutup">✕</button>${h}${foot ? `<div class="foot">${foot}</div>` : ''}</div></div>` : '';
  document.body.classList.toggle('noscroll', !!h);
  setTimeout(() => window.A && window.A.initCv && window.A.initCv(), 0);
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.getElementById('md').innerHTML) modal(''); });
export const csv = (rows) => '\ufeff' + rows.map((r) => r.map((c) => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
export function saveFile(name, data, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
export function saveB64(name, b64, type) {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  saveFile(name, u, type);
}
export const tagOf = (r, noStatus) => {
  const c = { Selesai: 'ok', Dibatalkan: 'er', 'Menunggu Konfirmasi': 'wa', 'Menunggu Persetujuan': 'wa', Diproses: 'wa' }[r.status] || '';
  return `${noStatus ? '' : `<span class="tag ${c}">${r.status}</span>`}${r.priority ? '<span class="tag er">🔥 Prioritas</span>' : ''}${r.flag ? `<span class="tag">🚩 ${esc(r.flag)}</span>` : ''}`;
};
/** Rangkum sekumpulan permintaan: jumlah per status dan rata-rata durasi (hari). */
export function agg(list) {
  const d = list.filter((r) => r.status === 'Selesai'), m = d.map(stages);
  const avg = (k) => (m.length ? +(m.reduce((a, x) => a + x[k], 0) / m.length / DAY).toFixed(2) : null);
  return {
    n: list.length, prog: list.filter((r) => QUEUE.includes(r.status)).length, wait: list.filter((r) => ['Menunggu Konfirmasi', 'Menunggu Persetujuan'].includes(r.status)).length,
    done: d.length, canc: list.filter((r) => r.status === 'Dibatalkan').length, avgProc: avg('proc'), avgTotal: avg('total'), avgWait: avg('wait'),
    onTime: d.filter((r) => stages(r).proc <= (r.slaDays || svc(r.sid).sla || 0) * DAY).length,
  };
}
