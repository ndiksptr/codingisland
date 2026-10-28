-- migrations/0007_keanggotaan_kelas.sql — satu murid boleh menjadi anggota banyak kelas (reguler + ekskul)
-- siswa_kelas menggantikan kolom siswa.kelas_id. Kolom lama TIDAK dihapus (menghapus kolom yang
-- berindeks dan berkunci asing di SQLite berarti membongkar tabel siswa), tetapi sudah tidak dibaca
-- maupun diisi lagi oleh kode mana pun.
-- sesi.kelas_aktif_id: kelas yang sedang dimainkan murid di sesi ini (NULL = belum memilih).

CREATE TABLE IF NOT EXISTS siswa_kelas (
  siswa_id       TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  kelas_id       TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  bergabung_pada TEXT NOT NULL,
  PRIMARY KEY (siswa_id, kelas_id)
);
CREATE INDEX IF NOT EXISTS idx_siswa_kelas_kelas ON siswa_kelas(kelas_id);

-- Isi dari kolom lama supaya tidak ada murid yang kehilangan kelasnya
INSERT OR IGNORE INTO siswa_kelas (siswa_id, kelas_id, bergabung_pada)
  SELECT id, kelas_id, dibuat_pada FROM siswa WHERE kelas_id IS NOT NULL;

ALTER TABLE sesi ADD COLUMN kelas_aktif_id TEXT REFERENCES kelas(id) ON DELETE SET NULL;
