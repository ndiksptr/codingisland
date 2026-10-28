// js/guru/kerangka.js — tata letak dashboard guru
// Navbar vertikal kiri (bisa diciutkan; drawer di layar kecil) + topbar berisi judul,
// filter kelas global, dan tanggal. Halaman dirender ke area isi di kanan.
//
// Fungsi render halaman menerima (wadahIsi, konteks) dengan konteks tambahan:
//   konteks.guru   : { guru, admin, menyamar, kelas[], pengaturan } dari guruKonteks()
//   konteks.kelasId: kelas yang dipilih di filter global (null = semua kelas)

import { esc, robot, bukaModal, toast, jenisGalat } from '../ui.js';
import { guruKonteks, getPreferensi, simpanPreferensi, keluar, kembaliKeAkunAdmin } from '../store.js';
import { pindah, muatUlang } from '../router.js';
import { IKON } from './komponen.js';

const MENU = [
  { id: 'ringkasan', teks: 'Ringkasan', href: '#/guru' },
  { id: 'kelas', teks: 'Kelas', href: '#/guru/kelas' },
  { id: 'siswa', teks: 'Siswa', href: '#/guru/siswa' },
  { id: 'level', teks: 'Level & Soal', href: '#/guru/level' },
  { id: 'nilai', teks: 'Nilai', href: '#/guru/nilai' },
  { id: 'aktivitas', teks: 'Aktivitas', href: '#/guru/aktivitas' },
  { id: 'guru', teks: 'Guru', href: '#/guru/guru', admin: true },
  { id: 'pengaturan', teks: 'Pengaturan', href: '#/guru/pengaturan' }
];

const tanggalHariIni = () => new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function sidebarHTML(konteks, aktif) {
  const { guru, admin } = konteks;
  return `
    <aside class="dg-sidebar" id="dg-sidebar" aria-label="Menu dashboard guru">
      <div class="dg-logo">
        ${robot('hai', { kelas: 'dg-logo-robot', alt: '' })}
        <span class="dg-teks-menu">
          <span class="block font-judul text-xl font-extrabold leading-none">Coding Island</span>
          <span class="block text-xs text-white/75">Dashboard Guru</span>
        </span>
      </div>

      <div class="dg-profil">
        <span class="dg-profil-inisial" aria-hidden="true">${esc((guru.nama || '?').replace(/^(Bu|Pak)\.?\s+/i, '').charAt(0).toUpperCase())}</span>
        <span class="dg-teks-menu min-w-0">
          <span class="block font-bold truncate">${esc(guru.nama)}</span>
          <span class="dg-peran">${admin ? 'Admin' : 'Guru'}</span>
        </span>
      </div>

      <nav class="dg-menu">
        <ul>
          ${MENU.filter((m) => !m.admin || admin).map((m) => `
            <li>
              <a href="${m.href}" class="${m.id === aktif ? 'dg-aktif' : ''}" ${m.id === aktif ? 'aria-current="page"' : ''} title="${esc(m.teks)}">
                ${IKON[m.id]}<span class="dg-teks-menu">${esc(m.teks)}</span>
              </a>
            </li>`).join('')}
        </ul>
      </nav>

      <div class="dg-sidebar-bawah">
        <button type="button" class="dg-tombol-ciut" data-ciutkan aria-label="Ciutkan menu" title="Ciutkan menu">
          ${IKON.ciut}<span class="dg-teks-menu">Ciutkan</span>
        </button>
        <button type="button" class="dg-keluar" data-keluar-guru title="Keluar">
          ${IKON.keluar}<span class="dg-teks-menu">Keluar</span>
        </button>
      </div>
    </aside>`;
}

// Bilah penanda saat admin sedang masuk sebagai guru (konteks.menyamar terisi)
function bilahMenyamarHTML(konteks) {
  if (!konteks.menyamar) return '';
  return `
    <div class="dg-bilah-menyamar" role="region" aria-label="Sedang masuk sebagai guru lain">
      ${IKON.masukSebagai}
      <p>Anda sedang masuk sebagai <strong>${esc(konteks.guru.nama)}</strong>
        <span class="dg-bilah-menyamar-kecil">(akun admin: ${esc(konteks.menyamar.adminNama)})</span></p>
      <button type="button" class="tombol tombol-sekunder tombol-kecil" data-kembali-admin>Kembali ke akun admin</button>
    </div>`;
}

