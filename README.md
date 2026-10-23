# Coding Island

**Coding Island** adalah game edukasi berbasis web untuk siswa SD kelas 3–6. Siswa belajar mengetik kode dan logika sederhana dengan mini-bahasa berbahasa Indonesia (`maju()`, `belok_kanan()`, `ulangi 3 { }`, `jika ada_jurang() { }`, dan lainnya) untuk menggerakkan **Robot Tutor** sambil menjelajahi 4 pulau:

| Pulau | Konsep | Level |
|---|---|---|
| Pantai | Urutan perintah | 4 (termasuk 1 debug dan 1 boss) |
| Laut | Perulangan (`ulangi`) | 3 |
| Gurun | Lompat dan kondisi (`jika … lainnya`) | 3 |
| Pegunungan Salju | `selama`, `bukan`, dan variabel (`buat`) | 3 |

Fitur utama:
- **Siswa:** mendaftar sendiri dengan kode kelas, peta pulau, level ketik/debug/boss, bintang dan koin, toko clue, piala dan berlian, profil, sertifikat juara, dan halaman bantuan.
- **Guru:** dashboard dengan ringkasan, kelas, siswa (termasuk impor CSV), level dan soal (editor dunia), nilai 1–100 (ekspor CSV dan cetak), serta aktivitas.
- **Admin:** semua fitur guru ditambah kelola akun guru dan pengaturan permainan.
- **Teknis:** tampilan statis tanpa proses build (HTML, CSS, JavaScript ES module) dan hash router. Data disimpan di **Cloudflare D1** lewat API **Cloudflare Pages Functions** (`functions/api`). Kode siswa dijalankan interpreter buatan sendiri di Web Worker (tanpa `eval`), lalu dijalankan ulang di server untuk menghitung nilai.

Dokumen lain: [UJI-COBA.md](UJI-COBA.md) (daftar uji Tahap 1–10B) dan [REVISI.md](REVISI.md) (catatan revisi).

---

## 1. Akun demo

Data contoh diisi ke database oleh `schema.sql` (bagian 3). Akun demo tampil di halaman masuk dan bisa diisi dengan tombol **Pakai** selama variabel `TAMPILKAN_AKUN_DEMO` bernilai `"1"`.

| Peran | Username | Password / PIN |
|---|---|---|
| Admin | `admin` | `admin123` |
| Guru (Kelas 3A, 4A) | `bu.sari` | `guru123` |
| Guru (Kelas 5A, 6A) | `pak.budi` | `guru123` |
| Siswa | `andi3`, `aisyah3`, `dimas4`, `zahra4`, `farhan5`, `salsa5`, `naufal6`, `aurel6`, dan lainnya (5 per kelas) | PIN `1234` |

- Kode kelas untuk pendaftaran siswa: `PULAU3`, `PULAU4`, `PULAU5`, `PULAU6` (huruf besar/kecil tidak berpengaruh).
- Untuk mengembalikan semua data ke awal, jalankan ulang `schema.sql` (bagian 3, langkah 3). Tombol **Reset data demo** di aplikasi hanya menampilkan pesan, karena di versi server reset dilakukan admin.

> Semua data (akun, progres, nilai) sekarang tersimpan di **database D1**, jadi siswa yang bermain di komputer mana pun langsung terlihat di dashboard guru. Yang masih disimpan di browser hanya draf kode yang sedang diketik dan preferensi tampilan.

---

## 2. Menjalankan secara lokal (wrangler pages dev)

Versi ini memakai API di folder `functions/api` dan database D1, jadi harus dijalankan dengan **Wrangler** (alat resmi Cloudflare). Server statis biasa seperti `python -m http.server` atau Live Server hanya menampilkan tampilan; masuk dan daftar akan gagal karena `/api` tidak ada.

Butuh **Node.js 20 atau lebih baru**. Semua perintah dijalankan dari folder proyek.

1. **Isi database lokal** (sekali, dan setiap kali ingin mengembalikan data ke awal):
   ```bash
   npx wrangler d1 execute coding-island-db --local --file=schema.sql
   ```
   Database lokal disimpan di folder `.wrangler/` dan tidak perlu `database_id` asli.
2. **Jalankan server lokal:**
   ```bash
   npx wrangler pages dev .
   ```
3. Buka **`http://127.0.0.1:8788`** (atau `http://localhost:8788`).

