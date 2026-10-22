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
- Nomor uji     : U5.20
- Prioritas     : Rendah
- Status        : Tidak jadi
- Masalah       : Di HP 375 px tombol Jalankan sejajar dengan Ulang Posisi sehingga terlihat sempit.
- Harapan       : Tombol Jalankan selebar layar di HP.
- Catatan pengerjaan : (ini hanya contoh)

---

## Revisi

<!-- Tulis revisi di bawah baris ini -->

### R1:
- Tahap/halaman :
- Nomor uji     :
- Prioritas     :
- Status        : Baru
- Masalah       :
- Harapan       :
- Catatan pengerjaan :
