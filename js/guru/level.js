// js/guru/level.js — #/guru/level: pulau milik kelas + daftar soal per pulau dalam urutan main
// Semua soal dibuat guru (tidak ada soal bawaan). Soal tampil di kelas yang dicentang di editor soal.
// Kartu "Pulau untuk kelas" (paling atas): guru mencentang pulau yang dipakai sebuah kelas dan menyusun
// urutannya. Definisi pulau tetap global (js/data/zona.js); yang milik kelas hanya pilihan & urutannya.
// Pulau yang dicentang tetapi belum berisi soal untuk kelas itu disembunyikan otomatis dari siswa.
// Aksi soal: edit, duplikat, coba main, naik/turun, hapus.

import { esc, bukaModal, toast, jenisGalat } from '../ui.js';
import { guruDaftarLevel, guruDuplikatLevel, guruPindahUrutanLevel, guruHapusLevel, guruAturZonaKelas } from '../store.js';
import { muatUlang, pindah } from '../router.js';
import { ZONA, cariZona } from '../data/zona.js';
import { LABEL_JENIS } from '../data/levels.js';
import { IKON, kosong, tombolAksi } from './komponen.js';

const LABEL_STATUS = { terbit: 'Terbit', draf: 'Draf' };
const JENIS_LENCANA = { terbit: 'selesai', draf: 'clue' };

// Soal terbit yang tampil di kelas ini (kelasIds null = semua kelas)
const soalTerbitDiKelas = (levels, kelasId, zonaId) =>
  levels.filter((l) => l.zona === zonaId && l.status === 'terbit' && (!l.kelasIds || l.kelasIds.includes(kelasId))).length;

function barisLevel(l, i, daftarZona) {
  const nonBoss = daftarZona.filter((x) => x.jenis !== 'boss');
  const posisi = nonBoss.indexOf(l);
  const bisaNaik = l.bisaPindah && posisi > 0;
  const bisaTurun = l.bisaPindah && posisi > -1 && posisi < nonBoss.length - 1;
  return `
    <tr>
      <td class="text-center font-bold">${i + 1}</td>
      <td><span class="font-bold">${esc(l.judul)}</span></td>
      <td class="whitespace-nowrap"><span class="dg-chip inline-flex items-center gap-1">${l.jenis === 'boss' ? '<img src="image/item/piala.png" alt="" class="w-4 h-4 object-contain">' : ''}${esc(LABEL_JENIS[l.jenis] || l.jenis)}</span></td>
      <td><span class="dg-lencana" data-jenis="${JENIS_LENCANA[l.status] || 'clue'}">${esc(LABEL_STATUS[l.status] || l.status)}</span></td>
      <td>${l.kelas ? (l.kelas.map((k) => `<span class="dg-chip">${esc(k)}</span>`).join(' ') || '<span class="text-sm text-[#B24E1C] font-bold">Belum tampil di kelas mana pun</span>') : '<span class="text-sm">Semua kelas</span>'}</td>
      <td class="text-sm">${esc(l.pembuat)}</td>
      <td class="text-right whitespace-nowrap">
        ${tombolAksi(IKON.naik, 'Naikkan urutan', `data-aksi="naik" data-id="${esc(l.id)}" ${bisaNaik ? '' : 'disabled'}`)}
        ${tombolAksi(IKON.turun, 'Turunkan urutan', `data-aksi="turun" data-id="${esc(l.id)}" ${bisaTurun ? '' : 'disabled'}`)}
        ${tombolAksi(IKON.main, `Coba main ${l.judul}`, `data-aksi="coba" data-id="${esc(l.id)}"`)}
        ${tombolAksi(IKON.edit, l.bisaEdit ? `Edit ${l.judul}` : 'Hanya admin/pembuat yang bisa mengedit', `data-aksi="edit" data-id="${esc(l.id)}" ${l.bisaEdit ? '' : 'disabled'}`)}
        ${tombolAksi(IKON.duplikat, `Duplikat ${l.judul}`, `data-aksi="duplikat" data-id="${esc(l.id)}"`)}
        ${tombolAksi(IKON.hapus, l.bisaHapus ? `Hapus ${l.judul}` : 'Hanya pembuat yang bisa menghapus', `data-aksi="hapus" data-id="${esc(l.id)}" ${l.bisaHapus ? '' : 'disabled'}`, true)}
      </td>
    </tr>`;
}

