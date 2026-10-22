// js/data/zona.js — data 4 zona pulau (urutan array = urutan buka)
// Dipakai di landing page, peta pulau, dan store saat seeding.

export const ZONA = [
  {
    id: 'pantai',
    nomor: 1,
    nama: 'Pantai',
    konsep: 'Urutan Perintah',
    deskripsi: 'Susun langkah robot satu per satu, dari awal sampai bendera.',
    gambar: 'image/background/pantai.jpeg',
    warna: '#F4B860' // pasir
  },
  {
    id: 'laut',
    nomor: 2,
    nama: 'Laut',
    konsep: 'Perulangan',
    deskripsi: 'Ulangi perintah tanpa capek mengetik berkali-kali.',
    gambar: 'image/background/laut.jpeg',
    warna: '#4FA3D1' // biru laut
  },
  {
    id: 'gurun',
    nomor: 3,
    nama: 'Gurun',
    konsep: 'Kondisi Jika',
    deskripsi: 'Ajari robot memilih jalan yang benar saat ada rintangan.',
    gambar: 'image/background/gurun-pasir.jpeg',
    warna: '#E8743B' // jingga gurun
  },
  {
    id: 'salju',
    nomor: 4,
    nama: 'Pegunungan Salju',
    konsep: 'Gabungan & Variabel',
    deskripsi: 'Gabungkan semua jurus dan simpan nilai di variabel.',
    gambar: 'image/background/pegunungan-salju.jpeg',
    warna: '#9DD3EE' // biru es
  }
];

/** Cari zona berdasarkan id. */
export function cariZona(id) {
  return ZONA.find((z) => z.id === id) || null;
}
