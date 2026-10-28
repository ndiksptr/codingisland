// js/data/levels.js — data 13 level Coding Island
// jenis: 'ketik' (editor kosong) | 'debug' (kode awal sengaja salah) | 'boss' (level terakhir zona)
// terbit: true dan kelasIds: null berarti level tampil untuk semua kelas.
//
// Field soal:
//   instruksi        teks sangat singkat untuk siswa
//   tantanganBonus   kalimat tambahan (sudah tidak ditampilkan ke murid; dibiarkan di data lama)
//   tujuanTeks       [{ teks, jenis: 'sampai' }] atau [{ teks, jenis: 'ambil', jumlah }]
//   dunia            { kolom, baris, robot {x,y,arah}, tujuan {x,y}, item [], rintangan [], jurang [] }
//                    ditulis sebagai peta teks lewat duniaDariTeks (lihat js/game/dunia.js):
//                    > < ^ v robot, F bendera, # rintangan, O jurang, $ koin wajib, . kosong
//   perintahTersedia nama perintah yang boleh dipakai (lihat SEMUA_PERINTAH di interpreter.js)
//   kodeAwal         isi editor saat pertama dibuka (untuk level debug: kode yang sengaja salah)
//   solusi           contoh jawaban; diperiksa otomatis oleh ciDev.validasiLevel()
//   batasBaris       jumlah baris maksimal untuk bintang ketiga
//   clue             [Clue 1 petunjuk arah, Clue 2 langkah berikutnya / baris bermasalah, Clue 3 potongan jawaban]

import { duniaDariTeks } from '../game/dunia.js';

// Perintah yang terbuka bertambah setiap pulau
const PERINTAH_PANTAI = ['maju', 'belok_kiri', 'belok_kanan', 'ambil'];
const PERINTAH_LAUT = [...PERINTAH_PANTAI, 'ulangi'];
const PERINTAH_GURUN = [...PERINTAH_LAUT, 'lompat', 'jika', 'ada_jurang', 'ada_rintangan'];
const PERINTAH_SALJU = [...PERINTAH_GURUN, 'selama', 'sampai_tujuan', 'buat'];

/** Perintah bawaan tiap zona (dipakai juga sebagai isian awal di editor level guru). */
export const PERINTAH_ZONA = { pantai: PERINTAH_PANTAI, laut: PERINTAH_LAUT, gurun: PERINTAH_GURUN, salju: PERINTAH_SALJU };

const SAMPAI = { teks: 'Sampai di bendera', jenis: 'sampai' };
const ambil = (jumlah) => ({ teks: `Ambil ${jumlah} koin`, jenis: 'ambil', jumlah });
const baris = (...isi) => isi.join('\n');

