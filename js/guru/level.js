// js/guru/level.js — #/guru/level: daftar level per zona dalam urutan main
// Aksi: edit, duplikat, coba main, naik/turun, hapus (level bawaan hanya bisa dinonaktifkan).

import { esc, bukaModal, toast } from '../ui.js';
import { guruDaftarLevel, guruDuplikatLevel, guruPindahUrutanLevel, guruHapusLevel, guruAturAktifLevel } from '../store.js';
import { muatUlang, pindah } from '../router.js';
import { ZONA } from '../data/zona.js';
import { LABEL_JENIS } from '../data/levels.js';
import { IKON, kosong, tombolAksi } from './komponen.js';

const LABEL_STATUS = { terbit: 'Terbit', draf: 'Draf', nonaktif: 'Nonaktif', sebagian: 'Sebagian nonaktif' };
const JENIS_LENCANA = { terbit: 'selesai', draf: 'clue', nonaktif: 'coba', sebagian: 'coba' };

const teksTingkat = (t) => {
  const urut = [...t].sort();
  return urut.length > 1 && urut[urut.length - 1] - urut[0] === urut.length - 1 ? `${urut[0]}–${urut[urut.length - 1]}` : urut.join(', ');
};

function barisLevel(l, i, daftarZona) {
  const nonBoss = daftarZona.filter((x) => x.jenis !== 'boss');
  const posisi = nonBoss.indexOf(l);
  const bisaNaik = l.bisaPindah && posisi > 0;
  const bisaTurun = l.bisaPindah && posisi > -1 && posisi < nonBoss.length - 1;
  const aktif = l.status === 'terbit' || l.status === 'sebagian';
  return `
    <tr class="${l.status === 'nonaktif' ? 'dg-baris-pudar' : ''}">
      <td class="text-center font-bold">${i + 1}</td>
      <td>
        <span class="font-bold">${esc(l.judul)}</span>
        ${l.bawaan ? '<span class="dg-chip ml-1">Bawaan</span>' : ''}
      </td>
      <td class="whitespace-nowrap"><span class="dg-chip inline-flex items-center gap-1">${l.jenis === 'boss' ? '<img src="image/item/piala.png" alt="" class="w-4 h-4 object-contain">' : ''}${esc(LABEL_JENIS[l.jenis] || l.jenis)}</span></td>
      <td class="whitespace-nowrap">Kelas ${esc(teksTingkat(l.tingkat))}</td>
      <td><span class="dg-lencana" data-jenis="${JENIS_LENCANA[l.status]}">${esc(LABEL_STATUS[l.status])}</span></td>
      <td>${l.kelas ? (l.kelas.map((k) => `<span class="dg-chip">${esc(k)}</span>`).join(' ') || '<span class="text-sm text-[#B24E1C] font-bold">Belum dipilih</span>') : '<span class="text-sm">Semua kelas</span>'}</td>
      <td class="text-sm">${esc(l.pembuat)}</td>
      <td class="text-right whitespace-nowrap">
        ${tombolAksi(IKON.naik, 'Naikkan urutan', `data-aksi="naik" data-id="${esc(l.id)}" ${bisaNaik ? '' : 'disabled'}`)}
        ${tombolAksi(IKON.turun, 'Turunkan urutan', `data-aksi="turun" data-id="${esc(l.id)}" ${bisaTurun ? '' : 'disabled'}`)}
        ${tombolAksi(IKON.main, `Coba main ${l.judul}`, `data-aksi="coba" data-id="${esc(l.id)}"`)}
        ${tombolAksi(IKON.edit, l.bisaEdit ? `Edit ${l.judul}` : 'Hanya admin/pembuat yang bisa mengedit', `data-aksi="edit" data-id="${esc(l.id)}" ${l.bisaEdit ? '' : 'disabled'}`)}
        ${tombolAksi(IKON.duplikat, `Duplikat ${l.judul}`, `data-aksi="duplikat" data-id="${esc(l.id)}"`)}
        ${l.bawaan
          ? tombolAksi(aktif ? IKON.nonaktif : IKON.periksa, aktif ? 'Nonaktifkan' : 'Aktifkan lagi', `data-aksi="${aktif ? 'nonaktif' : 'aktif'}" data-id="${esc(l.id)}"`, aktif)
          : tombolAksi(IKON.hapus, l.bisaHapus ? `Hapus ${l.judul}` : 'Hanya pembuat yang bisa menghapus', `data-aksi="hapus" data-id="${esc(l.id)}" ${l.bisaHapus ? '' : 'disabled'}`, true)}
      </td>
    </tr>`;
}

