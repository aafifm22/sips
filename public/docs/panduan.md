# Panduan Penggunaan Aplikasi Layanan Surat

## 0. Mulai dari mana?
- **Pemohon (mahasiswa/dosen/tamu)**: **Beranda** → tombol **＋ Ajukan surat baru** → pilih jenis surat → isi data → **Kirim permintaan** → catat **kode** → pantau di **Permintaan** → **⬇ Unduh surat** saat selesai.
- **Admin**: tab **Kerjakan** → pilih kartu di "Perlu diproses" → **▶ Mulai proses** → **Isi surat** → (**Tanda tangan**) → **Terbitkan**. Hanya 4 langkah, tombol utama selalu di bagian bawah layar.
- **Pejabat**: tab **Persetujuan** → **Tinjau** → **Setujui** (atau **Tolak** dengan alasan).
- Menu **Lainnya (☰)** berisi fitur yang jarang dipakai: dashboard, pengguna, pengaturan, ekspor, verifikasi, panduan. Tombol 🔔 di kanan atas membuka notifikasi; tombol bulat berinisial membuka menu akun.
- Di ponsel, menu utama ada di bar bawah; di komputer berupa tab di atas.

## 1. Mengenal peran
- **Tamu**: tanpa login. Mengajukan surat (nama, kontak, email, data sesuai jenis) dan melacak dengan **kode + email**. Simpan keduanya.
- **Pengguna terdaftar** (status: Mahasiswa, Dosen, Tendik, Ketua STIKES, Waket 1, Waket 2): login Google/email. Melihat semua permintaannya, posisi antrean, durasi tiap tahap, dan mengunduh surat.
- **Pejabat**: pengguna terdaftar (mis. Ketua/Waket) yang diberi hak oleh Admin Super. Login sendiri untuk **menyetujui & menandatangani** surat pada layanan yang menunjuknya.
- **Admin**: memproses antrean, menyiapkan & menerbitkan surat, mengelola layanan/template, memverifikasi pengguna.
- **Admin Super**: semua kemampuan Admin + role, hak pejabat, pengaturan aplikasi, audit, cadangan, inisialisasi rantai.

## 2. Mengajukan dan melacak
- **Ajukan Surat** > pilih jenis > isi kolom bertanda *. Anda mendapat **kode lacak** (mis. `LY-AB12C34`).
- **Permintaan Saya**: alur Diajukan → Diproses → (Menunggu Persetujuan) → Selesai/Dibatalkan, posisi antrean "ke-N dari M", dan durasi.
- **Detail** menampilkan **durasi tiap tahap**. Timer berjalan sampai **Selesai** atau **Dibatalkan**, lalu berhenti.
- Waktu **Menunggu Konfirmasi** (menunggu jawaban Anda) dicatat terpisah dan tidak dihitung sebagai kecepatan layanan.
- Perkiraan waktu memakai **rata-rata real** jenis surat tersebut.

## 3. Konfirmasi dan pembatalan
- **Pemohon** dapat membatalkan kapan saja sebelum surat selesai.
- **Admin tidak dapat membatalkan langsung.** Gunakan **Minta konfirmasi pemohon** (dengan pertanyaan). Pemohon punya batas waktu (bawaan 3 hari) untuk memilih **Masih butuh, lanjutkan** atau **Tidak perlu, batalkan**.
- Hanya jika batas waktu lewat **tanpa jawaban**, tombol **Batalkan (pemohon tidak menjawab)** aktif. Aturan ini dipaksa oleh aturan keamanan Firestore.

