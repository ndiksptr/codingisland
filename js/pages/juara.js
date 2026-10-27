// js/pages/juara.js — sertifikat "Juara Coding Island" (#/juara)
// Tampil setelah boss pulau AKTIF terakhir selesai (biasanya Pegunungan Salju; bila zona itu
// dinonaktifkan guru, pulau aktif sebelumnya). Bintang & daftar pulau hanya dari zona aktif (dihitung server).
// Tombol cetak memakai window.print() dengan gaya cetak khusus (@media print di css/app.css).

import { esc, robot, tombol } from '../ui.js';
import { sesiAktif, getRingkasanJuara, getZonaNonaktif } from '../store.js';
import { zonaTerakhir } from '../game/kemajuan.js';

// "keempat pulau: Pantai, Laut, Gurun, dan Pegunungan Salju" mengikuti jumlah pulau yang aktif
const KATA_JUMLAH = { 2: 'kedua', 3: 'ketiga', 4: 'keempat' };
function teksPulau(pulau) {
  if (pulau.length <= 1) return `pulau ${esc(pulau[0] || '')}`;
  const daftar = `${pulau.slice(0, -1).map(esc).join(', ')}${pulau.length > 2 ? ',' : ''} dan ${esc(pulau[pulau.length - 1])}`;
  return `${KATA_JUMLAH[pulau.length] || pulau.length} pulau: ${daftar}`;
}

const formatTanggal = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '-'
    : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

export async function renderJuara(halaman) {
  const sesi = await sesiAktif();
  const data = await getRingkasanJuara(sesi.pengguna.id);

  if (!data) {
    const akhir = zonaTerakhir(await getZonaNonaktif());
    halaman.innerHTML = `
      <section class="mx-auto max-w-lg px-4 py-12">
        <div class="kartu muncul flex flex-col items-center text-center gap-3">
          ${robot('berpikir', { kelas: 'w-28 h-auto melayang', alt: '' })}
          <img src="image/item/piala.png" alt="" class="w-16 h-16 object-contain opacity-50">
          <h1 class="font-judul text-3xl font-extrabold text-teal-tua">Sertifikat belum terbuka</h1>
          <p class="text-lg">Kalahkan boss ${esc(akhir?.nama || 'pulau terakhir')} untuk menjadi Juara Coding Island!</p>
          ${tombol({ teks: 'Kembali ke Peta', href: '#/peta', varian: 'utama' })}
        </div>
      </section>`;
    return;
  }

  halaman.innerHTML = `
    <section class="halaman-juara mx-auto max-w-5xl px-3 sm:px-6 py-6 sm:py-10">
      <div class="no-print flex flex-wrap items-center justify-center gap-3 mb-6">
        ${tombol({ teks: 'Cetak Sertifikat', varian: 'utama', attr: 'data-cetak', ikon: 'image/item/piala.png' })}
        ${tombol({ teks: 'Kembali ke Peta', href: '#/peta', varian: 'sekunder' })}
      </div>

      <article class="sertifikat" aria-label="Sertifikat Juara Coding Island">
        <div class="sertifikat-dalam">
          <img src="image/item/piala.png" alt="" class="sertifikat-piala">
          <p class="sertifikat-label">Sertifikat</p>
          <h1 class="sertifikat-judul">Juara Coding Island</h1>
          <p class="sertifikat-teks">Diberikan dengan bangga kepada</p>
          <p class="sertifikat-nama">${esc(data.namaLengkap)}</p>
          <p class="sertifikat-teks">
            siswa <strong>${esc(data.kelas)}</strong> yang telah menaklukkan ${teksPulau(data.pulau || [])}
            bersama Robot Tutor.
          </p>

          <div class="sertifikat-info">
            <div>
              <span>Total bintang</span>
              <strong><img src="image/item/bintang.png" alt="" class="w-7 h-7 object-contain">${data.totalBintang} / ${data.maksBintang}</strong>
            </div>
            <div>
              <span>Tanggal</span>
              <strong>${esc(formatTanggal(data.tanggal))}</strong>
            </div>
          </div>

          <div class="sertifikat-ttd">
            ${robot('gembira', { kelas: 'w-16 h-auto', alt: '' })}
            <div>
              <p class="sertifikat-ttd-garis">Robot Tutor</p>
              <p class="text-sm">Pemandu Coding Island</p>
            </div>
          </div>
        </div>
      </article>
    </section>`;

  halaman.querySelector('[data-cetak]').addEventListener('click', () => window.print());
}
