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
- **Teknis:** tampilan statis tanpa proses build (HTML, CSS, JavaScript ES module) dan hash router. Berjalan sebagai **Cloudflare Worker** (`worker.js`) dengan API di `functions/api` dan data di **Cloudflare D1**. Kode siswa dijalankan interpreter buatan sendiri di Web Worker (tanpa `eval`), lalu dijalankan ulang di server untuk menghitung nilai.

Dokumen lain: [UJI-COBA.md](UJI-COBA.md) (daftar uji Tahap 1–11) dan [REVISI.md](REVISI.md) (catatan revisi).

---

## 1. Pemasangan pertama

Coding Island tidak punya akun bawaan. Saat database masih kosong, yang dibuat otomatis hanya struktur tabel, pengaturan bawaan (harga clue 5/10/20, koin awal 20), dan 13 level bawaan. Akun admin pertama dibuat sekali lewat halaman **`#/pasang`**.

1. **Atur kode pemasangan** (sekali, dari folder proyek). Kode ini rahasia, jangan ditulis di kode atau `wrangler.toml`:
   ```bash
   npx wrangler secret put KODE_PASANG
   ```
   Ketik kode yang sulit ditebak (misalnya 16 karakter acak) saat diminta.
2. Buka `https://codingisland.ndiksptr159.workers.dev/#/guru/masuk`. Selama belum ada akun guru, muncul tautan **Pasang sekarang**.
3. Di halaman **Pemasangan**, isi kode pemasangan, nama admin, username, dan password (minimal 8 karakter, diulang sekali).
4. Klik **Pasang & Masuk**. Akun admin dibuat dan Anda langsung masuk ke dashboard.

Setelah admin pertama dibuat, halaman `#/pasang` dan endpoint-nya **menolak permanen** dengan pesan "Coding Island sudah terpasang". Kode pemasangan yang salah dibatasi 30 kali per 15 menit per alamat IP.

> Semua data (akun, progres, nilai) tersimpan di **database D1**, jadi siswa yang bermain di komputer mana pun langsung terlihat di dashboard guru. Yang disimpan di browser hanya draf kode yang sedang diketik dan preferensi tampilan.

---

## 2. Memulai tahun ajaran

Masuk sebagai admin di `#/guru/masuk`, lalu:

1. **Buat kelas:** menu **Kelas** → **Tambah kelas**. Isi nama (misalnya `Kelas 3A`) dan tingkat. Kode kelas 6 karakter dibuat otomatis, dan admin bisa memilih guru pengampunya di sini.
2. **Buat akun guru:** menu **Guru** → **Tambah guru**. Isi nama, username, password awal, peran (`guru` atau `admin`), dan kelas yang diampu. Berikan username dan password awal kepada guru, lalu minta guru menggantinya di **Pengaturan** → **Ganti password**.
3. **Bagikan kode kelas ke siswa:** menu **Kelas** menampilkan kode setiap kelas. Siswa membuka situs → **Daftar**, memilih kelasnya, lalu mengetik kode kelas tersebut. Guru juga bisa menambahkan siswa satu per satu atau lewat **Impor CSV** di menu **Siswa** (PIN acak tampil sekali untuk dicatat).
4. Jika kode kelas tersebar ke luar kelas, klik **Buat kode baru** di menu **Kelas**. Siswa yang sudah terdaftar tidak terpengaruh.
5. **Tahun ajaran berikutnya:** pindahkan siswa ke kelas baru lewat **Siswa** → detail siswa → **Pindah kelas**, atau buat kelas baru lalu hapus kelas lama setelah kosong.

---

## 3. Menjalankan secara lokal (wrangler dev)

Aplikasi ini adalah **Cloudflare Worker** yang melayani berkas statis sekaligus API (`/api`) dengan database **D1**. Untuk menjalankannya di komputer sendiri dipakai **Wrangler**. Server statis biasa seperti `python -m http.server` atau Live Server hanya menampilkan tampilan, sehingga masuk dan daftar akan gagal.

Butuh **Node.js 20 atau lebih baru**. Dari folder proyek:

0. **Pasang alat** (sekali, dan setiap `package.json` berubah):
   ```bash
   npm install
   ```
   Ini memasang Wrangler (versi dipin), Tailwind CLI, esbuild, CodeMirror, canvas-confetti, dan font.
1. **Siapkan variabel lokal** (sekali):
   ```bash
   cp .dev.vars.example .dev.vars
   ```
   Lalu isi `KODE_PASANG` di `.dev.vars` dengan kode bebas untuk uji lokal. File `.dev.vars` tidak ikut git dan tidak ikut deploy.