## 4. Menerbitkan surat (Admin)
1. **Proses** pada permintaan > **Mulai proses**.
2. Periksa/ubah isi surat (layanan bermode AI: **Draf dengan AI**; butuh API key di Pengaturan).
3. **Pratinjau PDF** untuk memeriksa tampilan.
4. Layanan **tanpa persetujuan**: isi nama/jabatan & gambar tanda tangan (gambar langsung, unggah, atau pakai tersimpan) lalu **Terbitkan & catat ke rantai**.
5. Layanan **dengan persetujuan pejabat**: **Kirim ke pejabat untuk disetujui**. Status menjadi *Menunggu Persetujuan*; pejabat menyetujui atau meminta revisi (kembali ke Diproses).
6. Penerbitan memberi **nomor surat** (aturan di bawah), **QR verifikasi**, hash SHA-256 PDF, dan **tanda tangan digital** dari kunci perangkat penerbit. Revisi menghasilkan versi baru dan entri rantai baru; versi lama ditandai "digantikan".

## 4a. Aturan nomor surat (otomatis / manual)
Atur di **Pengaturan (Admin Super) > Mode nomor surat**:
- **Otomatis** (bawaan): nomor dibuat saat terbit dari format `{n}/{kode}/{bln}/{thn}`. `{n}` = urutan 001, 002… **per jenis layanan per tahun** (counter `counters/{layanan}-{tahun}`), `{kode}` = kode layanan (mis. KET-AKT), `{bln}` = bulan romawi, `{thn}` = tahun. Contoh: `001/KET-AKT/STIKES-YKY/I/2026`. Counter hanya maju bila nomor otomatis dipakai.
- **Manual**: admin **wajib mengetik** nomor di langkah Terbitkan (mis. mengikuti nomor agenda TU). Counter tidak dipakai. Penerbit otomatis nonaktif dalam mode ini.
- **Bebas**: nomor otomatis, tetapi kolom nomor dapat diisi untuk **menimpa** (kosongkan = otomatis).
- Nomor tersimpan permanen di surat + rantai hash; revisi memakai nomor yang sama (versi baru).

## 4b. Cap / stempel (pilih salah satu atau tanpa cap)
- Kelola daftar cap di **Pengaturan > Cap / stempel**: tambah beberapa cap (mis. Cap Institusi, Cap Prodi, Cap Unit; pakai **PNG transparan** agar tidak menutup tanda tangan dengan kotak putih), tandai satu sebagai bawaan. Cap lama dapat dipindahkan ke daftar dengan satu tombol.
- Saat menerbitkan (admin maupun pejabat), pilih **salah satu cap** atau **Tanpa cap** pada dropdown. Cap digambar **menimpa (overlap)** gambar tanda tangan.
- Untuk template PDF: tandai titik **Cap / stempel** sekali di **Layanan > Atur penempatan**. Bila tidak ditandai, cap otomatis menimpa posisi TTD pertama.

## 4c. Kop surat (bisa banyak, pilih per surat)
- Kelola di **Pengaturan > Kop surat**: tiap kop berisi **gambar logo + teks nama & alamat** (mis. Kop Institusi, Kop Prodi, Kop Unit). Logo lama dapat dipindahkan menjadi Kop Institusi.
- Saat menerbitkan surat tata-letak standar, pilih salah satu kop pada dropdown (kop bawaan terpilih otomatis). Pilihan membeku di surat — surat lama tidak berubah bila daftar kop diubah. Template PDF memakai kop dari template (dropdown kop disembunyikan).

## 4b. Alur penerbitan dan checklist penandatangan (dinamis per layanan)
Di **Layanan > Alur penerbitan & penandatangan** (Admin):
- **Admin cek ulang lalu terbitkan** (bawaan) atau **Terbit otomatis (tanpa cek ulang admin)**. Otomatis memakai jeda menit, dapat dibatasi untuk pemohon terverifikasi, dan hanya untuk layanan bermode Otomatis/Template (surat AI tetap dicek admin). Admin dapat **Tahan terbit otomatis** pada satu permintaan selama jeda.
- **Checklist penandatangan**: tambah baris untuk tiap pihak yang harus menandatangani. Atur **wajib**, **urutan** (urutan sama = bersamaan; berbeda = berjenjang), dan **mode**:
  - **Manual**: pejabat login, meninjau, dan menandatangani digital. Penandatangan terakhir yang menerbitkan surat.
  - **Otomatis (delegasi)**: gambar tanda tangan pejabat dibubuhkan otomatis, hanya jika pejabat mengaktifkan delegasi di **🔐 Kunci TTD** (dapat dinonaktifkan). Surat dan rantai mencatat "atas delegasi".
