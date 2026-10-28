-- migrations/0011_jenis_kelas.sql — jenis kelas: 'reguler' (bawaan) atau 'ekskul'
-- Kolom tingkat tetap ada dengan aturan CHECK lamanya (1–6). Tabel kelas TIDAK dibongkar, karena
-- dirujuk guru_kelas, siswa_kelas, siswa, nilai_timpa, dan progres. Untuk kelas ekskul, nilai tingkat
-- hanya pengisi supaya lolos NOT NULL/CHECK dan tidak pernah ditampilkan: di mana pun kelas ekskul
-- ditulis "Ekskul". Selain label dan urutan tampilan, ekskul berperilaku sama persis dengan kelas reguler.

ALTER TABLE kelas ADD COLUMN jenis TEXT NOT NULL DEFAULT 'reguler' CHECK (jenis IN ('reguler', 'ekskul'));

-- Kelas ekskul yang sudah dibuat dengan tingkat palsu dikenali dari namanya (bisa diubah lagi lewat form Edit kelas)
UPDATE kelas SET jenis = 'ekskul' WHERE nama LIKE '%ekskul%' OR nama LIKE '%ekstrakurikuler%';
