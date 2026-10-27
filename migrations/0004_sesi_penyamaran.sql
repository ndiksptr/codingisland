-- migrations/0004_sesi_penyamaran.sql — admin bisa masuk sebagai guru ("menyamar")
-- Sesi penyamaran adalah sesi guru biasa (jenis = 'guru', pengguna_id = id guru) yang
-- menyimpan id admin aslinya. NULL = sesi biasa (bukan penyamaran).
-- Bila akun admin itu dihapus, sesi penyamarannya ikut terhapus.
ALTER TABLE sesi ADD COLUMN admin_asli_id TEXT REFERENCES guru(id) ON DELETE CASCADE;
