# Daftar Uji Coba: Tahap 1–5

Cara pakai: jalankan server lokal (lihat [README.md](README.md)), lalu centang `[x]` setiap butir yang sudah sesuai.
Jika ada yang tidak sesuai, catat nomornya (misalnya **U2.7**) di [REVISI.md](REVISI.md).

Sebelum mulai: klik **Reset data demo** di footer beranda agar datanya sama dengan daftar ini.

Perangkat uji yang disarankan:
- [ ] Laptop lebar 1366 px (Chrome atau Edge)
- [ ] HP lebar 375 px (DevTools → mode perangkat, atau HP asli lewat `https`)
- [ ] Mode gerak dikurangi: DevTools → `Ctrl+Shift+P` → *Rendering* → *Emulate prefers-reduced-motion: reduce*

---

## Tahap 1: Fondasi dan landing page

| No | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| U1.1 | Buka `#/` | Hero pantai dengan lapisan gelap, robot melayang, judul "Coding Island", tombol Daftar dan Masuk, serta tautan "Masuk sebagai Guru" | [ ] |
| U1.2 | Klik panah bawah di hero | Halaman bergulir halus ke bagian "Jelajahi 4 Pulau" | [ ] |
| U1.3 | Lihat bagian pulau dan cara bermain | 4 kartu zona bergambar; 3 langkah bergambar (editor kode, robot ke bendera, bintang dan koin) | [ ] |
| U1.4 | Buka `#/asal-asalan` | Halaman 404 "Pulau tidak ditemukan" dengan robot kaget dan tombol kembali | [ ] |
| U1.5 | Tampilan 375 px dan 1366 px | Rapi, tidak bisa digeser ke samping | [ ] |
| U1.6 | Aktifkan *reduced motion* | Robot tidak melayang, tidak ada animasi | [ ] |
| U1.7 | Tekan Tab berulang dari awal halaman | Fokus terlihat jelas (cincin kuning dan teal), muncul tautan "Lewati ke isi halaman" | [ ] |

## Tahap 2: Data, daftar, masuk, dan penjaga rute

| No | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| U2.1 | Buka `#/masuk` | Form username, 4 kotak PIN, papan angka besar, kotak **Akun Demo** yang bisa disembunyikan | [ ] |
| U2.2 | Klik **Pakai** pada `andi3`, lalu Masuk | Pindah ke peta; header menampilkan avatar, "Andi", koin, berlian, dan tombol keluar | [ ] |
| U2.3 | Keluar (konfirmasi Ya), lalu masukkan PIN salah 5 kali | Muncul "Sisa N kesempatan", lalu form terkunci dengan hitung mundur 60 detik | [ ] |
| U2.4 | Muat ulang halaman saat masih terkunci | Hitung mundur tetap berlanjut | [ ] |
| U2.5 | Ketik PIN memakai papan angka di layar | Kotak terisi berurutan; tombol hapus bekerja; otomatis masuk saat angka ke-4 terisi | [ ] |
| U2.6 | `#/daftar`: klik Lanjut tanpa mengisi | Pesan ramah di bawah setiap kolom (bukan *alert*), form bergoyang | [ ] |
| U2.7 | Langkah 2: pilih Kelas 3A, ketik kode `pulau3` (huruf kecil) | Diterima | [ ] |
| U2.8 | Langkah 2: ketik kode salah, mis. `SALAH1` | "Kode kelas belum cocok. Tanya gurumu ya." | [ ] |
| U2.9 | Langkah 3: lihat username | Otomatis berisi nama panggilan + angka; ubah ke `andi3` → "sudah dipakai" | [ ] |
| U2.10 | Langkah 3: isi PIN dan konfirmasi yang berbeda | "PIN belum sama. Coba ketik lagi." | [ ] |
| U2.11 | Selesaikan pendaftaran | Modal robot "Halo, [panggilan]! Selamat datang…" +20 koin, lalu pindah ke peta | [ ] |
| U2.12 | Saat masuk sebagai siswa, buka `#/guru` | Dialihkan ke halaman masuk guru | [ ] |
| U2.13 | Masuk guru `bu.sari` / `guru123`, buka `#/guru/guru` | Ditolak dengan toast "khusus admin", kembali ke `#/guru` | [ ] |
| U2.14 | Masuk `admin` / `admin123`, buka `#/guru/guru` | Halaman terbuka | [ ] |
| U2.15 | Saat tidak masuk, buka `#/peta` | Dialihkan ke `#/masuk`; setelah masuk kembali ke peta | [ ] |
| U2.16 | Klik **Reset data demo** di footer → Ya | Akun baru hilang, sesi keluar, data kembali seperti awal | [ ] |
| U2.17 | Masuk guru: password salah 5 kali | Ditahan 1 menit (terpisah dari tahanan siswa) | [ ] |

