# Ukuran data, penyimpanan ringkas, Parquet/HTML

## Apa yang disimpan per surat (mode Ringkas, bawaan)
| Dokumen | Isi | Perkiraan |
|---|---|---|
| `requests/{id}` | data permintaan + riwayat tahap | 2-3 KB |
| `requests/{id}/letters/{v}` | catatan surat beku (isi, data, penandatangan, versi template) | 1,5-3 KB |
| `ledger/{n}` | entri rantai (hash, tanda tangan) | ±0,9 KB |
| `hashes`, `codes`, `queuePub` | indeks verifikasi/antrean | <0,5 KB |
PDF **tidak disimpan**: dibuat ulang secara deterministik dari catatan beku + template + gambar tanda tangan, lalu hash-nya dicocokkan dengan rantai (uji: dua kali pembuatan menghasilkan byte identik). Bila tidak cocok (mis. pustaka PDF diganti), pengunduhan memberi peringatan.

Perkiraan: **±8-15 KB per surat** termasuk indeks Firestore → kapasitas 1 GiB setara **±70-120 ribu surat** (angka estimasi, belum diukur di produksi). Tulis per penerbitan ±9 dokumen → batas 20.000 tulis/hari ≈ 2.000 penerbitan/hari.

Satu kali per template: ukuran PDF ×1,33 (base64) di Firestore, dipecah otomatis; maks ±2,4 MB per template. Setiap versi menambah sebesar itu. Template dan versinya tidak dapat diubah/dihapus (aturan Firestore) agar surat lama selalu bisa dibuat ulang.

## Mode penyimpanan (Pengaturan > Penyimpanan salinan surat)
- **Ringkas** (bawaan): data + hash; PDF/HTML dibuat ulang saat dibuka.
- **Ringkas + HTML**: menyimpan salinan HTML mandiri (gzip, maks 150 KB) ±3-10 KB per surat; terbaca walau pustaka PDF berganti.
- **Arsip**: HTML + PDF terkompresi (lihat di bawah).

### Mode Arsip
Menyimpan PDF terkompresi (gzip) di Firestore. Layak hanya untuk surat **tanpa template** (±2-4 KB). Untuk surat bertemplate, PDF memuat seluruh template (ratusan KB) sehingga boros; gunakan mode Ringkas.

## Mengapa bukan Parquet/HTML?
- **Parquet** adalah format kolom untuk analitik tabel besar. Ia tidak cocok untuk dokumen surat itu sendiri. Berguna bila Anda ingin menganalisis riwayat permintaan (jutaan baris) di Python/DuckDB. Belum disertakan; bila perlu, ubah cadangan JSON:
```python
import json, pandas as pd   # contoh, belum diuji
j = json.load(open('cadangan.json'))
pd.json_normalize([d['data'] for d in j['data']['requests']]).to_parquet('requests.parquet')
```
- **HTML**: surat HTML kecil, tetapi tidak setara PDF untuk hasil cetak dan tidak mengikat hash ke tampilan. Surat bertemplate PDF tetap rujukan; mode Ringkas sudah sekecil data teksnya.

## Menghemat kuota baca (50.000/hari)
Admin memuat semua permintaan terbuka + 150 riwayat terbaru; tombol "Muat riwayat lebih lama" menambah. Hindari me-refresh halaman berulang-ulang. Klien hanya membaca permintaannya sendiri. Persistensi cache browser dapat ditambahkan bila kuota mulai ketat.

## Apakah cukup di Firestore Spark tanpa Google Drive?
Untuk satu kampus, ya. Dengan ±8-15 KB per surat, 20-50 surat/hari menghasilkan 15-20 ribu surat/tahun ≈ 0,2-0,3 GB/tahun, jadi ±3-5 tahun sebelum 1 GiB penuh (estimasi). Pantau di Firebase Console > Firestore > Usage. Tanda perlu bertindak: data >70% kuota, kuota baca/tulis harian sering habis, atau >100 surat/hari. Pilihan saat itu: (1) ekspor lalu arsipkan surat lama ke Drive/ZIP, (2) naik ke Blaze (tetap murah untuk skala ini) tanpa mengubah struktur data.

**Drive sebagai penyimpanan utama tidak disarankan**: token akses hanya ±1 jam dan butuh admin online, berkas milik satu akun (risiko saat admin berganti), klien/tamu tidak dapat membaca Drive admin (unduhan dan verifikasi bergantung pada admin), dan izin OAuth perlu dikelola. Drive paling tepat untuk **cadangan/arsip** yang dikendalikan admin.

## Jika PDF tidak disimpan, bagaimana membukanya lagi?
PDF tidak hilang: dibuat ulang dari catatan beku (isi, data, nomor, penandatangan, gambar tanda tangan, versi template) dan hash-nya dicocokkan dengan rantai. Admin/pemohon membukanya lagi lewat **Unduh** atau **Lihat HTML**. Syaratnya data pendukung tidak hilang: template & tanda tangan tidak dapat dihapus oleh aturan Firestore, dan **Ekspor massal** ke Drive/ZIP menyimpan PDF asli sebagai salinan independen (disarankan rutin).