// =====================================================================
// Pulau untuk kelas: centang pulau yang dipakai + susun urutannya
// =====================================================================
/** Baris pulau: yang dipakai (urutan kelas) di atas, yang tidak dipakai di bawah (urutan bawaan). */
function urutanTampil(dipakai) {
  return [...dipakai.map(cariZona).filter(Boolean), ...ZONA.filter((z) => !dipakai.includes(z.id))];
}

function daftarPulauHTML(kelas, dipakai, levels) {
  let nomor = 0;
  return urutanTampil(dipakai).map((z) => {
    const pakai = dipakai.includes(z.id);
    const i = dipakai.indexOf(z.id);
    const jumlah = soalTerbitDiKelas(levels, kelas.id, z.id);
    const kosongSoal = pakai && !jumlah;
    if (pakai && jumlah) nomor++;
    return `
      <li class="flex flex-wrap items-center gap-3 py-2 border-b border-[#EEF5F3] last:border-0">
        <label class="dg-centang flex-1 min-w-[12rem]">
          <input type="checkbox" data-zona-pakai="${esc(z.id)}" ${pakai ? 'checked' : ''}>
          <img src="${esc(z.gambar)}" alt="" class="w-12 h-8 rounded-md object-cover">
          <span>
            <span class="block">${pakai && jumlah ? `Pulau ${nomor} · ` : ''}${esc(z.nama)}</span>
            <span class="block text-sm font-normal">${esc(z.konsep)} · ${jumlah} soal terbit untuk ${esc(kelas.nama)}</span>
            ${kosongSoal ? '<span class="block text-sm text-[#B24E1C] font-bold">Belum ada soal: disembunyikan dari siswa dan dilewati</span>' : ''}
          </span>
        </label>
        ${pakai ? `
          <span class="whitespace-nowrap">
            ${tombolAksi(IKON.naik, `Naikkan ${z.nama}`, `data-geser-zona="${esc(z.id)}" data-arah="-1" ${i > 0 ? '' : 'disabled'}`)}
            ${tombolAksi(IKON.turun, `Turunkan ${z.nama}`, `data-geser-zona="${esc(z.id)}" data-arah="1" ${i < dipakai.length - 1 ? '' : 'disabled'}`)}
          </span>` : '<span class="text-sm">Tidak dipakai</span>'}
      </li>`;
  }).join('');
}

