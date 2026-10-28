// js/guru/komponen.js — potongan tampilan & helper bersama dashboard guru

import { esc, robot } from '../ui.js';

// ---------- Ikon menu (SVG garis, mengikuti warna teks) ----------
const svg = (isi, ukuran = 22) => `<svg width="${ukuran}" height="${ukuran}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${isi}</svg>`;

export const IKON = {
  ringkasan: svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  kelas: svg('<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/><path d="M3 21h18"/>'),
  siswa: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.2c3 .2 5.5 2.3 5.5 5.8"/>'),
  level: svg('<path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="m2 13 10 5 10-5"/><path d="m2 17.5 10 5 10-5" opacity=".6"/>'),
  nilai: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  aktivitas: svg('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
  guru: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17c.6-2 2-3 3.5-3s2.9 1 3.5 3M15 10h3M15 14h3"/>'),
  pengaturan: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'),
  keluar: svg('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>'),
  masukSebagai: svg('<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="m9 17 5-5-5-5"/><path d="M14 12H3"/>', 18),
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>', 24),
  ciut: svg('<path d="m15 6-6 6 6 6"/>', 20),
  tambah: svg('<path d="M12 5v14M5 12h14"/>', 18),
  edit: svg('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/>', 18),
  hapus: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 18),
  lihat: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 18),
  kunci: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 18),
  pindah: svg('<path d="M4 8h13l-3-3M20 16H7l3 3"/>', 18),
  salin: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', 16),
  segarkan: svg('<path d="M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4"/>', 16),
  unduh: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 18),
  unggah: svg('<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>', 18),
  kode: svg('<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>', 18),
  urut: svg('<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>', 14),
  naik: svg('<path d="m6 15 6-6 6 6"/>', 18),
  turun: svg('<path d="m6 9 6 6 6-6"/>', 18),
  duplikat: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/><path d="M14 11v6M11 14h6"/>', 18),
  main: svg('<path d="M7 4.5v15l12-7.5z"/>', 18),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', 18),
  penghapus: svg('<path d="m7 21-4-4a2 2 0 0 1 0-2.8L13.2 4a2 2 0 0 1 2.8 0l4 4a2 2 0 0 1 0 2.8L11 20"/><path d="M7 21h13M9 11l6 6"/>', 26),
  nonaktif: svg('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/>', 18),
  periksa: svg('<path d="m5 12 5 5 9-10"/>', 18)
};

// ---------- Format ----------
export function formatTanggal(iso, { jam = false } = {}) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const opsi = { day: 'numeric', month: 'short', year: 'numeric' };
  if (jam) Object.assign(opsi, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('id-ID', opsi);
}

/** "baru saja", "5 menit lalu", "3 hari lalu", lalu tanggal biasa. */
export function waktuRelatif(iso) {
  if (!iso) return 'Belum pernah';
  const selisih = Date.now() - Date.parse(iso);
  const menit = Math.floor(selisih / 60000);
  if (menit < 1) return 'baru saja';
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  if (hari === 1) return 'kemarin';
  if (hari < 30) return `${hari} hari lalu`;
  return formatTanggal(iso);
}

export function formatDurasi(detik) {
  const d = Math.max(0, Math.round(detik || 0));
  if (d < 60) return `${d} dtk`;
  const m = Math.floor(d / 60);
  if (m < 60) return `${m} mnt ${d % 60} dtk`;
  return `${Math.floor(m / 60)} jam ${m % 60} mnt`;
}

export const avatarSiswa = (avatar, kelas = 'w-9 h-9') =>
  `<img src="image/profile/${avatar === 'wanita' ? 'wanita' : 'pria'}.png" alt="" class="${kelas} rounded-full bg-mint object-cover shrink-0" loading="lazy" decoding="async">`;

