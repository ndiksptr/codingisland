-- migrations/0003_indeks.sql — indeks untuk kueri yang sering dipakai saat banyak siswa bermain bersamaan
-- Aman diulang (IF NOT EXISTS) dan tidak mengubah data.
--
-- Kolom yang SUDAH terindeks otomatis, jadi tidak dibuat indeks tambahan (indeks ganda hanya memperlambat tulis):
--   siswa(username)          -> UNIQUE (sqlite_autoindex_siswa)
--   progres(siswa_id)        -> PRIMARY KEY (siswa_id, level_id); siswa_id kolom pertamanya
--   sesi(token_hash)         -> PRIMARY KEY
--   guru(username), kelas(kode_kelas) -> UNIQUE
--   guru_kelas(guru_id)      -> PRIMARY KEY (guru_id, kelas_id)
--
-- Sudah dibuat di 0001 dan ditegaskan lagi di sini (tidak berubah apa-apa bila sudah ada):
CREATE INDEX IF NOT EXISTS idx_siswa_kelas ON siswa(kelas_id);
CREATE INDEX IF NOT EXISTS idx_progres_level ON progres(level_id);
CREATE INDEX IF NOT EXISTS idx_aktivitas_waktu ON aktivitas(waktu);

-- Baru: pembersihan oportunistis saat login (DELETE ... WHERE kadaluarsa / diperbarui < ?)
CREATE INDEX IF NOT EXISTS idx_sesi_kadaluarsa ON sesi(kadaluarsa);
CREATE INDEX IF NOT EXISTS idx_percobaan_login_diperbarui ON percobaan_login(diperbarui);

-- Baru: filter jenis di halaman Aktivitas dan matriks nilai per kelas
CREATE INDEX IF NOT EXISTS idx_aktivitas_jenis ON aktivitas(jenis, waktu);
CREATE INDEX IF NOT EXISTS idx_nilai_timpa_kelas ON nilai_timpa(kelas_id);
