import { S, F, $, esc, fdate, run, hook } from './core.js';
import { sha256 } from './crypto.js';
const A = (window.A = window.A || {});
let RES = null;
function result(r) {
  if (!r) return '';
  if (r.loading) return '<div class="card">Memeriksa…</div>';
  if (!r.found) return `<div class="card" style="border-left:4px solid var(--er)"><h2>❌ ${r.hash ? 'PDF tidak terdaftar atau telah diubah' : 'Dokumen tidak ditemukan'}</h2><p>${r.hash ? 'Hash SHA-256 file ini tidak ada di rantai. File mungkin bukan dokumen resmi atau sudah dimodifikasi satu byte pun.<br><code>' + r.hash + '</code>' : 'Kode verifikasi tidak terdaftar.'}</p></div>`;
  const e = r.entry, ok = r.hashOk && r.sigOk && r.linkOk && r.nextOk !== false && r.soHashOk !== false && !(r.signoffs || []).some((x) => x.ok === false), sup = r.status === 'superseded';
  const tick = (v, t) => `<div>${v === null ? '➖' : v ? '✅' : '❌'} ${t}</div>`;
  return `<div class="card" style="border-left:4px solid var(--${!ok ? 'er' : sup ? 'wa' : 'ok'})"><h2>${!ok ? '⚠ Integritas bermasalah' : sup ? '⚠ Asli, tetapi telah digantikan revisi #' + r.supersededBy : '✅ Dokumen sah'}</h2>
  ${r.hash ? '<p><b>✅ File PDF yang Anda unggah identik dengan dokumen terdaftar</b> (hash cocok).</p>' : ''}
  <table><tr><th>Nomor</th><td>${esc(e.no)} ${e.type === 'revise' ? '<span class="tag">revisi</span>' : ''}</td></tr><tr><th>Layanan</th><td>${esc(e.serviceName)}</td></tr><tr><th>Penandatangan (tercetak)</th><td>${esc(e.signerName)} ${esc(e.signerTitle)}</td></tr>
  <tr><th>Ditandatangani digital oleh</th><td>${esc(r.keyName || '-')} · kunci <code>${e.kid}</code> ${r.keyActive === false ? '<span class="tag er">kini dicabut</span>' : ''}</td></tr><tr><th>Waktu pencatatan</th><td>${fdate(e.at)}</td></tr>
  <tr><th>Entri rantai</th><td>#${e.seq}</td></tr><tr><th>Hash dokumen (SHA-256)</th><td><code style="word-break:break-all">${e.docHash}</code></td></tr><tr><th>Hash entri</th><td><code style="word-break:break-all">${e.entryHash}</code></td></tr></table>
  <h3 style="margin-top:12px">Pemeriksaan kriptografis (dihitung di browser Anda)</h3>${tick(r.hashOk, 'Hash entri dihitung ulang cocok')}${tick(r.sigOk, 'Tanda tangan digital ECDSA P-256 valid terhadap kunci publik terdaftar')}${tick(r.linkOk, 'Tertaut ke entri sebelumnya (rantai tidak terputus)')}${tick(r.nextOk, 'Entri berikutnya menaut ke entri ini')}${r.signoffs && r.signoffs.length ? `<h3 style="margin-top:12px">Penandatangan</h3>${r.signoffs.map((x) => `<div>${x.delegated ? '🖋' : x.ok ? '✅' : '❌'} <b>${esc(x.label)}</b> · ${esc(x.name)} ${esc(x.title)} ${x.delegated ? '<span class="tag">tanda tangan gambar atas delegasi (otomatis)</span>' : x.ok ? '<span class="tag ok">tanda tangan digital valid</span>' : '<span class="tag er">tanda tangan tidak valid</span>'}</div>`).join('')}${tick(r.soHashOk, 'Ringkasan penandatangan utuh (hash cocok)')}` : ''}${e.auto ? '<p class="mu">Diterbitkan otomatis tanpa pengecekan ulang admin.</p>' : ''}</div>`;
}
export function verifyV(code) {
  if (code && (!RES || RES.code !== code)) { RES = { loading: true, code }; A.vCode(code); }
  return `<div class="card"><h2>🔎 Verifikasi dokumen</h2><p class="mu">Cara 1: masukkan kode verifikasi (tercetak di surat / QR). Cara 2: unggah PDF; hash SHA-256 dihitung di browser Anda dan <b>file tidak diunggah ke mana pun</b>.</p>
  <div class="row"><input id="vc" placeholder="Kode verifikasi" value="${esc(code || '')}" style="flex:1;margin:0"><button class="btn" onclick="A.vCode()">Periksa</button></div>
  <label class="btn g" style="display:inline-block;margin-top:10px">📄 Unggah PDF untuk dicocokkan<input type="file" accept="application/pdf" hidden onchange="A.vFile(this)"></label></div>${result(RES)}`;
}
Object.assign(A, {
  async vCode(c) {
    const code = String(c || $('#vc').value).trim(); if (!code) return;
    RES = { loading: true, code }; if (!c) hook.render();
    const r = await run(() => F.verifyCode(code)); RES = { ...(r || { found: false }), code }; hook.render();
  },
  async vFile(inp) {
    const f = inp.files[0]; if (!f) return; RES = { loading: true, code: '' }; hook.render();
    const h = await sha256(new Uint8Array(await f.arrayBuffer())), r = await run(() => F.verifyHash(h)); RES = { ...(r || { found: false, hash: h }), code: '' }; hook.render();
  },
});