Catatan:
- Wrangler otomatis membaca `wrangler.toml` (binding `DB`) dan `.dev.vars` (`MODE_DEV=1`, jadi panel Dev bisa mengubah progres saat uji lokal).
- Buka lewat `127.0.0.1` atau `localhost`, **bukan** alamat jaringan seperti `http://192.168.x.x`. Cookie sesi bertanda `Secure`, dan browser hanya menerimanya di `https` atau `localhost`.
- Perlu internet untuk Google Fonts, Tailwind CDN, CodeMirror (esm.sh), dan confetti.
- Setelah kode diubah, tekan **Ctrl + F5**. Perubahan di `functions/` atau `server/` dimuat ulang otomatis oleh Wrangler.
- Jika `npx wrangler` meminta izin memasang paket, jawab `y`.

---

## 3. Deploy ke Cloudflare Pages + D1

Tampilan tetap situs statis tanpa build command. Bedanya, sekarang ada **Pages Functions** (`functions/api`) dan **database D1**, jadi deploy harus lewat **Wrangler** (atau Git). Cara **Upload assets** di dashboard tidak mendukung Functions.

### 3a. Langkah pertama kali

1. **Masuk ke akun Cloudflare:**
   ```bash
   npx wrangler login
   ```
2. **Buat database D1:**
   ```bash
   npx wrangler d1 create coding-island-db
   ```
   Salin `database_id` dari hasilnya ke `wrangler.toml`, menggantikan `GANTI-DENGAN-ID-DATABASE-D1`.
3. **Buat tabel dan isi data awal** di database Cloudflare:
   ```bash
   npx wrangler d1 execute coding-island-db --remote --file=schema.sql
   ```
   > **Hati-hati:** `schema.sql` menghapus semua tabel lalu membuatnya ulang. Jalankan dengan `--remote` hanya saat pertama kali atau jika memang ingin mengembalikan data ke contoh awal.
4. **Deploy situs dan API:**
   ```bash
   npx wrangler pages deploy
   ```
   Saat pertama kali, Wrangler menawarkan membuat proyek `coding-island`. Pilih production branch `main`. Situs tersedia di `https://coding-island.pages.dev`.
