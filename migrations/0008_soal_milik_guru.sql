-- migrations/0008_soal_milik_guru.sql — tidak ada lagi soal bawaan; semua soal dibuat guru
-- 1) Hapus 13 soal bawaan yang dulu disemai migrasi 0001. Progres murid pada soal itu ikut terhapus
--    lewat ON DELETE CASCADE. Soal buatan guru (bawaan = 0) tidak disentuh.
--    Perintah DELETE tidak ikut ke server/skema.js; database baru memang tidak lagi disemai soal.
-- 2) Fitur "nonaktifkan soal untuk kelas tertentu" dihapus: kelas yang memakai soal kini cukup
--    diatur lewat centang Kelas (kolom kelas_ids).

DELETE FROM level WHERE bawaan = 1;

ALTER TABLE level DROP COLUMN kelas_nonaktif;
