-- migrations/0006_bahasa_bawaan_inggris.sql — bahasa perintah koding bawaan murid menjadi Inggris
-- Kolom siswa.bahasa (migrasi 0005) DEFAULT-nya tetap 'id' karena SQLite tidak bisa mengubah DEFAULT;
-- murid baru diberi 'en' langsung oleh kode (BAHASA_BAWAAN_SISWA di js/game/kamus-perintah.js).
-- Murid lama ikut menjadi 'en'. Mereka tetap bisa memilih bahasa Indonesia lagi di halaman Profil.
UPDATE siswa SET bahasa = 'en' WHERE bahasa = 'id';