export async function renderLevelGuru(wadah, { konteks, kelasId }) {
  let semua = await guruDaftarLevel();
  // Filter kelas global: tampilkan level yang ditujukan ke kelas itu
  const tampil = kelasId ? semua.filter((l) => !l.kelasIds || l.kelasIds.includes(kelasId)) : semua;

  wadah.innerHTML = `
    <div class="dg-kartu mb-5">
      <div class="dg-kartu-kepala mb-0">
        <div>
          <h2 class="dg-subjudul">Level & Soal</h2>
          <p class="text-sm">Level boss selalu di urutan terakhir zonanya. Level baru otomatis disisipkan sebelum boss.
          ${konteks.admin ? '' : 'Anda bisa mengedit level buatan Anda; level bawaan bisa diduplikat atau dinonaktifkan untuk kelas Anda.'}</p>
        </div>
        <a href="#/guru/level/baru" class="tombol tombol-utama tombol-kecil">${IKON.tambah}<span>Buat Level Baru</span></a>
      </div>
    </div>
    ${ZONA.map((z) => {
      const daftarZona = tampil.filter((l) => l.zona === z.id);
      return `
        <section class="dg-kartu mb-5" aria-labelledby="zona-${z.id}">
          <div class="dg-kartu-kepala">
            <div class="flex items-center gap-3">
              <img src="${esc(z.gambar)}" alt="" class="w-16 h-10 rounded-lg object-cover">
              <div>
                <h3 id="zona-${z.id}" class="dg-subjudul">${esc(z.nama)}</h3>
                <p class="text-sm text-teal-tua font-bold">${esc(z.konsep)} · ${daftarZona.length} level</p>
              </div>
            </div>
          </div>
          ${daftarZona.length ? `
            <div class="dg-tabel-wadah">
              <table class="dg-tabel">
                <thead><tr>
                  <th class="text-center">#</th><th>Judul</th><th>Jenis</th><th>Tingkat</th><th>Status</th>
                  <th>Kelas tujuan</th><th>Pembuat</th><th class="text-right">Aksi</th>
                </tr></thead>
                <tbody>${daftarZona.map((l, i) => barisLevel(l, i, daftarZona)).join('')}</tbody>
              </table>
            </div>`
            : kosong('Belum ada level di pulau ini', 'Buat level baru agar siswa punya tantangan tambahan.')}
        </section>`;
    }).join('')}`;

  wadah.addEventListener('click', async (e) => {
    const tombol = e.target.closest('[data-aksi]');
    if (!tombol || tombol.disabled) return;
    const l = semua.find((x) => x.id === tombol.dataset.id);
    const aksi = tombol.dataset.aksi;
    try {
      if (aksi === 'naik' || aksi === 'turun') {
        await guruPindahUrutanLevel(l.id, aksi === 'naik' ? -1 : 1);
        toast(`Urutan "${l.judul}" diubah.`, 'sukses');
        muatUlang();
      } else if (aksi === 'coba') {
        pindah(`/guru/level/${l.id}/coba`);
      } else if (aksi === 'edit') {
        pindah(`/guru/level/${l.id}/edit`);
      } else if (aksi === 'duplikat') {
        const baru = await guruDuplikatLevel(l.id);
        toast(`Salinan dibuat sebagai draf: ${baru.judul}`, 'sukses');
        pindah(`/guru/level/${baru.id}/edit`);
      } else if (aksi === 'nonaktif' || aksi === 'aktif') {
        const nonaktif = aksi === 'nonaktif';
        if (nonaktif) {
          const ya = await bukaModal({
            judul: `Nonaktifkan "${l.judul}"?`,
            isi: `<p>${konteks.admin ? 'Level ini akan hilang dari peta semua siswa.' : 'Level ini akan hilang dari peta siswa di kelas yang Anda ampu.'} Progres siswa tetap tersimpan dan level bisa diaktifkan lagi.</p>`,
            tombol: [{ teks: 'Batal', nilai: false, varian: 'sekunder' }, { teks: 'Nonaktifkan', nilai: true, varian: 'bahaya' }]
          });
          if (!ya) return;
        }
        await guruAturAktifLevel(l.id, !nonaktif);
        toast(nonaktif ? `"${l.judul}" dinonaktifkan.` : `"${l.judul}" aktif lagi.`, 'sukses');
        muatUlang();
      } else if (aksi === 'hapus') {
        const ya = await bukaModal({
          judul: `Hapus "${l.judul}"?`,
          isi: '<p>Level dan progres siswa pada level ini dihapus permanen.</p>',
          tombol: [{ teks: 'Batal', nilai: false, varian: 'sekunder' }, { teks: 'Hapus', nilai: true, varian: 'bahaya' }]
        });
        if (!ya) return;
        await guruHapusLevel(l.id);
        toast(`"${l.judul}" dihapus.`, 'sukses');
        semua = semua.filter((x) => x.id !== l.id);
        muatUlang();
      }
    } catch (err) {
      toast(err.message, 'peringatan');
    }
  });
}
