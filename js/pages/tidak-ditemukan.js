// js/pages/tidak-ditemukan.js — halaman 404 bertema pulau

import { robot, tombol } from '../ui.js';

export function renderTidakDitemukan(halaman) {
  halaman.innerHTML = `
    <section class="relative tinggi-layar flex items-center justify-center overflow-hidden px-4 py-12">
      <img src="image/background/laut.jpeg" alt="" class="absolute inset-0 w-full h-full object-cover">
      <div class="absolute inset-0 hero-overlay" aria-hidden="true"></div>

      <div class="relative z-10 kartu w-full max-w-lg text-center flex flex-col items-center gap-3 muncul">
        ${robot('kaget', { kelas: 'melayang w-36 sm:w-44 h-auto', alt: 'Robot Tutor kaget' })}
        <p class="font-judul text-6xl font-extrabold text-teal leading-none">404</p>
        <h1 class="font-judul text-3xl sm:text-4xl font-extrabold text-teal-tua">Pulau tidak ditemukan</h1>
        <p class="text-lg sm:text-xl">Wah, Robot Tutor tersesat di tengah laut. Ayo pulang ke beranda!</p>
        <div class="mt-2 w-full sm:w-auto">
          ${tombol({ teks: 'Kembali ke Beranda', href: '#/', varian: 'utama', lebar: true })}
        </div>
      </div>
    </section>`;
}