function kartuPulauHTML(konteks, kelas, dipakai, levels) {
  if (!konteks.kelas.length) {
    return `<div class="dg-kartu mb-5">${kosong('Belum ada kelas', 'Buat kelas dulu di menu Kelas, lalu pilih pulau yang dipakai kelas itu di sini.')}</div>`;
  }
  return `
    <section class="dg-kartu mb-5" aria-labelledby="judul-pulau-kelas" data-kartu-pulau>
      <div class="dg-kartu-kepala">
        <div>
          <h2 id="judul-pulau-kelas" class="dg-subjudul">Pulau untuk kelas</h2>
          <p class="text-sm">Centang pulau yang dipakai kelas ini dan susun urutannya. Pulau yang tidak dicentang tidak tampil
            bagi siswa kelas ini, dan pulau berikutnya menjadi urutan selanjutnya. Pulau tanpa soal disembunyikan otomatis.</p>
        </div>
        <label class="dg-label-sebaris">Kelas
          <select class="dg-input" data-kelas-pulau>
            ${konteks.kelas.map((k) => `<option value="${esc(k.id)}" ${k.id === kelas.id ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}
          </select>
        </label>
      </div>
      <ul data-daftar-pulau>${daftarPulauHTML(kelas, dipakai, levels)}</ul>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" class="tombol tombol-utama tombol-kecil" data-simpan-pulau>Simpan pulau ${esc(kelas.nama)}</button>
        <span class="text-sm" data-catatan-pulau></span>
      </div>
    </section>`;
}

export async function renderLevelGuru(wadah, { konteks, kelasId }) {
  let semua = await guruDaftarLevel();
  // Filter kelas global: tampilkan level yang ditujukan ke kelas itu
  const tampil = kelasId ? semua.filter((l) => !l.kelasIds || l.kelasIds.includes(kelasId)) : semua;
  // Kartu pulau memakai kelas dari filter global, atau kelas pertama
  let kelasPulau = konteks.kelas.find((k) => k.id === kelasId) || konteks.kelas[0] || null;
  let dipakai = kelasPulau ? kelasPulau.zonaIds.slice() : [];

  wadah.innerHTML = `
    <div class="dg-kartu mb-5">
      <div class="dg-kartu-kepala mb-0">
        <div>
          <h2 class="dg-subjudul">Level & Soal</h2>
          <p class="text-sm">Semua soal dibuat guru. Centang kelas yang memakai soal di editor soal; soal tanpa centang kelas tidak tampil di mana pun.
          Level boss selalu di urutan terakhir pulaunya, dan level baru otomatis disisipkan sebelum boss.</p>
        </div>
        <a href="#/guru/level/baru" class="tombol tombol-utama tombol-kecil">${IKON.tambah}<span>Buat Level Baru</span></a>
      </div>
    </div>
    <div data-wadah-pulau>${kelasPulau ? kartuPulauHTML(konteks, kelasPulau, dipakai, semua) : kartuPulauHTML(konteks, null, [], semua)}</div>
    ${ZONA.map((z) => {
      const daftarZona = tampil.filter((l) => l.zona === z.id);
      const kelasFilter = konteks.kelas.find((k) => k.id === kelasId);
      return `
        <section class="dg-kartu mb-5" aria-labelledby="zona-${z.id}">
          <div class="dg-kartu-kepala">
            <div class="flex items-center gap-3">
              <img src="${esc(z.gambar)}" alt="" class="w-16 h-10 rounded-lg object-cover">
              <div>
                <h3 id="zona-${z.id}" class="dg-subjudul">${esc(z.nama)}</h3>
                <p class="text-sm text-teal-tua font-bold">${esc(z.konsep)} · ${daftarZona.length} level</p>
                ${kelasFilter && !kelasFilter.zonaIds.includes(z.id) ? `<p class="text-sm text-[#B24E1C] font-bold">Tidak dipakai ${esc(kelasFilter.nama)} · tidak tampil bagi siswanya</p>` : ''}
              </div>
            </div>
          </div>
          ${daftarZona.length ? `
            <div class="dg-tabel-wadah">
              <table class="dg-tabel">
                <thead><tr>
                  <th class="text-center">#</th><th>Judul</th><th>Jenis</th><th>Status</th>
                  <th>Kelas</th><th>Pembuat</th><th class="text-right">Aksi</th>
                </tr></thead>
                <tbody>${daftarZona.map((l, i) => barisLevel(l, i, daftarZona)).join('')}</tbody>
              </table>
            </div>`
            : kosong('Belum ada level di pulau ini', 'Buat level baru agar siswa punya tantangan di pulau ini.')}
        </section>`;
    }).join('')}`;

  // ---------- Kartu pulau ----------
  const wadahPulau = wadah.querySelector('[data-wadah-pulau]');
  const gambarPulau = (berubah = false) => {
    if (!kelasPulau) return;
    wadahPulau.querySelector('[data-daftar-pulau]').innerHTML = daftarPulauHTML(kelasPulau, dipakai, semua);
    wadahPulau.querySelector('[data-catatan-pulau]').textContent = berubah ? 'Ada perubahan yang belum disimpan.' : '';
  };
  wadahPulau.addEventListener('change', (e) => {
    const pilihKelas = e.target.closest('[data-kelas-pulau]');
    if (pilihKelas) {
      kelasPulau = konteks.kelas.find((k) => k.id === pilihKelas.value);
      dipakai = kelasPulau.zonaIds.slice();
      wadahPulau.innerHTML = kartuPulauHTML(konteks, kelasPulau, dipakai, semua);
      return;
    }
    const centang = e.target.closest('[data-zona-pakai]');
    if (!centang) return;
    const id = centang.dataset.zonaPakai;
    dipakai = centang.checked ? [...dipakai, id] : dipakai.filter((x) => x !== id);
    gambarPulau(true);
  });
  wadahPulau.addEventListener('click', async (e) => {
    const geser = e.target.closest('[data-geser-zona]');
    if (geser && !geser.disabled) {
      const i = dipakai.indexOf(geser.dataset.geserZona);
      const j = i + Number(geser.dataset.arah);
      if (i < 0 || j < 0 || j >= dipakai.length) return;
      [dipakai[i], dipakai[j]] = [dipakai[j], dipakai[i]];
      gambarPulau(true);
      return;
    }
    const simpan = e.target.closest('[data-simpan-pulau]');
    if (!simpan || simpan.disabled) return;
    if (!dipakai.length) {
      const ya = await bukaModal({
        judul: `${kelasPulau.nama} tidak memakai pulau apa pun?`,
        isi: `<p>Siswa ${esc(kelasPulau.nama)} akan melihat "Belum ada pulau yang dibuka" sampai Anda mencentang minimal satu pulau.</p>`,
        tombol: [{ teks: 'Batal', nilai: false, varian: 'sekunder' }, { teks: 'Tetap simpan', nilai: true, varian: 'bahaya' }]
      });
      if (!ya) return;
    }
    simpan.disabled = true;
    try {
      const k = await guruAturZonaKelas(kelasPulau.id, dipakai);
      toast(`Pulau untuk ${k.nama} berhasil disimpan.`, 'sukses');
      muatUlang(); // konteks kelas (zonaIds) ikut diperbarui
    } catch (err) {
      toast(err.message, jenisGalat(err));
    } finally {
      simpan.disabled = false;
    }
  });

  // ---------- Aksi soal ----------
  wadah.addEventListener('click', async (e) => {
    const tombol = e.target.closest('[data-aksi]');
    if (!tombol || tombol.disabled) return;
    const l = semua.find((x) => x.id === tombol.dataset.id);
    const aksi = tombol.dataset.aksi;
    try {
      if (aksi === 'naik' || aksi === 'turun') {
        await guruPindahUrutanLevel(l.id, aksi === 'naik' ? -1 : 1);
        toast(`Urutan level "${l.judul}" berhasil diubah.`, 'sukses');
        muatUlang();
      } else if (aksi === 'coba') {
        pindah(`/guru/level/${l.id}/coba`);
      } else if (aksi === 'edit') {
        pindah(`/guru/level/${l.id}/edit`);
      } else if (aksi === 'duplikat') {
        const baru = await guruDuplikatLevel(l.id);
        toast(`Salinan "${baru.judul}" berhasil dibuat sebagai draf.`, 'sukses');
        pindah(`/guru/level/${baru.id}/edit`);
      } else if (aksi === 'hapus') {
        const ya = await bukaModal({
          judul: `Hapus "${l.judul}"?`,
          isi: '<p>Level dan progres siswa pada level ini (di semua kelas) dihapus permanen.</p>',
          tombol: [{ teks: 'Batal', nilai: false, varian: 'sekunder' }, { teks: 'Hapus', nilai: true, varian: 'bahaya' }]
        });
        if (!ya) return;
        await guruHapusLevel(l.id);
        toast(`Level "${l.judul}" berhasil dihapus.`, 'sukses');
        semua = semua.filter((x) => x.id !== l.id);
        muatUlang();
      }
    } catch (err) {
      toast(err.message, jenisGalat(err));
    }
  });
}
