# Daftar Uji Coba: Tahap 1–12

Cara pakai: jalankan `npx wrangler dev` lalu buka `http://localhost:8787` (lihat [README.md](README.md) bagian 3), lalu centang `[x]` setiap butir yang sudah sesuai.
Jika ada yang tidak sesuai, catat nomornya (misalnya **U2.7**) di [REVISI.md](REVISI.md).

Sejak Tahap 11 tidak ada lagi data contoh. Sebelum menguji Tahap 1–9, siapkan data uji sendiri di database lokal:
pasang admin di `#/pasang`, buat **Kelas 3A**, buat satu akun guru, lalu daftarkan beberapa siswa (misalnya `andi3`, `aisyah3`) lewat `#/daftar`.
Nama akun seperti `andi3`, `bu.sari`, atau kode `PULAU3` di butir lama hanyalah contoh; ganti dengan akun uji Anda.
Untuk mengulang dari database kosong: hentikan server, hapus folder `.wrangler`, lalu jalankan `npx wrangler d1 migrations apply coding-island-db --local`.

> Sejak Tahap 12, JS dan CSS dikirim dengan `Cache-Control: no-cache`, jadi muat ulang biasa sudah cukup setelah ada pembaruan kode.
> Uji di lingkungan **staging** (README bagian 4g) atau lokal, **jangan** dengan akun siswa sungguhan.

Perangkat uji yang disarankan:

- [ ] Laptop lebar 1366 px (Chrome atau Edge)
- [ ] HP lebar 375 px (DevTools → mode perangkat, atau HP asli lewat `https`)
- [ ] Mode gerak dikurangi: DevTools → `Ctrl+Shift+P` → _Rendering_ → _Emulate prefers-reduced-motion: reduce_

---

## Tahap 1: Fondasi dan landing page

| No   | Langkah                              | Hasil yang diharapkan                                                                                                               | OK  |
| ---- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --- |
| U1.1 | Buka `#/`                            | Hero pantai dengan lapisan gelap, robot melayang, judul "Coding Island", tombol Daftar dan Masuk, serta tautan "Masuk sebagai Guru" | [ ] |
| U1.2 | Klik panah bawah di hero             | Halaman bergulir halus ke bagian "Jelajahi 4 Pulau"                                                                                 | [ ] |
| U1.3 | Lihat bagian pulau dan cara bermain  | 4 kartu zona bergambar; 3 langkah bergambar (editor kode, robot ke bendera, bintang dan koin)                                       | [ ] |
| U1.4 | Buka `#/asal-asalan`                 | Halaman 404 "Pulau tidak ditemukan" dengan robot kaget dan tombol kembali                                                           | [ ] |
| U1.5 | Tampilan 375 px dan 1366 px          | Rapi, tidak bisa digeser ke samping                                                                                                 | [ ] |
| U1.6 | Aktifkan _reduced motion_            | Robot tidak melayang, tidak ada animasi                                                                                             | [ ] |
| U1.7 | Tekan Tab berulang dari awal halaman | Fokus terlihat jelas (cincin kuning dan teal), muncul tautan "Lewati ke isi halaman"                                                | [ ] |

## Tahap 2: Data, daftar, masuk, dan penjaga rute

| No    | Langkah                                                      | Hasil yang diharapkan                                                                      | OK  |
| ----- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | --- |
| U2.1  | Buka `#/masuk`                                               | Form username, 4 kotak PIN, papan angka besar, kotak **Akun Demo** yang bisa disembunyikan | [ ] |
| U2.2  | Klik **Pakai** pada `andi3`, lalu Masuk                      | Pindah ke peta; header menampilkan avatar, "Andi", koin, berlian, dan tombol keluar        | [ ] |
| U2.3  | Keluar (konfirmasi Ya), lalu masukkan PIN salah 5 kali       | Muncul "Sisa N kesempatan", lalu form terkunci dengan hitung mundur 60 detik               | [ ] |
| U2.4  | Muat ulang halaman saat masih terkunci                       | Hitung mundur tetap berlanjut                                                              | [ ] |
| U2.5  | Ketik PIN memakai papan angka di layar                       | Kotak terisi berurutan; tombol hapus bekerja; otomatis masuk saat angka ke-4 terisi        | [ ] |
| U2.6  | `#/daftar`: klik Lanjut tanpa mengisi                        | Pesan ramah di bawah setiap kolom (bukan _alert_), form bergoyang                          | [ ] |
| U2.7  | Langkah 2: pilih Kelas 3A, ketik kode `pulau3` (huruf kecil) | Diterima                                                                                   | [ ] |
| U2.8  | Langkah 2: ketik kode salah, mis. `SALAH1`                   | "Kode kelas belum cocok. Tanya gurumu ya."                                                 | [ ] |
| U2.9  | Langkah 3: lihat username                                    | Otomatis berisi nama panggilan + angka; ubah ke `andi3` → "sudah dipakai"                  | [ ] |
| U2.10 | Langkah 3: isi PIN dan konfirmasi yang berbeda               | "PIN belum sama. Coba ketik lagi."                                                         | [ ] |
| U2.11 | Selesaikan pendaftaran                                       | Modal robot "Halo, [panggilan]! Selamat datang…" +20 koin, lalu pindah ke peta             | [ ] |
| U2.12 | Saat masuk sebagai siswa, buka `#/guru`                      | Dialihkan ke halaman masuk guru                                                            | [ ] |
| U2.13 | Masuk guru `bu.sari` / `guru123`, buka `#/guru/guru`         | Ditolak dengan toast "khusus admin", kembali ke `#/guru`                                   | [ ] |
| U2.14 | Masuk `admin` / `admin123`, buka `#/guru/guru`               | Halaman terbuka                                                                            | [ ] |
| U2.15 | Saat tidak masuk, buka `#/peta`                              | Dialihkan ke `#/masuk`; setelah masuk kembali ke peta                                      | [ ] |
| U2.16 | Klik **Reset data demo** di footer → Ya                      | Akun baru hilang, sesi keluar, data kembali seperti awal                                   | [ ] |
| U2.17 | Masuk guru: password salah 5 kali                            | Ditahan 1 menit (terpisah dari tahanan siswa)                                              | [ ] |

