// Pembuat PDF di browser (pdf-lib via CDN). Deterministik: masukan sama -> byte sama -> hash SHA-256 sama.
const P = () => window.PDFLib;
const safe = (s) => String(s ?? '').replace(/\r/g, '').replace(/[^\n\x20-\x7E\xA0-\xFF]/g, '?');
function wrap(text, font, size, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    let line = '';
    for (const w of para.split(/\s+/)) { const t = line ? line + ' ' + w : w; if (font.widthOfTextAtSize(t, size) > maxW && line) { out.push(line); line = w; } else line = t; }
    out.push(line);
  }
  return out;
}
/** QR digambar sebagai persegi vektor (bukan gambar PNG) agar PDF deterministik di semua browser. */
function drawQr(pg, x, y, size, text) {
  const { rgb } = P(), m = window.QRMatrix(text), n = m.length, u = size / (n + 2);
  pg.drawRectangle({ x, y, width: size, height: size, color: rgb(1, 1, 1) });
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!m[r][c]) continue; let e = c; while (e + 1 < n && m[r][e + 1]) e++;
    pg.drawRectangle({ x: x + (c + 1) * u, y: y + size - (r + 2) * u, width: (e - c + 1) * u, height: u, color: rgb(0, 0, 0) }); c = e;
  }
}
/** QR sebagai SVG inline (untuk salinan HTML). */
export function qrSvg(text, px = 80) {
  const m = window.QRMatrix(text), n = m.length; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { if (!m[r][c]) continue; let e = c; while (e + 1 < n && m[r][e + 1]) e++; d += `M${c + 1} ${r + 1}h${e - c + 1}v1h-${e - c + 1}z`; c = e; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${n + 2} ${n + 2}" shape-rendering="crispEdges"><rect width="${n + 2}" height="${n + 2}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
/** rec = catatan surat beku (isi, data, penandatangan, nomor, tanggal, kop). tpl = {bytes, mode, map} | null. */
export async function buildPdf({ rec, tpl, sigPng, sigMap, stampPng, stampMap, logoPng, verifyUrl }) {
  const { PDFDocument, StandardFonts } = P();
  const keys = { ...rec.data, nama: rec.data.nama || rec.reqName, _nomor: rec.no, _tanggal: rec.date, _isi: rec.content, _ttd_nama: rec.signerName || '', _ttd_jabatan: rec.signerTitle || '' };
  const when = new Date(rec.at);
  // penandatangan: daftar baru (rec.signers) atau satu penandatangan lama
  const signers = rec.signers && rec.signers.length ? rec.signers.map((s) => ({ ...s, png: (sigMap || {})[s.key] || null })) : (rec.signerName || rec.signerTitle ? [{ key: '_', name: rec.signerName, title: rec.signerTitle, png: sigPng }] : []);
  const sOf = (k) => (k ? signers.find((s) => s.key === k) : signers[0]);
  let pdf;
  if (tpl && tpl.bytes) {
    pdf = await PDFDocument.load(tpl.bytes, { updateMetadata: false });
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    if (tpl.mode === 'acroform') {
      const form = pdf.getForm();
      for (const [k, v] of Object.entries(keys)) { if (k[0] === '_' && !['_nomor', '_tanggal', '_isi', '_ttd_nama', '_ttd_jabatan'].includes(k)) continue; try { form.getTextField(k).setText(safe(v)); } catch (e) { /* tidak ada */ } }
      try { form.flatten(); } catch (e) { /* abaikan */ }
    }
    const pages = pdf.getPages();
    let stampImg = null;
    if (stampPng) { try { stampImg = await pdf.embedPng(stampPng); } catch (e) { /* abaikan */ } }
    // Cap per penandatangan: stampMap {kunciPenandatangan: bytes}.
    const stampImgs = {};
    for (const [k, b] of Object.entries(stampMap || {})) { try { stampImgs[k] = await pdf.embedPng(b); } catch (e) { /* abaikan */ } }
    const hasMap = Object.keys(stampImgs).length > 0;
    const firstMap = () => stampImgs[Object.keys(stampImgs)[0]] || null;
    const drawStampAt = (img, pg, x, y, w, h) => { if (img) { try { pg.drawImage(img, { x, y, width: w || 95, height: h || 95 }); } catch (e) { /* abaikan */ } } };
    for (const [k, p] of Object.entries(tpl.map || {})) {
      const pg = pages[p.page || 0]; if (!pg) continue;
      if (k === '_cap' || k.startsWith('_cap:')) {
        const key = k.startsWith('_cap:') ? k.slice(5) : null;
        drawStampAt(key ? stampImgs[key] || null : stampImg || firstMap(), pg, p.x, p.y, p.w || 95, p.h || 95);
        continue;
      }
      if (k === '_ttd' || k.startsWith('_ttd:')) { const s = sOf(k.split(':')[1]); if (s && s.png) pg.drawImage(await pdf.embedPng(s.png), { x: p.x, y: p.y, width: p.w || 140, height: p.h || 60 }); continue; }
      if (k.startsWith('_ttd_nama:') || k.startsWith('_ttd_jabatan:')) { const s = sOf(k.split(':')[1]), v = s && (k.startsWith('_ttd_nama') ? s.name : s.title); if (v) pg.drawText(safe(v), { x: p.x, y: p.y, size: p.size || 11, font }); continue; }
      if (k === '_qr') { drawQr(pg, p.x, p.y, p.w || 70, verifyUrl); continue; }
      if (k === '_isi') { const size = p.size || 11; wrap(safe(keys._isi), font, size, p.w || 450).forEach((l, i) => pg.drawText(l, { x: p.x, y: p.y - i * size * 1.35, size, font })); continue; }
      const v = keys[k]; if (v == null || v === '') continue;
      pg.drawText(safe(v), { x: p.x, y: p.y, size: p.size || 11, font });
    }
    // Cap/stempel tanpa titik _cap: tiap penandatangan menimpa TTD-nya masing-masing;
    // surat lama (satu cap) menimpa TTD pertama seperti sebelumnya.
    const hasCapDot = Object.keys(tpl.map).some((k) => k === '_cap' || k.startsWith('_cap:'));
    if (!hasCapDot) {
      if (hasMap) {
        for (const [k, p] of Object.entries(tpl.map)) {
          if (k !== '_ttd' && !k.startsWith('_ttd:')) continue;
          const key = k.includes(':') ? k.split(':')[1] : '_', img = stampImgs[key];
          if (!img) continue;
          const pg = pages[p.page || 0]; if (pg) drawStampAt(img, pg, (p.x || 0) - 18, (p.y || 0) - 28, 100, 100);
        }
      } else if (stampImg) {
        const t = Object.entries(tpl.map).find(([k]) => k === '_ttd' || k.startsWith('_ttd:'));
        if (t) { const p = t[1], pg = pages[p.page || 0]; if (pg) drawStampAt(stampImg, pg, (p.x || 0) - 18, (p.y || 0) - 28, 100, 100); }
      }
    }
  } else {
    pdf = await PDFDocument.create();
    const W = 595.28, H = 841.89, M = 70; let pg = pdf.addPage([W, H]);
    const tb = await pdf.embedFont(StandardFonts.TimesRomanBold), tr = await pdf.embedFont(StandardFonts.TimesRoman); let y = H - 50;
    // Logo institusi di kiri kop (bila ada): sejajar tengah blok nama + alamat.
    // Gambar diskalakan dengan aspect ratio agar tidak potong/cukup.
    if (logoPng) { try { const img = await pdf.embedPng(logoPng); const iw = img.width, ih = img.height; const k = Math.min(48/iw, 48/ih); pg.drawImage(img, { x: M - 22, y: H - 68, width: iw * k, height: ih * k }); } catch (e) { /* abaikan */ } }
    let stampImg2 = null;
    if (stampPng) { try { stampImg2 = await pdf.embedPng(stampPng); } catch (e) { /* abaikan */ } }
    const stampImgs2 = {};
    for (const [k, b] of Object.entries(stampMap || {})) { try { stampImgs2[k] = await pdf.embedPng(b); } catch (e) { /* abaikan */ } }
    const hasMap2 = Object.keys(stampImgs2).length > 0;
    const ctr = (t, f, s) => pg.drawText(t, { x: (W - f.widthOfTextAtSize(t, s)) / 2, y, size: s, font: f });
    ctr(safe(rec.instName || '').toUpperCase(), tb, 15); y -= 16;
    if (rec.address) { ctr(safe(rec.address), tr, 9); y -= 8; }
    pg.drawLine({ start: { x: M - 20, y }, end: { x: W - M + 20, y }, thickness: 2 }); y -= 3;
    pg.drawLine({ start: { x: M - 20, y }, end: { x: W - M + 20, y }, thickness: 0.6 }); y -= 34;
    const title = safe(rec.serviceName).toUpperCase(), tw = tb.widthOfTextAtSize(title, 13);
    ctr(title, tb, 13); pg.drawLine({ start: { x: (W - tw) / 2, y: y - 2 }, end: { x: (W + tw) / 2, y: y - 2 }, thickness: 0.8 }); y -= 16;
    ctr('Nomor: ' + safe(rec.no), tr, 11); y -= 30;
    for (const l of wrap(safe(rec.content), tr, 12, W - 2 * M)) { if (y < 190) { pg = pdf.addPage([W, H]); y = H - 70; } pg.drawText(l, { x: M, y, size: 12, font: tr }); y -= 17; }
    if (y < 220) { pg = pdf.addPage([W, H]); y = H - 70; }
    y -= 20; const sx = W - M - 190;
    pg.drawText(safe(`${rec.city || ''}, ${rec.date}`), { x: sx, y, size: 12, font: tr }); y -= 16;
    if (signers.length <= 1) {
      const s = signers[0] || {};
      if (s.title) pg.drawText(safe(s.title), { x: sx, y, size: 12, font: tb });
      y -= 70; if (s.png) pg.drawImage(await pdf.embedPng(s.png), { x: sx, y, width: 130, height: 60 });
      const simg = stampImgs2[s.key || '_'] || stampImg2;
      if (simg) { try { pg.drawImage(simg, { x: sx - 28, y: y - 22, width: 100, height: 100 }); } catch (e) { /* abaikan */ } }
      y -= 14;
      if (s.name) { const n = safe(s.name); pg.drawText(n, { x: sx, y, size: 12, font: tb }); pg.drawLine({ start: { x: sx, y: y - 2 }, end: { x: sx + tb.widthOfTextAtSize(n, 12), y: y - 2 }, thickness: 0.7 }); }
    } else {
      const colW = (W - 2 * M) / 2; y -= 4;
      for (let i = 0; i < signers.length; i += 2) {
        if (y < 200) { pg = pdf.addPage([W, H]); y = H - 90; }
        for (let c = 0; c < 2 && i + c < signers.length; c++) {
          const s = signers[i + c], x = M + c * colW; let yy = y;
          if (s.title) pg.drawText(safe(s.title), { x, y: yy, size: 11, font: tb });
          yy -= 66; if (s.png) pg.drawImage(await pdf.embedPng(s.png), { x, y: yy, width: 120, height: 56 });
          const simg = stampImgs2[s.key] || (!hasMap2 && c === 0 ? stampImg2 : null);
          if (simg) { try { pg.drawImage(simg, { x: x - 22, y: yy - 20, width: 95, height: 95 }); } catch (e) { /* abaikan */ } }
          yy -= 14; if (s.name) { const n = safe(s.name); pg.drawText(n, { x, y: yy, size: 11, font: tb }); pg.drawLine({ start: { x, y: yy - 2 }, end: { x: x + tb.widthOfTextAtSize(n, 11), y: yy - 2 }, thickness: 0.7 }); }
        }
        y -= 100;
      }
    }
    drawQr(pg, M - 20, 45, 62, verifyUrl);
    pg.drawText('Dokumen ditandatangani digital. Verifikasi: pindai QR atau buka', { x: M + 50, y: 85, size: 7.5, font: tr });
    pg.drawText(safe(verifyUrl), { x: M + 50, y: 75, size: 7.5, font: tr });
  }
  pdf.setTitle(safe(rec.serviceName)); pdf.setProducer('Layanan Surat'); pdf.setCreator('Layanan Surat'); pdf.setAuthor(safe(rec.instName || ''));
  pdf.setCreationDate(when); pdf.setModificationDate(when);
  return pdf.save({ useObjectStreams: false });
}
