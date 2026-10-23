// scripts/buat-schema.mjs — membuat berkas database Coding Island dari satu sumber
// Jalankan dari folder proyek:  node scripts/buat-schema.mjs
//
// Hasil:
//   migrations/0001_struktur_awal.sql  patokan struktur + pengaturan bawaan + 13 level bawaan.
//                                      Hanya ditulis jika BELUM ada (migrasi yang sudah dijalankan
//                                      tidak boleh diubah). Tambahkan --tulis-ulang untuk memaksa.
//   schema.sql                         gabungan semua migrasi (tanpa perintah pembersihan data),
//                                      untuk dibaca atau mengisi database kosong secara manual.
//   server/skema.js                    perintah yang sama, dipakai worker.js mengisi database kosong.
//
// Semua perintah aman diulang: CREATE ... IF NOT EXISTS dan INSERT OR IGNORE.
// Tidak ada akun, kelas, atau siswa bawaan — admin pertama dibuat lewat #/pasang.

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEVEL_AWAL } from '../js/data/levels.js';
import { CLUE } from '../js/game/skor.js';
import { KOIN_AWAL } from '../server/data.js';

const akar = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const DIBUAT = '2026-09-01T00:30:00.000Z';

// ---------- Helper SQL ----------
const q = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
};
const sisip = (tabel, kolom, data) =>
  `INSERT OR IGNORE INTO ${tabel} (${kolom.join(', ')}) VALUES\n${data.map((d) => `  (${d.map(q).join(', ')})`).join(',\n')};\n`;

