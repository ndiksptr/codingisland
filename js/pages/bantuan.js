// js/pages/bantuan.js — #/bantuan: daftar perintah dengan contoh
// Isi yang sama juga dibuka sebagai modal dari tombol "?" di layar level.
// Nama perintah & contoh kode mengikuti bahasa pilihan murid; penjelasannya tetap bahasa Indonesia.

import { esc, robot, bukaModal } from '../ui.js';
import { sesiAktif } from '../store.js';
import { bahasaSah, namaDalam, terjemahkanKode } from '../game/kamus-perintah.js';

const KELOMPOK = [
  {
    judul: 'Bergerak',
    pulau: 'Pantai',
    perintah: [
      { nama: 'maju', contoh: 'maju()\nmaju(3)', teks: 'Robot maju 1 petak. Isi angka di dalam kurung untuk maju beberapa petak sekaligus.' },
      { nama: 'belok_kiri', contoh: 'belok_kiri()', teks: 'Robot berputar ke kiri di tempat (tidak berpindah petak).' },
      { nama: 'belok_kanan', contoh: 'belok_kanan()', teks: 'Robot berputar ke kanan di tempat.' },
      { nama: 'ambil', contoh: 'maju(2)\nambil()', teks: 'Mengambil koin atau berlian di petak tempat robot berdiri.' }
    ]
  },
  {
    judul: 'Mengulang',
    pulau: 'Laut',
    perintah: [
      { nama: 'ulangi', contoh: 'ulangi 4 {\n  maju()\n  ambil()\n}', teks: 'Menjalankan perintah di dalam kurung kurawal beberapa kali. Jangan lupa menutup dengan }.' }
    ]
  },
  {
    judul: 'Melompat dan memilih',
    pulau: 'Gurun',
    perintah: [
      { nama: 'lompat', contoh: 'lompat()', teks: 'Robot melompati 1 petak, misalnya jurang, lalu mendarat di petak sesudahnya.' },
      { nama: 'jika', contoh: 'jika ada_jurang() {\n  lompat()\n} lainnya {\n  maju()\n}', teks: 'Robot memeriksa syarat. Jika benar, jalankan bagian pertama. Jika tidak, jalankan bagian lainnya (boleh tidak ditulis).' },
      { nama: 'ada_jurang', contoh: 'jika ada_jurang() { ... }', teks: 'Syarat: benar jika petak di depan robot adalah jurang.' },
      { nama: 'ada_rintangan', contoh: 'jika ada_rintangan() { ... }', teks: 'Syarat: benar jika di depan robot ada rintangan atau ujung peta.' }
    ]
  },
  {
    judul: 'Berjalan sampai selesai dan menyimpan angka',
    pulau: 'Pegunungan Salju',
    perintah: [
      { nama: 'selama', contoh: 'selama bukan sampai_tujuan() {\n  maju()\n}', teks: 'Mengulang terus selama syaratnya benar. Pastikan robot bergerak, supaya perulangannya bisa berhenti.' },
      { nama: 'sampai_tujuan', contoh: 'selama bukan sampai_tujuan() { ... }', teks: 'Syarat: benar jika robot sudah berdiri di bendera.' },
      { nama: 'bukan', contoh: 'jika bukan ada_rintangan() { ... }', teks: 'Membalik syarat: benar menjadi salah, salah menjadi benar.' },
      { nama: 'buat', contoh: 'buat langkah = 3\nmaju(langkah)\nlangkah = langkah + 1', teks: 'Membuat variabel untuk menyimpan angka. Nilainya bisa ditambah atau dikurangi.' },
      { nama: 'ada_koin', contoh: 'jika ada_koin() {\n  ambil()\n}', teks: 'Syarat: benar jika ada koin di petak tempat robot berdiri.' }
    ]
  }
];