## Tahap 3: Peta pulau

| No | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| U3.1 | Masuk `andi3`, buka `#/peta` | 4 kartu pulau; hanya Pantai terbuka; lainnya abu-abu dengan gembok dan "Selesaikan boss … dulu" | [ ] |
| U3.2 | Klik kartu Laut yang terkunci | Toast "Selesaikan boss Pantai dulu ya!" | [ ] |
| U3.3 | Klik kartu Pantai | Peta pulau: background penuh, jalur putus-putus, lingkaran level | [ ] |
| U3.4 | Periksa lingkaran level | Selesai = teal dengan bintang; terbuka = berdenyut dengan cincin kuning; terkunci = abu-abu dengan gembok; boss = lebih besar dengan piala; level 3 berlencana bug | [ ] |
| U3.5 | Klik level terkunci | Toast "Selesaikan level sebelumnya dulu ya!" | [ ] |
| U3.6 | Klik level terbuka | Modal pratinjau: judul, jenis, ringkasan, bintang terbaik, tombol **Main!** | [ ] |
| U3.7 | Diamkan 20 detik | Robot berganti melamun; gerakkan mouse dan robot kembali; klik robot untuk tips baru | [ ] |
| U3.8 | Tombol panah kiri/kanan dan tombol "Ringkasan Pulau" | Pindah zona bekerja; panah ke zona terkunci nonaktif | [ ] |
| U3.9 | Console: `ciDev.selesaikanLevel('pantai-4', 3)`, lalu buka `#/peta` | Roket dan robot terbang melintas, lalu toast "Pulau baru terbuka!" | [ ] |
| U3.10 | Muat ulang halaman | Animasi tidak muncul lagi | [ ] |
| U3.11 | `ciDev.resetProgres()` | Semua pulau kecuali Pantai kembali terkunci | [ ] |
| U3.12 | Peta pulau di 375 px | Jalur tegak dari bawah ke atas, lingkaran tidak bertumpuk | [ ] |
| U3.13 | Masuk `naufal6` | Pantai, Laut, dan Gurun berstatus "Tuntas!"; Salju terbuka | [ ] |

## Tahap 4: Interpreter

Buka `http://localhost:8000/?dev=1#/uji-interpreter`.

| No | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| U4.1 | Buka tanpa `?dev=1` | Halaman 404 | [ ] |
| U4.2 | Klik **Jalankan semua tes** | 22 dari 22 lulus (sekitar 2–3 detik) | [ ] |
| U4.3 | Pilih dunia "Jurang", klik Jalankan | BERHASIL; tabel jejak berisi `gerak`, `lompat`, `selesai` | [ ] |
| U4.4 | Kode `majuu()` | "Baris 1: Robot belum kenal majuu. Maksudmu maju()?" | [ ] |
| U4.5 | Kode `maju(2` | "Baris 1: kurung tutup ) sepertinya hilang." | [ ] |
| U4.6 | Kode `belok kiri()` | Saran memakai `belok_kiri()` dengan garis bawah | [ ] |
| U4.7 | Kode `selama bukan ada_jurang() {` + baris `belok_kiri()` + `}` | "Robot kelelahan! Sepertinya perulanganmu tidak pernah berhenti." | [ ] |
| U4.8 | Isi perintahTersedia `maju, belok_kiri`, lalu pakai `ulangi` | "Perintah ini belum dibuka di pulau ini" | [ ] |
| U4.9 | Kode `MAJU ( 2 )` (huruf besar dan spasi berlebih) | Tetap dimengerti | [ ] |
| U4.10 | Kode dengan variabel: `buat langkah = 2` lalu `maju(langkah)` | Robot maju 2 petak | [ ] |