// Detail soal per level
const SOAL = {
  // =====================================================================
  // PANTAI — urutan perintah
  // =====================================================================
  'pantai-1': {
    instruksi: 'Bawa robot ke bendera! Ketik maju() untuk maju 1 petak.',
    tantanganBonus: 'Bisakah kamu menyelesaikannya hanya dengan 1 baris? Coba maju(4).',
    tujuanTeks: [SAMPAI],
    dunia: duniaDariTeks([
      '...#....',
      '........',
      '.>...F..',
      '........',
      '#.....#.'
    ], { rintangan: 'batu' }),
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
    instruksi: 'Ambil 2 koin, lalu belok ke bendera. Ketik ambil() saat robot berdiri di atas koin.',
    tantanganBonus: 'Pakai maju(2) supaya kodemu cukup 7 baris.',
    tujuanTeks: [ambil(2), SAMPAI],
    dunia: duniaDariTeks([
      '........',
      '>.$.$.#.',
      '........',
      '.#...F..',
      '.......#'
    ], { rintangan: 'batu' }),
    perintahTersedia: PERINTAH_PANTAI,
    kodeAwal: '// Ambil 2 koin, lalu menuju bendera\n',
    solusi: baris('maju(2)', 'ambil()', 'maju(2)', 'ambil()', 'maju()', 'belok_kanan()', 'maju(2)'),
    batasBaris: 7,
    clue: [
      'Robot berjalan lurus mengambil koin, lalu belok ke bawah (kanan robot) menuju bendera.',
      'Robot harus berhenti tepat di atas koin, baru ketik ambil(). Koin pertama 2 petak di depan.',
      'Setelah koin kedua: maju() sekali, belok_kanan(), lalu maju(2).'
    ]
  },
  'pantai-3': {
    instruksi: 'Robot berbelok ke arah yang salah. Perbaiki kodenya!',
    tantanganBonus: 'Sebelum menekan Jalankan, tebak dulu ke mana robot akan pergi.',
    tujuanTeks: [SAMPAI],
    dunia: duniaDariTeks([
      '........',
      '.>..#...',
      '........',
      '......F.',
      '#......#'
    ], { rintangan: 'batu' }),
    perintahTersedia: PERINTAH_PANTAI,
    kodeAwal: baris(
      '// Ada bug! Arah beloknya tertukar.',
      'maju(2)',
      'belok_kiri()',
      'maju(2)',
      'belok_kanan()',
      'maju(3)'
    ),
    solusi: baris('maju(2)', 'belok_kanan()', 'maju(2)', 'belok_kiri()', 'maju(3)'),
    batasBaris: 5,
    clue: [
      'Di depan batu, robot harus turun ke bawah dulu, baru berjalan ke kanan.',
      'Baris 3 bermasalah: belok_kiri() membuat robot naik ke atas lalu keluar peta.',
      'Tukar dua perintah belok: baris 3 jadi belok_kanan() dan baris 5 jadi belok_kiri().'
    ]
  },
  'pantai-4': {
    instruksi: 'Boss! Lewati labirin batu dan ambil 3 koin.',
    tantanganBonus: 'Selesaikan dalam 8 baris atau kurang dengan memakai maju(2).',
    tujuanTeks: [ambil(3), SAMPAI],
    dunia: duniaDariTeks([
      '>.$.$#..',
      '####.#..',
      '..#.$#..',
      '..#..#..',
      '....F...'
    ], { rintangan: 'batu' }),
    perintahTersedia: PERINTAH_PANTAI,
    kodeAwal: '// Kalahkan boss: ambil 3 koin lalu ke bendera\n',
    solusi: baris('maju(2)', 'ambil()', 'maju(2)', 'ambil()', 'belok_kanan()', 'maju(2)', 'ambil()', 'maju(2)'),
    batasBaris: 8,
    clue: [
      'Ambil 2 koin di baris atas, lalu turun lewat lorong di antara batu.',
      'Setelah koin kedua, ada batu di depan robot. Belok ke kanan robot (ke bawah).',
      'Awalnya: maju(2), ambil(), maju(2), ambil(), belok_kanan() ...'
    ]
  },

  // =====================================================================
  // LAUT — perulangan
  // =====================================================================
  'laut-1': {
    instruksi: 'Robot harus maju 6 kali. Pakai ulangi supaya kodemu pendek!',
    tantanganBonus: 'Tulis kodenya hanya dengan 2 baris perintah.',
    tujuanTeks: [SAMPAI],
    dunia: duniaDariTeks([
      '........',
      '...#....',
      '>.....F.',
      '........',
      '.#....#.'
    ], { rintangan: 'karang' }),
    perintahTersedia: PERINTAH_LAUT,
    kodeAwal: '// Contoh: ulangi 3 { ... }\n',
    solusi: baris('ulangi 6 {', '  maju()', '}'),
    batasBaris: 2,
    clue: [
      'Bendera ada lurus di depan robot, 6 petak jauhnya.',
      'Tulis ulangi 6 { lalu maju() di baris berikutnya, dan tutup dengan }.',
      'ulangi 6 {\n  maju()\n}'
    ]
  },
  'laut-2': {
    instruksi: 'Robot berjalan terlalu jauh! Perbaiki angka ulangi.',
    tantanganBonus: 'Hitung petaknya tanpa menjalankan kode dulu.',
    tujuanTeks: [SAMPAI],
    dunia: duniaDariTeks([
      '..#.....',
      '........',
      '>....F..',
      '........',
      '......#.'
    ], { rintangan: 'karang' }),
    perintahTersedia: PERINTAH_LAUT,
    kodeAwal: baris(
      '// Ada bug! Robot melewati bendera.',
      'ulangi 7 {',
      '  maju()',
      '}'
    ),
    solusi: baris('ulangi 5 {', '  maju()', '}'),
    batasBaris: 2,
    clue: [
      'Bendera ada di depan robot. Hitung petak dari robot sampai bendera.',
      'Baris 2 bermasalah: angka 7 terlalu besar.',
      'Ganti menjadi ulangi 5 {'
    ]
  },
  'laut-3': {
    instruksi: 'Boss! Turuni tangga karang dan ambil 4 koin. Pakai ulangi berisi beberapa perintah.',
    tantanganBonus: 'Kodemu bisa selesai dalam 7 baris.',
    tujuanTeks: [ambil(4), SAMPAI],
    dunia: duniaDariTeks([
      '>.#.....',
      '.$.#....',
      '..$.#...',
      '...$.#..',
      '....$F..'
    ], { rintangan: 'karang' }),
    perintahTersedia: PERINTAH_LAUT,
    kodeAwal: '// Kalahkan boss: turuni tangga dan ambil 4 koin\n',
    solusi: baris('ulangi 4 {', '  maju()', '  belok_kanan()', '  maju()', '  belok_kiri()', '  ambil()', '}', 'maju()'),
    batasBaris: 7,
    clue: [
      'Robot bergerak seperti menuruni tangga: ke kanan 1, ke bawah 1, lalu ambil koin.',
      'Satu anak tangga = maju(), belok_kanan(), maju(), belok_kiri(), ambil(). Ulangi 4 kali.',
      'ulangi 4 {\n  maju()\n  belok_kanan()\n  maju()\n  belok_kiri()\n  ambil()\n}'
    ]
  },

  // =====================================================================
  // GURUN — lompat dan kondisi jika
  // =====================================================================
  'gurun-1': {
    instruksi: 'Ada jurang! Ketik lompat() untuk melompati 1 jurang.',
    tantanganBonus: 'Hitung dulu: di petak mana saja robot harus melompat?',
    tujuanTeks: [SAMPAI],
    dunia: duniaDariTeks([
      '..#.....',
      '........',
      '>.O..O.F',
      '........',
      '....#...'
    ], { rintangan: 'kaktus' }),
    perintahTersedia: PERINTAH_GURUN,
    kodeAwal: '// Lompati jurang dengan lompat()\n',
    solusi: baris('maju()', 'lompat()', 'maju()', 'lompat()', 'maju()'),
    batasBaris: 5,
    clue: [
      'Robot berjalan lurus. Setiap kali ada jurang tepat di depan, robot harus melompat.',
      'Mulai dengan maju() sekali, karena jurang pertama ada 2 petak di depan.',
      'maju()\nlompat()\nmaju()\nlompat() ...'
    ]
  },
  'gurun-2': {
    instruksi: 'Robot jatuh ke jurang! Ada yang tertukar di dalam jika. Perbaiki ya.',
    tantanganBonus: 'Jelaskan dengan kata-katamu sendiri apa arti jika ... lainnya.',
    tujuanTeks: [SAMPAI],
    dunia: duniaDariTeks([
      '.#......',
      '........',
      '>.O.O..F',
      '........',
      '.....#..'
    ], { rintangan: 'kaktus' }),
    perintahTersedia: PERINTAH_GURUN,
    kodeAwal: baris(
      '// Ada bug! Robot melompat di saat yang salah.',
      'ulangi 5 {',
      '  jika ada_jurang() {',
      '    maju()',
      '  } lainnya {',
      '    lompat()',
      '  }',
      '}'
    ),
    solusi: baris('ulangi 5 {', '  jika ada_jurang() {', '    lompat()', '  } lainnya {', '    maju()', '  }', '}'),
    batasBaris: 5,
    clue: [
      'Jika ada jurang di depan, robot harus melompat. Jika tidak ada, robot cukup maju.',
      'Baris 4 dan baris 6 bermasalah: isinya tertukar.',
      'jika ada_jurang() {\n  lompat()\n} lainnya {\n  maju()\n}'
    ]
  },
  'gurun-3': {
    instruksi: 'Boss! Jalan panjang penuh jurang. Pakai ulangi berisi jika ada_jurang().',
    tantanganBonus: 'Berapa kali ulangi yang tepat? Hitung tanpa mencoba-coba.',
    tujuanTeks: [SAMPAI],
    dunia: duniaDariTeks([
      '...#......#.',
      '............',
      '>.O.O..O.O.F',
      '............',
      '.#.....#....'
    ], { rintangan: 'kaktus' }),
    perintahTersedia: PERINTAH_GURUN,
    kodeAwal: '// Kalahkan boss: seberangi semua jurang\n',
    solusi: baris('ulangi 7 {', '  jika ada_jurang() {', '    lompat()', '  } lainnya {', '    maju()', '  }', '}'),
    batasBaris: 5,
    clue: [
      'Setiap langkah, robot memeriksa: ada jurang di depan? Lompat. Tidak ada? Maju.',
      'Hitung gerakan robot sampai bendera: ada 4 lompatan dan 3 langkah maju, jadi 7 kali.',
      'ulangi 7 {\n  jika ada_jurang() {\n    lompat()\n  } lainnya {\n    maju()\n  }\n}'
    ]
  },

  // =====================================================================
  // PEGUNUNGAN SALJU — variabel dan selama
  // =====================================================================
  'salju-1': {
    instruksi: 'Simpan angka di variabel: buat langkah = 3, lalu pakai maju(langkah).',
    tantanganBonus: 'Pakai variabel langkah dua kali di kodemu.',
    tujuanTeks: [SAMPAI],
    dunia: duniaDariTeks([
      '.>......',
      '......#.',
      '..#.....',
      '....F...',
      '.......#'
    ], { rintangan: 'es' }),
    perintahTersedia: PERINTAH_SALJU,
    kodeAwal: '// Contoh: buat langkah = 3\n',
    solusi: baris('buat langkah = 3', 'maju(langkah)', 'belok_kanan()', 'maju(langkah)'),
    batasBaris: 4,
    clue: [
      'Robot maju 3 petak ke kanan, lalu belok ke bawah dan maju 3 petak lagi.',
      'Baris pertama: buat langkah = 3. Lalu robot maju sejauh langkah.',
      'buat langkah = 3\nmaju(langkah)\nbelok_kanan() ...'
    ]
  },
  'salju-2': {
    instruksi: 'Robot berputar terus tanpa henti! Perbaiki isi selama.',
    tantanganBonus: 'Kenapa perulangan tadi tidak pernah berhenti?',
    tujuanTeks: [SAMPAI],
    dunia: duniaDariTeks([
      '....#...',
      '........',
      '>.....F.',
      '........',
      '.#......'
    ], { rintangan: 'es' }),
    perintahTersedia: PERINTAH_SALJU,
    kodeAwal: baris(
      '// Ada bug! Robot tidak pernah sampai.',
      'selama bukan sampai_tujuan() {',
      '  belok_kanan()',
      '}'
    ),
    solusi: baris('selama bukan sampai_tujuan() {', '  maju()', '}'),
    batasBaris: 2,
    clue: [
      'Bendera lurus di depan robot. Robot cukup terus maju sampai tiba.',
      'Baris 3 bermasalah: belok_kanan() hanya memutar robot, robot tidak pernah berpindah.',
      'selama bukan sampai_tujuan() {\n  maju()\n}'
    ]
  },
  'salju-3': {
    instruksi: 'Boss terakhir! Robot berjalan sendiri sampai bendera dan belok saat ada rintangan.',
    tantanganBonus: 'Kodemu hanya perlu 5 baris, tanpa angka sama sekali.',
    tujuanTeks: [SAMPAI],
    dunia: duniaDariTeks([
      '>....#..',
      '.......#',
      '.F....#.',
      '....#...',
      '......#.'
    ], { rintangan: 'es' }),
    perintahTersedia: PERINTAH_SALJU,
    kodeAwal: '// Kalahkan boss terakhir: pakai selama dan jika\n',
    solusi: baris(
      'selama bukan sampai_tujuan() {',
      '  jika ada_rintangan() {',
      '    belok_kanan()',
      '  } lainnya {',
      '    maju()',
      '  }',
      '}'
    ),
    batasBaris: 5,
    clue: [
      'Robot terus maju. Setiap bertemu bongkahan es, robot belok ke kanan.',
      'Pakai selama bukan sampai_tujuan() { ... } dan di dalamnya jika ada_rintangan().',
      'selama bukan sampai_tujuan() {\n  jika ada_rintangan() {\n    belok_kanan()\n  } lainnya {'
    ]
  }
};

