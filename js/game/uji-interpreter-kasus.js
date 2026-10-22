// js/game/uji-interpreter-kasus.js — kasus uji otomatis untuk interpreter
// Dipakai halaman #/uji-interpreter?dev=1 dan bisa juga dijalankan di Node.
// Setiap kasus: { nama, peta, kode, opsi?, perluWorker?, cek(hasil) -> true | 'alasan gagal' }

import { duniaDariTeks } from './dunia.js';

const jenisJejak = (h) => h.jejak.map((e) => e.jenis);
const terakhir = (h) => h.jejak[h.jejak.length - 1];
const harusBerhasil = (h) => h.berhasil || `harusnya berhasil, tapi: ${h.alasan}`;
const pesanMemuat = (teks) => (h) =>
  (!h.berhasil && h.alasan.includes(teks)) || `pesan harus memuat "${teks}", didapat: ${h.alasan}`;

export const KASUS_UJI = [
  {
    nama: 'Urutan perintah',
    peta: ['>...F'],
    kode: 'maju()\nmaju()\nmaju(2)',
    cek: (h) => harusBerhasil(h) === true && h.jejak.filter((e) => e.jenis === 'gerak').length === 4
      ? true : `harus berhasil dengan 4 gerak (${h.alasan})`
  },
  {
    nama: 'Belok kanan dan kiri',
    peta: ['>.#', '..F'],
    kode: 'maju()\nbelok_kanan()\nmaju()\nbelok_kiri()\nmaju()',
    cek: (h) => (h.berhasil && terakhir(h).arah === 'timur') || `harus sampai menghadap timur (${h.alasan})`
  },
  {
    nama: 'Ulangi + jumlah baris',
    peta: ['>.....F'],
    kode: '// jalan lurus\nulangi 6 {\n  maju()\n}\n',
    cek: (h) => (h.berhasil && h.jumlahBaris === 2) || `harus berhasil dengan jumlahBaris 2 (didapat ${h.jumlahBaris}, ${h.alasan})`
  },
  {
    nama: 'Jika ... lainnya',
    peta: ['>#.', '.F.'],
    kode: 'jika ada_rintangan() {\n  belok_kanan()\n  maju()\n} lainnya {\n  maju()\n}\nbelok_kiri()\nmaju()',
    cek: harusBerhasil
  },
  {
    nama: 'Jika bukan (cabang lainnya di baris baru)',
    peta: ['>.F'],
    kode: 'jika bukan ada_rintangan() {\n  maju(2)\n}\nlainnya {\n  belok_kiri()\n}',
    cek: harusBerhasil
  },
  {
    nama: 'Selama bukan sampai_tujuan',
    peta: ['>........F'],
    kode: 'selama bukan sampai_tujuan() {\n  maju()\n}',
    cek: harusBerhasil
  },
  {
    nama: 'Variabel buat, ubah, dan pakai',
    peta: ['>.....F'],
    kode: 'buat langkah = 2\nlangkah = langkah + 2\nmaju(langkah)\nlangkah = langkah - 3\nulangi langkah + 1 {\n  maju()\n}',
    cek: harusBerhasil
  },
  {
    nama: 'Lompat jurang',
    peta: ['>.O.F'],
    kode: 'maju()\nlompat()\nmaju()',
    cek: (h) => (h.berhasil && jenisJejak(h).includes('lompat')) || `harus berhasil dengan peristiwa lompat (${h.alasan})`
  },
  {
    nama: 'Jatuh ke jurang tanpa lompat',
    peta: ['>.O.F'],
    kode: 'maju(4)',
    cek: (h) => (!h.berhasil && terakhir(h).jenis === 'jatuh' && h.galat.baris === 1) || `harus jatuh di baris 1 (${h.alasan})`
  },
  {
    nama: 'Menabrak batu',
    peta: ['>#F'],
    kode: 'maju()\nmaju()',
    cek: (h) => (!h.berhasil && terakhir(h).jenis === 'tabrak' && terakhir(h).x === 0 && h.galat.baris === 1)
      || `robot harus menabrak di baris 1 dan tetap di x=0 (${h.alasan})`
  },
  {
    nama: 'Keluar peta',
    peta: ['>F'],
    kode: 'belok_kiri()\nmaju()',
    cek: (h) => (!h.berhasil && terakhir(h).jenis === 'keluar' && h.alasan.startsWith('Baris 2')) || `harus keluar di baris 2 (${h.alasan})`
  },
  {
    nama: 'Perulangan tak berhenti (batas 1000 langkah)',
    peta: ['>.F'],
    kode: 'selama bukan ada_jurang() {\n  belok_kiri()\n}',
    cek: (h) => (!h.berhasil && h.galat.jenis === 'kelelahan' && h.alasan.includes('Robot kelelahan'))
      || `harus kelelahan (${h.alasan})`
  },
  {
    nama: 'Pengaman waktu worker 2 detik',
    peta: ['>.F'],
    kode: 'selama bukan ada_jurang() {\n  belok_kiri()\n}',
    opsi: { maksLangkah: Infinity }, // matikan batas langkah supaya pengaman waktu yang bekerja
    perluWorker: true,
    cek: (h) => (h.alasan === 'Robot kelelahan! Sepertinya perulanganmu tidak pernah berhenti.') || `harus dihentikan runner (${h.alasan})`
  },
  {
    nama: 'Perintah salah ketik (saran Levenshtein)',
    peta: ['>.F'],
    kode: 'maju()\nmajuu()',
    cek: pesanMemuat('Baris 2: Robot belum kenal majuu. Maksudmu maju()?')
  },
  {
    nama: 'Perintah belum dibuka',
    peta: ['>.F'],
    kode: 'ulangi 2 {\n  maju()\n}',
    opsi: { perintahTersedia: ['maju', 'belok_kiri', 'belok_kanan'] },
    cek: pesanMemuat('Perintah ini belum dibuka di pulau ini')
  },
  {
    nama: 'Kurung tutup hilang',
    peta: ['>.F'],
    kode: 'maju()\nbelok_kiri()\nmaju(2',
    cek: pesanMemuat('Baris 3: kurung tutup ) sepertinya hilang')
  },
  {
    nama: 'Kurung kurawal tutup hilang',
    peta: ['>.F'],
    kode: 'ulangi 2 {\n  maju()\n',
    cek: pesanMemuat('Baris 1: kurung kurawal tutup } sepertinya hilang')
  },
  {
    nama: 'Ambil koin wajib dengan ada_koin()',
    peta: ['>.$.$F'],
    kode: 'selama bukan sampai_tujuan() {\n  maju()\n  jika ada_koin() {\n    ambil()\n  }\n}',
    cek: (h) => (h.berhasil && h.itemDiambil === 2) || `harus berhasil dengan 2 koin (${h.alasan})`
  },
  {
    nama: 'Koin wajib tertinggal',
    peta: ['>$F'],
    kode: 'maju(2)',
    cek: pesanMemuat('belum diambil')
  },
  {
    nama: 'Huruf besar & spasi berlebih',
    peta: ['>..F'],
    kode: '   MAJU (  3  )   \n\n',
    cek: harusBerhasil
  },
  {
    nama: 'Belok kiri tanpa garis bawah',
    peta: ['>.F'],
    kode: 'belok kiri()',
    cek: pesanMemuat('Maksudmu belok_kiri()?')
  },
  {
    nama: 'Satu perintah per baris',
    peta: ['>..F'],
    kode: 'maju() maju()',
    cek: pesanMemuat('Baris 1: tulis satu perintah di setiap baris')
  }
];

/**
 * Jalankan semua kasus. pelari(kode, dunia, opsi) -> Promise<hasil>.
 * lewatiWorker = true untuk melewati kasus yang butuh Web Worker (mis. di Node).
 */
export async function jalankanSemuaUji(pelari, { lewatiWorker = false } = {}) {
  const laporan = [];
  for (const kasus of KASUS_UJI) {
    if (kasus.perluWorker && lewatiWorker) {
      laporan.push({ nama: kasus.nama, lulus: null, catatan: 'dilewati (butuh Web Worker)' });
      continue;
    }
    let hasil = null;
    let lulus = false;
    let catatan = '';
    try {
      hasil = await pelari(kasus.kode, duniaDariTeks(kasus.peta), kasus.opsi || {});
      const c = kasus.cek(hasil);
      lulus = c === true;
      catatan = lulus ? hasil.alasan : String(c);
    } catch (err) {
      catatan = `error: ${err.message}`;
    }
    laporan.push({ nama: kasus.nama, lulus, catatan, hasil });
  }
  return laporan;
}
