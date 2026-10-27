-- migrations/0005_siswa_bahasa.sql — bahasa nama perintah koding pilihan murid
-- 'id' = Indonesia (bawaan), 'en' = Inggris. Hanya nama perintah yang berganti; tampilan tetap bahasa Indonesia.
-- Kode murid tetap disimpan apa adanya; interpreter menerima kedua bahasa apa pun pilihannya.
ALTER TABLE siswa ADD COLUMN bahasa TEXT NOT NULL DEFAULT 'id' CHECK (bahasa IN ('id', 'en'));
