// js/guru/level.js — #/guru/level: daftar level per zona dalam urutan main
// Aksi: edit, duplikat, coba main, naik/turun, hapus (level bawaan hanya bisa dinonaktifkan).
// Tiap pulau punya sakelar aktif/nonaktif (guru & admin, berlaku untuk semua kelas), disimpan di
// pengaturan.zona_nonaktif. Menyalakan pulau bisa menurunkan nilai murid, jadi konfirmasinya memuat angka sungguhan.

import { esc, bukaModal, toast } from '../ui.js';
import {
  guruDaftarLevel, guruDuplikatLevel, guruPindahUrutanLevel, guruHapusLevel, guruAturAktifLevel, guruDaftarZona, guruAturZona
} from '../store.js';
import { muatUlang, pindah } from '../router.js';
import { ZONA } from '../data/zona.js';
import { LABEL_JENIS } from '../data/levels.js';
import { zonaTerjangkau } from '../game/kemajuan.js';
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

function sakelarZonaHTML(z) {
  return `
    <label class="sakelar">
      <input type="checkbox" role="switch" data-zona="${esc(z.id)}" ${z.aktif ? 'checked' : ''} aria-label="Pulau ${esc(z.nama)} aktif untuk murid">
      <span class="sakelar-jalur" aria-hidden="true"></span>
      <span>${z.aktif ? 'Aktif' : 'Nonaktif'}</span>
    </label>`;
}

const daftarNama = (zona) => zona.map((z) => esc(z.nama)).join(', ');

/** Konfirmasi MENYALAKAN pulau: levelnya langsung masuk nilai sebagai 0, jadi tampilkan angka sungguhan. */
function modalNyalakan(z, nonaktifBaru) {
  const murid = !z.totalMurid
    ? 'Belum ada murid yang terdaftar.'
    : z.nilaiTurun
      ? `Nilai <strong>${z.nilaiTurun} murid</strong> akan turun sampai mereka menyelesaikannya.`
      : 'Tidak ada nilai murid yang turun.';
  const terjangkau = zonaTerjangkau(nonaktifBaru);
  const terkunci = terjangkau.some((x) => x.id === z.id) ? '' : `
    <p class="mt-2">Pulau ini tetap terkunci bagi murid sampai pulau sebelumnya dinyalakan juga.</p>`;
  return {
    judul: `Nyalakan ${z.nama}?`,
    isi: `
      <p>Pulau ini berisi <strong>${z.jumlahLevel} level</strong>. ${murid} Lanjutkan?</p>${terkunci}
      <p class="mt-2 text-sm">Berlaku untuk <strong>semua kelas</strong>. Level yang belum selesai dihitung 0 dalam nilai akhir.
        Nilai yang sudah ditimpa guru tidak berubah. Progres dan bintang lama murid di pulau ini muncul kembali.</p>`,
    tombol: [{ teks: 'Batal', nilai: false, varian: 'sekunder' }, { teks: 'Nyalakan', nilai: true, varian: 'utama' }]
  };
}

/** Konfirmasi MEMATIKAN pulau: aman untuk nilai, tetapi pulau sesudahnya ikut terkunci. */
function modalMatikan(z, nonaktifLama, nonaktifBaru) {
  const sebelum = zonaTerjangkau(nonaktifLama);
  const sesudah = zonaTerjangkau(nonaktifBaru);
  const ikutTerkunci = sebelum.filter((x) => x.id !== z.id && !sesudah.some((y) => y.id === x.id));
  // Mematikan pulau ini membuat murid tidak punya satu pun pulau yang bisa dimainkan
  const habis = sebelum.length > 0 && !sesudah.length;
  return {
    judul: habis ? 'Murid tidak punya pulau untuk dimainkan' : `Matikan ${z.nama}?`,
    isi: `
      ${habis ? `<p class="rounded-xl bg-kuning p-3 mb-2 font-bold">Setelah ${esc(z.nama)} dimatikan, murid tidak punya satu pun pulau
        yang bisa dimainkan. Peta mereka akan bertuliskan "Belum ada pulau yang dibuka".</p>` : ''}
      <p>${esc(z.nama)} disembunyikan dari peta murid di <strong>semua kelas</strong>, dan levelnya tidak dihitung dalam nilai akhir.</p>
      ${ikutTerkunci.length ? `<p class="mt-2">Pulau sesudahnya (<strong>${daftarNama(ikutTerkunci)}</strong>) ikut terkunci bagi murid
        sampai ${esc(z.nama)} dinyalakan lagi.</p>` : ''}
      <p class="mt-2 text-sm">Progres, bintang, koin, dan berlian murid tidak dihapus, dan muncul kembali saat pulau dinyalakan lagi.</p>`,
    tombol: [{ teks: 'Batal', nilai: false, varian: 'sekunder' }, { teks: habis ? 'Tetap matikan' : 'Matikan', nilai: true, varian: 'bahaya' }]
  };
}

