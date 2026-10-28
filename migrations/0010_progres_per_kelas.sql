-- migrations/0010_progres_per_kelas.sql — kemajuan murid terpisah per kelas
-- Kunci progres menjadi (siswa_id, kelas_id, level_id): soal yang sama di dua kelas punya bintang,
-- nilai, clue, dan percobaan masing-masing. Kunci utama SQLite tidak bisa diubah lewat ALTER, jadi
-- tabelnya dibuat ulang: tabel baru -> salin isi lama -> hapus tabel lama -> ganti nama.
-- Tidak ada tabel lain yang merujuk ke progres, jadi urutan ini aman untuk kunci asing.
-- kelas_id baris lama diambil dari keanggotaan murid (migrasi 0007; saat ini paling banyak satu kelas
-- per murid). Progres murid yang tidak punya kelas tidak bisa ditempatkan dan tidak ikut disalin.
--
-- zona_terlihat (pulau yang animasi pembukaannya sudah dilihat) pindah dari baris murid ke baris
-- keanggotaan, supaya animasi pulau baru muncul lagi saat pulau terbuka di kelas lain.
-- NULL = belum pernah dicatat: kunjungan pertama di kelas itu mencatat diam-diam tanpa animasi.
-- Kolom siswa.zona_terlihat dibiarkan dan sudah tidak dipakai.
-- Koin dan berlian TIDAK berubah: tetap satu dompet di baris murid.

ALTER TABLE siswa_kelas ADD COLUMN zona_terlihat TEXT;
UPDATE siswa_kelas SET zona_terlihat = (SELECT s.zona_terlihat FROM siswa s WHERE s.id = siswa_kelas.siswa_id);

CREATE TABLE progres_baru (
  siswa_id      TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  kelas_id      TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
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
  PRIMARY KEY (siswa_id, kelas_id, level_id)
);

INSERT INTO progres_baru (siswa_id, kelas_id, level_id, selesai, bintang, nilai, percobaan, clue_dibeli, kode_terakhir, detik, selesai_pada, diperbarui)
  SELECT p.siswa_id, sk.kelas_id, p.level_id, p.selesai, p.bintang, p.nilai, p.percobaan, p.clue_dibeli, p.kode_terakhir, p.detik, p.selesai_pada, p.diperbarui
  FROM progres p JOIN siswa_kelas sk ON sk.siswa_id = p.siswa_id;

DROP TABLE progres;

ALTER TABLE progres_baru RENAME TO progres;

CREATE INDEX IF NOT EXISTS idx_progres_level ON progres(level_id);
CREATE INDEX IF NOT EXISTS idx_progres_kelas ON progres(kelas_id, level_id);
