// js/data/levels.js — data awal 13 level
// jenis: 'ketik' (editor kosong) | 'debug' (perbaiki kode) | 'boss' (level terakhir zona)
// terbit: true dan kelasIds: null berarti level tampil untuk semua kelas.
//
// Field soal (level tanpa field 'dunia' belum bisa dimainkan):
//   instruksi        teks penjelasan untuk siswa
//   tujuanTeks       [{ teks, jenis: 'sampai' }] atau [{ teks, jenis: 'ambil', jumlah }]
//   dunia            { kolom, baris, robot {x,y,arah}, tujuan {x,y}, item [], rintangan [], jurang [] }
//   perintahTersedia nama perintah yang boleh dipakai (lihat SEMUA_PERINTAH di interpreter.js)
//   kodeAwal         isi editor saat pertama dibuka
//   solusi           contoh jawaban (untuk guru dan pengujian)
//   batasBaris       jumlah baris maksimal untuk 3 bintang
//   clue             3 petunjuk bertingkat (dipakai di Tahap 6)

// Detail soal per level. Level lain menyusul.
const SOAL = {
  'pantai-1': {
    instruksi: 'Bantu robot berjalan ke bendera! Ketik maju() untuk maju 1 petak. Kamu juga bisa menulis maju(4) supaya robot maju 4 petak sekaligus.',
    tujuanTeks: [{ teks: 'Sampai di bendera', jenis: 'sampai' }],
    dunia: {
      kolom: 8, baris: 5,
      robot: { x: 1, y: 2, arah: 'timur' },
      tujuan: { x: 5, y: 2 },
      item: [],
      rintangan: [{ jenis: 'batu', x: 3, y: 0 }, { jenis: 'batu', x: 6, y: 4 }, { jenis: 'batu', x: 0, y: 4 }],
      jurang: []
    },
    perintahTersedia: ['maju'],
    kodeAwal: '// Ketik perintahmu di bawah ini\n',
    solusi: 'maju(4)',
    batasBaris: 4,
    clue: [
      'Bendera ada lurus di depan robot. Robot cukup berjalan maju.',
      'Hitung petaknya: dari robot ke bendera ada 4 petak.',
      'Tulis maju() empat kali, atau cukup maju(4).'
    ]
  },
  'pantai-2': {
    instruksi: 'Kumpulkan 2 koin di jalan, lalu belok menuju bendera. Ketik ambil() saat robot berdiri di atas koin. Pakai belok_kanan() atau belok_kiri() untuk berbelok.',
    tujuanTeks: [{ teks: 'Ambil 2 koin', jenis: 'ambil', jumlah: 2 }, { teks: 'Sampai di bendera', jenis: 'sampai' }],
    dunia: {
      kolom: 8, baris: 5,
      robot: { x: 0, y: 1, arah: 'timur' },
      tujuan: { x: 5, y: 3 },
      item: [{ jenis: 'koin', x: 2, y: 1, wajib: true }, { jenis: 'koin', x: 4, y: 1, wajib: true }],
      rintangan: [{ jenis: 'batu', x: 6, y: 1 }, { jenis: 'batu', x: 1, y: 3 }, { jenis: 'batu', x: 7, y: 4 }],
      jurang: []
    },
    perintahTersedia: ['maju', 'belok_kiri', 'belok_kanan', 'ambil'],
    kodeAwal: '// Ambil 2 koin, lalu menuju bendera\n',
    solusi: 'maju(2)\nambil()\nmaju(2)\nambil()\nmaju()\nbelok_kanan()\nmaju(2)',
    batasBaris: 7,
    clue: [
      'Robot harus berhenti tepat di atas koin, baru ketik ambil().',
      'Koin pertama 2 petak di depan robot. Koin kedua 2 petak sesudahnya.',
      'Setelah koin kedua: maju() sekali, belok_kanan(), lalu maju(2).'
    ]
  }
};

export const LEVEL_AWAL = [
  // ---------- Pantai: urutan perintah ----------
  { id: 'pantai-1', zona: 'pantai', urutan: 1, jenis: 'ketik', judul: 'Langkah Pertama', ringkasan: 'Gerakkan robot maju sampai ke bendera.' },
  { id: 'pantai-2', zona: 'pantai', urutan: 2, jenis: 'ketik', judul: 'Koin di Tepi Pantai', ringkasan: 'Ambil 2 koin, lalu belok menuju bendera.' },
  { id: 'pantai-3', zona: 'pantai', urutan: 3, jenis: 'debug', judul: 'Langkah yang Tertukar', ringkasan: 'Ada perintah yang urutannya tertukar. Perbaiki ya!' },
  { id: 'pantai-4', zona: 'pantai', urutan: 4, jenis: 'boss', judul: 'Boss Kepiting Raksasa', ringkasan: 'Susun perintah panjang untuk melewati batu dan jurang.' },

  // ---------- Laut: perulangan ----------
  { id: 'laut-1', zona: 'laut', urutan: 1, jenis: 'ketik', judul: 'Berenang Jauh', ringkasan: 'Gunakan ulangi agar robot maju jauh tanpa mengetik banyak.' },
  { id: 'laut-2', zona: 'laut', urutan: 2, jenis: 'debug', judul: 'Ombak Berulang', ringkasan: 'Jumlah perulangannya salah. Temukan bug-nya!' },
  { id: 'laut-3', zona: 'laut', urutan: 3, jenis: 'boss', judul: 'Boss Gurita Pusing', ringkasan: 'Gabungkan perulangan dan belokan untuk keluar dari pusaran.' },

  // ---------- Gurun: kondisi jika ----------
  { id: 'gurun-1', zona: 'gurun', urutan: 1, jenis: 'ketik', judul: 'Jika Ada Batu', ringkasan: 'Ajari robot memeriksa jalan di depannya sebelum melangkah.' },
  { id: 'gurun-2', zona: 'gurun', urutan: 2, jenis: 'debug', judul: 'Fatamorgana', ringkasan: 'Kondisi jika-nya terbalik. Perbaiki supaya robot tidak jatuh.' },
  { id: 'gurun-3', zona: 'gurun', urutan: 3, jenis: 'boss', judul: 'Boss Badai Pasir', ringkasan: 'Pakai jika dan perulangan untuk melewati gurun yang berubah-ubah.' },

  // ---------- Pegunungan Salju: gabungan & variabel ----------
  { id: 'salju-1', zona: 'salju', urutan: 1, jenis: 'ketik', judul: 'Kantong Ajaib', ringkasan: 'Simpan jumlah langkah di dalam variabel.' },
  { id: 'salju-2', zona: 'salju', urutan: 2, jenis: 'debug', judul: 'Es yang Licin', ringkasan: 'Nilai variabelnya keliru. Cari dan perbaiki!' },
  { id: 'salju-3', zona: 'salju', urutan: 3, jenis: 'boss', judul: 'Boss Puncak Salju', ringkasan: 'Gabungkan semua jurus untuk mencapai puncak gunung.' }
].map((l) => ({ ...l, ...(SOAL[l.id] || {}), terbit: true, kelasIds: null }));

/** Label jenis level untuk ditampilkan ke siswa. */
export const LABEL_JENIS = {
  ketik: 'Ketik Kode',
  debug: 'Perbaiki Bug',
  boss: 'Level Boss'
};