## Tahap 3: Peta pulau

| No    | Langkah                                                                                                                                                                                  | Hasil yang diharapkan                                                                                                                                              | OK  |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| U3.1  | Masuk `andi3`, buka `#/peta`                                                                                                                                                             | 4 kartu pulau; hanya Pantai terbuka; lainnya abu-abu dengan gembok dan "Selesaikan boss … dulu"                                                                    | [ ] |
| U3.2  | Klik kartu Laut yang terkunci                                                                                                                                                            | Toast "Selesaikan boss Pantai dulu ya!"                                                                                                                            | [ ] |
| U3.3  | Klik kartu Pantai                                                                                                                                                                        | Peta pulau: background penuh, jalur putus-putus, lingkaran level                                                                                                   | [ ] |
| U3.4  | Periksa lingkaran level                                                                                                                                                                  | Selesai = teal dengan bintang; terbuka = berdenyut dengan cincin kuning; terkunci = abu-abu dengan gembok; boss = lebih besar dengan piala; level 3 berlencana bug | [ ] |
| U3.5  | Klik level terkunci                                                                                                                                                                      | Toast "Selesaikan level sebelumnya dulu ya!"                                                                                                                       | [ ] |
| U3.6  | Klik level terbuka                                                                                                                                                                       | Modal pratinjau: judul, jenis, ringkasan, bintang terbaik, tombol **Main!**                                                                                        | [ ] |
| U3.7  | Diamkan 20 detik                                                                                                                                                                         | Robot berganti melamun; gerakkan mouse dan robot kembali; klik robot untuk tips baru                                                                               | [ ] |
| U3.8  | Tombol panah kiri/kanan dan tombol "Ringkasan Pulau"                                                                                                                                     | Pindah zona bekerja; panah ke zona terkunci nonaktif                                                                                                               | [ ] |
| U3.9  | Buka alamat dengan `?dev=1` (mis. `http://localhost:8000/?dev=1#/peta`), klik tombol oranye **Dev** di pojok kiri bawah → bagian _Tuntaskan satu pulau_ pilih **Pantai** → **Tuntaskan** | Toast "Semua 4 level di pantai selesai.", lalu roket dan robot terbang melintas dan muncul toast "Pulau baru terbuka! Selamat datang di Laut."                     | [ ] |
| U3.10 | Muat ulang halaman (F5)                                                                                                                                                                  | Animasi tidak muncul lagi; Pantai "Tuntas!", Laut "Terbuka"                                                                                                        | [ ] |
| U3.11 | Panel **Dev** → **Reset progres saya**                                                                                                                                                   | Semua pulau kecuali Pantai kembali terkunci                                                                                                                        | [ ] |
| U3.12 | Peta pulau di 375 px                                                                                                                                                                     | Jalur tegak dari bawah ke atas, lingkaran tidak bertumpuk                                                                                                          | [ ] |
| U3.13 | Masuk `naufal6`                                                                                                                                                                          | Pantai, Laut, dan Gurun berstatus "Tuntas!"; Salju terbuka                                                                                                         | [ ] |

## Tahap 4: Interpreter

Tahap 4 adalah "otak" yang membaca kode siswa. Di tahap ini belum ada robot yang bergerak di panggung;
pengujiannya memakai **halaman pengembang** yang menampilkan hasil dalam bentuk teks dan tabel.

### Persiapan (sekali saja)

1. Jalankan server lokal. Alamat dasarnya tergantung cara yang dipakai:
   - Python `python -m http.server 8000` → `http://localhost:8000`
   - VS Code Live Server → biasanya `http://127.0.0.1:5500`
2. Ketik alamat ini di address bar (ganti alamat dasarnya jika berbeda), lalu tekan Enter:
   ```
   http://localhost:8000/?dev=1#/uji-interpreter
   ```
   Untuk Live Server: `http://127.0.0.1:5500/index.html?dev=1#/uji-interpreter`.
   Tidak perlu masuk akun. Cara lain: buka halaman mana saja dengan `?dev=1`, klik tombol oranye **Dev** di pojok kiri bawah, lalu klik **Uji Interpreter**.
3. Halaman **Uji Interpreter** terbagi menjadi:
   - **Kiri:** pilihan _Dunia contoh_, kotak **Kode**, kolom _perintahTersedia_, tombol **Jalankan** dan **Jalankan semua tes**.
   - **Kanan:** _Dunia awal_ (peta teks) dan kotak **Hasil** (muncul setelah Jalankan).
   - **Bawah:** tabel _Jejak peristiwa_ (langkah-langkah robot) dan tabel _Tes otomatis_.
4. Cara membaca peta teks: `>` `<` `^` `v` = robot dan arah hadapnya, `F` = bendera tujuan, `#` = batu, `O` = jurang, `$` = koin wajib, `.` = petak kosong.

### Cara mencoba satu kode

1. Pilih _Dunia contoh_ yang disebut di butir uji.
2. Klik di kotak **Kode**, tekan **Ctrl + A** lalu **Delete** untuk mengosongkannya.
3. Ketik atau salin kode dari butir uji di bawah. Untuk menempel kode di kotak ini **tidak** perlu "allow pasting"; itu hanya untuk Console.
4. Klik **Jalankan**.
5. Lihat kotak **Hasil**: label hijau **BERHASIL** atau oranye **GAGAL**, lalu pesannya di bawah label.