function topbarHTML(judul, konteks, kelasId) {
  return `
    <header class="dg-topbar">
      ${bilahMenyamarHTML(konteks)}
      <button type="button" class="dg-hamburger" data-buka-drawer aria-label="Buka menu" aria-controls="dg-sidebar" aria-expanded="false">${IKON.menu}</button>
      <h1 class="dg-judul">${esc(judul)}</h1>
      <div class="dg-topbar-kanan">
        <label class="dg-filter">
          <span class="sr-only sm:not-sr-only text-sm font-bold text-teal-tua">Kelas</span>
          <select data-filter-kelas aria-label="Filter kelas">
            <option value="">${konteks.admin ? 'Semua kelas' : 'Semua kelas saya'}</option>
            ${konteks.kelas.map((k) => `<option value="${esc(k.id)}" ${k.id === kelasId ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}
          </select>
        </label>
        <span class="dg-tanggal">${esc(tanggalHariIni())}</span>
      </div>
    </header>`;
}

/**
 * Bungkus render halaman dengan kerangka dashboard.
 * opsi: { judul, menu } — menu = id menu yang aktif
 */
export function denganKerangkaGuru(render, { judul, menu }) {
  return async (halaman, ctx) => {
    let konteks;
    try {
      konteks = await guruKonteks();
    } catch (err) {
      toast(err.message, jenisGalat(err));
      pindah('/guru/masuk');
      return undefined;
    }
    const pref = await getPreferensi();
    const kelasId = konteks.kelas.some((k) => k.id === pref.kelasGuru) ? pref.kelasGuru : '';

    halaman.innerHTML = `
      <div class="dg-kerangka ${pref.menuGuruCiut ? 'dg-ciut' : ''}" data-kerangka>
        ${sidebarHTML(konteks, menu)}
        <div class="dg-tirai" data-tutup-drawer hidden></div>
        <div class="dg-utama">
          ${topbarHTML(judul, konteks, kelasId)}
          <div class="dg-isi" data-isi-guru></div>
        </div>
      </div>`;

    const kerangka = halaman.querySelector('[data-kerangka]');
    const tirai = halaman.querySelector('[data-tutup-drawer]');
    const tombolHamburger = halaman.querySelector('[data-buka-drawer]');

    // ---------- Ciutkan menu (layar lebar) ----------
    halaman.querySelector('[data-ciutkan]').addEventListener('click', () => {
      const ciut = kerangka.classList.toggle('dg-ciut');
      simpanPreferensi({ menuGuruCiut: ciut });
    });

    // ---------- Drawer (layar kecil) ----------
    const aturDrawer = (buka) => {
      kerangka.classList.toggle('dg-drawer-buka', buka);
      tirai.hidden = !buka;
      tombolHamburger.setAttribute('aria-expanded', String(buka));
      if (buka) halaman.querySelector('.dg-menu a')?.focus();
    };
    tombolHamburger.addEventListener('click', () => aturDrawer(true));
    tirai.addEventListener('click', () => aturDrawer(false));
    halaman.querySelector('.dg-menu').addEventListener('click', () => aturDrawer(false));
    const escTutup = (e) => { if (e.key === 'Escape' && kerangka.classList.contains('dg-drawer-buka')) aturDrawer(false); };
    document.addEventListener('keydown', escTutup);

    // ---------- Keluar ----------
    halaman.querySelector('[data-keluar-guru]').addEventListener('click', async () => {
      const ya = await bukaModal({
        judul: 'Keluar dari dashboard?',
        isi: '<p>Anda perlu masuk lagi untuk membuka dashboard.</p>',
        tombol: [{ teks: 'Batal', nilai: false, varian: 'sekunder' }, { teks: 'Keluar', nilai: true }]
      });
      if (!ya) return;
      await keluar();
      toast('Anda berhasil keluar dari dashboard.', 'sukses');
      pindah('/guru/masuk');
    });

    // ---------- Kembali dari akun guru ke akun admin ----------
    halaman.querySelector('[data-kembali-admin]')?.addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try {
        await kembaliKeAkunAdmin();
        toast('Anda kembali ke akun admin.', 'sukses');
        pindah('/guru/guru');
      } catch (err) {
        toast(err.message, jenisGalat(err));
        pindah('/guru/masuk');
      }
    });

    // ---------- Filter kelas global ----------
    halaman.querySelector('[data-filter-kelas]').addEventListener('change', async (e) => {
      await simpanPreferensi({ kelasGuru: e.target.value });
      muatUlang();
    });

    // ---------- Isi halaman ----------
    const wadahIsi = halaman.querySelector('[data-isi-guru]');
    let hasil;
    try {
      hasil = await render(wadahIsi, { ...ctx, konteks, kelasId: kelasId || null });
    } catch (err) {
      console.error(err);
      wadahIsi.innerHTML = `
        <div class="dg-kartu dg-kosong">
          ${robot('sedih', { kelas: 'w-24 h-auto', alt: '' })}
          <p class="font-judul text-xl font-extrabold text-teal-tua">Halaman tidak bisa ditampilkan</p>
          <p>${esc(err.message)}</p>
          <a href="#/guru" class="tombol tombol-utama tombol-kecil">Kembali ke Ringkasan</a>
        </div>`;
    }

    return () => {
      document.removeEventListener('keydown', escTutup);
      if (typeof hasil === 'function') hasil();
    };
  };
}

/** Placeholder untuk menu yang dibuat di tahap berikutnya. */
export function renderSegeraGuru(judul, teks) {
  return (wadah) => {
    wadah.innerHTML = `
      <div class="dg-kartu dg-kosong">
        ${robot('berpikir', { kelas: 'w-28 h-auto melayang', alt: '' })}
        <p class="font-judul text-2xl font-extrabold text-teal-tua">${esc(judul)}</p>
        <p class="max-w-md">${esc(teks)}</p>
      </div>`;
  };
}
