// js/guru/siswa-detail.js — #/guru/siswa/:id: profil, progres per zona & level, kode terakhir, catatan guru
// Kemajuan terpisah per kelas: progres yang tampil milik satu kelas (?kelas=, bawaan kelas pertama yang Anda ampu).

import { esc, bukaModal, toast, jenisGalat } from '../ui.js';
import { guruDetailSiswa, guruSimpanCatatan } from '../store.js';
import { pindah, muatUlang } from '../router.js';
import { LABEL_JENIS } from '../data/levels.js';
import { deretBintang } from '../game/ikon.js';
import { IKON, avatarSiswa, bilah, formatTanggal, formatDurasi, waktuRelatif, tombolAksi } from './komponen.js';
import { aksiEditSiswa, aksiTambahKeKelas, aksiKeluarkanDariKelas, aksiResetPin, aksiHapusSiswa } from './siswa.js';

export async function renderDetailSiswa(wadah, { params, konteks, query = {} }) {
  const data = await guruDetailSiswa(params.id, { kelasId: query.kelas || null });
  const s = data.siswa;
  const namaKelasDipilih = data.kelasBoleh.find((k) => k.id === data.kelasId)?.nama || 'Tanpa kelas';
  const namaZona = Object.fromEntries(data.zona.map((z) => [z.id, z.nama]));

  wadah.innerHTML = `
    <a href="#/guru/siswa" class="dg-tautan-kecil inline-block mb-3">← Kembali ke daftar siswa</a>

    <div class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <section class="dg-kartu" aria-label="Profil siswa">
        <div class="flex items-center gap-4">
          ${avatarSiswa(s.avatar, 'w-20 h-20')}
          <div class="min-w-0">
            <h2 class="font-judul text-2xl font-extrabold text-teal-tua leading-tight">${esc(s.namaLengkap)}</h2>
            <p class="text-sm">Panggilan <strong>${esc(s.namaPanggilan)}</strong></p>
            <p class="text-sm">Kelas: ${s.semuaKelas.length ? s.semuaKelas.map((k) => `<span class="dg-chip">${esc(k.nama)}</span>`).join(' ') : '<strong>belum punya kelas</strong>'}</p>
            <p class="text-sm">Username <code class="dg-kode">${esc(s.username)}</code></p>
          </div>
        </div>
        ${data.kelasBoleh.length > 1 ? `
          <label class="dg-label-sebaris mt-4">Lihat kemajuan di
            <select class="dg-input" data-pilih-kelas-detail>
              ${data.kelasBoleh.map((k) => `<option value="${esc(k.id)}" ${k.id === data.kelasId ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}
            </select>
          </label>` : ''}
        <p class="mt-3 text-sm text-teal-tua font-bold">Angka di bawah ini untuk kelas ${esc(namaKelasDipilih)} (koin dan berlian untuk semua kelas).</p>
        <dl class="dg-profil-data">
          <div><dt>Koin</dt><dd><img src="image/item/koin.png" alt="" class="w-5 h-5 inline object-contain"> ${s.koin}</dd></div>
          <div><dt>Berlian</dt><dd><img src="image/item/berlian.png" alt="" class="w-5 h-5 inline object-contain"> ${s.berlian}</dd></div>
          <div><dt>Level selesai</dt><dd>${s.levelSelesai}/${s.totalLevel}</dd></div>
          <div><dt>Total bintang</dt><dd>${s.totalBintang}</dd></div>
          <div><dt>Nilai rata-rata</dt><dd>${s.nilai || '-'}</dd></div>
          <div><dt>Terakhir aktif</dt><dd>${esc(waktuRelatif(s.terakhirAktif))}</dd></div>
          <div><dt>Terdaftar</dt><dd>${esc(formatTanggal(s.dibuatPada))}</dd></div>
        </dl>
        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="tombol tombol-sekunder tombol-kecil" data-aksi="edit">${IKON.edit}<span>Edit</span></button>
          <button type="button" class="tombol tombol-sekunder tombol-kecil" data-aksi="tambah-kelas">${IKON.pindah}<span>Tambahkan ke kelas lain</span></button>
          <button type="button" class="tombol tombol-sekunder tombol-kecil" data-aksi="keluarkan">${IKON.keluar}<span>Keluarkan dari kelas</span></button>
          <button type="button" class="tombol tombol-sekunder tombol-kecil" data-aksi="pin">${IKON.kunci}<span>Ganti PIN</span></button>
          <button type="button" class="tombol tombol-bahaya tombol-kecil" data-aksi="hapus">${IKON.hapus}<span>Hapus akun</span></button>
        </div>
      </section>

      <div class="flex flex-col gap-5 min-w-0">
        <section class="dg-kartu" aria-labelledby="judul-zona-siswa">
          <h2 id="judul-zona-siswa" class="dg-subjudul mb-3">Progres per pulau · ${esc(namaKelasDipilih)}</h2>
          ${data.zona.length ? '' : '<p class="text-sm">Kelas ini belum memakai pulau apa pun.</p>'}
          <ul class="flex flex-col gap-3">
            ${data.zona.map((z) => `
              <li class="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3">
                <span class="font-bold">${esc(z.nama)}</span>
                ${bilah(z.persen, z.warna)}
                <span class="text-sm font-bold whitespace-nowrap">${z.selesai}/${z.total}</span>
              </li>`).join('')}
          </ul>
        </section>

        <section class="dg-kartu" aria-labelledby="judul-catatan">
          <h2 id="judul-catatan" class="dg-subjudul">Catatan guru</h2>
          <p class="text-sm mb-2" data-info-catatan>${data.catatan
            ? `Terakhir disimpan ${esc(formatTanggal(data.catatan.diperbarui, { jam: true }))} oleh ${esc(data.catatan.guruNama)}`
            : 'Catatan hanya terlihat oleh guru.'}</p>
          <textarea class="dg-input min-h-[7rem]" data-catatan maxlength="4000" placeholder="Contoh: Sudah paham urutan, perlu latihan perulangan.">${esc(data.catatan?.teks || '')}</textarea>
          <button type="button" class="tombol tombol-utama tombol-kecil mt-2" data-simpan-catatan>Simpan catatan</button>
        </section>
      </div>
    </div>

    <section class="dg-kartu mt-5" aria-labelledby="judul-level-siswa">
      <h2 id="judul-level-siswa" class="dg-subjudul mb-3">Progres per level · ${esc(namaKelasDipilih)}</h2>
      <div class="dg-tabel-wadah">
        <table class="dg-tabel">
          <thead><tr>
            <th>Level</th><th>Jenis</th><th>Bintang</th><th class="text-right">Nilai</th><th class="text-right">Percobaan</th>
            <th class="text-right">Clue</th><th class="text-right">Lama bermain</th><th>Terakhir dimainkan</th><th class="text-right">Kode</th>
          </tr></thead>
          <tbody>
            ${data.levels.map((l) => `
              <tr class="${!l.percobaan && !l.selesai ? 'dg-baris-pudar' : ''}">
                <td><span class="text-xs text-teal-tua font-bold block">${esc(namaZona[l.zona] || l.zona)} ${l.urutan}</span><span class="font-bold">${esc(l.judul)}</span></td>
                <td><span class="dg-chip">${esc(LABEL_JENIS[l.jenis] || l.jenis)}</span></td>
                <td>${l.selesai ? deretBintang(l.bintang, { ukuran: 'w-5 h-5' }) : `<span class="text-sm">${l.percobaan ? 'Belum selesai' : 'Belum dimainkan'}</span>`}</td>
                <td class="text-right">${l.selesai ? l.nilai : '-'}</td>
                <td class="text-right">${l.percobaan}</td>
                <td class="text-right">${l.clueDibeli}/3</td>
                <td class="text-right whitespace-nowrap">${l.detik ? esc(formatDurasi(l.detik)) : '-'}</td>
                <td class="whitespace-nowrap">${l.diperbarui ? esc(formatTanggal(l.diperbarui, { jam: true })) : '-'}</td>
                <td class="text-right">${tombolAksi(IKON.kode, `Lihat kode ${l.judul}`, `data-kode="${esc(l.id)}" ${l.kodeTerakhir ? '' : 'disabled'}`)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`;

  wadah.querySelector('[data-pilih-kelas-detail]')?.addEventListener('change', (e) => {
    pindah(`/guru/siswa/${s.id}?kelas=${encodeURIComponent(e.target.value)}`);
  });

  wadah.addEventListener('click', async (e) => {
    const tombolKode = e.target.closest('[data-kode]');
    if (tombolKode && !tombolKode.disabled) {
      const l = data.levels.find((x) => x.id === tombolKode.dataset.kode);
      await bukaModal({
        judul: `Kode terakhir: ${l.judul}`,
        lebar: true,
        isi: `
          <p class="text-left text-sm mb-2">${esc(s.namaLengkap)} · ${l.selesai ? `selesai, ${l.bintang} bintang` : 'belum selesai'} · ${l.percobaan} percobaan</p>
          <pre class="dg-blok-kode">${esc(l.kodeTerakhir).split('\n').map((b, i) => `<span class="dg-no-baris">${i + 1}</span>${b}`).join('\n')}</pre>`,
        tombol: [{ teks: 'Tutup', nilai: true, varian: 'sekunder' }]
      });
      return;
    }

    if (e.target.closest('[data-simpan-catatan]')) {
      try {
        const c = await guruSimpanCatatan(s.id, wadah.querySelector('[data-catatan]').value);
        wadah.querySelector('[data-info-catatan]').textContent = `Terakhir disimpan ${formatTanggal(c.diperbarui, { jam: true })} oleh ${c.guruNama}`;
        toast(`Catatan untuk ${s.namaPanggilan} berhasil disimpan.`, 'sukses');
      } catch (err) { toast(err.message, jenisGalat(err)); }
      return;
    }

    const aksi = e.target.closest('[data-aksi]')?.dataset.aksi;
    if (!aksi) return;
    if (aksi === 'edit' && (await aksiEditSiswa(s, konteks))) muatUlang();
    if (aksi === 'tambah-kelas' && (await aksiTambahKeKelas(s, konteks))) muatUlang();
    if (aksi === 'keluarkan' && (await aksiKeluarkanDariKelas(s, konteks, data.kelasId))) pindah(`/guru/siswa/${s.id}`);
    if (aksi === 'pin') await aksiResetPin(s);
    if (aksi === 'hapus' && (await aksiHapusSiswa(s))) pindah('/guru/siswa');
  });
}