### Butir uji

- [ ] **U4.1 Halaman tersembunyi.** Buka `http://localhost:8000/#/uji-interpreter` (tanpa `?dev=1`).
      Harapan: muncul halaman 404 "Pulau tidak ditemukan".

- [ ] **U4.2 Tes otomatis.** Di halaman uji, klik **Jalankan semua tes**.
      Harapan: setelah sekitar 3 detik muncul "22 dari 22 kasus lulus." dan semua baris berlabel **LULUS**.

- [ ] **U4.3 Kode contoh.** Pilih dunia **Jurang** (kodenya terisi otomatis), klik **Jalankan**.
      Harapan: **BERHASIL**, "Hore! Robot sampai di tujuan." Tabel jejak berisi `gerak`, `lompat`, dan diakhiri `selesai`.

- [ ] **U4.4 Salah ketik.** Dunia **Lurus**, kode:
      `     majuu()
  `
      Harapan: **GAGAL**, "Baris 1: Robot belum kenal majuu. Maksudmu maju()?"

- [ ] **U4.5 Kurung hilang.** Dunia **Lurus**, kode:
      `     maju(2
  `
      Harapan: "Baris 1: kurung tutup ) sepertinya hilang."

- [ ] **U4.6 Lupa garis bawah.** Dunia **Lurus**, kode:
      `     belok kiri()
  `
      Harapan: "Baris 1: Robot belum kenal belok. Maksudmu belok*kiri()? Pakai garis bawah * ya."

- [ ] **U4.7 Perulangan tanpa akhir.** Dunia **Lurus**, kode:
      `     selama bukan ada_jurang() {
    belok_kiri()
  }
  `
      Harapan: "Baris 1: Robot kelelahan! Sepertinya perulanganmu tidak pernah berhenti." Halaman tidak macet.

- [ ] **U4.8 Perintah belum dibuka.** Dunia **Lurus**. Isi kolom _perintahTersedia_ dengan `maju, belok_kiri`, lalu kode:
      `     ulangi 5 {
    maju()
  }
  `
      Harapan: "Baris 1: ulangi belum bisa dipakai. Perintah ini belum dibuka di pulau ini."
      Setelah itu **kosongkan lagi** kolom _perintahTersedia_.

- [ ] **U4.9 Huruf besar dan spasi.** Dunia **Lurus**, kode:
      `     MAJU ( 5 )
  `
      Harapan: **BERHASIL** (robot di dunia Lurus perlu maju 5 petak).

- [ ] **U4.10 Variabel.** Dunia **Lurus**, kode:
      `     buat langkah = 2
  langkah = langkah + 3
  maju(langkah)
  `
      Harapan: **BERHASIL**. Tabel jejak berisi 5 baris `gerak` lalu `selesai`.

- [ ] **U4.11 Menabrak batu.** Dunia **Belok & batu**, kode:
      `     maju(3)
  `
      Harapan: **GAGAL**, "Baris 1: Robot menabrak batu!" Baris terakhir tabel jejak berjenis `tabrak`.

## Tahap 5: Halaman level

| No    | Langkah                                                                                  | Hasil yang diharapkan                                                                                                       | OK  |
| ----- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --- |
| U5.1  | Masuk `andi3`, buka Pantai → level 2 → **Main!**                                         | Kiri: soal, tujuan, chip, editor, tombol. Kanan: panggung 16:9 dengan koin, batu, dan bendera                               | [ ] |
| U5.2  | Editor                                                                                   | Nomor baris, huruf JetBrains Mono besar, warna untuk perintah, angka, dan komentar                                          | [ ] |
| U5.3  | Ketik `ma` di editor                                                                     | Muncul saran autocomplete `maju`                                                                                            | [ ] |
| U5.4  | Klik chip `maju()` beberapa kali                                                         | Perintah disisipkan di posisi kursor dengan baris baru (kelas 3 selalu aktif)                                               | [ ] |
| U5.5  | Muat ulang halaman setelah mengetik                                                      | Kode masih ada (tersimpan otomatis)                                                                                         | [ ] |
| U5.6  | Jalankan kode benar yang panjang (10 baris)                                              | Robot bergerak, baris kode tersorot kuning, koin terbang ke header, tujuan tercentang, confetti, modal 2 bintang "Nilai 85" | [ ] |
| U5.7  | Klik **Coba lagi untuk 3 bintang**, jalankan solusi ≤ 7 baris                            | Modal 3 bintang "Nilai 100", +5 koin                                                                                        | [ ] |
| U5.8  | Jalankan lagi solusi yang sama                                                           | Koin tidak bertambah ("Hadiah koin level ini sudah kamu ambil")                                                             | [ ] |
| U5.9  | Kode `majuu()`                                                                           | Robot `salah.png`, pesan di balon kata, baris error berlatar oranye                                                         | [ ] |
| U5.10 | Level 1: kode `maju(7)`                                                                  | Robot maju lalu terpental, `kaget.png`, bergoyang, "Robot keluar dari peta!"                                                | [ ] |
| U5.11 | Level 2: kode tanpa `ambil()` sampai ke bendera                                          | Robot sedih, "masih ada 2 barang yang belum diambil"                                                                        | [ ] |
| U5.12 | Level 2: kode yang menabrak batu                                                         | Robot kaget dan bergoyang, "Robot menabrak batu!"                                                                           | [ ] |
| U5.13 | Pilih kecepatan Pelan, Normal, dan Cepat                                                 | Kecepatan animasi berubah; pilihan tetap setelah dimuat ulang                                                               | [ ] |
| U5.14 | Matikan sakelar **Tampilkan petak**                                                      | Garis petak hilang; pilihan tetap setelah dimuat ulang                                                                      | [ ] |
| U5.15 | Klik **Ulang Posisi** saat robot sedang berjalan                                         | Animasi berhenti, robot kembali ke awal                                                                                     | [ ] |
| U5.16 | Tekan `Ctrl + Enter` di editor                                                           | Kode dijalankan                                                                                                             | [ ] |
| U5.17 | Masuk `farhan5` (kelas 5), buka level 1                                                  | Ada sakelar **Bantu ketik**; chip baru bisa diklik setelah sakelar dinyalakan                                               | [ ] |
| U5.18 | Modal hasil → **Lanjut ke level berikutnya**                                             | Pindah ke level berikutnya (level 3, level debug)                                                                           | [ ] |
| U5.19 | DevTools → Network → blokir `esm.sh`, muat ulang                                         | Editor berganti ke textarea bernomor baris dan tetap bisa dipakai                                                           | [ ] |
| U5.20 | Tampilan 375 px                                                                          | Panggung di atas, editor di bawah, tidak ada scroll ke samping                                                              | [ ] |
| U5.21 | Aktifkan _reduced motion_, jalankan kode benar                                           | Robot langsung berpindah tanpa animasi, tidak ada confetti, sorotan baris tetap terlihat                                    | [ ] |
| U5.22 | Setelah beberapa kali Jalankan, ketik di console: `localStorage.getItem('ci_aktivitas')` | Ada catatan "Mencoba level…" dan "Menyelesaikan level…"                                                                     | [ ] |