2. **Siapkan database lokal** dengan migrasi:
   ```bash
   npx wrangler d1 migrations apply coding-island-db --local
   ```
3. **Jalankan:**
   ```bash
   npx wrangler dev
   ```
4. Buka **`http://localhost:8787`**, lalu pasang admin lokal di `http://localhost:8787/#/pasang` dengan kode dari `.dev.vars`.

Catatan:
- Untuk mengulang dari database kosong, hentikan server, hapus folder `.wrangler`, lalu ulangi langkah 2. Jika langkah 2 terlewat, worker tetap mengisi struktur, pengaturan, dan level bawaan secara otomatis.
- `.dev.vars` berisi `MODE_DEV = "1"`, jadi alat pengembang aktif saat uji lokal (bagian 6).
- Buka lewat `localhost` atau `127.0.0.1`, **bukan** alamat jaringan seperti `http://192.168.x.x`. Cookie sesi bertanda `Secure`, dan browser hanya menerimanya di `https` atau `localhost`.
- Tidak perlu internet untuk tampilan: Tailwind, CodeMirror, confetti, dan font semuanya berkas lokal (bagian 5).
- JS dan CSS dikirim dengan `Cache-Control: no-cache`, jadi cukup muat ulang biasa setelah kode diubah.

---

## 4. Deploy ke Cloudflare (Workers + D1)

Repositori GitHub `ndiksptr/codingisland` terhubung ke Cloudflare Workers. Setiap **push ke branch `main`** menjalankan `npx wrangler deploy` secara otomatis. Situs: `https://codingisland.ndiksptr159.workers.dev`.

### 4a. Pengaturan di dashboard Cloudflare (sekali saja)

