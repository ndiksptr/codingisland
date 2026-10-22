# Coding Island

Game edukasi belajar mengetik kode dan logika sederhana untuk siswa SD kelas 3–6.
Siswa menggerakkan Robot Tutor dengan mini-bahasa berbahasa Indonesia (`maju()`, `belok_kanan()`, `ulangi 3 { }`, dan seterusnya) sambil menjelajahi 4 pulau.

Dokumen terkait:
- [UJI-COBA.md](UJI-COBA.md): daftar uji coba Tahap 1–5 yang bisa dicentang.
- [REVISI.md](REVISI.md): tempat menulis permintaan revisi.

---

## 1. Cara menjalankan

Website ini statis, tanpa proses build. Karena memakai ES module dan Web Worker, aplikasi **harus dibuka lewat server lokal**. Membuka `index.html` langsung dari folder (`file://`) tidak akan berjalan.

Pilih salah satu cara dari folder proyek:

| Cara | Perintah |
|---|---|
| Python | `python -m http.server 8000` lalu buka `http://localhost:8000` |
| Node | `npx serve .` lalu buka alamat yang muncul |
| VS Code | Pasang ekstensi **Live Server**, klik kanan `index.html` → *Open with Live Server* |

Penting:
- Buka lewat **`localhost`** (atau `https`). PIN dan password di-hash dengan `crypto.subtle`, yang tidak tersedia jika dibuka lewat IP jaringan seperti `http://192.168.x.x`.
- Untuk melihat tampilan HP, pakai mode perangkat di DevTools (F12 → ikon HP).
- Perlu internet untuk Google Fonts, Tailwind CDN, CodeMirror, dan confetti. Jika CodeMirror gagal dimuat, editor otomatis berganti ke textarea biasa.

### Akun demo

Data contoh dibuat otomatis saat pertama kali dibuka. Akun demo juga tampil di halaman masuk dan bisa diisi dengan tombol **Pakai**.

| Peran | Username | Password / PIN |
|---|---|---|
| Admin | `admin` | `admin123` |
| Guru (Kelas 3A, 4A) | `bu.sari` | `guru123` |
| Guru (Kelas 5A, 6A) | `pak.budi` | `guru123` |
| Siswa | `andi3`, `aisyah3`, `dimas4`, `farhan5`, `naufal6`, dan lainnya (5 per kelas) | PIN `1234` |

Kode kelas untuk pendaftaran: `PULAU3`, `PULAU4`, `PULAU5`, `PULAU6` (huruf besar/kecil tidak berpengaruh).

Untuk mengembalikan semua data ke awal, klik **Reset data demo** di footer halaman beranda.

---

## 2. Struktur folder

```
coding_island/
├── index.html              Halaman tunggal: font, Tailwind CDN + konfigurasi warna, memuat js/main.js
├── css/app.css             Token warna, komponen, panggung, dan animasi (hormat prefers-reduced-motion)
├── image/                  Aset gambar (background, robot, item, profile)
└── js/
    ├── main.js             Daftar rute, penjaga rute, reset data demo
    ├── router.js           Router hash (#/peta, #/level/:id), penjaga, muatUlang()
    ├── ui.js               Tombol, kartu, modal, toast, loader, kotak PIN, pesan validasi
    ├── store.js            SATU-SATUNYA pintu data (localStorage, awalan ci_)
    ├── dev.js              ciDev di console (hanya di localhost)
    ├── data/
    │   ├── zona.js         4 zona: id, nama, konsep, gambar, warna aksen
    │   └── levels.js       13 level awal + isi soal (baru pantai-1 dan pantai-2)
    ├── game/
    │   ├── interpreter.js  Tokenizer → parser (AST) → evaluator → jejak peristiwa
    │   ├── worker.js       Web Worker tempat kode siswa dijalankan
    │   ├── runner.js       Pembungkus worker + batas waktu 2 detik
    │   ├── editor.js       CodeMirror 6 (esm.sh, versi dipin) + cadangan textarea
    │   ├── panggung.js     Panggung 16:9, robot, item, animasi jejak
    │   ├── kemajuan.js     Aturan buka-kunci zona dan level
    │   ├── jalur.js        Jalur berkelok + posisi level otomatis di peta
    │   ├── skor.js         Aturan bintang, nilai, koin
    │   ├── dunia.js        Ubah dunia level dari/ke peta teks
    │   ├── ikon.js         SVG: gembok, bug, panah, bendera, rintangan
    │   ├── efek.js         Animasi roket "pulau baru terbuka"
    │   └── uji-interpreter-kasus.js  22 kasus uji otomatis
    ├── pages/              Halaman siswa & umum (beranda, daftar, masuk, peta, level, dst.)
    └── guru/sementara.js   Halaman guru sementara (dashboard lengkap menyusul)
```

