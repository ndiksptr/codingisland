# Daftar Revisi

Tulis permintaan revisi di sini, lalu kirim ke Claude dengan pesan seperti:

> "Kerjakan revisi di REVISI.md yang berstatus Baru."

Claude akan membaca file ini, mengerjakan revisinya, lalu mengubah kolom **Status** dan mengisi **Catatan pengerjaan**.

## Cara mengisi

- Satu revisi = satu blok. Salin blok **Templat** di bawah, lalu beri nomor berurutan (R1, R2, R3, …).
- **Tahap/halaman:** sebut tahapnya atau alamat halamannya, misalnya `Tahap 5` atau `#/level/pantai-2`.
- **Nomor uji:** isi jika berasal dari [UJI-COBA.md](UJI-COBA.md), misalnya `U5.10`.
- **Prioritas:** `Tinggi` (rusak atau menghalangi), `Sedang` (mengganggu), `Rendah` (kosmetik atau ide).
- **Status:** `Baru` → `Dikerjakan` → `Selesai` (atau `Ditunda` / `Tidak jadi`).
- Screenshot boleh disimpan di folder `revisi/` lalu ditulis nama filenya.

---

## Templat (salin blok ini)

```
### R? — [judul singkat]
- Tahap/halaman :
- Nomor uji     :
- Prioritas     : Tinggi / Sedang / Rendah
- Status        : Baru
- Masalah       : (apa yang terjadi sekarang)
- Harapan       : (apa yang seharusnya terjadi)
- Langkah ulang : (opsional) 1. … 2. … 3. …
- Perangkat     : (opsional) Laptop Chrome / HP 375 px / …
- Screenshot    : (opsional) revisi/nama-file.png
- Catatan pengerjaan : (diisi Claude)
```

---

## Contoh (boleh dihapus)

### R0: Contoh: tombol Jalankan kurang besar di HP

- Tahap/halaman : Tahap 5, `#/level/pantai-1`
- Nomor uji : U5.20
- Prioritas : Rendah
- Status : Tidak jadi
- Masalah : Di HP 375 px tombol Jalankan sejajar dengan Ulang Posisi sehingga terlihat sempit.
- Harapan : Tombol Jalankan selebar layar di HP.
- Catatan pengerjaan : (ini hanya contoh)

---

## Revisi

<!-- Tulis revisi di bawah baris ini -->

### R1:

- Tahap/halaman : Tahap 3 , `ciDev.selesaikanLevel('pantai-4', 3)`
- Nomor uji : U3.9
- Prioritas : Tinggi
- Status : Selesai (mohon uji ulang)
- Masalah : Warning: Don’t paste code into the DevTools Console that you don’t understand or haven’t reviewed yourself. This could allow attackers to steal your identity or take control of your computer. Type "allow pasting" below and press Enter to allow pasting.
- Harapan : bisa jalan
- Catatan pengerjaan : Dari U3.19 sampai U3.13 saya belom mencoba karena U3.9 jg masih error. lalu untuk gambar bendera, batu tidak terlihat, apakah anda perlu saya buatkan image nya, sebutkan sekurangan gambarnya
- Catatan pengerjaan (Claude) :
  1. **Peringatan "allow pasting" bukan error aplikasi.** Itu fitur keamanan bawaan Chrome yang muncul saat kode *ditempel* ke Console. Supaya tidak perlu Console sama sekali, sekarang ada **Panel Dev** di layar:
     buka `http://localhost:8000/?dev=1#/peta` (Live Server: `http://127.0.0.1:5500/index.html?dev=1#/peta`), masuk sebagai siswa, lalu klik tombol oranye **Dev** di pojok kiri bawah.
     Isinya: *Selesaikan level*, *Tuntaskan pulau* (membuka pulau berikutnya), dan *Reset progres saya*. Langkah U3.9–U3.11 di UJI-COBA.md sudah diganti memakai panel ini.
     Jika tetap ingin memakai Console: ketik `allow pasting` lalu Enter sekali, atau ketik perintahnya langsung (jangan ditempel).
  2. **Bendera dan batu tidak terlihat: ini bug dan sudah diperbaiki.** Gambarnya ada (SVG), tetapi ukurannya hanya 3×3 piksel karena salah hitung jarak tepi (padding persen) di `css/app.css`. Sekarang ukurannya 62×62 piksel dan terlihat di panggung. Sudah dicek dengan screenshot.
  3. **Tidak perlu membuat gambar.** Daftar elemen yang digambar sendiri ada di catatan R3.
  4. Setelah memperbarui file, tekan **Ctrl + F5** agar browser tidak memakai CSS lama.