Buka [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → Worker **codingisland** → **Settings** → **Build**:

| Isian | Nilai |
|---|---|
| Build command | *(kosongkan)* |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

- Cloudflare otomatis menjalankan `npm install` karena ada `package.json`, lalu `npx wrangler deploy` memakai Wrangler versi yang dipin. Tidak ada build: `css/tailwind.css`, `js/vendor/`, dan `fonts/` sudah di-commit.
- Peringatan "Multiple environments are defined" saat deploy wajar (ada lingkungan staging); tanpa `--env`, yang di-deploy adalah produksi.
- **Nama Worker** harus sama dengan `name` di `wrangler.toml` (`codingisland`).
- **Binding:** **Settings** → **Bindings** harus berisi **D1 database** `DB` → `coding-island-db`. Binding diatur dari `wrangler.toml`; perubahan di dashboard akan tertimpa saat deploy berikutnya.
- **Pemantauan:** `[observability] enabled = true`, jadi log, error, dan **waktu CPU** per permintaan terlihat di Worker **codingisland** → **Observability**. Paket Workers Free membatasi CPU ±10 ms per permintaan; error 1102 di sana berarti batas itu terlampaui.

### 4b. Migrasi database

Struktur database dikelola dengan **migrasi bernomor** di folder `migrations/`. Setiap migrasi hanya dijalankan sekali; Wrangler mencatat yang sudah dijalankan di tabel `d1_migrations`.

| Migrasi | Isi |
|---|---|
| `0001_struktur_awal.sql` | Patokan struktur yang sudah ada + pengaturan & 13 level bawaan. Aman untuk database berisi data (`IF NOT EXISTS`, `INSERT OR IGNORE`). |
| `0002_hapus_data_demo.sql` | Menghapus data contoh dari masa demo. Hanya bekerja bila jejak data contoh masih ada; database baru tidak tersentuh. |
| `0003_indeks.sql` | Indeks untuk pembersihan sesi/batas login, filter aktivitas, dan nilai per kelas. Tidak mengubah data. |

Perintah untuk database online, dijalankan **sebelum** atau **tepat setelah** push yang membawa migrasi baru:

```bash
# 1. cadangan dulu (wajib sebelum migrasi yang menghapus atau mengubah data)
npx wrangler d1 export coding-island-db --remote --output=cadangan-sebelum-live.sql

# 2. lihat migrasi yang belum dijalankan
npx wrangler d1 migrations list coding-island-db --remote

# 3. jalankan
npx wrangler d1 migrations apply coding-island-db --remote
```

Aturan menambah migrasi: buat berkas bernomor berikutnya (`0004_...sql`), jangan pernah mengubah migrasi yang sudah dijalankan, dan jangan menghapus tabel yang berisi data sungguhan. Setelah menambah migrasi, jalankan `node scripts/buat-schema.mjs` agar `schema.sql` dan `server/skema.js` ikut diperbarui.

### 4c. Variabel dan rahasia

| Nama | Tempat | Arti |
|---|---|---|
| `ITERASI_PBKDF2` | `[vars]` di `wrangler.toml` | Iterasi hash PBKDF2 untuk PIN/password baru. Bawaan `10000` (±1,5 ms CPU; 100000 butuh ±14 ms, melebihi batas paket gratis). Hash lama otomatis di-hash ulang saat login berhasil. |
| `KODE_PASANG` | rahasia: `npx wrangler secret put KODE_PASANG` | Kode untuk halaman `#/pasang`. Boleh dihapus setelah terpasang: `npx wrangler secret delete KODE_PASANG`. |
| `MODE_DEV` | hanya `.dev.vars` (lokal) | `"1"` menyalakan alat pengembang. Tidak pernah ada di server online. |

Rahasia tidak pernah ditulis di kode, `wrangler.toml`, atau git.

### 4d. Data

- **Cadangan berkala:** `npx wrangler d1 export coding-island-db --remote --output=cadangan-YYYY-MM-DD.sql` (berkas `cadangan*.sql` diabaikan git).
- **Data bawaan diubah** (misalnya level di `js/data/levels.js`): perubahan untuk database yang sudah ada ditulis sebagai migrasi baru. `node scripts/buat-schema.mjs --tulis-ulang` hanya untuk proyek yang belum pernah dijalankan di server.

### 4e. Keamanan yang dikerjakan server

- PIN dan password di-hash dengan **PBKDF2-SHA256** (Web Crypto, salt acak). Hash tidak pernah dikirim ke browser.
- Sesi disimpan di cookie `ci_sesi` yang **HttpOnly, Secure, SameSite=Lax** (berlaku 8 jam). Di database hanya disimpan hash token sesinya.
- **Batas percobaan** (semua angka di `BATAS`, `server/batas.js`):

  | Batas | Angka | Akibat |
  |---|---|---|
  | Per username | 5 kali salah | username itu ditahan 1 menit |
  | Per IP, login siswa | 300 kali salah / 15 menit | login siswa dari IP itu ditahan sampai jendela habis |
  | Per IP, login guru | 30 kali salah / 15 menit | login guru dari IP itu ditahan |
  | Per IP, `#/pasang` | 30 kali salah / 15 menit | pemasangan dari IP itu ditahan |

  Batas siswa per IP dibuat longgar karena satu kelas (bahkan satu sekolah) berbagi satu IP Wi-Fi. Baris batas lama dan sesi kedaluwarsa dihapus otomatis saat ada login.
- **Pemasangan:** kode pemasangan dibandingkan dengan waktu konstan dan hanya bisa dipakai selama tabel guru kosong.
- **Klik ganda / permintaan bersamaan:** koin, berlian, bintang, piala, dan pembelian clue dihitung di dalam satu transaksi D1 dari isi database saat itu, jadi dua permintaan yang sama tidak memberi koin dobel atau memotong koin dua kali. Tombol **Jalankan** dan **Beli Clue** juga mati selama permintaan berjalan.
- Setiap endpoint guru memeriksa **peran** (guru/admin) dan **kelas yang diampu**.
- Saat siswa menekan **Jalankan**, server menjalankan ulang kode dan menghitung sendiri bintang, nilai, koin, dan berlian. Kunci jawaban tidak dikirim ke siswa, dan teks clue baru dikirim setelah dibeli.
- Perubahan data wajib berformat JSON (perlindungan CSRF ringan). Berkas khusus server (`server/`, `functions/`, `migrations/`, `worker.js`, `schema.sql`, `wrangler.toml`, dokumen `.md`) tidak ikut diunggah sebagai berkas statis (lihat `.assetsignore`).

### 4f. Setelah deploy

- **Domain berbeda:** ganti alamat pada `og:url` dan `og:image` di `index.html`.
- **Cache:** JS dan CSS `no-cache` (browser memeriksa ulang, pembaruan langsung terasa), gambar dan font disimpan 7 hari. Lihat `_headers`.
- **Jaringan sekolah lambat:** `js/store.js` mencoba ulang sekali permintaan baca (GET) yang gagal, lalu menampilkan "Internet sedang lambat, coba lagi ya." untuk jaringan putus, server sibuk (503), atau batas CPU.

### 4g. Lingkungan staging (untuk pengujian)

Staging adalah Worker **terpisah** (`codingisland-staging`) dengan database D1 **terpisah** (`coding-island-db-staging`). Pakai ini untuk mencoba perubahan sebelum dipakai siswa. **Data siswa sungguhan tidak boleh pernah disalin atau dipakai di staging**; buat akun uji sendiri.

Sekali saja:

```bash
npx wrangler d1 create coding-island-db-staging
# salin database_id dari hasilnya ke [[env.staging.d1_databases]] di wrangler.toml (ganti ISI-DATABASE-ID-STAGING)
npx wrangler d1 migrations apply coding-island-db-staging --env staging --remote
npx wrangler secret put KODE_PASANG --env staging
```

Setiap kali ingin menguji:

```bash
npx wrangler deploy --env staging
```

Situs staging: `https://codingisland-staging.ndiksptr159.workers.dev`. Pasang admin uji di `#/pasang` dengan kode staging.

---

## 5. Aset lokal tanpa CDN (Tailwind, CodeMirror, confetti, font)

Supaya tidak rusak oleh filter internet sekolah, semua aset dilayani dari Worker sendiri. Hasil build **di-commit** karena deploy tidak menjalankan build.

| Hasil (di-commit) | Sumber | Perintah |
|---|---|---|
| `css/tailwind.css` | `src/tailwind.css` + `tailwind.config.cjs` (warna & font sama dengan versi CDN dulu) | `npm run build:css` |
| `js/vendor/codemirror.js` | `src/vendor/codemirror.js` (CodeMirror 6, versi dipin di `package.json`) | `npm run build:vendor` |
| `js/vendor/confetti.js` | `src/vendor/confetti.js` (canvas-confetti 1.9.3) | `npm run build:vendor` |
| `fonts/*.woff2` + `fonts/LICENSE-OFL.txt` | paket `@fontsource-variable` (Baloo 2, Nunito, JetBrains Mono; lisensi OFL) | `npm run build:vendor` |

- **Wajib** menjalankan `npm run build:css` lalu commit `css/tailwind.css` setiap kali menulis kelas Tailwind baru di HTML/JS. Tanpa itu, kelas baru tidak punya gaya.
- `css/tailwind.css` sengaja dimuat **setelah** `css/app.css` agar urutan gaya sama dengan Tailwind CDN dulu (tampilan terbukti identik lewat perbandingan tangkapan layar).
- `@font-face` ada di awal `css/app.css`; font utama di-*preload* di `index.html`.

---

## 6. Fitur pengembang (hanya uji lokal)

Alat pengembang **tidak pernah dimuat di situs online**. Browser menanyakan `/api/auth/sesi`; hanya bila server menjawab `modeDev: true` (variabel `MODE_DEV = "1"`, yang hanya ada di `.dev.vars`), `js/dev.js` diimpor. Endpoint yang mengubah progres juga menolak bila `MODE_DEV` bukan `"1"`.

| Alat | Cara pakai (di `http://localhost:8787`) |
|---|---|
| Panel Dev | Tombol oranye **Dev** di pojok kiri bawah: selesaikan level, tuntaskan pulau, reset progres, validasi semua level, tautan ke Uji Interpreter (masuk sebagai siswa dulu) |
| `ciDev` di Console | `ciDev.selesaikanLevel('pantai-4', 3)`, `ciDev.tuntaskanPulau('pantai')`, `ciDev.resetProgres()`, `ciDev.validasiLevel()`, `ciDev.bantuan()` |
| Uji Interpreter | `#/uji-interpreter`: coba kode di dunia contoh, atau klik **Jalankan semua tes** (22 kasus). Di situs online rute ini tidak ada (404). |

---

## 7. Struktur folder

```
coding_island/
├── index.html          Halaman tunggal: meta & ikon, CSS lokal, memuat js/main.js
├── _headers            Header cache & keamanan untuk berkas statis
├── .assetsignore       Berkas yang tidak diunggah sebagai berkas statis (server/, functions/, migrations/, ...)
├── worker.js           Pintu masuk Worker: /api/* ke functions/api, selainnya berkas statis
├── wrangler.toml       Konfigurasi Worker + binding D1 "DB" + observability + staging (tanpa rahasia)
├── package.json        Alat build (devDependencies) & skrip build:css, build:vendor
├── tailwind.config.cjs Warna & font Tailwind; src/ berisi masukan build (tidak diunggah)
├── .dev.vars.example   Contoh variabel uji lokal; salin menjadi .dev.vars (tidak ikut git)
├── migrations/         Migrasi D1 bernomor: 0001_struktur_awal, 0002_hapus_data_demo, 0003_indeks
├── schema.sql          Struktur lengkap gabungan migrasi (DIBUAT oleh scripts/buat-schema.mjs)
├── scripts/
│   ├── buat-schema.mjs Membuat 0001 (bila belum ada), schema.sql, dan server/skema.js
│   └── build-vendor.mjs Bundel CodeMirror & confetti (esbuild) dan salin font
├── functions/api/      API, satu file per sumber daya:
│   ├── auth/           sesi, pemasangan pertama, masuk/keluar, daftar, batas login, akun sendiri,
│   │                   kelola guru, pengaturan
│   ├── kelas/          kelas publik, cek kode, kelola kelas
│   ├── siswa/          data siswa sendiri, kelola siswa, impor CSV, catatan, reset PIN
│   ├── level/          level terbit (tanpa solusi), editor & urutan level guru
│   ├── progres/        progres, jalankan (dinilai ulang di server), beli clue, juara
│   ├── nilai/          matriks nilai, timpa nilai
│   └── aktivitas/      log aktivitas, data Ringkasan dashboard
├── server/             Modul bersama API: http (router, galat), kripto (PBKDF2, token, perbandingan
│                       waktu-konstan), sesi (cookie, peran, kelas yang diampu), data (kueri D1),
│                       batas (batas percobaan berjendela), statistik, siapkan-db (isi database kosong),
│                       skema (SQL gabungan migrasi, dibuat otomatis)
├── css/app.css         @font-face, token warna, komponen, panggung, dashboard, gaya cetak, animasi
├── css/tailwind.css    Hasil Tailwind CLI (npm run build:css)
├── fonts/              Baloo 2, Nunito, JetBrains Mono (woff2) + LICENSE-OFL.txt
├── image/              Aset: background/, robot/, item/, profile/, favicon-32.png,
│                       apple-touch-icon.png (180 px), og-image.jpg (1200×630)
└── js/
    ├── main.js         Daftar rute, penjaga rute, penangkap error global, pemuat alat pengembang
    ├── router.js       Hash router dengan parameter (#/level/:id) dan penjaga rute
    ├── ui.js           Tombol, kartu, modal, toast, loader, form modal, PIN, unduh berkas
    ├── store.js        SATU-SATUNYA pintu data: fetch() ke /api
    ├── dev.js          Panel Dev, ciDev, rute #/uji-interpreter (hanya dimuat bila MODE_DEV=1)
    ├── vendor/         codemirror.js & confetti.js hasil bundel (npm run build:vendor)
    ├── data/           zona.js (4 pulau), levels.js (13 level bawaan)
    ├── game/           interpreter, worker, runner, editor (CodeMirror), panggung, kemajuan,
    │                   jalur peta, skor, validasi level, aturan isian siswa, ikon SVG, efek
    ├── pages/          Halaman siswa & umum (beranda, daftar, masuk, pasang, peta, level, profil, juara, bantuan)
    └── guru/           Dashboard guru (ringkasan, kelas, siswa, level & soal, nilai, aktivitas, guru, pengaturan)
```

Aturan teknis yang dipegang:
- **Tanpa proses build:** HTML, CSS, dan JavaScript murni (ES module).
- **Satu pintu data:** semua akses data hanya lewat `js/store.js`, yang memanggil `/api`. Server memeriksa sesi, peran, dan kelas yang diampu guru di setiap endpoint.
- **Database:** setiap perubahan struktur lewat migrasi bernomor baru; tidak ada perintah yang menghapus tabel berisi data.
- **Rahasia** hanya lewat `wrangler secret` (online) atau `.dev.vars` (lokal).
- **Kode siswa** dijalankan interpreter buatan sendiri di Web Worker, dibatasi 1000 langkah dan 2 detik.
- **Tanpa CDN:** semua CSS, JS, dan font dilayani dari Worker sendiri.
- **Gambar tambahan** (gembok, rintangan, bendera, bug, jurang) dibuat dengan SVG/CSS; tidak ada gambar dari internet.
- **Aksesibilitas & ketahanan:** fokus keyboard terlihat, modal mengunci fokus, animasi mati saat *prefers-reduced-motion*, dan error tak terduga ditampilkan sebagai toast robot kaget.

---

## 8. Langkah berikutnya

- **Cadangan data:** ekspor database secara berkala (bagian 4d).
