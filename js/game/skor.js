// js/game/skor.js — aturan bintang, nilai, dan koin (sementara, dirapikan di Tahap 6)
// Dipakai halaman level (untuk tampilan) dan store.js (untuk menyimpan hadiah).

export const NILAI_BINTANG = { 0: 0, 1: 70, 2: 85, 3: 100 };
export const KOIN_SELESAI_PERTAMA = 10;
export const KOIN_PER_BINTANG_BARU = 5;

/**
 * 1 bintang: selesai. 2 bintang: selesai tanpa clue.
 * 3 bintang: syarat 2 bintang + jumlah baris tidak melebihi batasBaris.
 */
export function hitungBintang({ berhasil, clueDibeli = 0, jumlahBaris = 0, batasBaris = null }) {
  if (!berhasil) return 0;
  if (clueDibeli > 0) return 1;
  if (batasBaris && jumlahBaris > batasBaris) return 2;
  return 3;
}

/** Koin untuk satu penyelesaian, dibandingkan dengan bintang terbaik sebelumnya. */
export function hitungKoin({ pertamaKali, bintangLama = 0, bintangBaru = 0 }) {
  const tambahanBintang = Math.max(0, bintangBaru - bintangLama);
  return (pertamaKali ? KOIN_SELESAI_PERTAMA : 0) + tambahanBintang * KOIN_PER_BINTANG_BARU;
}