// ---------- Struktur tabel ----------
const STRUKTUR = `
-- Guru dan admin (peran: 'guru' | 'admin'). password_hash berformat pbkdf2$sha256$iterasi$salt$hash
CREATE TABLE IF NOT EXISTS guru (
  id            TEXT PRIMARY KEY,
  nama          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  peran         TEXT NOT NULL DEFAULT 'guru' CHECK (peran IN ('guru', 'admin')),
  dibuat_pada   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kelas (
  id         TEXT PRIMARY KEY,
  nama       TEXT NOT NULL,
  tingkat    INTEGER NOT NULL CHECK (tingkat BETWEEN 1 AND 6),
  kode_kelas TEXT NOT NULL UNIQUE
);

-- Kelas yang diampu setiap guru
CREATE TABLE IF NOT EXISTS guru_kelas (
  guru_id  TEXT NOT NULL REFERENCES guru(id) ON DELETE CASCADE,
  kelas_id TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  PRIMARY KEY (guru_id, kelas_id)
);
CREATE INDEX IF NOT EXISTS idx_guru_kelas_kelas ON guru_kelas(kelas_id);

-- Siswa. zona_terlihat: JSON array id zona yang animasi pembukaannya sudah dilihat
CREATE TABLE IF NOT EXISTS siswa (
  id             TEXT PRIMARY KEY,
  nama_lengkap   TEXT NOT NULL,
  nama_panggilan TEXT NOT NULL,
  jenis_kelamin  TEXT NOT NULL DEFAULT 'L',
  avatar         TEXT NOT NULL DEFAULT 'pria',
  kelas_id       TEXT REFERENCES kelas(id) ON DELETE SET NULL,
  username       TEXT NOT NULL UNIQUE,
  pin_hash       TEXT NOT NULL,
  koin           INTEGER NOT NULL DEFAULT 0,
  berlian        INTEGER NOT NULL DEFAULT 0,
  zona_terlihat  TEXT NOT NULL DEFAULT '["pantai"]',
  dibuat_pada    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_siswa_kelas ON siswa(kelas_id);

-- Level. Kolom yang sering disaring dipisah; isi lain (instruksi, dunia, tujuan, solusi, clue, ...) di kolom JSON data.
-- kelas_ids NULL = untuk semua kelas; kelas_nonaktif = JSON array kelas yang menonaktifkan level ini.
CREATE TABLE IF NOT EXISTS level (
  id             TEXT PRIMARY KEY,
  zona           TEXT NOT NULL,
  urutan         REAL NOT NULL DEFAULT 0,
  jenis          TEXT NOT NULL CHECK (jenis IN ('ketik', 'debug', 'boss')),
  judul          TEXT NOT NULL,
  bawaan         INTEGER NOT NULL DEFAULT 0,
  terbit         INTEGER NOT NULL DEFAULT 0,
  pembuat_id     TEXT,
  pembuat_nama   TEXT,
  kelas_ids      TEXT,
  kelas_nonaktif TEXT NOT NULL DEFAULT '[]',
  data           TEXT NOT NULL DEFAULT '{}',
  dibuat_pada    TEXT NOT NULL,
  diperbarui     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_level_zona ON level(zona, urutan);

-- Progres satu siswa di satu level
CREATE TABLE IF NOT EXISTS progres (
  siswa_id      TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  level_id      TEXT NOT NULL REFERENCES level(id) ON DELETE CASCADE,
  selesai       INTEGER NOT NULL DEFAULT 0,
  bintang       INTEGER NOT NULL DEFAULT 0,
  nilai         INTEGER NOT NULL DEFAULT 0,
  percobaan     INTEGER NOT NULL DEFAULT 0,
  clue_dibeli   INTEGER NOT NULL DEFAULT 0,
  kode_terakhir TEXT NOT NULL DEFAULT '',
  detik         INTEGER NOT NULL DEFAULT 0,
  selesai_pada  TEXT,
  diperbarui    TEXT NOT NULL,
  PRIMARY KEY (siswa_id, level_id)
);
CREATE INDEX IF NOT EXISTS idx_progres_level ON progres(level_id);

-- Log aktivitas siswa (jenis: daftar, masuk, coba, selesai, clue, piala, juara)
CREATE TABLE IF NOT EXISTS aktivitas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  waktu      TEXT NOT NULL,
  siswa_id   TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  jenis      TEXT NOT NULL,
  keterangan TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_aktivitas_siswa ON aktivitas(siswa_id, waktu);
CREATE INDEX IF NOT EXISTS idx_aktivitas_waktu ON aktivitas(waktu);

-- ===== Tabel pendukung =====
-- Sesi login: hanya hash SHA-256 token yang disimpan; kadaluarsa dalam milidetik epoch
CREATE TABLE IF NOT EXISTS sesi (
  token_hash  TEXT PRIMARY KEY,
  jenis       TEXT NOT NULL CHECK (jenis IN ('siswa', 'guru')),
  pengguna_id TEXT NOT NULL,
  kadaluarsa  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sesi_pengguna ON sesi(jenis, pengguna_id);

-- Batas percobaan (kunci mis. 'siswa:u:<username>', 'guru:ip:<alamat>', 'pasang:ip:<alamat>')
CREATE TABLE IF NOT EXISTS percobaan_login (
  kunci        TEXT PRIMARY KEY,
  gagal        INTEGER NOT NULL DEFAULT 0,
  tahan_sampai INTEGER NOT NULL DEFAULT 0,
  diperbarui   INTEGER NOT NULL
);

-- Catatan guru untuk seorang siswa
CREATE TABLE IF NOT EXISTS catatan_guru (
  siswa_id   TEXT PRIMARY KEY REFERENCES siswa(id) ON DELETE CASCADE,
  teks       TEXT NOT NULL,
  guru_id    TEXT,
  guru_nama  TEXT,
  diperbarui TEXT NOT NULL
);

-- Nilai akhir yang ditimpa guru (1–100) beserta alasannya
CREATE TABLE IF NOT EXISTS nilai_timpa (
  siswa_id  TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  kelas_id  TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  nilai     INTEGER NOT NULL CHECK (nilai BETWEEN 1 AND 100),
  alasan    TEXT NOT NULL,
  guru_id   TEXT,
  guru_nama TEXT,
  waktu     TEXT NOT NULL,
  PRIMARY KEY (siswa_id, kelas_id)
);

-- Pengaturan umum (kunci: harga_clue, koin_awal); nilai berupa JSON
CREATE TABLE IF NOT EXISTS pengaturan (
  kunci TEXT PRIMARY KEY,
  nilai TEXT NOT NULL
);
`;

