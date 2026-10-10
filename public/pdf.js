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
export async function qrPng(url) {
  const u = await window.QRCode.toDataURL(url, { margin: 1, width: 260 });
  return Uint8Array.from(atob(u.split(',')[1]), (c) => c.charCodeAt(0));
}
/** rec = catatan surat beku (isi, data, penandatangan, nomor, tanggal, kop). tpl = {bytes, mode, map} | null. */
export async function buildPdf({ rec, tpl, sigPng, sigMap, verifyUrl }) {
  const { PDFDocument, StandardFonts } = P();
  const keys = { ...rec.data, nama: rec.data.nama || rec.reqName, _nomor: rec.no, _tanggal: rec.date, _isi: rec.content, _ttd_nama: rec.signerName || '', _ttd_jabatan: rec.signerTitle || '' };
  const qr = await qrPng(verifyUrl), when = new Date(rec.at);
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
    const pages = pdf.getPages(), qimg = await pdf.embedPng(qr);
    for (const [k, p] of Object.entries(tpl.map || {})) {
      const pg = pages[p.page || 0]; if (!pg) continue;
      if (k === '_ttd' || k.startsWith('_ttd:')) { const s = sOf(k.split(':')[1]); if (s && s.png) pg.drawImage(await pdf.embedPng(s.png), { x: p.x, y: p.y, width: p.w || 140, height: p.h || 60 }); continue; }
      if (k.startsWith('_ttd_nama:') || k.startsWith('_ttd_jabatan:')) { const s = sOf(k.split(':')[1]), v = s && (k.startsWith('_ttd_nama') ? s.name : s.title); if (v) pg.drawText(safe(v), { x: p.x, y: p.y, size: p.size || 11, font }); continue; }
      if (k === '_qr') { pg.drawImage(qimg, { x: p.x, y: p.y, width: p.w || 70, height: p.w || 70 }); continue; }
      if (k === '_isi') { const size = p.size || 11; wrap(safe(keys._isi), font, size, p.w || 450).forEach((l, i) => pg.drawText(l, { x: p.x, y: p.y - i * size * 1.35, size, font })); continue; }
      const v = keys[k]; if (v == null || v === '') continue;
      pg.drawText(safe(v), { x: p.x, y: p.y, size: p.size || 11, font });
    }
  } else {
    pdf = await PDFDocument.create();
    const W = 595.28, H = 841.89, M = 70; let pg = pdf.addPage([W, H]);
    const tb = await pdf.embedFont(StandardFonts.TimesRomanBold), tr = await pdf.embedFont(StandardFonts.TimesRoman); let y = H - 50;
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
          yy -= 14; if (s.name) { const n = safe(s.name); pg.drawText(n, { x, y: yy, size: 11, font: tb }); pg.drawLine({ start: { x, y: yy - 2 }, end: { x: x + tb.widthOfTextAtSize(n, 11), y: yy - 2 }, thickness: 0.7 }); }
        }
        y -= 100;
      }
    }
    pg.drawImage(await pdf.embedPng(qr), { x: M - 20, y: 45, width: 62, height: 62 });
    pg.drawText('Dokumen ditandatangani digital. Verifikasi: pindai QR atau buka', { x: M + 50, y: 85, size: 7.5, font: tr });
    pg.drawText(safe(verifyUrl), { x: M + 50, y: 75, size: 7.5, font: tr });
  }
  pdf.setTitle(safe(rec.serviceName)); pdf.setProducer('Layanan Surat'); pdf.setCreator('Layanan Surat'); pdf.setAuthor(safe(rec.instName || ''));
  pdf.setCreationDate(when); pdf.setModificationDate(when);
  return pdf.save({ useObjectStreams: false });
}