5. **Periksa binding `DB` di pengaturan proyek Pages:**
   1. Buka [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → proyek **coding-island**.
   2. Buka **Settings** → **Bindings**.
   3. Pastikan ada binding **D1 database** dengan **Variable name** `DB` yang mengarah ke `coding-island-db`.
   4. Jika belum ada (misalnya proyek dibuat lewat Git tanpa `wrangler.toml`), klik **Add** → **D1 database** → isi Variable name `DB`, pilih database `coding-island-db` → **Save**. Lakukan untuk **Production** dan **Preview**, lalu deploy ulang agar binding dipakai.

   Karena proyek ini punya `wrangler.toml`, binding dan variabel di file itu menjadi acuan. Dashboard hanya menampilkannya, dan perubahan dilakukan di `wrangler.toml` lalu deploy ulang.

### 3b. Variabel lingkungan

Diatur di bagian `[vars]` pada `wrangler.toml`:

| Variabel | Nilai | Arti |
|---|---|---|
| `TAMPILKAN_AKUN_DEMO` | `"1"` / `"0"` | Tampilkan daftar akun contoh di halaman masuk. Ubah ke `"0"` untuk pemakaian sungguhan. |
| `MODE_DEV` | `"0"` / `"1"` | Izinkan panel Dev mengubah progres. Biarkan `"0"` di Cloudflare. |
| `ITERASI_PBKDF2` | `"100000"` | Jumlah iterasi hash PBKDF2 untuk PIN/password baru (maksimal 100000 di Cloudflare). |

### 3c. Memperbarui situs

- Kode berubah: `npx wrangler pages deploy`.
- Data contoh atau struktur tabel berubah: `node scripts/buat-schema.mjs` membuat ulang `schema.sql`, lalu jalankan langkah 3a nomor 3 (data lama akan terhapus).
- Cadangan data: `npx wrangler d1 export coding-island-db --remote --output=cadangan.sql`.

### 3d. Keamanan yang dikerjakan server

- PIN dan password di-hash dengan **PBKDF2-SHA256** (Web Crypto, salt acak, 100.000 iterasi). Hash tidak pernah dikirim ke browser.
- Sesi disimpan di cookie `ci_sesi` yang **HttpOnly, Secure, SameSite=Lax** (berlaku 8 jam). Di database hanya disimpan hash token sesinya.
- **Batas percobaan login:** 5 kali salah untuk satu username menahan login username itu selama 1 menit, dan 50 kali salah dari satu alamat IP menahan alamat itu.
- Setiap endpoint guru memeriksa **peran** (guru/admin) dan **kelas yang diampu**. Guru tidak bisa membaca atau mengubah siswa, nilai, atau aktivitas kelas lain.
- Saat siswa menekan **Jalankan**, server menjalankan ulang kode dengan interpreter yang sama, lalu menghitung sendiri bintang, nilai, koin, dan berlian. Kunci jawaban (solusi) tidak dikirim ke siswa, dan teks clue baru dikirim setelah dibeli.
- Perubahan data wajib berformat JSON (perlindungan CSRF ringan), dan `_redirects` menyembunyikan berkas server seperti `server/`, `schema.sql`, dan `wrangler.toml`.

### 3e. Setelah deploy

- **Domain berbeda:** jika domain bukan `coding-island.pages.dev`, ganti alamat pada `og:url` dan `og:image` di `index.html`.
- **Cache 1 hari:** pengunjung lama bisa masih memakai JS lama sampai 1 hari setelah pembaruan. Minta mereka menekan Ctrl + F5, atau perpendek `max-age` di `_headers` selama masa pengembangan.
- **Uji di HP:** buka alamat `https://…pages.dev` di HP.

---

## 4. Catatan Tailwind CSS

`index.html` memuat **Tailwind lewat CDN** (`cdn.tailwindcss.com`) beserta konfigurasi warna di dalam tag `<script>`. Cara ini **hanya untuk demo**: ukurannya besar, CSS dibuat di browser setiap kali halaman dibuka, dan Console menampilkan peringatan "should not be used in production".

Untuk versi produksi, buat CSS Tailwind sekali dengan **Tailwind CLI**:

1. Buat `tailwind.config.js` di root. Isi `theme.extend`-nya disalin dari konfigurasi di `index.html`, lalu tambahkan:
   ```js
   module.exports = {
     content: ['./index.html', './js/**/*.js'],
     theme: { extend: { /* salin colors & fontFamily dari index.html */ } }
   };
   ```
2. Buat `src/tailwind.css` berisi:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```
3. Jalankan:
   ```bash
   npx tailwindcss@3 -i src/tailwind.css -o css/tailwind.css --minify
   ```
4. Di `index.html`, hapus `<script src="https://cdn.tailwindcss.com/…">` dan blok `tailwind.config = {…}`, lalu tambahkan `<link rel="stylesheet" href="css/tailwind.css">` **sebelum** `css/app.css`.
5. Ulangi langkah 3 setiap kali ada kelas Tailwind baru di HTML atau JS.

---

## 5. Fitur pengembang (tersembunyi)

Fitur pengembang tidak terlihat oleh pengguna biasa dan hanya aktif jika alamat mengandung `?dev=1`, misalnya `http://127.0.0.1:8788/?dev=1#/peta`.

| Alat | Cara pakai |
|---|---|
| Panel Dev | Tombol oranye **Dev** di pojok kiri bawah: selesaikan level, tuntaskan pulau, reset progres, validasi semua level, tautan ke Uji Interpreter (masuk sebagai siswa dulu) |
| `ciDev` di Console | `ciDev.selesaikanLevel('pantai-4', 3)`, `ciDev.tuntaskanPulau('pantai')`, `ciDev.resetProgres()`, `ciDev.validasiLevel()`, `ciDev.bantuan()` |
| Uji Interpreter | `/?dev=1#/uji-interpreter`: coba kode di dunia contoh, atau klik **Jalankan semua tes** (22 kasus) |

Alat yang **mengubah progres** (selesaikan level, tuntaskan pulau, reset progres) hanya diterima server jika variabel `MODE_DEV` bernilai `"1"`. Nilainya `"1"` saat uji lokal (berkas `.dev.vars`) dan `"0"` di Cloudflare (`wrangler.toml`), jadi siswa yang tahu `?dev=1` tetap tidak bisa mengubah progresnya di server sungguhan. Uji Interpreter tetap bisa dipakai karena hanya menjalankan kode di browser.

---

## 6. Struktur folder

```
coding_island/
├── index.html          Halaman tunggal: meta & ikon, font, Tailwind CDN, memuat js/main.js
├── _headers            Header cache & keamanan untuk Cloudflare Pages
├── _redirects          Menyembunyikan berkas khusus server (server/, scripts/, schema.sql, ...)
├── wrangler.toml       Konfigurasi Pages + binding D1 "DB" + variabel lingkungan
├── .dev.vars           Variabel khusus uji lokal (MODE_DEV=1), tidak ikut di-deploy
├── schema.sql          Tabel D1 + data awal (DIBUAT oleh scripts/buat-schema.mjs)
├── scripts/
│   └── buat-schema.mjs Membuat ulang schema.sql dari data contoh (node scripts/buat-schema.mjs)
├── functions/api/      API Pages Functions, satu file per sumber daya:
│   ├── auth/           sesi, masuk/keluar, daftar, batas login, akun sendiri, kelola guru, pengaturan
│   ├── kelas/          kelas publik, cek kode, kelola kelas
│   ├── siswa/          data siswa sendiri, kelola siswa, impor CSV, catatan, reset PIN
│   ├── level/          level terbit (tanpa solusi), editor & urutan level guru
│   ├── progres/        progres, jalankan (dinilai ulang di server), beli clue, juara
│   ├── nilai/          matriks nilai, timpa nilai
│   └── aktivitas/      log aktivitas, data Ringkasan dashboard
├── server/             Modul bersama API: http (router, galat), kripto (PBKDF2, token),
│                       sesi (cookie, peran, kelas yang diampu), data (kueri D1), statistik
├── css/app.css         Token warna, komponen, panggung, dashboard, gaya cetak, animasi
├── image/              Aset: background/, robot/, item/, profile/, favicon-32.png,
│                       apple-touch-icon.png (180 px), og-image.jpg (1200×630)
└── js/
    ├── main.js         Daftar rute, penjaga rute, penangkap error global
    ├── router.js       Hash router dengan parameter (#/level/:id) dan penjaga rute
    ├── ui.js           Tombol, kartu, modal, toast, loader, form modal, PIN, unduh berkas
    ├── store.js        SATU-SATUNYA pintu data: fetch() ke /api (nama fungsi sama dengan versi demo)
    ├── store-lokal.js  Versi demo localStorage, disimpan sebagai acuan (tidak dipakai aplikasi)
    ├── dev.js          Panel Dev & ciDev (hanya dengan ?dev=1)
    ├── data/           zona.js (4 pulau), levels.js (13 level bawaan)
    ├── game/           interpreter, worker, runner, editor (CodeMirror), panggung, kemajuan,
    │                   jalur peta, skor, validasi level, ikon SVG, efek
    ├── pages/          Halaman siswa & umum (beranda, daftar, masuk, peta, level, profil, juara, bantuan)
    └── guru/           Dashboard guru (ringkasan, kelas, siswa, level & soal, nilai, aktivitas, guru, pengaturan)
```

Aturan teknis yang dipegang:
- **Tanpa proses build:** HTML, CSS, dan JavaScript murni (ES module).
- **Satu pintu data:** semua akses data hanya lewat `js/store.js`, yang memanggil `/api`. Server memeriksa sesi, peran, dan kelas yang diampu guru di setiap endpoint.
- **Kode siswa** dijalankan interpreter buatan sendiri di Web Worker, dibatasi 1000 langkah dan 2 detik.
- **Gambar tambahan** (gembok, rintangan, bendera, bug, jurang) dibuat dengan SVG/CSS; tidak ada gambar dari internet.
- **Ukuran gambar:** keempat background sudah dikompres ke 121–175 KB (sebelumnya 580–715 KB) dengan nama file tetap.
- **Aksesibilitas & ketahanan:** fokus keyboard terlihat, modal mengunci fokus, animasi mati saat *prefers-reduced-motion*, dan error tak terduga ditampilkan sebagai toast robot kaget.

---

## 7. Langkah berikutnya

- **Tailwind CLI:** ganti Tailwind CDN dengan CSS hasil build (bagian 4).
- **Pemakaian sungguhan:** setelah data asli sekolah dimasukkan, ubah `TAMPILKAN_AKUN_DEMO` menjadi `"0"` lalu ganti password `admin` (menu **Pengaturan**) dan hapus akun/kelas contoh lewat dashboard.
- **Cadangan data:** ekspor database secara berkala dengan `npx wrangler d1 export coding-island-db --remote --output=cadangan.sql`.
