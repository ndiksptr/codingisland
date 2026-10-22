// js/pages/header-siswa.js — header untuk siswa yang sudah masuk
// Menampilkan avatar, nama panggilan, koin, berlian, dan tombol keluar.
// Otomatis diperbarui saat data siswa berubah (event 'ci:berubah').

import { esc, bukaModal, toast } from '../ui.js';
import { sesiAktif, keluar } from '../store.js';
import { pindah } from '../router.js';

const IKON_KELUAR = `
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>
  </svg>`;

function isiHeader(s) {
  const avatar = s.avatar === 'wanita' ? 'wanita' : 'pria';
  return `
    <div class="mx-auto max-w-6xl px-4 sm:px-6 h-16 sm:h-20 flex items-center gap-3">
      <a href="#/profil" class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 rounded-2xl" aria-label="Lihat profil ${esc(s.namaPanggilan)}">
        <img src="image/profile/${avatar}.png" alt="" class="w-11 h-11 sm:w-14 sm:h-14 shrink-0 rounded-full bg-mint border-[3px] border-white object-cover">
        <span class="min-w-0">
          <span class="block text-xs sm:text-sm text-white/80 leading-none">Halo,</span>
          <span class="block font-judul font-extrabold text-xl sm:text-2xl leading-tight truncate">${esc(s.namaPanggilan)}</span>
        </span>
      </a>
      <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <span class="chip-uang chip-koin" title="Koin">
          <img src="image/item/koin.png" alt=""><span class="sr-only">Koin:</span>${Number(s.koin) || 0}
        </span>
        <span class="chip-uang chip-berlian" title="Berlian">
          <img src="image/item/berlian.png" alt=""><span class="sr-only">Berlian:</span>${Number(s.berlian) || 0}
        </span>
        <button type="button" data-keluar class="tombol tombol-sekunder tombol-keluar" aria-label="Keluar">
          ${IKON_KELUAR}<span class="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </div>`;
}

/** Buat header siswa. Hasil: { el, bersihkan } */
export async function buatHeaderSiswa() {
  const el = document.createElement('header');
  el.className = 'header-siswa';

  async function gambar() {
    const sesi = await sesiAktif();
    if (sesi?.jenis === 'siswa') el.innerHTML = isiHeader(sesi.pengguna);
  }
  await gambar();

  const saatBerubah = (e) => {
    if (['siswa', 'sesi'].includes(e.detail?.entitas)) gambar();
  };
  window.addEventListener('ci:berubah', saatBerubah);

  el.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-keluar]')) return;
    const yakin = await bukaModal({
      judul: 'Mau keluar?',
      isi: '<p>Progresmu sudah tersimpan. Sampai jumpa lagi!</p>',
      pose: 'melamun',
      tombol: [
        { teks: 'Tidak', nilai: false, varian: 'sekunder' },
        { teks: 'Ya, Keluar', nilai: true, varian: 'utama' }
      ]
    });
    if (!yakin) return;
    await keluar();
    toast('Sampai jumpa lagi!', 'info');
    pindah('/');
  });

  return { el, bersihkan: () => window.removeEventListener('ci:berubah', saatBerubah) };
}