---

## Tahap 6: Gameplay lengkap

Siapkan: buka `http://localhost:8000/?dev=1#/peta`, klik **Reset data demo** di footer beranda bila perlu, lalu tekan **Ctrl + F5**.

| No    | Langkah                                                                                                        | Hasil yang diharapkan                                                                                          | OK  |
| ----- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --- |
| U6.1  | Panel **Dev** → **Validasi semua level**, lalu lihat Console (F12)                                             | Toast "Semua 13 level lulus validasi." dan tabel 13 baris dengan `lulus = true`                                | [ ] |
| U6.2  | Masuk `andi3`, buka Pantai level 2, klik tombol **Clue**                                                       | Modal **Toko Clue**: 3 kartu (5, 10, 20 koin), Clue 2 dan 3 bergembok, kotak "Cara dapat bintang" di bawah     | [ ] |
| U6.3  | Beli **Clue 1**                                                                                                | Koin berkurang 5 (header ikut berubah), isi clue tampil, tombol Clue menjadi "1/3"                             | [ ] |
| U6.4  | Tutup lalu buka lagi toko clue                                                                                 | Clue 1 tetap terbuka tanpa bayar lagi                                                                          | [ ] |
| U6.5  | Beli **Clue 3** (setelah Clue 2)                                                                               | Tombol berubah "Yakin? Bintang maksimal jadi 1"; klik lagi untuk membeli; tulisan "masih bisa dapat 1 bintang" | [ ] |
| U6.6  | Masuk siswa dengan koin sedikit (mis. daftar akun baru, 20 koin), beli clue sampai koin habis                  | Robot sedih: "Koinmu belum cukup. Selesaikan atau ulangi level lain untuk mengumpulkan koin."                  | [ ] |
| U6.7  | Selesaikan level setelah membeli Clue 2 dengan kode pendek                                                     | Modal hasil 2 bintang + saran "Kamu memakai Clue 2…"                                                           | [ ] |
| U6.8  | Buka Pantai level 3 (debug)                                                                                    | Editor berisi kode salah, banner kuning "Ada bug di kode ini! Temukan dan perbaiki" dengan ikon bug            | [ ] |
| U6.9  | Ubah kode, lalu klik **Kembalikan kode awal** → Ya                                                             | Kode kembali seperti awal                                                                                      | [ ] |
| U6.10 | Jalankan kode awal level debug tanpa diubah                                                                    | Robot gagal (keluar peta / kelewatan / jatuh / kelelahan sesuai level)                                         | [ ] |
| U6.11 | Buka Pantai level 4 (boss)                                                                                     | Panggung berbingkai emas, piala di kartu soal, lencana "Level Boss"                                            | [ ] |
| U6.12 | Selesaikan boss Pantai untuk pertama kali                                                                      | Animasi piala besar "Boss dikalahkan!" + "+3 berlian", modal hasil dengan tombol **Kembali ke Peta**           | [ ] |
| U6.13 | Klik **Kembali ke Peta**                                                                                       | Roket dan robot terbang, toast "Pulau baru terbuka! Selamat datang di Laut."                                   | [ ] |
| U6.14 | Masuk `farhan5` (kelas 5), buka level mana saja                                                                | Ada kotak biru **Tantangan bonus** di bawah instruksi; untuk `andi3` (kelas 3) kotak ini tidak ada             | [ ] |
| U6.15 | Mainkan level Laut, Gurun, dan Salju dengan solusi (lihat Clue 3 atau `js/data/levels.js`)                     | Setiap level bisa diselesaikan; rintangan sesuai pulau (karang, kaktus, es); jurang tampil sebagai petak gelap | [ ] |
| U6.16 | Panel Dev → _Tuntaskan pulau_ Pantai, Laut, Gurun, lalu selesaikan Salju 1–2, mainkan boss Salju sampai menang | Modal "Kamu Juara Coding Island!" dengan tombol **Lihat Sertifikat Juara**                                     | [ ] |
| U6.17 | Buka sertifikat (`#/juara`)                                                                                    | Nama lengkap, kelas, total bintang, tanggal; peta pulau menampilkan spanduk "Kamu Juara Coding Island!"        | [ ] |
| U6.18 | Klik **Cetak Sertifikat**                                                                                      | Pratinjau cetak A4 lanskap hanya berisi sertifikat (tanpa header dan tombol)                                   | [ ] |
| U6.19 | Siswa yang belum tamat membuka `#/juara`                                                                       | "Sertifikat belum terbuka" dengan tombol kembali ke peta                                                       | [ ] |

