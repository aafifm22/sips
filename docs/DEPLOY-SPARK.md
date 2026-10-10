# Deploy ke Firebase Spark (gratis)

## Yang tersedia di Spark
Hosting, Authentication (Google/email), Firestore. **Tidak tersedia**: Cloud Functions (butuh Blaze) dan Cloud Storage (sejak 3 Februari 2026 butuh Blaze). Karena itu paket ini **tidak memakai** keduanya. Periksa kuota terbaru di Firebase Console > Usage and billing.

Kuota harian Firestore (Spark) yang relevan: 50.000 baca, 20.000 tulis, 20.000 hapus, 1 GiB data.

## Langkah
1. https://console.firebase.google.com > Add project (tetap Spark).
2. **Authentication**: aktifkan Google dan Email/Password.
3. **Firestore**: Create database (production), lokasi `asia-southeast2`.
4. **Project settings > Web app**: salin config ke `public/firebase-config.js`; isi project ID di `.firebaserc`.
5. Pasang CLI & deploy:
```bash
npm i -g firebase-tools && firebase login
firebase deploy --only firestore,hosting
```
6. **Segera** buka aplikasi (pemilik pertama) > masuk > klik **Jadikan saya Admin Super** (hanya bisa sekali; pastikan dilakukan sebelum URL disebarkan). Alternatif: ubah `users/{uid}.role` menjadi `superadmin` di Firestore Console lalu buat dokumen `meta/super` {uid}.
7. Di aplikasi (ikuti kartu "Langkah awal"): **Pengaturan** > isi institusi, URL aplikasi (`https://PROJECT-ID.web.app/`) > **Inisialisasi rantai**; **Layanan** > Isi layanan awal; **Rantai & TTD** > buat kunci tanda tangan di perangkat Anda.
8. **Pengguna**: angkat Admin, verifikasi status, tandai **Pejabat** (Ketua/Waket), lalu pilih pejabat penyetuju di **Layanan**.

## Google Drive (opsional)
Lihat `docs/DRIVE.md` (aktifkan Drive API + scope `drive.file`).

## Email (opsional, gratis)
Tanpa Functions, email dikirim lewat Google Apps Script: lihat `apps-script/Code.gs` (cara pasang di komentar). Tempel URL `/exec` di Pengaturan. Hanya sesi admin yang memicu email (ke pemohon). Notifikasi dalam aplikasi selalu aktif. Tamu tanpa login tidak menerima email otomatis; mereka melacak dengan kode.

## Cadangan & pemulihan
- Aplikasi: Pengaturan > Cadangkan sekarang (JSON).
- Penuh/terjadwal: `node scripts/backup.js kunci.json out.json` (service account dari Console > Project settings > Service accounts). Bisa dijadwalkan lewat GitHub Actions (gratis).
- Pulihkan: `node scripts/restore.js kunci.json out.json`. Jangan membagikan file service account.

## Pengamanan yang disarankan
- Aktifkan **App Check** (reCAPTCHA) untuk Firestore agar pengajuan tamu tidak dibanjiri bot (Spark tidak punya pembatasan laju di sisi server).
- Batasi domain Google sign-in bila hanya untuk civitas; wajibkan verifikasi email.
- **Uji aturan** `firestore.rules` di Firebase Emulator sebelum dipakai (paket ini belum diuji pada project nyata).
- Pasang budget/notifikasi kuota; Spark akan menolak operasi bila kuota harian habis (tidak ada tagihan).

## Naik ke Blaze nanti
Data & aplikasi tetap sama. Dengan Blaze Anda dapat menambah Cloud Functions (email server-side, pembatasan laju, cadangan terjadwal) tanpa mengubah struktur data.