// ---------- Data bawaan: pengaturan + 13 level ----------
// Objek level dipisah menjadi kolom + JSON data (sama dengan perintahSimpanLevel di server/data.js)
const levelBaris = LEVEL_AWAL.map((l) => {
  const { id, zona, urutan, jenis, judul, bawaan, terbit, pembuat, kelasIds, kelasNonaktif, dibuatPada, diperbarui, ...data } = l;
  return [id, zona, urutan ?? 0, jenis, judul, bawaan ? 1 : 0, terbit === false ? 0 : 1, pembuat?.id || null, pembuat?.nama || null,
    kelasIds ? JSON.stringify(kelasIds) : null, JSON.stringify(kelasNonaktif || []), JSON.stringify(data), dibuatPada || DIBUAT, diperbarui || DIBUAT];
});

const MIGRASI_0001 = `-- migrations/0001_struktur_awal.sql — patokan struktur database Coding Island
-- DIBUAT oleh scripts/buat-schema.mjs. Jangan diubah setelah dijalankan; perubahan berikutnya
-- ditulis sebagai migrasi bernomor baru (0002, 0003, ...).
-- Aman untuk database yang sudah berisi data: tabel/indeks hanya dibuat bila belum ada,
-- pengaturan dan level bawaan hanya ditambahkan bila belum ada (yang sudah diubah guru tetap).
${STRUKTUR}
-- ===== Pengaturan bawaan =====
${sisip('pengaturan', ['kunci', 'nilai'], [['harga_clue', JSON.stringify(CLUE.map((c) => c.harga))], ['koin_awal', String(KOIN_AWAL)]])}
-- ===== 13 level bawaan =====
${sisip('level', ['id', 'zona', 'urutan', 'jenis', 'judul', 'bawaan', 'terbit', 'pembuat_id', 'pembuat_nama', 'kelas_ids', 'kelas_nonaktif', 'data', 'dibuat_pada', 'diperbarui'], levelBaris)}`;

if (!existsSync(akar('migrations'))) mkdirSync(akar('migrations'));
const berkas0001 = akar('migrations/0001_struktur_awal.sql');
if (!existsSync(berkas0001) || process.argv.includes('--tulis-ulang')) {
  writeFileSync(berkas0001, MIGRASI_0001);
  console.log('migrations/0001_struktur_awal.sql ditulis.');
} else {
  console.log('migrations/0001_struktur_awal.sql sudah ada, tidak diubah.');
}

// ---------- Gabungkan semua migrasi ----------
// Perintah pembersihan data (DELETE) hanya untuk database lama, jadi tidak ikut ke schema.sql/skema.js
const daftarMigrasi = readdirSync(akar('migrations')).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
const perintah = [];
for (const f of daftarMigrasi) {
  const isi = readFileSync(akar(`migrations/${f}`), 'utf8')
    .split('\n').filter((b) => !b.trim().startsWith('--')).join('\n');
  for (const p of isi.split(/;\s*(?:\n|$)/).map((x) => x.trim()).filter(Boolean)) {
    if (!/^DELETE\b/i.test(p)) perintah.push(p);
  }
}

writeFileSync(akar('schema.sql'), `-- schema.sql — struktur lengkap database Coding Island (gabungan migrations/*.sql)
-- DIBUAT OTOMATIS oleh scripts/buat-schema.mjs. Jangan diedit manual.
-- Aman dijalankan ulang: tidak menghapus data. Untuk database online pakai:
--   npx wrangler d1 migrations apply coding-island-db --remote
-- Migrasi: ${daftarMigrasi.join(', ')}

${perintah.join(';\n\n')};
`);

writeFileSync(akar('server/skema.js'), `// server/skema.js — DIBUAT OTOMATIS oleh scripts/buat-schema.mjs. Jangan diedit manual.
// Perintah SQL gabungan migrations/*.sql (tanpa pembersihan data), dipakai worker.js
// untuk mengisi database yang masih kosong: struktur tabel, pengaturan bawaan, dan level bawaan.
// Migrasi: ${daftarMigrasi.join(', ')}

export const SKEMA_BUAT = ${JSON.stringify(perintah, null, 2)};
`);

console.log(`schema.sql & server/skema.js dibuat dari ${daftarMigrasi.length} migrasi (${perintah.length} perintah, ${LEVEL_AWAL.length} level bawaan).`);