// ---------- Komponen ----------
/** Tampilan kosong dengan robot melamun dan pesan ajakan. */
export function kosong(judul, ajakan = '', tombolHTML = '') {
  return `
    <div class="dg-kosong">
      ${robot('melamun', { kelas: 'w-28 h-auto', alt: '' })}
      <p class="font-judul text-xl font-extrabold text-teal-tua">${esc(judul)}</p>
      ${ajakan ? `<p class="max-w-md">${esc(ajakan)}</p>` : ''}
      ${tombolHTML}
    </div>`;
}

export function kartuStat({ label, nilai, ikon, catatan = '' }) {
  return `
    <div class="dg-kartu dg-stat">
      <span class="dg-stat-ikon">${ikon}</span>
      <div class="min-w-0">
        <p class="dg-stat-label">${esc(label)}</p>
        <p class="dg-stat-nilai">${esc(nilai)}</p>
        ${catatan ? `<p class="text-xs text-teal-tua font-bold">${esc(catatan)}</p>` : ''}
      </div>
    </div>`;
}

const LABEL_AKTIVITAS = {
  daftar: 'Daftar', masuk: 'Masuk', coba: 'Mencoba', selesai: 'Selesai',
  clue: 'Beli clue', piala: 'Piala', juara: 'Juara', keluar: 'Keluar', pin: 'Ganti PIN', nilai: 'Nilai', zona: 'Pulau'
};
export const JENIS_AKTIVITAS = Object.keys(LABEL_AKTIVITAS);
export const lencanaAktivitas = (jenis) =>
  `<span class="dg-lencana" data-jenis="${esc(jenis)}">${esc(LABEL_AKTIVITAS[jenis] || jenis)}</span>`;

/** Tombol ikon kecil untuk aksi per baris tabel. */
export const tombolAksi = (ikon, label, attr, bahaya = false) =>
  `<button type="button" class="dg-tombol-ikon ${bahaya ? 'bahaya' : ''}" aria-label="${esc(label)}" title="${esc(label)}" ${attr}>${ikon}</button>`;

/** Bilah progres sederhana (CSS). */
export const bilah = (persen, warna = 'var(--teal)') =>
  `<span class="dg-bilah" role="img" aria-label="${persen}%"><span style="width:${Math.max(0, Math.min(100, persen))}%;background:${warna}"></span></span>`;

// ---------- CSV ----------
/** Baca CSV sederhana (koma atau titik koma, mendukung tanda kutip). Hasil: array objek per baris. */
export function bacaCSV(teks) {
  const bersih = String(teks).replace(/^﻿/, '');
  const barisPertama = bersih.split(/\r?\n/)[0] || '';
  const pemisah = (barisPertama.match(/;/g) || []).length > (barisPertama.match(/,/g) || []).length ? ';' : ',';
  const baris = [];
  let sel = '';
  let kini = [];
  let dalamKutip = false;
  for (let i = 0; i < bersih.length; i++) {
    const c = bersih[i];
    if (dalamKutip) {
      if (c === '"' && bersih[i + 1] === '"') { sel += '"'; i++; }
      else if (c === '"') dalamKutip = false;
      else sel += c;
    } else if (c === '"') dalamKutip = true;
    else if (c === pemisah) { kini.push(sel); sel = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && bersih[i + 1] === '\n') i++;
      kini.push(sel); baris.push(kini); kini = []; sel = '';
    } else sel += c;
  }
  if (sel || kini.length) { kini.push(sel); baris.push(kini); }
  const isi = baris.filter((b) => b.some((s) => s.trim() !== ''));
  if (!isi.length) return { kolom: [], data: [] };
  const kolom = isi[0].map((k) => k.trim());
  return {
    kolom,
    data: isi.slice(1).map((b) => Object.fromEntries(kolom.map((k, i) => [k, (b[i] ?? '').trim()])))
  };
}

/** Ubah array objek menjadi teks CSV (pemisah koma). Isinya ada di csv.js agar bisa diuji di Node. */
export { buatCSV } from './csv.js';
