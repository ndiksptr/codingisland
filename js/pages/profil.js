// js/pages/profil.js — #/profil: profil siswa (dibuka dari header)
// Avatar & nama, total bintang, koin, berlian, koleksi piala per zona, progres per zona,
// riwayat 10 level terakhir, pilihan avatar, dan pilihan bahasa perintah koding.

import { esc, tombol, toast } from '../ui.js';
import { getSemuaProgres, ubahAvatarSaya, ubahBahasaSaya, getKelas } from '../store.js';
import { deretBintang } from '../game/ikon.js';
import { bahasaSah, namaDalam } from '../game/kamus-perintah.js';
import { muatPeta } from './peta.js';

const PILIHAN_BAHASA = [
  { id: 'id', nama: 'Bahasa Indonesia' },
  { id: 'en', nama: 'Bahasa Inggris' }
];
// Contoh nama perintah di kartu pilihan bahasa
const contohPerintah = (bahasa) => [`${namaDalam('maju', bahasa)}()`, namaDalam('ulangi', bahasa), namaDalam('jika', bahasa)];

const formatTanggal = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

export async function renderProfil(halaman) {
  const { siswa, status } = await muatPeta();
  const [progres, kelas] = await Promise.all([getSemuaProgres({ siswaId: siswa.id }), getKelas(siswa.kelasId)]);
  const totalBintang = status.reduce((n, z) => n + z.bintang, 0);
  const maksBintang = status.reduce((n, z) => n + z.bintangMaks, 0);

  // Info level (judul, zona) dari peta siswa — hanya level yang masih terlihat
  const infoLevel = new Map();
  status.forEach((z) => z.levels.forEach((l) => infoLevel.set(l.id, { judul: l.judul, zona: z.zona, nomor: l.nomor })));
  const riwayat = progres
    .filter((p) => infoLevel.has(p.levelId) && p.diperbarui)
    .sort((a, b) => String(b.diperbarui).localeCompare(String(a.diperbarui)))
    .slice(0, 10);

  halaman.innerHTML = `
    <section class="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div class="kartu flex flex-col sm:flex-row items-center gap-5 muncul">
        <img src="image/profile/${siswa.avatar === 'wanita' ? 'wanita' : 'pria'}.png" alt="Avatar ${esc(siswa.namaPanggilan)}" class="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-mint border-4 border-white shadow object-cover" data-avatar-besar>
        <div class="flex-1 text-center sm:text-left min-w-0">
          <h1 class="font-judul text-4xl font-extrabold text-teal-tua leading-tight">${esc(siswa.namaPanggilan)}</h1>
          <p class="text-lg font-bold">${esc(siswa.namaLengkap)} · ${esc(kelas?.nama || 'Tanpa kelas')}</p>
          <div class="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
            <span class="chip-uang chip-koin"><img src="image/item/bintang.png" alt="">${totalBintang}/${maksBintang} bintang</span>
            <span class="chip-uang chip-koin"><img src="image/item/koin.png" alt="">${Number(siswa.koin) || 0} koin</span>
            <span class="chip-uang chip-berlian"><img src="image/item/berlian.png" alt="">${Number(siswa.berlian) || 0} berlian</span>
          </div>
        </div>
        ${tombol({ teks: 'Ke Peta Pulau', href: '#/peta', varian: 'utama', ikon: 'image/item/roket.png' })}
      </div>

      <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section class="kartu" aria-labelledby="judul-piala">
          <h2 id="judul-piala" class="font-judul text-2xl font-extrabold text-teal-tua">Koleksi Piala</h2>
          <p class="mb-3">Kalahkan boss setiap pulau untuk mendapat pialanya.</p>
          <ul class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            ${status.map((z) => `
              <li class="koleksi-piala ${z.lulus ? 'didapat' : ''}">
                <img src="image/item/piala.png" alt="${z.lulus ? `Piala ${esc(z.zona.nama)} sudah didapat` : `Piala ${esc(z.zona.nama)} belum didapat`}" loading="lazy">
                <span class="font-bold">${esc(z.zona.nama)}</span>
                <span class="text-sm">${z.lulus ? 'Didapat!' : 'Belum'}</span>
              </li>`).join('')}
          </ul>
        </section>

        <section class="kartu" aria-labelledby="judul-progres">
          <h2 id="judul-progres" class="font-judul text-2xl font-extrabold text-teal-tua mb-3">Progres Pulau</h2>
          <ul class="flex flex-col gap-3">
            ${status.map((z) => {
              const persen = z.total ? Math.round((z.selesai / z.total) * 100) : 0;
              return `
                <li>
                  <div class="flex items-center justify-between font-bold"><span>${esc(z.zona.nama)}</span><span>${z.selesai}/${z.total} level</span></div>
                  <span class="bilah-progres profil-bilah mt-1" role="progressbar" aria-valuemin="0" aria-valuemax="${z.total}" aria-valuenow="${z.selesai}" aria-label="Progres ${esc(z.zona.nama)}"><span style="width:${persen}%;background:${z.zona.warna}"></span></span>
                </li>`;
            }).join('')}
          </ul>
        </section>
      </div>

      <section class="kartu mt-6" aria-labelledby="judul-riwayat">
        <h2 id="judul-riwayat" class="font-judul text-2xl font-extrabold text-teal-tua mb-3">10 Level Terakhir</h2>
        ${riwayat.length ? `
          <ul class="flex flex-col">
            ${riwayat.map((p) => {
              const l = infoLevel.get(p.levelId);
              return `
                <li class="riwayat-baris">
                  <span class="riwayat-zona" style="background:${l.zona.warna}">${esc(l.zona.nama)}</span>
                  <span class="flex-1 min-w-0 font-bold truncate">${esc(l.judul)}</span>
                  ${p.selesai ? deretBintang(p.bintang, { ukuran: 'w-6 h-6' }) : '<span class="text-sm font-bold text-[#B24E1C]">Belum selesai</span>'}
                  <span class="text-sm whitespace-nowrap">${esc(formatTanggal(p.diperbarui))}</span>
                </li>`;
            }).join('')}
          </ul>`
          : '<p>Belum ada level yang dimainkan. Ayo mulai dari Pulau Pantai!</p>'}
      </section>

      <section class="kartu mt-6" aria-labelledby="judul-avatar">
        <h2 id="judul-avatar" class="font-judul text-2xl font-extrabold text-teal-tua mb-3">Ganti Avatar</h2>
        <fieldset class="grid grid-cols-2 gap-4 max-w-md">
          <legend class="sr-only">Pilih avatar</legend>
          ${['pria', 'wanita'].map((a) => `
            <label class="pilih-avatar">
              <input type="radio" name="avatar" value="${a}" ${siswa.avatar === a ? 'checked' : ''}>
              <span class="tanda-pilih" aria-hidden="true">✓</span>
              <img src="image/profile/${a}.png" alt="" class="w-24 h-24 object-contain" loading="lazy">
              <span class="font-judul text-xl font-extrabold">${a === 'pria' ? 'Laki-laki' : 'Perempuan'}</span>
            </label>`).join('')}
        </fieldset>
      </section>

      <section class="kartu mt-6" aria-labelledby="judul-bahasa">
        <h2 id="judul-bahasa" class="font-judul text-2xl font-extrabold text-teal-tua">Bahasa Perintah Robot</h2>
        <p class="mb-3">Kamu boleh menulis perintah robot dalam bahasa Indonesia atau bahasa Inggris. Robot mengerti keduanya!
          Pilihan ini hanya mengganti nama perintah. Tulisan lain tetap bahasa Indonesia.</p>
        <fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <legend class="sr-only">Pilih bahasa perintah robot</legend>
          ${PILIHAN_BAHASA.map((b) => `
            <label class="pilih-avatar">
              <input type="radio" name="bahasa" value="${b.id}" ${bahasaSah(siswa.bahasa) === b.id ? 'checked' : ''}>
              <span class="tanda-pilih" aria-hidden="true">✓</span>
              <span class="font-judul text-xl font-extrabold">${b.nama}</span>
              <span class="flex flex-wrap justify-center gap-1.5">
                ${contohPerintah(b.id).map((k) => `<code class="kode-inline">${esc(k)}</code>`).join('')}
              </span>
            </label>`).join('')}
        </fieldset>
      </section>
    </section>`;

  halaman.querySelectorAll('[name="avatar"]').forEach((r) => r.addEventListener('change', async () => {
    try {
      const baru = await ubahAvatarSaya(r.value);
      halaman.querySelector('[data-avatar-besar]').src = `image/profile/${baru.avatar}.png`;
      toast('Avatar berhasil diganti!', 'sukses');
    } catch (err) {
      toast(err.message, 'peringatan');
    }
  }));

  halaman.querySelectorAll('[name="bahasa"]').forEach((r) => r.addEventListener('change', async () => {
    try {
      const baru = await ubahBahasaSaya(r.value);
      siswa.bahasa = baru.bahasa;
      toast(`Sekarang perintah robot memakai ${PILIHAN_BAHASA.find((b) => b.id === baru.bahasa)?.nama}. Contoh: ${contohPerintah(baru.bahasa)[0]}`, 'sukses');
    } catch (err) {
      // Kembalikan pilihan semula bila gagal tersimpan
      halaman.querySelector(`[name="bahasa"][value="${bahasaSah(siswa.bahasa)}"]`).checked = true;
      toast(err.message, 'peringatan');
    }
  }));
}
