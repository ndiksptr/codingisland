// js/main.js — titik masuk aplikasi: daftar rute, penjaga rute, lalu jalankan router

import { rute, mulaiRouter, aturPenjaga, pindah } from './router.js';
import { bukaModal, toast } from './ui.js';
import { sesiAktif, resetDataDemo } from './store.js';
import { renderBeranda } from './pages/beranda.js';
import { renderTidakDitemukan } from './pages/tidak-ditemukan.js';
import { renderPeta, renderPetaZona } from './pages/peta.js';
import { renderLevel } from './pages/level.js';
import { pasangCiDev } from './dev.js';
import { renderUjiInterpreter } from './pages/uji-interpreter.js';
import { renderDaftar } from './pages/daftar.js';
import { renderMasuk } from './pages/masuk.js';
import { renderGuruMasuk } from './pages/guru-masuk.js';
import { buatHeaderSiswa } from './pages/header-siswa.js';
import { renderBerandaGuru, renderKelolaGuru } from './guru/sementara.js';

// Bungkus halaman siswa dengan header (avatar, koin, berlian, keluar)
function denganHeaderSiswa(render) {
  return async (halaman, konteks) => {
    const header = await buatHeaderSiswa();
    const isi = document.createElement('div');
    const hasil = await render(isi, konteks);
    halaman.append(header.el, isi);
    return () => {
      header.bersihkan();
      if (typeof hasil === 'function') hasil();
    };
  };
}

// ---------- Rute umum & siswa ----------
rute('/', renderBeranda, '');
rute('/daftar', renderDaftar, 'Daftar');
rute('/masuk', renderMasuk, 'Masuk');
rute('/peta', denganHeaderSiswa(renderPeta), 'Peta Pulau');
rute('/peta/:zona', denganHeaderSiswa(renderPetaZona), 'Peta Pulau');
rute('/level/:id', denganHeaderSiswa(renderLevel), 'Level');

// ---------- Rute pengembang (hanya tampil dengan ?dev=1) ----------
rute('/uji-interpreter', renderUjiInterpreter, 'Uji Interpreter');

// ---------- Rute guru ----------
rute('/guru/masuk', renderGuruMasuk, 'Masuk Guru');
rute('/guru', renderBerandaGuru, 'Dashboard Guru');
rute('/guru/guru', renderKelolaGuru, 'Kelola Guru');

// ---------- Penjaga rute ----------
// #/peta, #/peta/* & #/level/* : siswa. #/guru/* : guru & admin. #/guru/guru : admin saja.
aturPenjaga(async (path) => {
  const sesi = await sesiAktif();
  const ke = encodeURIComponent(path);

  // Yang sudah masuk tidak perlu melihat halaman masuk/daftar lagi
  if ((path === '/masuk' || path === '/daftar') && sesi?.jenis === 'siswa') return '/peta';
  if (path === '/guru/masuk') return sesi?.jenis === 'guru' ? '/guru' : null;

  const halamanSiswa = path === '/peta' || path.startsWith('/peta/') || path === '/level' || path.startsWith('/level/');
  const halamanGuru = path === '/guru' || path.startsWith('/guru/');

  if (halamanSiswa && sesi?.jenis !== 'siswa') {
    toast('Masuk dulu ya, baru bisa bermain.', 'info');
    return `/masuk?ke=${ke}`;
  }
  if (halamanGuru && sesi?.jenis !== 'guru') {
    toast('Halaman ini khusus guru. Silakan masuk.', 'info');
    return `/guru/masuk?ke=${ke}`;
  }
  if (path === '/guru/guru' && sesi?.peran !== 'admin') {
    toast('Halaman ini khusus admin.', 'peringatan');
    return '/guru';
  }
  return null;
});

// ---------- Reset data demo (tautan di footer) ----------
document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-reset-demo]')) return;
  const yakin = await bukaModal({
    judul: 'Reset data demo?',
    isi: '<p>Semua akun, kelas, dan progres kembali seperti awal. Akun yang baru didaftarkan akan hilang.</p>',
    pose: 'kaget',
    tombol: [
      { teks: 'Batal', nilai: false, varian: 'sekunder' },
      { teks: 'Ya, Reset', nilai: true, varian: 'bahaya' }
    ]
  });
  if (!yakin) return;
  try {
    await resetDataDemo();
    toast('Data demo sudah kembali seperti awal.', 'sukses');
    pindah('/');
  } catch (err) {
    console.error(err);
    toast('Reset gagal. Coba muat ulang halaman.', 'peringatan');
  }
});

// Tautan "Lewati ke isi" memakai hash, jadi tangani manual agar tidak dianggap rute
document.querySelector('[data-lewati]')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('app')?.focus();
});

pasangCiDev();
mulaiRouter(document.getElementById('app'), renderTidakDitemukan);