## Tahap 7: Dashboard guru

Siapkan: klik **Reset data demo**, tekan **Ctrl + F5**, lalu buka `#/guru/masuk`.

| No    | Langkah                                                                                      | Hasil yang diharapkan                                                                                                           | OK  |
| ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --- |
| U7.1  | Masuk `bu.sari` / `guru123`                                                                  | Navbar teal tua di kiri (logo, kartu "Bu Sari · Guru", menu berikon), menu **Ringkasan** berlatar mint; tidak ada menu **Guru** | [ ] |
| U7.2  | Lihat Ringkasan                                                                              | 5 kartu statistik (10 siswa, 2 kelas, 13 level), daftar "Siswa yang perlu bantuan", diagram batang 4 zona, 10 aktivitas terbaru | [ ] |
| U7.3  | Buka filter kelas di topbar                                                                  | Hanya "Semua kelas saya", Kelas 3A, Kelas 4A; memilih Kelas 3A mengubah semua angka                                             | [ ] |
| U7.4  | Klik **Ciutkan** di bawah navbar, muat ulang                                                 | Navbar hanya ikon (±76 px) dan tetap ciut setelah dimuat ulang                                                                  | [ ] |
| U7.5  | Lebar 375 px                                                                                 | Navbar tersembunyi; tombol hamburger membuka drawer; klik di luar atau Esc menutupnya; tidak ada scroll ke samping              | [ ] |
| U7.6  | Kelas: klik ikon salin di kode kelas                                                         | Toast "Kode PULAU3 disalin."                                                                                                    | [ ] |
| U7.7  | Kelas: ikon buat kode baru → Buat                                                            | Kode berubah (6 huruf/angka), toast sukses                                                                                      | [ ] |
| U7.8  | Kelas: **Tambah Kelas** "Kelas 3B"                                                           | Kelas baru muncul, Bu Sari otomatis menjadi pengampu; muncul juga di filter kelas                                               | [ ] |
| U7.9  | Kelas: tombol hapus pada Kelas 3A                                                            | Tombol nonaktif (kelas masih berisi siswa); hapus Kelas 3B yang kosong berhasil                                                 | [ ] |
| U7.10 | Siswa: ketik "andi" di pencarian                                                             | Tabel hanya berisi Andi                                                                                                         | [ ] |
| U7.11 | Siswa: klik judul kolom **Nilai** dua kali                                                   | Urutan berganti dari besar ke kecil dan sebaliknya                                                                              | [ ] |
| U7.12 | Siswa: **Tambah Siswa** (isi nama, panggilan)                                                | Modal menampilkan username dan PIN 4 angka sekali; siswa bisa masuk di `#/masuk` dengan data itu                                | [ ] |
| U7.13 | Siswa: ikon gembok (reset PIN)                                                               | PIN baru tampil sekali; PIN lama tidak bisa dipakai lagi                                                                        | [ ] |
| U7.14 | Siswa: ikon panah (pindah kelas) ke Kelas 4A                                                 | Kelas siswa berubah, toast sukses                                                                                               | [ ] |
| U7.15 | Siswa: ikon hapus, ketik username untuk konfirmasi                                           | Siswa terhapus, toast sukses                                                                                                    | [ ] |
| U7.16 | Siswa: **Impor CSV** → Unduh contoh CSV, isi beberapa baris (satu sengaja salah), pilih file | Pratinjau menandai baris salah dengan alasan; **Buat N akun** membuat akun; **Unduh CSV username & PIN** mengunduh file         | [ ] |
| U7.17 | Klik nama siswa → detail                                                                     | Profil, koin, berlian, bilah progres per zona, tabel 13 level                                                                   | [ ] |
| U7.18 | Detail: mainkan dulu satu level sebagai siswa itu, lalu klik ikon **Lihat kode**             | Modal kode berfont monospace dengan nomor baris                                                                                 | [ ] |
| U7.19 | Detail: tulis catatan → **Simpan catatan**, muat ulang                                       | Catatan tetap ada dengan keterangan waktu dan nama guru                                                                         | [ ] |
| U7.20 | Ketik alamat `#/guru/siswa/siswa_5a_1` (siswa Pak Budi)                                      | Ditolak: "Siswa tidak ditemukan di kelas Anda."                                                                                 | [ ] |
| U7.21 | Aktivitas: filter jenis **Selesai**, lalu pilih satu siswa                                   | Hanya aktivitas yang sesuai; tombol "Tampilkan lebih banyak" jika lebih dari 100                                                | [ ] |
| U7.22 | Buka `#/guru/guru` sebagai Bu Sari                                                           | Dialihkan ke Ringkasan dengan toast "Halaman ini khusus admin."                                                                 | [ ] |
| U7.23 | Pengaturan: ganti password (lama salah, lalu benar)                                          | Pesan "Password lama salah."; setelah benar toast sukses dan bisa masuk dengan password baru                                    | [ ] |
| U7.24 | Masuk `admin` / `admin123`                                                                   | Menu **Guru** muncul; Ringkasan menampilkan 20 siswa dan 4 kelas                                                                | [ ] |
| U7.25 | Guru: tambah guru baru + centang Kelas 5A, lalu reset password                               | Password baru tampil sekali; guru itu hanya melihat Kelas 5A setelah masuk                                                      | [ ] |
| U7.26 | Pengaturan (admin): harga Clue 1 = 3, koin awal = 30 → Simpan                                | Toko clue siswa menampilkan harga 3; siswa baru mendapat 30 koin                                                                | [ ] |
| U7.27 | Tabel kosong (mis. filter kelas baru tanpa siswa)                                            | Robot melamun dengan pesan ajakan                                                                                               | [ ] |

