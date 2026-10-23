// scripts/buat-schema.mjs — membuat schema.sql (tabel + data awal) untuk D1
// Data contoh diambil dari versi demo (js/store-lokal.js) agar isinya sama persis,
// lalu PIN/password di-hash ulang dengan PBKDF2 (server/kripto.js).
// Jalankan dari folder proyek:  node scripts/buat-schema.mjs
// (Hanya perlu dijalankan ulang jika data contoh atau struktur tabel diubah.)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashRahasia } from '../server/kripto.js';

// ---------- localStorage palsu agar store-lokal.js bisa berjalan di Node ----------
const isi = new Map();
globalThis.localStorage = {
  get length() { return isi.size; },
  key: (i) => [...isi.keys()][i] ?? null,
  getItem: (k) => (isi.has(k) ? isi.get(k) : null),
  setItem: (k, v) => isi.set(k, String(v)),
  removeItem: (k) => isi.delete(k),
  clear: () => isi.clear()
};

const store = await import('../js/store-lokal.js');
await store.getSemuaKelas(); // memicu pengisian data contoh
const ambil = (k) => JSON.parse(isi.get(`ci_${k}`) || '[]');
const guru = ambil('guru');
const kelas = ambil('kelas');
const siswa = ambil('siswa');
const level = ambil('level');
const progres = ambil('progres');
const aktivitas = ambil('aktivitas');

// Password/PIN contoh (sama dengan versi demo)
const PASSWORD = { guru_admin: 'admin123', guru_sari: 'guru123', guru_budi: 'guru123' };
const PIN = '1234';

// ---------- Helper SQL ----------
const q = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
};
const baris = (tabel, kolom, data) => data.length
  ? `INSERT INTO ${tabel} (${kolom.join(', ')}) VALUES\n${data.map((d) => `  (${d.map(q).join(', ')})`).join(',\n')};\n`
  : '';

const DIBUAT = '2026-09-01T00:30:00.000Z';

// ---------- Struktur tabel ----------
const STRUKTUR = `-- schema.sql — struktur database D1 Coding Island + data awal
-- DIBUAT OTOMATIS oleh scripts/buat-schema.mjs. Jangan diedit manual.
-- PERINGATAN: menjalankan file ini MENGHAPUS semua data lama lalu mengisi data contoh.
--   npx wrangler d1 execute coding-island-db --local  --file=schema.sql   (lokal)
--   npx wrangler d1 execute coding-island-db --remote --file=schema.sql   (Cloudflare)
-- Akun contoh: admin / admin123, bu.sari / guru123, pak.budi / guru123, siswa PIN 1234.

PRAGMA defer_foreign_keys = true;

DROP TABLE IF EXISTS nilai_timpa;
DROP TABLE IF EXISTS catatan_guru;
DROP TABLE IF EXISTS aktivitas;
DROP TABLE IF EXISTS progres;
DROP TABLE IF EXISTS sesi;
DROP TABLE IF EXISTS percobaan_login;
DROP TABLE IF EXISTS pengaturan;
DROP TABLE IF EXISTS level;
DROP TABLE IF EXISTS siswa;
DROP TABLE IF EXISTS guru_kelas;
DROP TABLE IF EXISTS kelas;
DROP TABLE IF EXISTS guru;

-- Guru dan admin (peran: 'guru' | 'admin'). password_hash berformat pbkdf2$sha256$iterasi$salt$hash
CREATE TABLE guru (
  id            TEXT PRIMARY KEY,
  nama          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  peran         TEXT NOT NULL DEFAULT 'guru' CHECK (peran IN ('guru', 'admin')),
  dibuat_pada   TEXT NOT NULL
);

CREATE TABLE kelas (
  id         TEXT PRIMARY KEY,
  nama       TEXT NOT NULL,
  tingkat    INTEGER NOT NULL CHECK (tingkat BETWEEN 1 AND 6),
  kode_kelas TEXT NOT NULL UNIQUE
);

-- Kelas yang diampu setiap guru
CREATE TABLE guru_kelas (
  guru_id  TEXT NOT NULL REFERENCES guru(id) ON DELETE CASCADE,
  kelas_id TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  PRIMARY KEY (guru_id, kelas_id)
);
CREATE INDEX idx_guru_kelas_kelas ON guru_kelas(kelas_id);

-- Siswa. zona_terlihat: JSON array id zona yang animasi pembukaannya sudah dilihat
CREATE TABLE siswa (
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
CREATE INDEX idx_siswa_kelas ON siswa(kelas_id);

-- Level. Kolom yang sering disaring dipisah; isi lain (instruksi, dunia, tujuan, solusi, clue, ...) di kolom JSON data.
-- kelas_ids NULL = untuk semua kelas; kelas_nonaktif = JSON array kelas yang menonaktifkan level ini.
CREATE TABLE level (
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
CREATE INDEX idx_level_zona ON level(zona, urutan);

-- Progres satu siswa di satu level
CREATE TABLE progres (
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
CREATE INDEX idx_progres_level ON progres(level_id);

-- Log aktivitas siswa (jenis: daftar, masuk, coba, selesai, clue, piala, juara)
CREATE TABLE aktivitas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  waktu      TEXT NOT NULL,
  siswa_id   TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  jenis      TEXT NOT NULL,
  keterangan TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_aktivitas_siswa ON aktivitas(siswa_id, waktu);
CREATE INDEX idx_aktivitas_waktu ON aktivitas(waktu);

-- ===== Tabel pendukung =====
-- Sesi login: hanya hash SHA-256 token yang disimpan; kadaluarsa dalam milidetik epoch
CREATE TABLE sesi (
  token_hash  TEXT PRIMARY KEY,
  jenis       TEXT NOT NULL CHECK (jenis IN ('siswa', 'guru')),
  pengguna_id TEXT NOT NULL,
  kadaluarsa  INTEGER NOT NULL
);
CREATE INDEX idx_sesi_pengguna ON sesi(jenis, pengguna_id);

-- Batas percobaan login (kunci: 'siswa:<username>', 'guru:<username>', 'ip:<alamat>')
CREATE TABLE percobaan_login (
  kunci        TEXT PRIMARY KEY,
  gagal        INTEGER NOT NULL DEFAULT 0,
  tahan_sampai INTEGER NOT NULL DEFAULT 0,
  diperbarui   INTEGER NOT NULL
);

-- Catatan guru untuk seorang siswa
CREATE TABLE catatan_guru (
  siswa_id   TEXT PRIMARY KEY REFERENCES siswa(id) ON DELETE CASCADE,
  teks       TEXT NOT NULL,
  guru_id    TEXT,
  guru_nama  TEXT,
  diperbarui TEXT NOT NULL
);

-- Nilai akhir yang ditimpa guru (1–100) beserta alasannya
CREATE TABLE nilai_timpa (
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
CREATE TABLE pengaturan (
  kunci TEXT PRIMARY KEY,
  nilai TEXT NOT NULL
);
`;

