// js/main.js — titik masuk aplikasi: daftar rute, penjaga rute, lalu jalankan router

import { rute, mulaiRouter, aturPenjaga, pindah, halamanError } from './router.js';
import { toast } from './ui.js';
import { sesiAktif, modeDevAktif } from './store.js';
import { renderBeranda } from './pages/beranda.js';
import { renderTidakDitemukan } from './pages/tidak-ditemukan.js';
import { renderPeta, renderPetaZona } from './pages/peta.js';
import { renderLevel } from './pages/level.js';
import { renderJuara } from './pages/juara.js';
import { renderDaftar } from './pages/daftar.js';
import { renderMasuk } from './pages/masuk.js';
import { renderGuruMasuk } from './pages/guru-masuk.js';
import { renderPasang } from './pages/pasang.js';
import { buatHeaderSiswa } from './pages/header-siswa.js';
import { denganKerangkaGuru } from './guru/kerangka.js';
import { renderRingkasan } from './guru/ringkasan.js';
import { renderKelas } from './guru/kelas.js';
import { renderSiswa } from './guru/siswa.js';
import { renderDetailSiswa } from './guru/siswa-detail.js';
import { renderAktivitas } from './guru/aktivitas.js';
import { renderGuru } from './guru/guru.js';
import { renderPengaturan } from './guru/pengaturan.js';
import { renderLevelGuru } from './guru/level.js';
import { renderEditorLevel } from './guru/level-editor.js';
import { renderCobaLevel } from './guru/level-coba.js';
import { renderNilai } from './guru/nilai.js';
import { renderProfil } from './pages/profil.js';
import { renderBantuan } from './pages/bantuan.js';
import { renderPilihKelas, renderGabungKelas } from './pages/pilih-kelas.js';

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
rute('/juara', denganHeaderSiswa(renderJuara), 'Sertifikat Juara');
rute('/profil', denganHeaderSiswa(renderProfil), 'Profilku');
rute('/pilih-kelas', denganHeaderSiswa(renderPilihKelas), 'Pilih Kelas');
rute('/gabung-kelas', denganHeaderSiswa(renderGabungKelas), 'Kode Kelas');
rute('/bantuan', renderBantuan, 'Bantuan');

rute('/pasang', renderPasang, 'Pemasangan');

// ---------- Rute guru ----------
rute('/guru/masuk', renderGuruMasuk, 'Masuk Guru');
// Dashboard guru: setiap halaman dibungkus kerangka (navbar vertikal + topbar)
const guru = (path, render, judul, menu) => rute(path, denganKerangkaGuru(render, { judul, menu }), `${judul} · Guru`);
guru('/guru', renderRingkasan, 'Ringkasan', 'ringkasan');
guru('/guru/kelas', renderKelas, 'Kelas', 'kelas');
guru('/guru/siswa', renderSiswa, 'Siswa', 'siswa');
guru('/guru/siswa/:id', renderDetailSiswa, 'Detail Siswa', 'siswa');
guru('/guru/level', renderLevelGuru, 'Level & Soal', 'level');
guru('/guru/level/baru', renderEditorLevel, 'Level Baru', 'level');
guru('/guru/level/:id/edit', renderEditorLevel, 'Edit Level', 'level');
guru('/guru/level/:id/coba', renderCobaLevel, 'Coba Level', 'level');
guru('/guru/nilai', renderNilai, 'Nilai', 'nilai');
guru('/guru/aktivitas', renderAktivitas, 'Aktivitas', 'aktivitas');
guru('/guru/guru', renderGuru, 'Guru', 'guru');
guru('/guru/pengaturan', renderPengaturan, 'Pengaturan', 'pengaturan');

// ---------- Penjaga rute ----------
// #/peta, #/peta/*, #/level/*, #/juara & #/profil : siswa dengan kelas aktif. #/pilih-kelas & #/gabung-kelas : siswa.
// #/guru/* : guru & admin. #/guru/guru : admin saja.
aturPenjaga(async (path) => {
  const sesi = await sesiAktif();
  const ke = encodeURIComponent(path);

  // Yang sudah masuk tidak perlu melihat halaman masuk/daftar lagi
  if ((path === '/masuk' || path === '/daftar') && sesi?.jenis === 'siswa') return '/peta';
  if (path === '/guru/masuk') return sesi?.jenis === 'guru' ? '/guru' : null;

  const halamanSiswa = path === '/peta' || path.startsWith('/peta/') || path === '/level' || path.startsWith('/level/') ||
    path === '/juara' || path === '/profil';
  const halamanKelas = path === '/pilih-kelas' || path === '/gabung-kelas';
  const halamanGuru = path === '/guru' || path.startsWith('/guru/');

  if ((halamanSiswa || halamanKelas) && sesi?.jenis !== 'siswa') {
    toast('Masuk dulu ya, baru bisa bermain.', 'info');
    return `/masuk?ke=${ke}`;
  }
  // Semua isi permainan mengikuti kelas aktif: belum punya kelas -> kode kelas; banyak kelas -> pilih dulu
  if (halamanSiswa && !sesi.pengguna.kelasId) {
    return sesi.pengguna.kelas?.length ? `/pilih-kelas?ke=${ke}` : '/gabung-kelas';
  }
  if (halamanGuru && sesi?.jenis !== 'guru') {
    toast('Halaman ini khusus guru. Silakan masuk dengan akun guru.', 'info');
    return `/guru/masuk?ke=${ke}`;
  }
  if (path === '/guru/guru' && sesi?.peran !== 'admin') {
    toast('Halaman ini khusus admin. Anda dialihkan ke Ringkasan.', 'peringatan');
    return '/guru';
  }
  return null;
});

// Tautan "Lewati ke isi" memakai hash, jadi tangani manual agar tidak dianggap rute
document.querySelector('[data-lewati]')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('app')?.focus();
});

// ---------- Penangkap error tak terduga ----------
// Tampilkan toast ramah (robot kaget) dan halaman cadangan, bukan layar putih.
let waktuGalatTerakhir = 0;
function tanganiGalat(err) {
  const pesan = String(err?.message || err || '');
  if (/ResizeObserver loop/i.test(pesan)) return; // peringatan browser yang tidak berbahaya
  console.error(err);
  if (Date.now() - waktuGalatTerakhir < 2000) return; // jangan menumpuk toast
  waktuGalatTerakhir = Date.now();
  toast(err?.jaringan ? err.message : 'Ups, ada yang tidak beres. Coba lagi ya.', 'galat', 4500);
  const app = document.getElementById('app');
  if (app && !app.textContent.trim()) app.innerHTML = halamanError();
}
window.addEventListener('error', (e) => tanganiGalat(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => tanganiGalat(e.reason));

// ---------- Alat pengembang ----------
// js/dev.js hanya diimpor bila server dalam mode pengembang (MODE_DEV=1 di .dev.vars, uji lokal).
try {
  if (await modeDevAktif()) (await import('./dev.js')).pasangAlatDev();
} catch {
  /* server belum terjangkau: lanjut tanpa alat pengembang */
}

mulaiRouter(document.getElementById('app'), renderTidakDitemukan);