## Tahap 8: Level & Soal

Siapkan: **Reset data demo**, **Ctrl + F5**, masuk `bu.sari` / `guru123`, buka menu **Level & Soal**.

| No    | Langkah                                                                     | Hasil yang diharapkan                                                                                                               | OK  |
| ----- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --- |
| U8.1  | Lihat daftar                                                                | 4 kelompok zona (Pantai, Laut, Gurun, Salju) dalam urutan main; level bawaan berlabel "Bawaan"; boss paling bawah                   | [ ] |
| U8.2  | Klik ikon edit pada level bawaan (sebagai Bu Sari)                          | Tombol nonaktif (hanya admin/pembuat yang bisa mengedit)                                                                            | [ ] |
| U8.3  | Klik ikon ▶ (coba main) pada Pantai 1                                       | Halaman coba main: tulis `maju(4)` → Jalankan → robot sampai, tertulis jumlah bintang; tidak ada koin/progres yang tersimpan        | [ ] |
| U8.4  | **Buat Level Baru**                                                         | Form di kiri, editor dunia di kanan dengan background Pantai dan petak terlihat; tombol **Terbitkan** nonaktif dengan daftar alasan | [ ] |
| U8.5  | Ketik judul dan instruksi                                                   | Pratinjau tampilan siswa ikut berubah langsung                                                                                      | [ ] |
| U8.6  | Pilih alat **Koin wajib**, klik satu petak; klik petak yang sama lagi       | Koin muncul; klik kedua ditolak "Petak sudah terisi"; tujuan otomatis menjadi "Ambil 1 koin"                                        | [ ] |
| U8.7  | Alat **Robot**, klik robot beberapa kali                                    | Arah robot berputar (lihat panah kuning di kaki robot)                                                                              | [ ] |
| U8.8  | Taruh rintangan, jurang, berlian; lalu **Undo** beberapa kali (atau Ctrl+Z) | Perubahan dibatalkan satu per satu                                                                                                  | [ ] |
| U8.9  | Ubah Kolom ke 6                                                             | Benda di luar grid hilang; panggung mengecil                                                                                        | [ ] |
| U8.10 | Ganti Zona ke Laut                                                          | Background berubah, rintangan menjadi karang, perintah otomatis menyertakan `ulangi`                                                | [ ] |
| U8.11 | Tulis solusi                                                                | "Saran dari solusi: N baris" dan batas baris terisi otomatis                                                                        | [ ] |
| U8.12 | Klik **Uji Jawaban**                                                        | Robot beranimasi seperti di halaman siswa; hasil "Solusi berhasil…" atau alasan gagal                                               | [ ] |
| U8.13 | Isi ketiga clue sampai daftar alasan kosong                                 | "Siap diterbitkan", tombol **Terbitkan** aktif                                                                                      | [ ] |
| U8.14 | Jenis **Perbaiki Bug** dengan kode awal kosong / kode awal yang berhasil    | Alasan "Level debug wajib punya kode awal…" / "Kode awal level debug masih berhasil…"                                               | [ ] |
| U8.15 | **Simpan Draf** dengan solusi yang salah                                    | Tersimpan sebagai Draf; tidak muncul di peta siswa                                                                                  | [ ] |
| U8.16 | **Terbitkan**                                                               | Toast terbit; di daftar level berstatus Terbit, tepat sebelum boss                                                                  | [ ] |
| U8.17 | Masuk `andi3` (3A), buka peta pulau tersebut                                | Level baru tampil sebelum boss, lingkaran tertata otomatis                                                                          | [ ] |
| U8.18 | Buat level lain hanya untuk Kelas 3A, lalu masuk `dimas4` (4A)              | Level itu tidak tampil untuk siswa 4A                                                                                               | [ ] |
| U8.19 | Siswa yang sudah menyelesaikan boss Pantai membuka Pantai                   | Level baru langsung terbuka (tidak terkunci) dan pulau Laut tetap terbuka                                                           | [ ] |
| U8.20 | Tombol naik/turun pada level buatan sendiri                                 | Urutan berubah; tidak bisa melewati boss; level boss tidak punya tombol geser                                                       | [ ] |
| U8.21 | Duplikat level bawaan                                                       | Editor terbuka dengan "Salinan …" berstatus Draf milik Bu Sari                                                                      | [ ] |
| U8.22 | Hapus level buatan sendiri                                                  | Terhapus setelah konfirmasi; level bawaan tidak punya tombol hapus                                                                  | [ ] |
| U8.23 | Nonaktifkan level bawaan (sebagai Bu Sari)                                  | Hilang dari peta siswa 3A/4A, tetap ada untuk 5A/6A; status "Nonaktif"; bisa diaktifkan lagi                                        | [ ] |
| U8.24 | Masuk `pak.budi`                                                            | Level buatan Bu Sari untuk 3A/4A tidak tampil di daftarnya                                                                          | [ ] |
| U8.25 | Masuk `admin`: edit level bawaan dan nonaktifkan untuk semua                | Admin bisa mengedit bawaan; nonaktif berlaku untuk semua kelas                                                                      | [ ] |
| U8.26 | Panel Dev → **Validasi semua level**                                        | Semua level (bawaan + buatan guru yang terbit) lulus                                                                                | [ ] |

## Tahap 9: Nilai, profil, bantuan, dan perapian

