// js/guru/nilai.js — #/guru/nilai: matriks nilai siswa x level untuk satu kelas
// Nilai Akhir = rata-rata nilai semua level terbit (belum selesai = 0), minimal 1.
// Guru bisa menimpa Nilai Akhir dengan alasan wajib; ekspor CSV dan cetak tersedia.

import { esc, bukaFormModal, toast, unduhBerkas } from '../ui.js';
import { guruMatriksNilai, guruTimpaNilai, guruHapusTimpaNilai, simpanPreferensi } from '../store.js';
import { muatUlang } from '../router.js';
import { IKON, kosong, avatarSiswa, formatTanggal } from './komponen.js';
import { csvNilai, labelLevelNilai } from './csv.js';


function selHTML(c, l) {
  const keterangan = c.dimainkan
    ? `${l.judul}: ${c.selesai ? `nilai ${c.nilai}, ${c.bintang} bintang` : 'belum selesai'}, ${c.percobaan} percobaan, ${c.clueDibeli} clue dibeli`
    : `${l.judul}: belum dimainkan`;
  const isi = !c.dimainkan
    ? '<span class="dg-strip" aria-hidden="true">–</span>'
    : !c.selesai
      ? '<span class="dg-strip text-[#B24E1C]" aria-hidden="true">•</span>'
      : `<span class="dg-bintang-sel" aria-hidden="true">${[1, 2, 3].map((n) => `<img src="image/item/bintang.png" alt="" class="${n <= c.bintang ? '' : 'bintang-kosong'}">`).join('')}</span>`;
  return `<td class="dg-sel-nilai" title="${esc(keterangan)}"><span class="sr-only">${esc(keterangan)}</span>${isi}</td>`;
}

