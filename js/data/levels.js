// js/data/levels.js — data pendukung soal (tidak ada lagi soal bawaan: semua soal dibuat guru)
// jenis soal: 'ketik' (editor kosong) | 'debug' (kode awal sengaja salah) | 'boss' (level terakhir zona)
//
// Field soal (disimpan lewat editor level guru):
//   instruksi        teks sangat singkat untuk siswa
//   tantanganBonus   kalimat tambahan (sudah tidak ditampilkan ke murid; dibiarkan di data lama)
//   tujuanTeks       [{ teks, jenis: 'sampai' }] atau [{ teks, jenis: 'ambil', jumlah }]
//   dunia            { kolom, baris, robot {x,y,arah}, tujuan {x,y}, item [], rintangan [], jurang [] }
//   perintahTersedia nama perintah yang boleh dipakai (lihat SEMUA_PERINTAH di interpreter.js)
//   kodeAwal         isi editor saat pertama dibuka (untuk level debug: kode yang sengaja salah)
//   solusi           contoh jawaban; diperiksa otomatis sebelum terbit
//   batasBaris       jumlah baris maksimal untuk bintang ketiga
//   clue             [Clue 1 petunjuk arah, Clue 2 langkah berikutnya / baris bermasalah, Clue 3 potongan jawaban]
//   kelasIds         kelas yang memakai soal ini (null = semua kelas, [] = belum tampil di kelas mana pun)

// Perintah yang terbuka bertambah setiap pulau
const PERINTAH_PANTAI = ['maju', 'belok_kiri', 'belok_kanan', 'ambil'];
const PERINTAH_LAUT = [...PERINTAH_PANTAI, 'ulangi'];
const PERINTAH_GURUN = [...PERINTAH_LAUT, 'lompat', 'jika', 'ada_jurang', 'ada_rintangan'];
const PERINTAH_SALJU = [...PERINTAH_GURUN, 'selama', 'sampai_tujuan', 'buat'];

/** Perintah bawaan tiap zona (dipakai sebagai isian awal di editor level guru). */
export const PERINTAH_ZONA = { pantai: PERINTAH_PANTAI, laut: PERINTAH_LAUT, gurun: PERINTAH_GURUN, salju: PERINTAH_SALJU };

/** Label jenis level untuk ditampilkan ke siswa. */
export const LABEL_JENIS = {
  ketik: 'Ketik Kode',
  debug: 'Perbaiki Bug',
  boss: 'Level Boss'
};
