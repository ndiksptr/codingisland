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
- **Teknis:** website statis tanpa proses build (HTML, CSS, JavaScript ES module), hash router, dan kode siswa dijalankan oleh interpreter buatan sendiri di Web Worker (tanpa `eval`).

Dokumen lain: [UJI-COBA.md](UJI-COBA.md) (daftar uji Tahap 1–9) dan [REVISI.md](REVISI.md) (catatan revisi).

---

## 1. Akun demo

Data contoh dibuat otomatis saat aplikasi pertama kali dibuka. Akun demo juga tampil di halaman masuk dan bisa diisi dengan tombol **Pakai**.

| Peran | Username | Password / PIN |
|---|---|---|
| Admin | `admin` | `admin123` |
| Guru (Kelas 3A, 4A) | `bu.sari` | `guru123` |
| Guru (Kelas 5A, 6A) | `pak.budi` | `guru123` |
| Siswa | `andi3`, `aisyah3`, `dimas4`, `zahra4`, `farhan5`, `salsa5`, `naufal6`, `aurel6`, dan lainnya (5 per kelas) | PIN `1234` |

- Kode kelas untuk pendaftaran siswa: `PULAU3`, `PULAU4`, `PULAU5`, `PULAU6` (huruf besar/kecil tidak berpengaruh).
- Untuk mengembalikan semua data ke awal, klik **Reset data demo** di footer beranda, atau buka menu **Pengaturan** sebagai admin.

> **Penting:** semua data (akun, progres, nilai) disimpan di **localStorage browser**, terpisah untuk setiap perangkat dan browser. Siswa yang bermain di komputer A tidak terlihat di dashboard guru di komputer B. Untuk dipakai bersama satu sekolah, `js/store.js` perlu diganti ke API Cloudflare Pages Functions + D1 (lihat bagian 7).

---

## 2. Menjalankan secara lokal

Aplikasi memakai ES module dan Web Worker, jadi **harus dibuka lewat server lokal**. Membuka `index.html` langsung dari folder (`file://`) tidak akan berjalan.

Dari folder proyek, pilih salah satu:

| Cara | Perintah | Alamat |
|---|---|---|
| Python | `python -m http.server 8000` | `http://localhost:8000` |
| Node.js | `npx serve .` | alamat yang muncul di terminal |
| VS Code | ekstensi **Live Server** → klik kanan `index.html` → *Open with Live Server* | biasanya `http://127.0.0.1:5500/index.html` |

Catatan:
- Buka lewat **`localhost`** atau **`https`**. PIN dan password di-hash dengan `crypto.subtle`, yang tidak tersedia di alamat IP jaringan seperti `http://192.168.x.x`.
- Perlu internet untuk Google Fonts, Tailwind CDN, CodeMirror (esm.sh), dan confetti. Jika CodeMirror gagal dimuat, editor otomatis memakai textarea biasa.
- Setelah kode diubah, tekan **Ctrl + F5** agar browser tidak memakai file lama. Saat menguji, buka DevTools (F12) → **Network** → centang **Disable cache**.

---

## 3. Deploy ke Cloudflare Pages

Proyek ini situs statis murni, jadi **tidak perlu build command**. Semua path aset sudah relatif dan huruf besar-kecilnya sudah dicocokkan dengan nama file asli. Ini penting karena server Cloudflare membedakan `Pantai.jpeg` dan `pantai.jpeg`, sedangkan Windows tidak.

Berkas yang dibutuhkan situs:

```
index.html   _headers   css/   js/   image/
```