| No    | Langkah                                                                          | Hasil yang diharapkan                                                                                   | OK  |
| ----- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --- |
| U9.1  | Masuk `bu.sari`, buka **Nilai**                                                  | Pilihan kelas (3A/4A); matriks siswa × 13 level dengan kepala zona berwarna                             | [ ] |
| U9.2  | Arahkan kursor ke sebuah sel                                                     | Tooltip: nilai, jumlah bintang, percobaan, clue dibeli                                                  | [ ] |
| U9.3  | Cek Nilai Akhir satu siswa                                                       | Sama dengan (jumlah nilai level selesai) ÷ (jumlah level terbit), dibulatkan; siswa yang belum main = 1 | [ ] |
| U9.4  | Ikon pensil → isi nilai tanpa alasan                                             | Ditolak: "Tulis alasan penimpaan nilai…"                                                                | [ ] |
| U9.5  | Isi nilai 95 dan alasan → Simpan                                                 | Nilai 95 dengan lencana "Ditimpa"; tooltip menunjukkan alasan dan nilai otomatis                        | [ ] |
| U9.6  | Pensil lagi → centang "Kembalikan ke nilai otomatis"                             | Nilai kembali otomatis, lencana hilang                                                                  | [ ] |
| U9.7  | **Ekspor CSV**, buka di Excel                                                    | Huruf rapi (tidak rusak), kolom nama, kelas, nilai tiap level, nilai akhir, ditimpa, alasan             | [ ] |
| U9.8  | **Cetak**                                                                        | Pratinjau cetak tanpa navbar, berjudul "Rekap Nilai Coding Island — Kelas 3A"                           | [ ] |
| U9.9  | Lebar 375 px di halaman Nilai                                                    | Tabel bisa digeser di dalam kotaknya, halaman tidak bergeser ke samping                                 | [ ] |
| U9.10 | Masuk `naufal6`, klik avatar/nama di header                                      | Halaman Profil: bintang, koin, berlian, 3 piala berwarna + 1 abu-abu, progres pulau, 10 level terakhir  | [ ] |
| U9.11 | Profil: pilih avatar Perempuan                                                   | Toast sukses; avatar besar dan avatar di header ikut berganti                                           | [ ] |
| U9.12 | Buka level, klik tombol **?**                                                    | Modal Bantuan Perintah; perintah yang belum dibuka ditandai "Belum dibuka"; Esc menutup modal           | [ ] |
| U9.13 | Buka `#/bantuan`                                                                 | Halaman daftar perintah dengan contoh dan tips                                                          | [ ] |
| U9.14 | Tekan Tab berulang di modal mana pun                                             | Fokus berputar di dalam modal, terlihat jelas                                                           | [ ] |
| U9.15 | Dashboard di 375 px: hamburger → Tab                                             | Menu drawer bisa dipakai dengan keyboard, Esc menutup                                                   | [ ] |
| U9.16 | Cek beranda, peta, level, profil, dashboard di 1366 / 768 / 375 px               | Tidak ada scroll ke samping; tombol nyaman disentuh (≥ 44 px)                                           | [ ] |
| U9.17 | Aktifkan _reduced motion_                                                        | Tidak ada animasi (robot melayang, denyut level, roket, confetti)                                       | [ ] |
| U9.18 | Console: `setTimeout(() => { throw new Error('uji') })`                          | Toast "Ups, ada yang tidak beres. Coba lagi ya." dengan robot kaget; halaman tetap tampil               | [ ] |
| U9.19 | DevTools → Application → blokir penyimpanan (atau mode privat ketat), muat ulang | Aplikasi tetap tampil (tidak layar putih)                                                               | [ ] |
| U9.20 | Peta pulau: arahkan kursor ke kartu pulau, lihat tab Network                     | Background pulau mulai dimuat sebelum diklik                                                            | [ ] |

## Tahap 11: Siap dipakai sungguhan

Persiapan: `cp .dev.vars.example .dev.vars` lalu isi `KODE_PASANG`, hapus folder `.wrangler`, jalankan `npx wrangler d1 migrations apply coding-island-db --local`, lalu `npx wrangler dev`.

| No     | Langkah | Hasil yang diharapkan | OK  |
| ------ | ------- | --------------------- | --- |
| U11.1  | Buka `#/masuk` dan `#/guru/masuk` | Tidak ada kotak akun contoh atau tombol **Pakai**; kata "demo" tidak muncul di halaman mana pun | [ ] |
| U11.2  | Masuk guru dengan `admin` / `admin123` | Ditolak ("Username atau password salah.") karena akun bawaan sudah tidak ada | [ ] |
| U11.3  | Buka `#/daftar` | Daftar kelas kosong (belum ada kelas) | [ ] |
| U11.4  | Buka `#/guru/masuk` saat belum ada akun guru | Muncul kotak kuning "Coding Island belum dipasang. **Pasang sekarang**" | [ ] |
| U11.5  | Di `#/pasang`, isi password 6 karakter | Pesan "Password minimal 8 karakter." | [ ] |
| U11.6  | Isi kode pemasangan salah 30 kali (batas Tahap 12) | Muncul "Sisa N kesempatan", lalu pada kali ke-30 "Coba lagi dalam 15 menit"; kode benar pun ditolak sampai 15 menit berlalu | [ ] |
| U11.7  | Hapus folder `.wrangler`, jalankan ulang, isi `#/pasang` dengan kode dari `.dev.vars` | Toast "Coding Island terpasang…", langsung masuk dashboard sebagai Admin | [ ] |
| U11.8  | Buka lagi `#/pasang` | Kartu "Coding Island sudah terpasang"; tautan di `#/guru/masuk` hilang. Console: `fetch('/api/auth/pasang',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json())` → `{galat: "Coding Island sudah terpasang."}` | [ ] |
| U11.9  | Admin: buat kelas, buat akun guru, salin kode kelas; siswa mendaftar dengan kode itu | Semua berhasil; guru baru bisa masuk dan melihat siswa kelasnya | [ ] |
| U11.10 | Menu **Pengaturan** (admin) | Tidak ada bagian **Reset data demo** | [ ] |
| U11.11 | Saat uji lokal (`MODE_DEV = "1"`) | Tombol **Dev** muncul, `typeof ciDev` = `"object"`, `#/uji-interpreter` terbuka | [ ] |
| U11.12 | Ubah `MODE_DEV` di `.dev.vars` menjadi `"0"`, jalankan ulang, muat ulang dengan DevTools → Network | Tidak ada permintaan ke `js/dev.js`; tidak ada tombol Dev; `typeof ciDev` = `"undefined"`; `#/uji-interpreter` menampilkan 404 | [ ] |
| U11.13 | Buka `/migrations/0001_struktur_awal.sql`, `/.dev.vars`, `/js/store-lokal.js` | `404` | [ ] |
| U11.14 | **Database online** (setelah cadangan): `npx wrangler d1 migrations apply coding-island-db --remote` | 0001 dan 0002 tercatat ✅; akun/kelas/siswa contoh hilang; 13 level dan pengaturan tetap; `#/guru/masuk` online menampilkan tautan pemasangan | [ ] |
| U11.15 | Di situs online: `npx wrangler secret put KODE_PASANG`, lalu pasang admin di `#/pasang` | Admin sungguhan terbuat; `#/pasang` menolak permanen sesudahnya | [ ] |