export async function renderLevelGuru(wadah, { konteks, kelasId }) {
  const [daftarLevel, infoZona] = await Promise.all([guruDaftarLevel(), guruDaftarZona()]);
  let semua = daftarLevel;
  // Filter kelas global: tampilkan level yang ditujukan ke kelas itu
  const tampil = kelasId ? semua.filter((l) => !l.kelasIds || l.kelasIds.includes(kelasId)) : semua;

  wadah.innerHTML = `
    <div class="dg-kartu mb-5">
      <div class="dg-kartu-kepala mb-0">
        <div>
          <h2 class="dg-subjudul">Level & Soal</h2>
          <p class="text-sm">Level boss selalu di urutan terakhir zonanya. Level baru otomatis disisipkan sebelum boss.
          ${konteks.admin ? '' : 'Anda bisa mengedit level buatan Anda; level bawaan bisa diduplikat atau dinonaktifkan untuk kelas Anda.'}</p>
          <p class="text-sm mt-1">Sakelar <strong>Aktif</strong> di tiap pulau berlaku untuk semua kelas. Pulau nonaktif tidak tampil di peta murid,
          levelnya tidak dihitung dalam nilai, dan pulau sesudahnya ikut terkunci.</p>
        </div>
        <a href="#/guru/level/baru" class="tombol tombol-utama tombol-kecil">${IKON.tambah}<span>Buat Level Baru</span></a>
      </div>
    </div>
    ${ZONA.map((z) => {
      const daftarZona = tampil.filter((l) => l.zona === z.id);
      const iz = infoZona.find((x) => x.id === z.id) || { ...z, aktif: true };
      return `
        <section class="dg-kartu mb-5" aria-labelledby="zona-${z.id}">
          <div class="dg-kartu-kepala">
            <div class="flex items-center gap-3">
              <img src="${esc(z.gambar)}" alt="" class="w-16 h-10 rounded-lg object-cover">
              <div>
                <h3 id="zona-${z.id}" class="dg-subjudul">${esc(z.nama)}</h3>
                <p class="text-sm text-teal-tua font-bold">${esc(z.konsep)} · ${daftarZona.length} level</p>
                ${iz.aktif ? '' : '<p class="text-sm text-[#B24E1C] font-bold">Tidak tampil di peta murid · tidak dihitung dalam nilai</p>'}
              </div>
            </div>
            ${sakelarZonaHTML(iz)}
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

  // Sakelar pulau: tampilan baru berubah setelah tersimpan; angka konfirmasi diambil ulang dari server
  wadah.addEventListener('change', async (e) => {
    const sakelar = e.target.closest('[data-zona]');
    if (!sakelar) return;
    const aktif = sakelar.checked;
    sakelar.checked = !aktif;
    sakelar.disabled = true;
    try {
      const terbaru = await guruDaftarZona();
      const z = terbaru.find((x) => x.id === sakelar.dataset.zona);
      const nonaktifLama = terbaru.filter((x) => !x.aktif).map((x) => x.id);
      const nonaktifBaru = aktif ? nonaktifLama.filter((id) => id !== z.id) : [...nonaktifLama, z.id];
      const ya = await bukaModal(aktif ? modalNyalakan(z, nonaktifBaru) : modalMatikan(z, nonaktifLama, nonaktifBaru));
      if (!ya) return;
      await guruAturZona(z.id, aktif);
      toast(`Pulau ${z.nama} ${aktif ? 'dinyalakan' : 'dimatikan'}.`, 'sukses');
      muatUlang();
    } catch (err) {
      toast(err.message, 'peringatan');
    } finally {
      sakelar.disabled = false;
    }
  });

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
