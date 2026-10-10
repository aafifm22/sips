# Model keamanan & batasan jujur

**Yang dijamin secara kriptografis**: PDF yang diubah sebesar satu byte tidak cocok dengan hash di rantai; setiap entri bertanda tangan ECDSA P-256 dari kunci perangkat penerbit; entri berantai (hash sebelumnya). Siapa pun dapat memverifikasi tanpa login, termasuk offline.

**Yang BUKAN**:
- Ini rantai hash append-only di Firestore, **bukan blockchain terdesentralisasi**. Pemilik project Firebase (lewat Console/Admin SDK) secara teknis dapat mengubah/menghapus dokumen. Mitigasi: simpan **hash kepala** & **bukti rantai** secara berkala di tempat independen (arsip kampus, penanda waktu publik seperti OpenTimestamps, atau blockchain publik) — verifikator offline akan mendeteksi perubahan.
- Aturan Firestore memaksa siapa boleh menulis dan keterhubungan rantai (prevHash = kepala), tetapi **tidak dapat menghitung SHA-256 atau memverifikasi tanda tangan**; validitas kriptografis diperiksa verifikator (aplikasi/offline).
- Tanda tangan digital ini bukan tanda tangan elektronik tersertifikasi (PSrE/TTE) menurut UU ITE; pakai bila institusi menerima bukti internal ini.
- Kunci disimpan di IndexedDB peramban (tidak dapat diekspor, tetapi dapat digunakan oleh skrip pada halaman yang sama bila situs terkena XSS). Gunakan perangkat pribadi yang terkunci.
- Tamu: ID permintaan = kode + hash(email); siapa pun yang tahu kode **dan** email dapat melihat/membatalkan. Tidak ada pembatasan laju sisi server di Spark (gunakan App Check).
- Data pribadi ada di `requests` (hanya pemilik/admin/pejabat terkait). Rantai publik tidak memuat data pemohon.
- Dibuat tanpa dapat diuji terhadap project Firebase nyata; uji `firestore.rules` di emulator dan lakukan uji alur lengkap.

## Penerbitan otomatis & delegasi (v2.2)
- Di Spark tidak ada server; "terbit otomatis" dijalankan oleh sesi admin yang terbuka. Surat tercatat dengan kunci perangkat admin tersebut dan ditandai "diterbitkan otomatis" (juga di rantai). Jika tidak ada penerbit aktif, permintaan menunggu.
- Tanda tangan **delegasi** hanyalah gambar yang dibubuhkan atas izin pejabat (aktivasi dapat dicabut). Ia **bukan** tanda tangan kriptografis pejabat; hanya tanda tangan manual yang memakai kunci pejabat.
- Tiap tanda tangan manual mengikat hash isi surat; bila isi diubah setelahnya, penerbitan ditolak dan persetujuan harus diulang. Aturan Firestore memastikan hanya pejabat yang ditunjuk menambah tanda tangannya; **urutan berjenjang dan kelengkapan checklist ditegakkan oleh aplikasi (klien), bukan oleh aturan Firestore**.
- Revisi surat untuk layanan dengan lebih dari satu penandatangan manual tidak didukung (ajukan permintaan baru).