## Tahap 12: Stabil untuk 30–90 siswa bersamaan dari satu Wi-Fi

Persiapan: `npm install`, lalu `npx wrangler d1 migrations apply coding-island-db --local` dan `npx wrangler dev`. Buat akun uji sendiri (admin, 1 kelas, beberapa siswa).

| No     | Langkah | Hasil yang diharapkan | OK  |
| ------ | ------- | --------------------- | --- |
| U12.1  | Satu username: ketik PIN salah 5 kali | Kali ke-4 "Sisa 1 kesempatan"; kali ke-5 ditahan 60 detik | [ ] |
| U12.2  | Saat U12.1 ditahan, siswa lain di komputer/Wi-Fi yang sama masuk | Berhasil masuk (yang ditahan hanya username itu) | [ ] |
| U12.3  | Guru: salah password 30 kali (username apa saja) dari satu jaringan | Ditahan sampai 15 menit; login guru dari jaringan lain dan login siswa tetap bisa | [ ] |
| U12.4  | Angka batas | Semua ada di objek `BATAS` di `server/batas.js` | [ ] |
| U12.5  | `npx wrangler d1 migrations list coding-island-db --local` | `0003_indeks.sql` sudah ✅ | [ ] |
| U12.6  | Siswa dengan hash PIN lama (100000 iterasi) masuk | Berhasil; setelahnya kolom `pin_hash` diawali `pbkdf2$sha256$10000$` | [ ] |
| U12.7  | Di level, klik **Jalankan** berkali-kali dengan cepat | Robot jalan sekali; DevTools → Network hanya satu permintaan `/percobaan`; koin bertambah sekali | [ ] |
| U12.8  | Selesaikan level, lalu klik **Ulang** dan langsung **Jalankan** | Tombol Jalankan tetap mati sampai hasil sebelumnya tersimpan | [ ] |
| U12.9  | Toko Clue: klik **Beli** Clue 1 berkali-kali dengan cepat | Koin terpotong sekali; aktivitas "Membeli Clue 1" tercatat sekali | [ ] |
| U12.10 | DevTools → Network → blokir `cdn.tailwindcss.com`, `esm.sh`, `fonts.googleapis.com`, `fonts.gstatic.com`, lalu buka beranda, level, dashboard | Tampilan sama persis; editor berwarna (CodeMirror, bukan kotak teks polos); font judul Baloo 2; tidak ada permintaan ke domain luar | [ ] |
| U12.11 | Network → klik `app.css`, `tailwind.css`, satu gambar, satu font | JS/CSS: `cache-control: no-cache`; gambar & font: `max-age=604800` | [ ] |
| U12.12 | Network → **Offline**, lalu buka halaman Profil | Toast "Internet sedang lambat, coba lagi ya." (bukan layar putih atau pesan teknis) | [ ] |
| U12.13 | Guru: impor CSV berisi 12 siswa | Semua akun terbuat (dikirim per 4 baris); PIN tampil untuk semua | [ ] |
| U12.14 | Buka `/package.json`, `/node_modules/`, `/src/tailwind.css`, `/migrations/0003_indeks.sql` | `404` | [ ] |
| U12.15 | Staging: `npx wrangler deploy --env staging` (README 4g) | Situs `codingisland-staging…workers.dev` terbuka dengan database kosong terpisah | [ ] |
| U12.16 | Dashboard Cloudflare → Worker **codingisland** → **Observability** saat kelas memakai | Waktu CPU per permintaan terlihat; tidak ada error 1102 | [ ] |

## Ringkasan hasil

| Tahap   | Jumlah butir | Lulus | Gagal | Catatan |
| ------- | ------------ | ----- | ----- | ------- |
| Tahap 1 | 7            |       |       |         |
| Tahap 2 | 17           |       |       |         |
| Tahap 3 | 13           |       |       |         |
| Tahap 4 | 11           |       |       |         |
| Tahap 5 | 22           |       |       |         |
| Tahap 6 | 19           |       |       |         |
| Tahap 7 | 27           |       |       |         |
| Tahap 8 | 26           |       |       |         |
| Tahap 9 | 20           |       |       |         |
| Tahap 11 | 15          |       |       |         |
| Tahap 12 | 16          |       |       |         |

Diuji oleh: \***\*\_\_\_\_\*\*** Tanggal: \***\*\_\_\_\_\*\*** Browser/perangkat: \***\*\_\_\_\_\*\***
