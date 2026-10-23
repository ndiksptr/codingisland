-- migrations/0002_hapus_data_demo.sql — hapus data contoh dari masa demo
-- Menghapus SEMUA baris di tabel sesi, percobaan_login, aktivitas, progres, nilai_timpa,
-- catatan_guru, siswa, guru_kelas, guru, dan kelas (anak dulu, induk terakhir sesuai foreign key).
-- Tabel level dan pengaturan TIDAK disentuh.
--
-- Pengaman: setiap perintah hanya berjalan bila database masih berisi jejak data contoh
-- (guru guru_admin/guru_sari/guru_budi, kelas kelas_3a–kelas_6a, atau siswa siswa_3a_1 dst.).
-- Database baru yang dipasang lewat #/pasang tidak pernah memakai id tersebut, jadi migrasi ini
-- tidak menghapus apa pun di sana. Pemeriksaan ada di setiap perintah agar tetap berlaku
-- sampai baris guru (penanda terakhir) dihapus di perintah paling akhir.
--
-- Jalankan lewat:  npx wrangler d1 migrations apply coding-island-db --remote
-- (buat cadangan dulu: npx wrangler d1 export coding-island-db --remote --output=cadangan-sebelum-live.sql)

DELETE FROM sesi WHERE EXISTS (SELECT 1 FROM guru WHERE id IN ('guru_admin', 'guru_sari', 'guru_budi'))
  OR EXISTS (SELECT 1 FROM kelas WHERE id IN ('kelas_3a', 'kelas_4a', 'kelas_5a', 'kelas_6a'))
  OR EXISTS (SELECT 1 FROM siswa WHERE id GLOB 'siswa_[3-6]a_[0-9]*');

DELETE FROM percobaan_login WHERE EXISTS (SELECT 1 FROM guru WHERE id IN ('guru_admin', 'guru_sari', 'guru_budi'))
  OR EXISTS (SELECT 1 FROM kelas WHERE id IN ('kelas_3a', 'kelas_4a', 'kelas_5a', 'kelas_6a'))
  OR EXISTS (SELECT 1 FROM siswa WHERE id GLOB 'siswa_[3-6]a_[0-9]*');

DELETE FROM aktivitas WHERE EXISTS (SELECT 1 FROM guru WHERE id IN ('guru_admin', 'guru_sari', 'guru_budi'))
  OR EXISTS (SELECT 1 FROM kelas WHERE id IN ('kelas_3a', 'kelas_4a', 'kelas_5a', 'kelas_6a'))
  OR EXISTS (SELECT 1 FROM siswa WHERE id GLOB 'siswa_[3-6]a_[0-9]*');

DELETE FROM progres WHERE EXISTS (SELECT 1 FROM guru WHERE id IN ('guru_admin', 'guru_sari', 'guru_budi'))
  OR EXISTS (SELECT 1 FROM kelas WHERE id IN ('kelas_3a', 'kelas_4a', 'kelas_5a', 'kelas_6a'))
  OR EXISTS (SELECT 1 FROM siswa WHERE id GLOB 'siswa_[3-6]a_[0-9]*');

DELETE FROM nilai_timpa WHERE EXISTS (SELECT 1 FROM guru WHERE id IN ('guru_admin', 'guru_sari', 'guru_budi'))
  OR EXISTS (SELECT 1 FROM kelas WHERE id IN ('kelas_3a', 'kelas_4a', 'kelas_5a', 'kelas_6a'))
  OR EXISTS (SELECT 1 FROM siswa WHERE id GLOB 'siswa_[3-6]a_[0-9]*');

DELETE FROM catatan_guru WHERE EXISTS (SELECT 1 FROM guru WHERE id IN ('guru_admin', 'guru_sari', 'guru_budi'))
  OR EXISTS (SELECT 1 FROM kelas WHERE id IN ('kelas_3a', 'kelas_4a', 'kelas_5a', 'kelas_6a'))
  OR EXISTS (SELECT 1 FROM siswa WHERE id GLOB 'siswa_[3-6]a_[0-9]*');

DELETE FROM siswa WHERE EXISTS (SELECT 1 FROM guru WHERE id IN ('guru_admin', 'guru_sari', 'guru_budi'))
  OR EXISTS (SELECT 1 FROM kelas WHERE id IN ('kelas_3a', 'kelas_4a', 'kelas_5a', 'kelas_6a'))
  OR EXISTS (SELECT 1 FROM siswa WHERE id GLOB 'siswa_[3-6]a_[0-9]*');

DELETE FROM guru_kelas WHERE EXISTS (SELECT 1 FROM guru WHERE id IN ('guru_admin', 'guru_sari', 'guru_budi'))
  OR EXISTS (SELECT 1 FROM kelas WHERE id IN ('kelas_3a', 'kelas_4a', 'kelas_5a', 'kelas_6a'));

-- kelas dihapus sebelum guru, karena baris guru adalah penanda terakhir yang masih diperiksa
DELETE FROM kelas WHERE EXISTS (SELECT 1 FROM guru WHERE id IN ('guru_admin', 'guru_sari', 'guru_budi'))
  OR EXISTS (SELECT 1 FROM kelas WHERE id IN ('kelas_3a', 'kelas_4a', 'kelas_5a', 'kelas_6a'));

DELETE FROM guru WHERE EXISTS (SELECT 1 FROM guru WHERE id IN ('guru_admin', 'guru_sari', 'guru_budi'));
