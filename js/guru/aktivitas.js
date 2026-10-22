// js/guru/aktivitas.js — #/guru/aktivitas: log aktivitas yang bisa difilter per kelas, siswa, dan jenis

import { esc, toast } from '../ui.js';
import { guruAktivitas, guruDaftarSiswa, simpanPreferensi } from '../store.js';
import { muatUlang } from '../router.js';
import { kosong, lencanaAktivitas, formatTanggal, waktuRelatif, JENIS_AKTIVITAS } from './komponen.js';

const LANGKAH = 100;

export async function renderAktivitas(wadah, { konteks, kelasId }) {
  const siswa = await guruDaftarSiswa({ kelasId });
  const status = { siswaId: '', jenis: '', batas: LANGKAH };

  wadah.innerHTML = `
    <div class="dg-kartu">
      <div class="dg-kartu-kepala">
        <div>
          <h2 class="dg-subjudul">Log aktivitas siswa</h2>
          <p class="text-sm" data-jumlah></p>
        </div>
      </div>
      <div class="dg-alat">
        <label class="dg-label-sebaris">Kelas
          <select class="dg-input" data-filter-kelas-lokal>
            <option value="">Semua</option>
            ${konteks.kelas.map((k) => `<option value="${esc(k.id)}" ${k.id === kelasId ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}
          </select>
        </label>
        <label class="dg-label-sebaris">Siswa
          <select class="dg-input" data-filter-siswa>
            <option value="">Semua siswa</option>
            ${siswa.sort((a, b) => a.namaLengkap.localeCompare(b.namaLengkap)).map((s) => `<option value="${esc(s.id)}">${esc(s.namaLengkap)} (${esc(s.kelasNama)})</option>`).join('')}
          </select>
        </label>
        <label class="dg-label-sebaris">Jenis
          <select class="dg-input" data-filter-jenis>
            <option value="">Semua jenis</option>
            ${JENIS_AKTIVITAS.map((j) => `<option value="${j}">${esc(j[0].toUpperCase() + j.slice(1))}</option>`).join('')}
          </select>
        </label>
      </div>
      <div data-daftar></div>
    </div>`;

  const elDaftar = wadah.querySelector('[data-daftar]');
  const elJumlah = wadah.querySelector('[data-jumlah]');

  async function gambar() {
    try {
      const { total, daftar } = await guruAktivitas({ kelasId, siswaId: status.siswaId || null, jenis: status.jenis || null, batas: status.batas });
      elJumlah.textContent = `Menampilkan ${daftar.length} dari ${total} aktivitas`;
      elDaftar.innerHTML = daftar.length ? `
        <div class="dg-tabel-wadah">
          <table class="dg-tabel">
            <thead><tr><th>Waktu</th><th>Siswa</th><th>Kelas</th><th>Jenis</th><th>Keterangan</th></tr></thead>
            <tbody>
              ${daftar.map((a) => `
                <tr>
                  <td class="whitespace-nowrap"><span class="block">${esc(formatTanggal(a.waktu, { jam: true }))}</span><span class="text-xs text-teal-tua">${esc(waktuRelatif(a.waktu))}</span></td>
                  <td class="font-bold"><a class="dg-tautan" href="#/guru/siswa/${esc(a.siswaId)}">${esc(a.namaSiswa)}</a></td>
                  <td>${esc(a.kelasNama)}</td>
                  <td>${lencanaAktivitas(a.jenis)}</td>
                  <td>${esc(a.keterangan)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        ${total > daftar.length ? '<div class="mt-3 text-center"><button type="button" class="tombol tombol-sekunder tombol-kecil" data-lagi>Tampilkan lebih banyak</button></div>' : ''}`
        : kosong('Belum ada aktivitas', 'Aktivitas muncul saat siswa mendaftar, masuk, mencoba level, atau membeli clue.');
    } catch (err) {
      toast(err.message, 'peringatan');
    }
  }
  await gambar();

  wadah.querySelector('[data-filter-kelas-lokal]').addEventListener('change', async (e) => {
    await simpanPreferensi({ kelasGuru: e.target.value });
    muatUlang();
  });
  wadah.querySelector('[data-filter-siswa]').addEventListener('change', (e) => { status.siswaId = e.target.value; status.batas = LANGKAH; gambar(); });
  wadah.querySelector('[data-filter-jenis]').addEventListener('change', (e) => { status.jenis = e.target.value; status.batas = LANGKAH; gambar(); });
  elDaftar.addEventListener('click', (e) => {
    if (e.target.closest('[data-lagi]')) { status.batas += LANGKAH; gambar(); }
  });
}
