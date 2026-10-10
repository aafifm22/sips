# Google Drive: cara kerja, pemasangan, batasan

## Cara kerja
Admin menekan **Hubungkan Google Drive**. Aplikasi meminta izin OAuth lewat Firebase Auth dengan scope `drive.file` (hanya berkas/folder yang dibuat aplikasi ini; aplikasi tidak melihat isi Drive lainnya). Token akses disimpan hanya di memori halaman (±1 jam). Seluruh unggahan dilakukan dari browser admin ke Drive milik admin tersebut; tidak ada server perantara.

## Pemasangan
1. Pastikan Google sign-in aktif di Firebase Authentication.
2. Google Cloud Console > project yang sama > **OAuth consent screen** (Google Auth platform): tambahkan scope `.../auth/drive.file`. Status publikasi **In production** agar token tidak kedaluwarsa 7 hari (mode Testing). Scope `drive.file` umumnya tidak memerlukan verifikasi sensitif, tetapi periksa kebijakan Google terbaru di Console.
3. Google Cloud Console > **APIs & Services > Library**: aktifkan **Google Drive API** untuk project tersebut.
4. Domain hosting sudah otomatis terdaftar di Authorized domains Firebase.

## Fitur yang memakai Drive
- Ekspor massal PDF/HTML + indeks + bukti rantai (menu Ekspor & Cadangan).
- Cadangan data JSON.
- Konversi Word/ODT -> PDF untuk template (berkas sementara dibuat lalu dihapus). Hasil konversi oleh Google; periksa tampilannya karena Word yang kompleks bisa bergeser sedikit. Untuk fidelitas penuh, ekspor PDF langsung dari Word.

## Batasan
- Sesi ±1 jam: ekspor panjang dapat berhenti; hubungkan ulang dan jalankan lagi (mode "baru" melanjutkan).
- Folder berada di Drive akun admin yang menghubungkan; bagikan folder ke admin lain secara manual bila perlu.
- Konversi HTML dari Word tidak dipakai sebagai template (keabsahan terikat pada byte PDF); HTML hanya sebagai salinan baca.
- Kuota Drive API dan penyimpanan Drive mengikuti akun admin.
