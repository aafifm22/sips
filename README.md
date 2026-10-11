# Layanan Surat (Firebase Spark)

Aplikasi administrasi pelayanan surat perguruan tinggi yang berjalan di **Firebase Spark (gratis)**: Hosting + Auth + Firestore, tanpa Cloud Functions/Storage.

```
public/        aplikasi web (ES modules, tanpa build)  · verifikasi-offline.html (verifikator mandiri)
firestore.rules, firestore.indexes.json, firebase.json
apps-script/   relay email gratis (opsional)
scripts/       backup.js / restore.js (Admin SDK) · smoke.mjs (uji asap)
docs/          DEPLOY-SPARK.md · PANDUAN.md · STORAGE.md · DRIVE.md · KEAMANAN.md · FRAMEWORK.md
```
Mulai dari **docs/DEPLOY-SPARK.md**. Baca **docs/KEAMANAN.md** untuk batasan.
Konvensi kode mengikuti **docs/FRAMEWORK.md** (adopsi App Feature Framework:
kit UX, env, dan testing).

Uji cepat sebelum deploy: `node scripts/smoke.mjs` (cek sintaks, JSON, dokumen, aturan).

Override konfigurasi Firebase lokal: salin `public/env.example.js` menjadi
`public/env.local.js` (gitignored, jangan commit) lalu sesuaikan — berguna saat
pengembangan menunjuk project lain.

Fitur: Tamu, Pengguna, Admin, Admin Super + pejabat penyetuju · antrean & prioritas · durasi per tahap · konfirmasi/pembatalan berbatas aturan · template PDF identik (AcroForm/koordinat, versi) · persetujuan & tanda tangan digital (ECDSA) · rantai hash SHA-256 + verifikasi (kode/QR/unggah PDF/offline) · penyimpanan ringkas + salinan HTML · ekspor massal ZIP/Google Drive · Word→PDF via Drive · dashboard terfilter + CSV · feedback · audit · tema warna-warni.

**Antarmuka**: mobile-first (bar bawah di ponsel), alur berlangkah untuk pengajuan dan penerbitan surat.

**Status pengujian**: sintaks semua modul, pembuat PDF (deterministik), hash/rantai/tanda tangan, serta tampilan & alur penerbitan→unduh→verifikasi diuji di browser dengan Firebase tiruan (data contoh). **Aturan Firestore dan alur end-to-end belum diuji pada project Firebase nyata.**
