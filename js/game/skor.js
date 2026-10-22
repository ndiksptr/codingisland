// js/game/skor.js — aturan bintang, nilai, koin, clue, dan berlian
// Dipakai halaman level (untuk tampilan) dan store.js (untuk menyimpan hadiah).

export const NILAI_BINTANG = { 0: 0, 1: 70, 2: 85, 3: 100 };
export const KOIN_SELESAI_PERTAMA = 10;
export const KOIN_PER_BINTANG_BARU = 5;
export const BERLIAN_BOSS = 3;

/** Toko clue: harus dibeli berurutan. clueDibeli di progres = nomor clue tertinggi yang sudah dibeli (0–3). */
export const CLUE = [
  { nomor: 1, nama: 'Petunjuk arah', harga: 5 },
  { nomor: 2, nama: 'Langkah berikutnya atau baris yang bermasalah', harga: 10 },
  { nomor: 3, nama: 'Potongan jawaban', harga: 20 }
];

/**
 * Bintang:
 *  - 1 bintang dasar karena selesai
 *  - +1 jika clue yang dibeli paling tinggi Clue 1
 *  - +1 jika jumlahBaris tidak melebihi batasBaris
 *  - jika Clue 3 dibeli, bintang maksimal 1
 */
export function hitungBintang({ berhasil, clueDibeli = 0, jumlahBaris = 0, batasBaris = null }) {
  if (!berhasil) return 0;
  if (clueDibeli >= 3) return 1;
  let bintang = 1;
  if (clueDibeli <= 1) bintang += 1;
  if (!batasBaris || jumlahBaris <= batasBaris) bintang += 1;
  return bintang;
}

/** Bintang paling banyak yang masih bisa diraih setelah membeli clue. */
export function bintangMaksimal(clueDibeli = 0) {
  if (clueDibeli >= 3) return 1;
  return clueDibeli <= 1 ? 3 : 2;
}

/** Koin untuk satu penyelesaian, dibandingkan dengan bintang terbaik sebelumnya. */
export function hitungKoin({ pertamaKali, bintangLama = 0, bintangBaru = 0 }) {
  const tambahanBintang = Math.max(0, bintangBaru - bintangLama);
  return (pertamaKali ? KOIN_SELESAI_PERTAMA : 0) + tambahanBintang * KOIN_PER_BINTANG_BARU;
}
