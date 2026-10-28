// js/pages/header-siswa.js — header untuk siswa yang sudah masuk
// Menampilkan avatar, nama panggilan, kelas yang sedang dimainkan (menu pindah kelas), koin, berlian, dan tombol keluar.
// Otomatis diperbarui saat data siswa berubah (event 'ci:berubah').

import { esc, bukaModal, toast, jenisGalat } from '../ui.js';
import { sesiAktif, keluar, pilihKelasAktif } from '../store.js';
import { pindah } from '../router.js';

const IKON_KELAS = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M7 9.5V15c0 1.5 2.2 3 5 3s5-1.5 5-3V9.5"/>
  </svg>`;

const IKON_KELUAR = `
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>
  </svg>`;

function isiHeader(s) {
  const avatar = s.avatar === 'wanita' ? 'wanita' : 'pria';
  return `
    <div class="mx-auto max-w-6xl px-4 sm:px-6 h-16 sm:h-20 flex items-center gap-3">
      <div class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <a href="#/profil" class="shrink-0 rounded-full" aria-label="Lihat profil ${esc(s.namaPanggilan)}">
          <img src="image/profile/${avatar}.png" alt="" class="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-mint border-[3px] border-white object-cover">
        </a>
        <span class="min-w-0">
          <a href="#/profil" class="block font-judul font-extrabold text-xl sm:text-2xl leading-tight truncate">${esc(s.namaPanggilan)}</a>
          ${tombolKelasHTML(s)}
        </span>
      </div>
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

// Nama kelas aktif selalu terlihat (di bawah nama murid) supaya anak tahu dia sedang main sebagai apa.
// Diklik: menu pindah kelas tanpa harus keluar dan masuk lagi.
function tombolKelasHTML(s) {
  const daftar = s.kelas || [];
  const aktif = daftar.find((k) => k.id === s.kelasId);
  if (!daftar.length) return '<span class="tombol-kelas-aktif">Belum punya kelas</span>';
  const teks = aktif ? aktif.nama : 'Pilih kelas';
  return `
    <button type="button" data-ganti-kelas class="tombol-kelas-aktif"
      aria-label="${esc(aktif ? `Sedang main sebagai ${aktif.nama}. Ganti kelas` : 'Pilih kelas')}" title="${esc(aktif ? `Kelas: ${aktif.nama}` : 'Pilih kelas')}">
      ${IKON_KELAS}<span>${esc(teks)}</span><span aria-hidden="true">▾</span>
    </button>`;
}

/** Menu pindah kelas: kartu tiap kelas yang diikuti + tautan ikut kelas lain. */
async function bukaMenuKelas(s) {
  const pilihan = await bukaModal({
    judul: 'Kamu mau main sebagai apa?',
    pose: 'gembira',
    isi: '<p>Soal, pulau, dan bintangmu mengikuti kelas yang kamu pilih. Koinmu tetap sama.</p>',
    tombol: [
      ...(s.kelas || []).map((k) => ({
        teks: k.id === s.kelasId ? `${k.nama} (sedang dimainkan)` : k.nama,
        nilai: k.id,
        varian: k.id === s.kelasId ? 'utama' : 'sekunder'
      })),
      { teks: 'Ikut kelas lain', nilai: '__gabung', varian: 'sekunder' }
    ]
  });
  if (!pilihan) return;
  if (pilihan === '__gabung') { pindah('/gabung-kelas'); return; }
  if (pilihan === s.kelasId) return;
  try {
    const { kelas } = await pilihKelasAktif(pilihan);
    toast(`Ayo main sebagai ${kelas.nama}!`, 'sukses');
    pindah('/peta');
  } catch (err) {
    toast(err.message, jenisGalat(err));
  }
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
    if (e.target.closest('[data-ganti-kelas]')) {
      const sesi = await sesiAktif();
      if (sesi?.jenis === 'siswa') await bukaMenuKelas(sesi.pengguna);
      return;
    }
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
    toast('Sampai jumpa lagi!', 'sukses');
    pindah('/');
  });

  return { el, bersihkan: () => window.removeEventListener('ci:berubah', saatBerubah) };
}
