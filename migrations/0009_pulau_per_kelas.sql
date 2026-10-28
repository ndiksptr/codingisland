-- migrations/0009_pulau_per_kelas.sql — tiap kelas memilih pulau (map) yang dipakai beserta urutannya
-- kelas.zona_ids: JSON array id zona dalam urutan main, mis. ["pantai","gurun"]. Definisi pulau
-- (nama, gambar, warna) tetap di js/data/zona.js; yang menjadi milik kelas hanya pilihan dan urutannya.
-- Pulau yang dipilih tetapi belum berisi soal disembunyikan otomatis dari murid.
-- Menggantikan sakelar menyeluruh pengaturan.zona_nonaktif.

ALTER TABLE kelas ADD COLUMN zona_ids TEXT NOT NULL DEFAULT '["pantai","laut","gurun","salju"]';

-- Kelas lama mengikuti sakelar lama: pulau yang dulu dimatikan tidak ikut dipilih (urutan tetap)
UPDATE kelas SET zona_ids = (
  SELECT json_group_array(value) FROM (
    SELECT value FROM json_each('["pantai","laut","gurun","salju"]')
    WHERE value NOT IN (SELECT value FROM json_each(COALESCE((SELECT nilai FROM pengaturan WHERE kunci = 'zona_nonaktif'), '[]')))
    ORDER BY key
  )
);

DELETE FROM pengaturan WHERE kunci = 'zona_nonaktif';