const TIPS = [
  'Satu baris berisi satu perintah.',
  'Tulis // di depan kalimat untuk membuat catatan. Robot tidak akan menjalankannya.',
  'Huruf besar dan huruf kecil dianggap sama: MAJU() sama dengan maju().',
  'Kalau ada yang salah, Robot Tutor memberi tahu nomor barisnya.',
  'Tekan Ctrl + Enter untuk menjalankan kode dengan cepat.'
];

/**
 * HTML isi bantuan.
 * tersedia: daftar perintah yang terbuka di level ini (opsional, nama Indonesia) — perintah lain ditandai "belum dibuka".
 * bahasa  : 'id' | 'en' — bahasa nama perintah pilihan murid.
 */
export function bantuanHTML({ tersedia = null, bahasa = 'id' } = {}) {
  const terbuka = tersedia ? new Set(tersedia) : null;
  const bolehDipakai = (nama) => !terbuka || terbuka.has(nama) || (nama === 'bukan' && (terbuka.has('jika') || terbuka.has('selama')));
  return `
    <div class="bantuan text-left">
      ${KELOMPOK.map((k) => `
        <section class="bantuan-kelompok">
          <h2 class="font-judul text-2xl font-extrabold text-teal-tua">${esc(k.judul)} <span class="bantuan-pulau">Pulau ${esc(k.pulau)}</span></h2>
          <div class="bantuan-grid">
            ${k.perintah.map((p) => `
              <article class="bantuan-kartu ${bolehDipakai(p.nama) ? '' : 'belum-terbuka'}">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <h3 class="font-kode text-lg font-bold">${esc(namaDalam(p.nama, bahasa))}</h3>
                  ${terbuka ? (bolehDipakai(p.nama) ? '<span class="bantuan-chip bisa">Bisa dipakai di sini</span>' : '<span class="bantuan-chip">Belum dibuka</span>') : ''}
                </div>
                <p class="mt-1">${esc(p.teks)}</p>
                <pre class="bantuan-contoh">${esc(terjemahkanKode(p.contoh, bahasa))}</pre>
              </article>`).join('')}
          </div>
        </section>`).join('')}
      <section class="bantuan-kelompok">
        <h2 class="font-judul text-2xl font-extrabold text-teal-tua">Tips</h2>
        <ul class="bantuan-tips">${TIPS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </section>
    </div>`;
}

/** Buka bantuan sebagai modal (dari tombol "?" di layar level). */
export function bukaBantuan(tersedia = null, bahasa = 'id') {
  return bukaModal({
    judul: 'Bantuan Perintah',
    pose: 'berpikir',
    lebar: true,
    isi: bantuanHTML({ tersedia, bahasa }),
    tombol: [{ teks: 'Mengerti!', nilai: true }]
  });
}

export async function renderBantuan(halaman) {
  // Murid melihat nama perintah dalam bahasa pilihannya; pengunjung lain dalam bahasa Indonesia
  const sesi = await sesiAktif().catch(() => null);
  const bahasa = sesi?.jenis === 'siswa' ? bahasaSah(sesi.pengguna.bahasa) : 'id';
  halaman.innerHTML = `
    <section class="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div class="flex flex-wrap items-center gap-4 mb-6">
        ${robot('berpikir', { kelas: 'w-20 sm:w-24 h-auto melayang', alt: 'Robot Tutor sedang berpikir' })}
        <div class="flex-1 min-w-[12rem]">
          <h1 class="font-judul text-4xl sm:text-5xl font-extrabold text-teal-tua leading-none">Bantuan Perintah</h1>
          <p class="text-lg font-bold mt-1">Semua perintah robot beserta contohnya.</p>
        </div>
        <button type="button" class="tombol tombol-sekunder" data-kembali>← Kembali</button>
      </div>
      <div class="kartu">${bantuanHTML({ bahasa })}</div>
    </section>`;
  halaman.querySelector('[data-kembali]').addEventListener('click', () => {
    if (history.length > 1) history.back();
    else location.hash = '#/';
  });
}
