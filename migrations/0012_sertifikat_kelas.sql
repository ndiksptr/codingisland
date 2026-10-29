-- migrations/0012_sertifikat_kelas.sql — isi sertifikat juara diatur guru per kelas
-- kelas.sertifikat: JSON { sekolah, ttdNama, ttdJabatan }. NULL = bawaan (tanpa nama sekolah,
-- ditandatangani "Robot Tutor"). Hanya mengubah tampilan sertifikat; aturan juara tidak berubah.

ALTER TABLE kelas ADD COLUMN sertifikat TEXT;