export async function renderNilai(wadah, { konteks, kelasId }) {
  if (!konteks.kelas.length) {
    wadah.innerHTML = `<div class="dg-kartu">${kosong('Belum ada kelas', 'Buat kelas dulu di menu Kelas, lalu nilai siswa akan tampil di sini.')}</div>`;
    return;
  }
  // Kelas yang dipilih: dari filter global, atau kelas pertama
  const idKelas = kelasId || konteks.kelas[0].id;
  const data = await guruMatriksNilai(idKelas);
  const { levels, siswa } = data;

  // Kelompok zona untuk kepala kolom
  const kelompok = [];
  for (const l of levels) {
    const akhir = kelompok[kelompok.length - 1];
    if (akhir && akhir.zona === l.zona) akhir.jumlah++;
    else kelompok.push({ zona: l.zona, nama: l.zonaNama, warna: l.warna, jumlah: 1 });
  }
  const labelLevel = labelLevelNilai(levels); // P1, P2, L1, ... (sama dengan kolom CSV)
  const rata = siswa.length ? Math.round(siswa.reduce((n, s) => n + s.nilaiAkhir, 0) / siswa.length) : 0;

  wadah.innerHTML = `
    <div class="dg-kartu">
      <div class="dg-kartu-kepala no-print">
        <div class="flex flex-wrap items-center gap-3">
          <label class="dg-label-sebaris">Kelas
            <select class="dg-input" data-pilih-kelas>
              ${konteks.kelas.map((k) => `<option value="${esc(k.id)}" ${k.id === idKelas ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}
            </select>
          </label>
          <span class="text-sm">${siswa.length} siswa · ${levels.length} level terbit · rata-rata kelas <strong>${rata}</strong></span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="tombol tombol-sekunder tombol-kecil" data-ekspor ${siswa.length ? '' : 'disabled'}>${IKON.unduh}<span>Ekspor CSV</span></button>
          <button type="button" class="tombol tombol-sekunder tombol-kecil" data-cetak ${siswa.length ? '' : 'disabled'}>${IKON.nilai}<span>Cetak</span></button>
        </div>
      </div>

      <div class="hanya-cetak mb-3">
        <p class="font-judul text-2xl font-extrabold">Rekap Nilai Coding Island — ${esc(data.kelas.nama)}</p>
        <p class="text-sm">Dicetak ${esc(formatTanggal(new Date().toISOString(), { jam: true }))} oleh ${esc(konteks.guru.nama)} · rata-rata kelas ${rata}</p>
      </div>

      ${siswa.length && levels.length ? `
        <p class="text-sm mb-2 no-print">Arahkan kursor ke sel untuk melihat nilai, percobaan, dan clue. <span class="dg-strip">–</span> belum dimainkan, <span class="dg-strip text-[#B24E1C]">•</span> dicoba tetapi belum selesai.</p>
        <div class="dg-tabel-wadah dg-matriks-wadah">
          <table class="dg-tabel dg-matriks">
            <thead>
              <tr>
                <th rowspan="2" class="dg-kolom-siswa">Siswa</th>
                ${kelompok.map((k) => `<th colspan="${k.jumlah}" class="dg-kepala-zona" style="--warna-zona:${k.warna}">${esc(k.nama)}</th>`).join('')}
                <th rowspan="2" class="dg-kolom-akhir">Nilai Akhir</th>
              </tr>
              <tr>
                ${levels.map((l, i) => `<th class="dg-kepala-level" style="--warna-zona:${l.warna}" title="${esc(l.judul)}"><abbr title="${esc(l.judul)}">${labelLevel[i]}</abbr></th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${siswa.map((s) => `
                <tr>
                  <th scope="row" class="dg-kolom-siswa">
                    <a href="#/guru/siswa/${esc(s.id)}" class="flex items-center gap-2 dg-tautan">${avatarSiswa(s.avatar, 'w-7 h-7')}<span class="truncate">${esc(s.namaLengkap)}</span></a>
                  </th>
                  ${levels.map((l) => selHTML(s.sel[l.id], l)).join('')}
                  <td class="dg-kolom-akhir">
                    <span class="inline-flex items-center gap-1">
                      <strong class="text-lg ${s.timpa ? 'dg-nilai-timpa' : ''}" ${s.timpa ? `title="Ditimpa ${esc(s.timpa.guruNama)}: ${esc(s.timpa.alasan)} (otomatis ${s.nilaiOtomatis})"` : ''}>${s.nilaiAkhir}</strong>
                      ${s.timpa ? '<span class="dg-lencana" data-jenis="clue" title="Nilai ditimpa guru">Ditimpa</span>' : ''}
                      <button type="button" class="dg-tombol-ikon no-print" data-timpa="${esc(s.id)}" aria-label="Ubah nilai akhir ${esc(s.namaLengkap)}" title="Ubah nilai akhir">${IKON.edit}</button>
                    </span>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`
        : kosong(siswa.length ? 'Belum ada level terbit untuk kelas ini' : 'Belum ada siswa di kelas ini',
          siswa.length ? 'Terbitkan level di menu Level & Soal.' : 'Bagikan kode kelas atau tambahkan siswa di menu Siswa.')}
    </div>`;

  wadah.querySelector('[data-pilih-kelas]').addEventListener('change', async (e) => {
    await simpanPreferensi({ kelasGuru: e.target.value });
    muatUlang();
  });

  wadah.querySelector('[data-cetak]')?.addEventListener('click', () => window.print());

  wadah.querySelector('[data-ekspor]')?.addEventListener('click', () => {
    const nama = `nilai-${data.kelas.nama.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
    unduhBerkas(nama, csvNilai(data)); // unduhBerkas menambahkan BOM UTF-8
    toast(`CSV nilai ${data.kelas.nama} berhasil diunduh.`, 'sukses');
  });

  wadah.addEventListener('click', async (e) => {
    const tombol = e.target.closest('[data-timpa]');
    if (!tombol) return;
    const s = siswa.find((x) => x.id === tombol.dataset.timpa);
    const hasil = await bukaFormModal({
      judul: `Nilai akhir ${s.namaLengkap}`,
      teksSimpan: 'Simpan nilai',
      isi: `
        <p class="mb-3">Nilai otomatis: <strong>${s.nilaiOtomatis}</strong>${s.timpa ? ` · sekarang ditimpa menjadi <strong>${s.timpa.nilai}</strong> oleh ${esc(s.timpa.guruNama)}` : ''}</p>
        <div class="dg-form-grid">
          <label class="dg-label">Nilai baru (1–100)<input name="nilai" type="number" min="1" max="100" class="dg-input" value="${s.nilaiAkhir}"></label>
        </div>
        <label class="dg-label mt-3">Alasan (wajib)<textarea name="alasan" class="dg-input min-h-[4.5rem]" maxlength="300" placeholder="Contoh: Mengikuti remedial dan sudah menunjukkan pemahaman.">${esc(s.timpa?.alasan || '')}</textarea></label>
        ${s.timpa ? '<label class="dg-centang mt-3"><input type="checkbox" name="kembalikan"> Kembalikan ke nilai otomatis</label>' : ''}`,
      saatSimpan: async (fd) => {
        if (fd.get('kembalikan')) {
          await guruHapusTimpaNilai(s.id, idKelas);
          return 'kembali';
        }
        await guruTimpaNilai(s.id, idKelas, fd.get('nilai'), fd.get('alasan'));
        return 'timpa';
      }
    });
    if (!hasil) return;
    toast(hasil === 'kembali' ? `Nilai ${s.namaPanggilan} berhasil dikembalikan ke nilai otomatis.` : `Nilai akhir ${s.namaPanggilan} berhasil disimpan.`, 'sukses');
    muatUlang();
  });
}
