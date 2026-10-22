// js/guru/sementara.js — halaman guru sementara
// Dashboard lengkap dengan navbar vertikal dibuat di tahap berikutnya.

import { esc, robot, tombol, toast } from '../ui.js';
import { sesiAktif, keluar, getSemuaKelas } from '../store.js';
import { pindah } from '../router.js';

function kerangka(isi) {
  return `
    <section class="min-h-screen py-8 sm:py-12 px-4 bg-gradient-to-b from-mint/60 to-latar">
      <div class="mx-auto max-w-2xl">${isi}</div>
    </section>`;
}

function pasangKeluar(halaman) {
  halaman.querySelector('[data-keluar-guru]')?.addEventListener('click', async () => {
    await keluar();
    toast('Anda sudah keluar.', 'info');
    pindah('/guru/masuk');
  });
}

/** #/guru — beranda guru sementara */
export async function renderBerandaGuru(halaman) {
  const sesi = await sesiAktif();
  const guru = sesi.pengguna;
  const semuaKelas = await getSemuaKelas();
  const kelasDiampu = sesi.peran === 'admin' ? semuaKelas : semuaKelas.filter((k) => guru.kelasIds.includes(k.id));

  halaman.innerHTML = kerangka(`
    <div class="kartu muncul flex flex-col gap-4">
      <div class="flex items-center gap-3">
        ${robot('gembira', { kelas: 'w-20 h-auto shrink-0', alt: '' })}
        <div class="min-w-0">
          <h1 class="font-judul text-3xl sm:text-4xl font-extrabold text-teal-tua leading-tight">Halo, ${esc(guru.nama)}!</h1>
          <p class="font-bold">Peran: <span class="rounded-lg ${sesi.peran === 'admin' ? 'bg-oranye' : 'bg-mint'} px-2 py-0.5">${sesi.peran === 'admin' ? 'Admin' : 'Guru'}</span></p>
        </div>
      </div>
      <p class="rounded-2xl bg-kuning p-3 font-bold">Dashboard lengkap sedang disiapkan. Untuk sekarang, ini kelas ${sesi.peran === 'admin' ? 'di sekolah' : 'yang Anda ampu'}:</p>
      <ul class="grid gap-2 sm:grid-cols-2">
        ${kelasDiampu.map((k) => `
          <li class="rounded-2xl bg-mint p-3">
            <p class="font-judul text-xl font-extrabold text-teal-tua">${esc(k.nama)}</p>
            <p>Kode kelas: <strong class="font-kode">${esc(k.kodeKelas)}</strong></p>
          </li>`).join('') || '<li>Belum ada kelas.</li>'}
      </ul>
      <div class="flex flex-col sm:flex-row gap-3">
        ${sesi.peran === 'admin' ? tombol({ teks: 'Kelola Guru', href: '#/guru/guru', varian: 'utama' }) : ''}
        ${tombol({ teks: 'Keluar', varian: 'sekunder', attr: 'data-keluar-guru' })}
      </div>
    </div>`);
  pasangKeluar(halaman);
}

/** #/guru/guru — khusus admin (sementara) */
export async function renderKelolaGuru(halaman) {
  halaman.innerHTML = kerangka(`
    <div class="kartu muncul flex flex-col items-center text-center gap-4">
      ${robot('berpikir', { kelas: 'w-28 h-auto melayang', alt: '' })}
      <h1 class="font-judul text-3xl sm:text-4xl font-extrabold text-teal-tua">Kelola Guru</h1>
      <p class="text-lg">Halaman khusus admin ini sedang disiapkan.</p>
      <div class="flex flex-col sm:flex-row gap-3">
        ${tombol({ teks: 'Kembali ke Dashboard', href: '#/guru', varian: 'utama' })}
        ${tombol({ teks: 'Keluar', varian: 'sekunder', attr: 'data-keluar-guru' })}
      </div>
    </div>`);
  pasangKeluar(halaman);
}