### Aturan teknis yang dipegang
- Tanpa proses build: HTML, CSS, dan JavaScript murni (ES module) ditambah Tailwind CDN.
- Hash router, jadi bisa di-hosting di Cloudflare Pages tanpa konfigurasi tambahan.
- **Semua akses data hanya lewat `js/store.js`** (fungsi async). Nanti cukup modul ini yang diganti ke API Cloudflare Pages Functions + D1.
- Kode siswa **tidak pernah** dijalankan dengan `eval` atau `new Function`, tetapi lewat interpreter buatan sendiri di Web Worker.
- Tidak memakai gambar dari internet. Elemen tambahan (gembok, batu, bendera, bug, jurang) dibuat dengan SVG atau CSS.
- `image/robot/marah.png` tidak dipakai untuk siswa.

---

## 3. Ringkasan per tahap

### Tahap 1: Fondasi
- `index.html` memuat Baloo 2, Nunito, JetBrains Mono, dan Tailwind CDN dengan nama warna proyek: `teal-tua`, `teal`, `mint`, `kuning`, `tinta`, `oranye`, `latar`.
- `css/app.css` berisi token warna yang sama plus kelas animasi `.melayang`, `.muncul`, `.goyang`. Semua animasi mati saat *prefers-reduced-motion* aktif.
- Router hash dengan parameter (`#/level/:id`), gulir ke atas saat pindah halaman, dan halaman 404 "Pulau tidak ditemukan".
- Helper UI: tombol besar (utama, sekunder, bahaya), kartu, modal dengan fokus terkunci, toast, dan loader robot berpikir.
- Landing page: hero pantai, robot melayang, bagian "Jelajahi 4 Pulau", bagian "Cara Bermain", dan footer.

### Tahap 2: Data, pendaftaran, dan masuk
- `store.js` menyimpan entitas guru, kelas, siswa, level, progres, dan aktivitas.
  - PIN dan password di-hash SHA-256 dengan salt acak, dan sesi berlaku 8 jam.
  - Data contoh: 1 admin, 2 guru, 4 kelas, dan 20 siswa dengan progres acak ber-seed tetap, jadi hasilnya sama setiap reset.
- `#/daftar` terdiri dari 3 langkah: nama dan avatar → kelas dan kode kelas → username (disarankan otomatis dan dicek unik) serta PIN 4 kotak. Setelah berhasil muncul modal +20 koin.
- `#/masuk` (siswa) memakai papan angka besar. `#/guru/masuk` untuk guru dan admin. Setelah 5 kali salah, percobaan ditahan 1 menit.
- Penjaga rute:
  - `#/peta` dan `#/level/*` hanya untuk siswa.
  - `#/guru/*` hanya untuk guru dan admin.
  - `#/guru/guru` hanya untuk admin.
- Header siswa menampilkan avatar, nama panggilan, koin, berlian, dan tombol keluar.

### Tahap 3: Peta pulau
- 13 level: Pantai 4, Laut 3, Gurun 3, Salju 3. Level terakhir tiap zona adalah **boss**, dan ada satu level **debug** per zona.
- `#/peta` menampilkan ringkasan 4 pulau dengan progres, bintang, dan status terkunci atau terbuka.
- `#/peta/:zona` menampilkan background penuh, jalur putus-putus berkelok, dan lingkaran level yang ditata **otomatis**. Robot memberi tips dan berganti melamun setelah 20 detik tanpa interaksi.
- Aturan buka-kunci:
  - Zona berikutnya terbuka setelah boss zona sebelumnya selesai.
  - Sebuah level terbuka jika level sebelumnya selesai.
- Animasi roket dan robot terbang sekali saat pulau baru terbuka.