// ---------- Data awal ----------
const guruBaris = [];
for (const g of guru) guruBaris.push([g.id, g.nama, g.username, await hashRahasia(PASSWORD[g.id] || 'guru123'), g.peran, DIBUAT]);

const siswaBaris = [];
for (const s of siswa) {
  siswaBaris.push([s.id, s.namaLengkap, s.namaPanggilan, s.jenisKelamin, s.avatar, s.kelasId, s.username,
    await hashRahasia(PIN), s.koin, s.berlian, JSON.stringify(s.zonaTerlihat || ['pantai']), s.dibuatPada]);
}

// Pisahkan objek level menjadi kolom + JSON data (sama dengan perintahSimpanLevel di server/data.js)
const levelBaris = level.map((l) => {
  const { id, zona, urutan, jenis, judul, bawaan, terbit, pembuat, kelasIds, kelasNonaktif, dibuatPada, diperbarui, ...data } = l;
  return [id, zona, urutan ?? 0, jenis, judul, bawaan ? 1 : 0, terbit === false ? 0 : 1, pembuat?.id || null, pembuat?.nama || null,
    kelasIds ? JSON.stringify(kelasIds) : null, JSON.stringify(kelasNonaktif || []), JSON.stringify(data), dibuatPada || DIBUAT, diperbarui || DIBUAT];
});

const progresBaris = progres.map((p) => [p.siswaId, p.levelId, p.selesai ? 1 : 0, p.bintang || 0, p.nilai || 0, p.percobaan || 0,
  p.clueDibeli || 0, p.kodeTerakhir || '', p.detik || 0, p.selesai ? p.diperbarui : null, p.diperbarui]);

// Urut dari yang terlama agar id AUTOINCREMENT mengikuti waktu
const aktivitasBaris = [...aktivitas].sort((a, b) => a.waktu.localeCompare(b.waktu))
  .map((a) => [a.waktu, a.siswaId, a.jenis, a.keterangan || '']);

const sql = [
  STRUKTUR,
  '-- ===== Data awal =====',
  baris('guru', ['id', 'nama', 'username', 'password_hash', 'peran', 'dibuat_pada'], guruBaris),
  baris('kelas', ['id', 'nama', 'tingkat', 'kode_kelas'], kelas.map((k) => [k.id, k.nama, k.tingkat, k.kodeKelas])),
  baris('guru_kelas', ['guru_id', 'kelas_id'], kelas.flatMap((k) => (k.guruIds || []).map((g) => [g, k.id]))),
  baris('siswa', ['id', 'nama_lengkap', 'nama_panggilan', 'jenis_kelamin', 'avatar', 'kelas_id', 'username', 'pin_hash', 'koin', 'berlian', 'zona_terlihat', 'dibuat_pada'], siswaBaris),
  baris('level', ['id', 'zona', 'urutan', 'jenis', 'judul', 'bawaan', 'terbit', 'pembuat_id', 'pembuat_nama', 'kelas_ids', 'kelas_nonaktif', 'data', 'dibuat_pada', 'diperbarui'], levelBaris),
  baris('progres', ['siswa_id', 'level_id', 'selesai', 'bintang', 'nilai', 'percobaan', 'clue_dibeli', 'kode_terakhir', 'detik', 'selesai_pada', 'diperbarui'], progresBaris),
  baris('aktivitas', ['waktu', 'siswa_id', 'jenis', 'keterangan'], aktivitasBaris),
  baris('pengaturan', ['kunci', 'nilai'], [['harga_clue', '[5,10,20]'], ['koin_awal', '20']])
].join('\n');

const tujuan = fileURLToPath(new URL('../schema.sql', import.meta.url));
writeFileSync(tujuan, sql);
console.log(`schema.sql dibuat: ${guru.length} guru, ${kelas.length} kelas, ${siswa.length} siswa, ${level.length} level, ${progres.length} progres, ${aktivitas.length} aktivitas.`);