export const LEVEL_AWAL = [
  // ---------- Pantai: urutan perintah ----------
  { id: 'pantai-1', zona: 'pantai', urutan: 1, jenis: 'ketik', judul: 'Langkah Pertama', ringkasan: 'Gerakkan robot maju sampai ke bendera.' },
  { id: 'pantai-2', zona: 'pantai', urutan: 2, jenis: 'ketik', judul: 'Koin di Tepi Pantai', ringkasan: 'Ambil 2 koin, lalu belok menuju bendera.' },
  { id: 'pantai-3', zona: 'pantai', urutan: 3, jenis: 'debug', judul: 'Belokan yang Tertukar', ringkasan: 'Arah belok robot tertukar. Perbaiki ya!' },
  { id: 'pantai-4', zona: 'pantai', urutan: 4, jenis: 'boss', judul: 'Boss Labirin Batu', ringkasan: 'Lewati labirin batu dan ambil 3 koin.' },

  // ---------- Laut: perulangan ----------
  { id: 'laut-1', zona: 'laut', urutan: 1, jenis: 'ketik', judul: 'Berenang Jauh', ringkasan: 'Gunakan ulangi agar robot maju 6 petak.' },
  { id: 'laut-2', zona: 'laut', urutan: 2, jenis: 'debug', judul: 'Ombak Berulang', ringkasan: 'Angka ulangi salah sehingga robot melewati bendera.' },
  { id: 'laut-3', zona: 'laut', urutan: 3, jenis: 'boss', judul: 'Boss Tangga Karang', ringkasan: 'Turuni tangga karang dan ambil 4 koin dengan ulangi.' },

  // ---------- Gurun: lompat & kondisi jika ----------
  { id: 'gurun-1', zona: 'gurun', urutan: 1, jenis: 'ketik', judul: 'Lompat Jurang', ringkasan: 'Lompati jurang dengan lompat().' },
  { id: 'gurun-2', zona: 'gurun', urutan: 2, jenis: 'debug', judul: 'Fatamorgana', ringkasan: 'Isi jika ... lainnya tertukar. Perbaiki supaya robot tidak jatuh.' },
  { id: 'gurun-3', zona: 'gurun', urutan: 3, jenis: 'boss', judul: 'Boss Jalan Seribu Jurang', ringkasan: 'Seberangi jalan panjang penuh jurang dengan ulangi dan jika.' },

  // ---------- Pegunungan Salju: variabel & selama ----------
  { id: 'salju-1', zona: 'salju', urutan: 1, jenis: 'ketik', judul: 'Kantong Ajaib', ringkasan: 'Simpan jumlah langkah di dalam variabel.' },
  { id: 'salju-2', zona: 'salju', urutan: 2, jenis: 'debug', judul: 'Putaran Salju', ringkasan: 'Perulangan selama tidak pernah berhenti. Cari bug-nya!' },
  { id: 'salju-3', zona: 'salju', urutan: 3, jenis: 'boss', judul: 'Boss Puncak Salju', ringkasan: 'Gunakan selama dan jika untuk mencapai puncak gunung.' }
].map((l) => ({
  ...l,
  ...(SOAL[l.id] || {}),
  bawaan: true,          // level bawaan tidak bisa dihapus, hanya dinonaktifkan
  tingkat: [3, 4, 5, 6], // tingkat kelas sasaran
  pembuat: null,
  terbit: true,
  kelasIds: null
}));

/** Label jenis level untuk ditampilkan ke siswa. */
export const LABEL_JENIS = {
  ketik: 'Ketik Kode',
  debug: 'Perbaiki Bug',
  boss: 'Level Boss'
};
