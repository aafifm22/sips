# Adopsi App Feature Framework

Dokumen ini memetakan bagian framework yang **diadopsi**, yang **sudah ada**,
dan yang **sengaja dilewati** beserta alasannya (paket Firebase Spark gratis,
tanpa build, tanpa Cloud Functions/Storage).

## Diadopsi (v2.4.1)

| Framework | Adopsi di SIPS |
|---|---|
| Tema terpusat (CSS variables) + toggle & persist | Sudah ada (`styles.css :root`, `theme.js`); ditambah sinkron `<meta name=theme-color>` dengan aksen |
| Helpers JS: `toast`, `loading`, `confirmDialog`, `validators`, `debounce`, `empty` | `core.js`: `toast()`, `loading()` (overlay + jeda anti-kedip), `confirmDlg()` (overlay sendiri agar tak menimpa modal), `empty()`, `vReq/vEmail/vPhone/vUrl/vMin`, `debounce()` |
| Error handling terpusat | `run()` kini menampilkan loading + toast galat (bukan `alert`) |
| Konfirmasi destruktif | `confirmDlg()` dipakai di: hapus layanan, reset layanan, seed, hapus cap/logo/pilihan, cabut kunci, klaim Admin Super |
| Validasi form | Cek kirim ganda di pengajuan (`S._submitting`), validasi email/HP tamu, validasi URL https di Pengaturan |
| Env / secrets | `firebase-config.js` membaca `window.__ENV`; `public/env.example.js` → salin ke `env.local.js` (gitignored); `.gitignore` mencakup service-account, cadangan, zip arsip, `exports/` |
| PWA-lite | `manifest.webmanifest`, `theme-color`, meta deskripsi |
| Struktur docs (README, CHANGELOG, panduan) | `README.md` diperluas, `public/changelog.json` berversi, `docs/FRAMEWORK.md` (ini) |
| Testing checklist | `scripts/smoke.mjs` (`node scripts/smoke.mjs`): cek sintaks, JSON, dokumen, aturan |
| Skeleton / empty state | Class `.skel`, helper `empty()` |

## Sudah ada sebelum framework (tetap dipakai)

Tema gelap/terang/otomatis + 9 aksen · `esc()` anti-XSS · `modal()` + tombol Escape ·
`fdate`/`fd` Indonesia · CSV + unduh berkas · antrean & SLA · audit log ·
cadangan JSON + ekspor ZIP/Drive + bukti rantai · aturan Firestore ketat
(`chg()` allow-list, state-machine, ID tamu tak-tertebak) · AI BYOK multi-provider.

## Sengaja dilewati

- **Next.js / Angular / Flutter / Java**: aplikasi ini vanilla ES modules tanpa
  build (buka langsung via Hosting). Pola komponen framework-nya tidak berlaku.
- **Cloud Functions ("lolos functions") & Storage**: tidak tersedia di paket
  Spark; logika ditegakkan via `firestore.rules` + Apps Script (email) + Drive.
- **Sistem ikon premium (Lucide/dll)**: tetap emoji — nol dependensi, konsisten
  dengan gaya mobile-first yang ada.
- **Service worker offline penuh**: Hosting memakai `Cache-Control: no-cache`
  agar PDF deterministik & verifikasi selalu segar; SW berisiko menyajikan
  dokumen basi. Manifest saja sudah cukup untuk "install".
- **`confirm()` bawaan yang tersisa** (`issue`, `apprGo`, `ensureKey`,
  pembatalan dari modal detail): disengaja — `confirmDlg()` memakai overlay
  sendiri dan hanya aman dipanggil saat modal `#md` tidak terbuka. Konfirmasi
  di dalam modal tetap memakai dialog bawaan agar tidak menimpa isi modal.
- **Rate-limit server & server timestamp**: butuh Functions; sebagai gantinya
  ada guard kirim-ganda sisi klien + aturan `near()` ±5 menit di rules.
- **Animasi angka dashboard (`animateValue`)**: opsional, belum diadopsi agar
  diff kecil; tersedia pola di framework bila dibutuhkan.