## Tahap 5: Halaman level

| No | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| U5.1 | Masuk `andi3`, buka Pantai → level 2 → **Main!** | Kiri: soal, tujuan, chip, editor, tombol. Kanan: panggung 16:9 dengan koin, batu, dan bendera | [ ] |
| U5.2 | Editor | Nomor baris, huruf JetBrains Mono besar, warna untuk perintah, angka, dan komentar | [ ] |
| U5.3 | Ketik `ma` di editor | Muncul saran autocomplete `maju` | [ ] |
| U5.4 | Klik chip `maju()` beberapa kali | Perintah disisipkan di posisi kursor dengan baris baru (kelas 3 selalu aktif) | [ ] |
| U5.5 | Muat ulang halaman setelah mengetik | Kode masih ada (tersimpan otomatis) | [ ] |
| U5.6 | Jalankan kode benar yang panjang (10 baris) | Robot bergerak, baris kode tersorot kuning, koin terbang ke header, tujuan tercentang, confetti, modal 2 bintang "Nilai 85" | [ ] |
| U5.7 | Klik **Coba lagi untuk 3 bintang**, jalankan solusi ≤ 7 baris | Modal 3 bintang "Nilai 100", +5 koin | [ ] |
| U5.8 | Jalankan lagi solusi yang sama | Koin tidak bertambah ("Hadiah koin level ini sudah kamu ambil") | [ ] |
| U5.9 | Kode `majuu()` | Robot `salah.png`, pesan di balon kata, baris error berlatar oranye | [ ] |
| U5.10 | Level 1: kode `maju(7)` | Robot maju lalu terpental, `kaget.png`, bergoyang, "Robot keluar dari peta!" | [ ] |
| U5.11 | Level 2: kode tanpa `ambil()` sampai ke bendera | Robot sedih, "masih ada 2 barang yang belum diambil" | [ ] |
| U5.12 | Level 2: kode yang menabrak batu | Robot kaget dan bergoyang, "Robot menabrak batu!" | [ ] |
| U5.13 | Pilih kecepatan Pelan, Normal, dan Cepat | Kecepatan animasi berubah; pilihan tetap setelah dimuat ulang | [ ] |
| U5.14 | Matikan sakelar **Tampilkan petak** | Garis petak hilang; pilihan tetap setelah dimuat ulang | [ ] |
| U5.15 | Klik **Ulang Posisi** saat robot sedang berjalan | Animasi berhenti, robot kembali ke awal | [ ] |
| U5.16 | Tekan `Ctrl + Enter` di editor | Kode dijalankan | [ ] |
| U5.17 | Masuk `farhan5` (kelas 5), buka level 1 | Ada sakelar **Bantu ketik**; chip baru bisa diklik setelah sakelar dinyalakan | [ ] |
| U5.18 | Modal hasil → **Lanjut ke level berikutnya** | Pindah ke level berikutnya (level 3 menampilkan "sedang disiapkan") | [ ] |
| U5.19 | DevTools → Network → blokir `esm.sh`, muat ulang | Editor berganti ke textarea bernomor baris dan tetap bisa dipakai | [ ] |
| U5.20 | Tampilan 375 px | Panggung di atas, editor di bawah, tidak ada scroll ke samping | [ ] |
| U5.21 | Aktifkan *reduced motion*, jalankan kode benar | Robot langsung berpindah tanpa animasi, tidak ada confetti, sorotan baris tetap terlihat | [ ] |
| U5.22 | Setelah beberapa kali Jalankan, ketik di console: `localStorage.getItem('ci_aktivitas')` | Ada catatan "Mencoba level…" dan "Menyelesaikan level…" | [ ] |

---

## Ringkasan hasil

| Tahap | Jumlah butir | Lulus | Gagal | Catatan |
|---|---|---|---|---|
| Tahap 1 | 7 | | | |
| Tahap 2 | 17 | | | |
| Tahap 3 | 13 | | | |
| Tahap 4 | 10 | | | |
| Tahap 5 | 22 | | | |

Diuji oleh: ____________  Tanggal: ____________  Browser/perangkat: ____________