- Checklist kosong = tanpa pejabat; surat memakai nama bawaan layanan dan diterbitkan admin.
- Pemohon dan admin melihat checklist (✅ sudah, ⬜ menunggu, 🖋 otomatis) pada setiap permintaan.
- **Penerbit otomatis**: di **Kerjakan (antrean)**, aktifkan "Penerbit otomatis" pada satu komputer kantor yang menyala dan login sebagai admin (kunci tanda tangan terdaftar). Spark tidak punya server, jadi tab/browser itu harus tetap terbuka. Tanpa penerbit aktif, permintaan menunggu di antrean seperti biasa.
- Template PDF: pada **Atur penempatan** tersedia kunci TTD/Nama/Jabatan **per penandatangan**.

## 5. Pejabat: menyetujui dan menandatangani
- Tab **✍ Persetujuan** memuat surat yang menunggu Anda. **Tinjau** > periksa isi/pratinjau > **Setujui & tanda tangani digital** atau **Tolak / minta revisi**.
- Pertama kali, aplikasi menawarkan membuat **kunci tanda tangan digital** di perangkat. Kunci pribadi tidak dapat diekspor. Ganti perangkat = daftarkan kunci baru (tab **🔐 Rantai & TTD**). Jika perangkat hilang, **cabut** kuncinya.
- Gambar tanda tangan dapat digambar langsung, diunggah, atau memakai yang tersimpan; nama & jabatan yang tercetak dapat diketik/diganti.

## 6. Verifikasi dokumen
- Menu **🔎 Verifikasi** (tanpa login): masukkan kode di surat/QR **atau unggah PDF**. Hash dihitung di browser Anda; file tidak diunggah.
- Hasil: nomor, layanan, penandatangan, waktu, dan pemeriksaan kriptografis (hash entri, tanda tangan digital, tautan rantai). PDF yang diubah satu byte pun tidak akan cocok.
- **Verifikasi offline**: buka `verifikasi-offline.html`, pilih file bukti rantai (Admin: **Ekspor bukti rantai**) dan PDF. Tidak memerlukan server.

## 7. Layanan dan template PDF (Admin)
- Menu **Layanan**: tambah/hapus layanan, batas hari, mode (Otomatis/Template/AI), siapa yang boleh mengajukan, kolom formulir, perlu TTD, **perlu persetujuan pejabat** (+ daftar pejabat), nama/jabatan bawaan.
- **Template PDF** (maks ±650 KB; kompres bila perlu): AcroForm (nama field = kunci isian) atau Koordinat (klik posisi di pratinjau). Tampilan hasil identik dengan PDF unggahan. **Riwayat versi** template dapat diaktifkan kembali; surat lama tidak berubah.
- **Reset semua layanan** (khusus Admin Super, di atas daftar layanan): menghapus **seluruh** layanan sekaligus (permintaan lama tetap tersimpan). Perlu konfirmasi + ketik `RESET`. Pakai bila ingin mulai dari nol.
- **Logo kop**: kelola di **Pengaturan > Kop surat (bisa banyak)** — tambah Kop Institusi/Prodi/Unit lalu pilih salah satu saat menerbitkan. Berkas **`public/logo.png.png`** tetap dipakai sebagai cadangan bila daftar kop kosong.

## 7b. Feedback wajib & unduhan CSV
- Setiap surat yang **Selesai** meminta feedback (Kerapihan/Kecepatan/Keramahan + komentar) lewat **pop-up**. Selama belum dinilai, pemohon **tidak dapat melihat detail maupun mengunduh** dokumen (PDF/HTML) — tombol berubah menjadi **"⭐ Isi nilai untuk buka dokumen"**, dan dokumen terbuka otomatis setelah Kirim. Admin/pejabat tidak dibatasi.
- Admin melihat semua feedback di menu **Feedback** beserta rata-rata ★, dan dapat **mengunduh semuanya sebagai CSV** (kode, layanan, pemohon, bintang, tiap aspek, komentar, waktu).