- `_headers` berisi cache 1 hari untuk `image/`, `css/`, `js/` dan header keamanan dasar (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`).
- **Tidak perlu `_redirects`**: aplikasi memakai hash router (`#/peta`, `#/guru/siswa`), jadi semua halaman dilayani oleh `index.html`.

### 3a. Lewat dashboard Cloudflare (unggah folder)

1. Siapkan folder bersih berisi **hanya** berkas di atas. Jangan ikutkan folder `.git` atau berkas cadangan. Dengan PowerShell dari folder proyek:
   ```powershell
   Remove-Item -Recurse -Force ..\coding-island-publik -ErrorAction SilentlyContinue
   New-Item -ItemType Directory ..\coding-island-publik | Out-Null
   Copy-Item index.html, _headers -Destination ..\coding-island-publik
   Copy-Item css, js, image -Destination ..\coding-island-publik -Recurse
   ```
2. Masuk ke [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → tab **Pages** → **Upload assets**.
3. Isi nama proyek `coding-island`, lalu **Create project**.
4. Seret folder `coding-island-publik` (atau file ZIP berisinya) ke area unggah → **Deploy site**.
5. Setelah selesai, situs tersedia di `https://coding-island.pages.dev`. Untuk memperbarui, buka proyek → **Create deployment** → unggah ulang folder yang baru.

### 3b. Lewat perintah (Wrangler)

Butuh Node.js 18 atau lebih baru.

```bash
# sekali saja: masuk ke akun Cloudflare
npx wrangler login

# deploy dari folder proyek
npx wrangler pages deploy . --project-name=coding-island
```

- Saat pertama kali, Wrangler menawarkan untuk membuat proyek `coding-island`. Pilih **production branch** `main`.
- Wrangler tidak mengunggah folder `.git` dan `node_modules`. Berkas dokumen seperti `README.md`, `UJI-COBA.md`, dan `REVISI.md` ikut terunggah dan bisa dibuka publik. Jika tidak diinginkan, deploy folder bersih dari langkah 3a: `npx wrangler pages deploy ..\coding-island-publik --project-name=coding-island`.

### 3c. Setelah deploy

- **Domain berbeda:** jika domain bukan `coding-island.pages.dev` (misalnya domain sekolah), ganti alamat pada `og:url` dan `og:image` di `index.html` supaya pratinjau tautan di WhatsApp/Facebook tampil benar.
- **Cache 1 hari:** pengunjung lama bisa masih memakai CSS/JS lama sampai 1 hari setelah pembaruan. Minta mereka menekan Ctrl + F5, atau perpendek `max-age` di `_headers` selama masa pengembangan.
- **Uji di HP:** buka alamat `https://…pages.dev` di HP. Karena sudah `https`, hashing PIN berjalan normal.

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

Fitur pengembang tidak terlihat oleh pengguna biasa dan hanya aktif jika alamat mengandung `?dev=1`, misalnya `https://coding-island.pages.dev/?dev=1#/peta` atau `http://localhost:8000/?dev=1#/peta`.

| Alat | Cara pakai |
|---|---|
| Panel Dev | Tombol oranye **Dev** di pojok kiri bawah: selesaikan level, tuntaskan pulau, reset progres, validasi semua level, tautan ke Uji Interpreter (masuk sebagai siswa dulu) |
| `ciDev` di Console | `ciDev.selesaikanLevel('pantai-4', 3)`, `ciDev.tuntaskanPulau('pantai')`, `ciDev.resetProgres()`, `ciDev.validasiLevel()`, `ciDev.bantuan()` |
| Uji Interpreter | `/?dev=1#/uji-interpreter`: coba kode di dunia contoh, atau klik **Jalankan semua tes** (22 kasus) |

Karena datanya tersimpan di browser, siswa yang tahu `?dev=1` bisa mengubah progresnya sendiri. Ini tidak bisa dicegah sampai data dipindah ke server (bagian 7).

---

## 6. Struktur folder

```
coding_island/
├── index.html          Halaman tunggal: meta & ikon, font, Tailwind CDN, memuat js/main.js
├── _headers            Header cache & keamanan untuk Cloudflare Pages
├── css/app.css         Token warna, komponen, panggung, dashboard, gaya cetak, animasi
├── image/              Aset: background/, robot/, item/, profile/, favicon-32.png,
│                       apple-touch-icon.png (180 px), og-image.jpg (1200×630)
└── js/
    ├── main.js         Daftar rute, penjaga rute, penangkap error global
    ├── router.js       Hash router dengan parameter (#/level/:id) dan penjaga rute
    ├── ui.js           Tombol, kartu, modal, toast, loader, form modal, PIN, unduh berkas
    ├── store.js        SATU-SATUNYA pintu data (localStorage, awalan ci_)
    ├── dev.js          Panel Dev & ciDev (hanya dengan ?dev=1)
    ├── data/           zona.js (4 pulau), levels.js (13 level bawaan)
    ├── game/           interpreter, worker, runner, editor (CodeMirror), panggung, kemajuan,
    │                   jalur peta, skor, validasi level, ikon SVG, efek
    ├── pages/          Halaman siswa & umum (beranda, daftar, masuk, peta, level, profil, juara, bantuan)
    └── guru/           Dashboard guru (ringkasan, kelas, siswa, level & soal, nilai, aktivitas, guru, pengaturan)
```

Aturan teknis yang dipegang:
- **Tanpa proses build:** HTML, CSS, dan JavaScript murni (ES module).
- **Satu pintu data:** semua akses data hanya lewat `js/store.js`. Fungsi dashboard `guru*`/`admin*` membatasi data pada kelas yang diampu guru.
- **Kode siswa** dijalankan interpreter buatan sendiri di Web Worker, dibatasi 1000 langkah dan 2 detik.
- **Gambar tambahan** (gembok, rintangan, bendera, bug, jurang) dibuat dengan SVG/CSS; tidak ada gambar dari internet.
- **Ukuran gambar:** keempat background sudah dikompres ke 121–175 KB (sebelumnya 580–715 KB) dengan nama file tetap.
- **Aksesibilitas & ketahanan:** fokus keyboard terlihat, modal mengunci fokus, animasi mati saat *prefers-reduced-motion*, dan error tak terduga ditampilkan sebagai toast robot kaget.

---

## 7. Langkah berikutnya

- **Data bersama satu sekolah:** ganti isi `js/store.js` menjadi pemanggilan `fetch()` ke Cloudflare Pages Functions + D1. Nama dan bentuk fungsi publiknya sudah async dan bisa dipertahankan. Fungsi `guru*`/`admin*` dipindah ke server dengan pemeriksaan sesi yang sama.
- **Tailwind CLI:** ganti Tailwind CDN dengan CSS hasil build (bagian 4).
- **Data demo:** nonaktifkan akun demo dan tautan "Reset data demo" sebelum dipakai sungguhan.