### R2:

- Tahap/halaman : Tahap 4, Semua nya
- Nomor uji : U4.1- U4.10
- Prioritas : Tinggi
- Status : Selesai (mohon uji ulang)
- Masalah : Saya masih bingung cara testing nya dari paham awal anda kurang jelas informasi nya
- Harapan : bisa saya tes
- Catatan pengerjaan (Claude) :
  1. Bagian **Tahap 4** di UJI-COBA.md ditulis ulang menjadi panduan langkah demi langkah:
     - alamat yang harus diketik, untuk Python maupun Live Server;
     - penjelasan isi halaman Uji Interpreter (kiri, kanan, bawah) dan cara membaca peta teks (`>`, `F`, `#`, `O`, `$`);
     - cara mencoba satu kode: pilih dunia → kosongkan kotak Kode → salin kode → Jalankan → baca kotak Hasil.
  2. Setiap butir uji (U4.1–U4.11, ditambah satu butir "menabrak batu") sekarang berisi nama dunia yang dipilih, kode lengkap yang tinggal disalin, dan pesan yang harus muncul. Semua pesan itu sudah dicocokkan dengan keluaran interpreter yang sebenarnya.
  3. Halaman uji juga bisa dibuka dari tombol **Dev** → **Uji Interpreter**, dan tidak perlu masuk akun.

### R3:

- Tahap/halaman : Tahap 5, Semua nya
- Nomor uji : U5.1- U4.22
- Prioritas : Tinggi
- Status : Selesai (mohon uji ulang)
- Masalah : Saya bingung semua item yang tidak saya berikan tidak terlihat, apakah bisa saya bantu carikan, sebuatkan saja ada item nya.
- Harapan : bisa saya tes
- Catatan pengerjaan (Claude) :
  1. Penyebabnya sama dengan R1: bendera dan rintangan sebenarnya digambar, tetapi berukuran 3×3 piksel. Sudah diperbaiki, jadi **gambar tambahan tidak diperlukan**.
  2. Daftar elemen yang tidak ada di folder `image/` dan digambar sendiri dengan SVG/CSS:

     | Elemen | Dipakai di | Cara digambar | Bisa dilihat sekarang? |
     |---|---|---|---|
     | Bendera finish | Panggung level, landing page | SVG (`ikonBendera` di `js/game/ikon.js`) | Ya, `#/level/pantai-1` dan `pantai-2` |
     | Batu | Rintangan Pulau Pantai | SVG | Ya, `#/level/pantai-1` dan `pantai-2` |
     | Karang | Rintangan Pulau Laut | SVG | Belum, soal Laut dibuat di tahap berikutnya |
     | Kaktus | Rintangan Pulau Gurun | SVG | Belum |
     | Bongkahan es | Rintangan Pulau Salju | SVG | Belum |
     | Jurang | Petak gelap bertepi di panggung | CSS (gradasi gelap) | Belum, level berjurang dibuat di tahap berikutnya |
     | Gembok | Kartu pulau dan level terkunci | SVG | Ya, `#/peta` |
     | Ikon bug | Lencana level debug | SVG | Ya, `#/peta/pantai` (level 3) |
     | Lingkaran level | Peta pulau | CSS | Ya, `#/peta/pantai` |
     | Panah arah robot | Di bawah kaki robot | CSS | Ya, panggung level |
     | Jalur putus-putus | Peta pulau | SVG | Ya, `#/peta/pantai` |

     Karang, kaktus, es, dan jurang bisa dilihat sementara di `?dev=1#/uji-interpreter` (dunia "Jurang"), tetapi di sana hanya berupa huruf. Gambar penuhnya muncul setelah soal pulau-pulau itu dibuat.
  3. **Jika ingin memakai gambar sendiri (opsional):** siapkan PNG berlatar transparan, ukuran 256×256 px, sudut pandang dari depan, dengan nama
     `image/item/bendera.png`, `image/rintangan/batu.png`, `karang.png`, `kaktus.png`, `es.png`, dan `jurang.png`.
     Setelah itu kirim revisi baru; saya akan mengganti SVG-nya dengan gambar tersebut.
  4. Nomor uji tertulis "U5.1- U4.22", yang dimaksud mungkin U5.1–U5.22. Semua butir Tahap 5 bisa diuji sekarang. Jangan lupa **Ctrl + F5** dulu.