## 8. Dashboard, unduhan, cadangan
- Filter jenis surat & rentang tanggal; on progress, menunggu konfirmasi, selesai, dibatalkan, rata-rata kecepatan layanan/total, tepat waktu, rating. **Rincian/Ringkasan (CSV)** mengikuti filter. CSV feedback ada di menu **Feedback**.

## 8a. AI pembantu draf (Anthropic / OpenAI / Gemini / DeepSeek / OpenRouter)
- Tombol **✨ Draf dengan AI** (layanan bermode AI) memakai penyedia yang dipilih di **Pengaturan > AI** (bawaan dari Admin Super, dapat ditimpa per browser).
- **Cara mendapatkan key:**
  - **Anthropic (Claude):** `console.anthropic.com` → Settings → API Keys → Create Key. Model mis. `claude-sonnet-4-5`.
  - **OpenAI (GPT):** `platform.openai.com` → API keys → Create new secret key (butuh billing). Model mis. `gpt-4o-mini`.
  - **Google Gemini:** `aistudio.google.com` → Get API Key → Create API key (ada kuota gratis). Model mis. `gemini-2.0-flash`.
  - **DeepSeek:** `platform.deepseek.com` → API keys. **OpenRouter:** `openrouter.ai/keys`.
- Key hanya tersimpan di browser (localStorage) dan dikirim langsung ke penyedia AI; hapus bila memakai komputer bersama. Error 401/403 = key/kuota salah; 404 = nama model salah untuk provider itu.
- Admin: panel **perlu perhatian** (lewat SLA, konfirmasi kedaluwarsa, persetujuan tertunda) menggantikan pengingat terjadwal.
- **Cadangan** (Admin Super, Pengaturan): unduh JSON secara berkala. Pemulihan via `scripts/restore.js`.

## 8b. Ekspor & cadangan massal, Google Drive (Admin)
- Menu **📦 Ekspor & Cadangan**: pilih surat (baru sejak ekspor terakhir / rentang tanggal / semua), tujuan **Google Drive** atau **ZIP**, lalu **Mulai ekspor**. Tidak perlu mengunduh satu per satu.
- Hubungkan Drive dengan tombol **Hubungkan Google Drive** (izin hanya untuk berkas yang dibuat aplikasi ini). Hasil tersusun di *Layanan Surat - Arsip/Tahun/Bulan/Layanan* beserta `indeks.csv` dan `bukti-rantai-*.json`.
- Setiap PDF dicocokkan dengan hash rantai; yang tidak cocok ditandai "TIDAK" di indeks.
- **Cadangan data (JSON)** juga dapat disimpan ke Drive.
- **Surat lama dapat dibuka kembali kapan pun**: di jendela Proses > Riwayat versi surat pilih **Unduh** (PDF dibuat ulang & dicek hash) atau **HTML**.
- **Word → PDF**: di **Layanan**, tombol *Word → PDF (via Google Drive)* mengonversi .docx/.odt memakai Google, lalu menjadikannya template baru.

## 9. Tema dan kenyamanan
Tombol 🎨 di header: mode terang/gelap/otomatis, 9 warna aksen + warna kustom, dan **mode warna-warni**. Pilihan tersimpan per pengguna.

## 10. Tanya jawab
- **Lupa kode lacak?** Login jika Anda mengajukan sebagai pemohon; tamu perlu kode + email yang tersimpan.
- **Surat salah data?** Hubungi admin; admin menerbitkan revisi.
- **"Tindakan ditolak oleh aturan keamanan"?** Status berubah atau tindakan belum diizinkan (mis. batas konfirmasi belum lewat). Muat ulang.