### Tahap 4: Interpreter
- Mini-bahasa:

```
// komentar
maju()            maju(3)         belok_kiri()    belok_kanan()
ambil()           lompat()
ulangi 3 { ... }
jika ada_rintangan() { ... } lainnya { ... }
selama bukan sampai_tujuan() { ... }
buat langkah = 3
langkah = langkah + 1
```

- Syarat yang tersedia: `ada_rintangan()`, `ada_jurang()`, `ada_koin()`, `sampai_tujuan()`, dan kata `bukan` di depannya untuk membalik.
- Pengaman: kode berhenti setelah 1000 langkah eksekusi, dan worker dimatikan paksa setelah 2 detik.
- Pesan galat ramah anak dan selalu menyebut nomor baris. Salah ketik diberi saran (jarak Levenshtein).
- Halaman pengembang: `http://localhost:8000/?dev=1#/uji-interpreter`.

### Tahap 5: Halaman level yang bisa dimainkan
- `pantai-1` (maju lurus 4 petak) dan `pantai-2` (ambil 2 koin lalu belok) sudah lengkap. Level lain menampilkan "sedang disiapkan".
- Laptop: kiri berisi soal, tujuan bercentang, chip perintah, editor, dan tombol; kanan berisi panggung 16:9. HP: panggung di atas.
- Editor CodeMirror 6 punya nomor baris, warna kode, dan autocomplete. Kode tersimpan otomatis per level.
- **Bantu ketik** (klik chip untuk menyisipkan perintah) selalu aktif untuk kelas 3–4. Kelas 5–6 bisa menyalakannya lewat sakelar.
- Animasi jejak berjalan sambil menyorot baris kode yang sedang dijalankan. Ekspresi robot berganti sesuai hasil.
- Saat berhasil: confetti, lalu modal bintang dan koin.
- Aturan sementara: bintang 1 = selesai, 2 = tanpa clue, 3 = tanpa clue dan jumlah baris ≤ `batasBaris`. Nilai 70 / 85 / 100. Koin: +10 saat pertama selesai, ditambah +5 untuk tiap bintang baru.

---

## 4. Alat bantu pengembang

| Alat | Cara pakai |
|---|---|
| `ciDev` di console | Hanya di localhost. Masuk sebagai siswa, lalu buka console (F12). `ciDev.selesaikanLevel('pantai-4', 3)` menandai level selesai, `ciDev.resetProgres()` menghapus progres siswa itu, `ciDev.bantuan()` menampilkan daftar perintah. |
| Uji interpreter | `/?dev=1#/uji-interpreter`: coba kode bebas di dunia contoh atau klik **Jalankan semua tes** (22 kasus). |
| Reset data | Tautan **Reset data demo** di footer beranda. |
| Hapus total | DevTools → Application → Local Storage → hapus kunci berawalan `ci_`. |

### Menulis dunia level dengan cepat
`js/game/dunia.js` bisa mengubah peta teks menjadi data dunia:

```js
import { duniaDariTeks } from './js/game/dunia.js';
duniaDariTeks([
  '>.$.#...',
  '...O....',
  '......F.'
]);
// >  <  ^  v  robot (arah)    F tujuan    # batu    O jurang    $ koin wajib    * koin bebas
```

---

## 5. Hosting di Cloudflare Pages
1. Unggah isi folder ini ke repositori Git, atau unggah langsung lewat dashboard Cloudflare Pages.
2. Build command: *(kosong)*. Output directory: `/` (root).
3. Karena memakai hash router (`#/...`), tidak perlu aturan *redirect*.
4. Catatan: `ciDev` otomatis mati di domain selain localhost. Tailwind CDN hanya untuk demo; untuk produksi sebaiknya CSS-nya di-*build*.

---

## 6. Yang belum dikerjakan (tahap berikutnya)
- Tahap 6: tombol clue bertingkat yang dibeli dengan koin, serta perapian aturan bintang dan koin.
- Isi soal untuk 11 level lainnya, termasuk level debug dan boss beserta hadiah piala dan berlian.
- Dashboard guru dan admin dengan navbar vertikal: kelola kelas, siswa, level atau soal, serta nilai 1–100.
- Penggantian `store.js` ke API Cloudflare Pages Functions + D1.
