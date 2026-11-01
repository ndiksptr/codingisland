-- migrations/0013_mode_soal.sql — mode pengerjaan soal: teks / blok / keduanya (Tahap 1, fondasi)
-- Hanya ADD COLUMN dengan nilai bawaan aman; tidak ada kolom/tabel lama yang diubah, dihapus, atau diganti nama.
-- level.mode           : 'teks' (bawaan: soal lama tetap diketik seperti sebelumnya), 'blok', atau 'keduanya'.
-- level.kode_awal_blok : kode awal versi blok per soal. Masih kosong (NULL); diisi otomatis di Tahap 2.
-- Selama tahap ini mode belum mengubah apa pun di layar siswa.

ALTER TABLE level ADD COLUMN mode TEXT NOT NULL DEFAULT 'teks' CHECK (mode IN ('teks', 'blok', 'keduanya'));

ALTER TABLE level ADD COLUMN kode_awal_blok TEXT;
