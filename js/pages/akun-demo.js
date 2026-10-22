// js/pages/akun-demo.js — kotak akun demo yang bisa disembunyikan
// Tombol "Pakai" mengisi form masuk secara otomatis.

import { esc } from '../ui.js';
import { getAkunDemo } from '../store.js';

function isiSiswa(siswa) {
  // Kelompokkan per kelas
  const perKelas = {};
  siswa.forEach((s) => { (perKelas[s.kelas] ||= []).push(s); });
  return `
    <p class="mb-3">PIN semua siswa contoh: <strong class="font-kode text-lg">1234</strong></p>
    <div class="grid gap-3 sm:grid-cols-2">
      ${Object.entries(perKelas).map(([kelas, daftar]) => `
        <div class="rounded-2xl bg-white/80 p-3">
          <p class="font-judul font-extrabold text-teal-tua">${esc(kelas)}</p>
          <div class="mt-1 flex flex-wrap gap-2">
            ${daftar.map((s) => `
              <button type="button" class="rounded-xl bg-mint hover:bg-teal px-2.5 py-1 font-kode font-bold text-sm"
                data-pakai-username="${esc(s.username)}" data-pakai-rahasia="${esc(s.pin)}"
                aria-label="Pakai akun ${esc(s.namaPanggilan)}">${esc(s.username)}</button>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
}

function isiGuru(guru) {
  return `
    <ul class="flex flex-col gap-2">
      ${guru.map((g) => `
        <li class="rounded-2xl bg-white/80 p-3 flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0">
            <p class="font-judul font-extrabold text-teal-tua leading-tight">
              ${esc(g.nama)}
              <span class="ml-1 rounded-lg ${g.peran === 'admin' ? 'bg-oranye' : 'bg-mint'} px-2 py-0.5 text-xs align-middle">${g.peran === 'admin' ? 'Admin' : 'Guru'}</span>
            </p>
            <p class="font-kode text-sm break-all">${esc(g.username)} / ${esc(g.password)}</p>
          </div>
          <button type="button" class="tombol tombol-sekunder tombol-kecil"
            data-pakai-username="${esc(g.username)}" data-pakai-rahasia="${esc(g.password)}">Pakai</button>
        </li>`).join('')}
    </ul>`;
}

/** HTML kotak akun demo. jenis: 'siswa' | 'guru' */
export async function kotakAkunDemo(jenis) {
  const akun = await getAkunDemo();
  const daftar = jenis === 'guru' ? akun.guru : akun.siswa;
  if (!daftar.length) return '';
  return `
    <details class="kotak-demo" open>
      <summary>
        <span>Akun Demo</span>
        <span class="text-base font-bold text-teal-tua underline underline-offset-4">
          <span class="teks-tutup">Sembunyikan</span><span class="teks-buka">Tampilkan</span>
        </span>
      </summary>
      <div class="px-4 pb-4 sm:px-5 sm:pb-5">
        ${jenis === 'guru' ? isiGuru(daftar) : isiSiswa(daftar)}
      </div>
    </details>`;
}

/** Pasang klik tombol "Pakai". saatPakai(username, rahasia) */
export function pasangKotakAkunDemo(akar, saatPakai) {
  akar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pakai-username]');
    if (btn) saatPakai(btn.dataset.pakaiUsername, btn.dataset.pakaiRahasia);
  });
}
