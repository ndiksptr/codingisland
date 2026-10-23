// js/pages/uji-interpreter.js — halaman pengembang untuk menguji interpreter
// Hanya didaftarkan oleh js/dev.js saat mode pengembang aktif (MODE_DEV=1, uji lokal).

import { esc, tombol, toast } from '../ui.js';
import { jalankanKodeSiswa } from '../game/runner.js';
import { SEMUA_PERINTAH } from '../game/interpreter.js';
import { duniaDariTeks, duniaKeTeks } from '../game/dunia.js';
import { KASUS_UJI, jalankanSemuaUji } from '../game/uji-interpreter-kasus.js';

const CONTOH = [
  {
    nama: 'Lurus',
    peta: ['>....F'],
    kode: 'ulangi 5 {\n  maju()\n}'
  },
  {
    nama: 'Belok & batu',
    peta: ['>.#..', '.....', '...$F'],
    kode: 'maju()\nbelok_kanan()\nmaju(2)\nbelok_kiri()\nmaju(2)\nambil()\nmaju()'
  },
  {
    nama: 'Jurang',
    peta: ['>.O.O.F'],
    kode: '// lompati setiap jurang\nselama bukan sampai_tujuan() {\n  jika ada_jurang() {\n    lompat()\n  } lainnya {\n    maju()\n  }\n}'
  },
  {
    nama: 'Labirin kecil',
    peta: ['>..#.', '.#...', '.#.#F', '...#.'],
    kode: 'buat langkah = 2\nmaju(langkah)\nbelok_kanan()\nmaju()\nbelok_kiri()\nmaju(2)\nbelok_kanan()\nmaju()'
  }
];

function barisJejak(e, i) {
  const item = e.item ? `${e.item.jenis} (${e.item.x},${e.item.y})` : e.rintangan || '';
  return `
    <tr class="border-t border-mint">
      <td class="px-2 py-1">${i + 1}</td>
      <td class="px-2 py-1 font-bold">${esc(e.jenis)}</td>
      <td class="px-2 py-1">${e.baris ?? ''}</td>
      <td class="px-2 py-1">${e.x}</td>
      <td class="px-2 py-1">${e.y}</td>
      <td class="px-2 py-1">${esc(e.arah)}</td>
      <td class="px-2 py-1">${esc(item)}</td>
    </tr>`;
}

export function renderUjiInterpreter(halaman) {

  halaman.innerHTML = `
    <section class="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <p class="inline-block rounded-xl bg-oranye px-3 py-1 font-bold">Mode pengembang</p>
      <h1 class="mt-2 font-judul text-4xl font-extrabold text-teal-tua">Uji Interpreter</h1>
      <p class="mt-1">Kode dijalankan di Web Worker lewat <code class="font-kode">runner.js</code>, sama seperti saat bermain.</p>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <div class="kartu flex flex-col gap-3">
          <label class="label-kolom" for="u-contoh">Dunia contoh</label>
          <select id="u-contoh" class="kolom-input" data-contoh>
            ${CONTOH.map((c, i) => `<option value="${i}">${esc(c.nama)}</option>`).join('')}
          </select>
          <label class="label-kolom" for="u-kode">Kode</label>
          <textarea id="u-kode" class="kolom-input font-kode text-base min-h-[16rem]" spellcheck="false" data-kode></textarea>
          <label class="label-kolom" for="u-tersedia">perintahTersedia <span class="font-isi text-sm font-bold text-teal-tua">(pisahkan dengan koma, kosong = semua)</span></label>
          <input id="u-tersedia" class="kolom-input font-kode text-base" placeholder="${esc(SEMUA_PERINTAH.join(', '))}" data-tersedia>
          <div class="flex flex-wrap gap-3">
            ${tombol({ teks: 'Jalankan', varian: 'utama', attr: 'data-jalankan' })}
            ${tombol({ teks: 'Jalankan semua tes', varian: 'sekunder', attr: 'data-semua-tes' })}
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <div class="kartu">
            <h2 class="kartu-judul">Dunia awal</h2>
            <pre class="font-kode text-lg leading-snug bg-latar rounded-2xl p-3 overflow-x-auto" data-grid-awal></pre>
            <p class="mt-2 text-sm">Simbol: <code class="font-kode">&gt; &lt; ^ v</code> robot, <code class="font-kode">F</code> tujuan, <code class="font-kode">#</code> batu, <code class="font-kode">O</code> jurang, <code class="font-kode">$</code> koin wajib, <code class="font-kode">*</code> koin bebas</p>
          </div>
          <div class="kartu" data-hasil hidden>
            <h2 class="kartu-judul">Hasil</h2>
            <div data-ringkasan></div>
            <pre class="mt-3 font-kode text-lg leading-snug bg-latar rounded-2xl p-3 overflow-x-auto" data-grid-akhir></pre>
          </div>
        </div>
      </div>

      <div class="kartu mt-6 overflow-x-auto" data-jejak hidden>
        <h2 class="kartu-judul">Jejak peristiwa</h2>
        <table class="w-full text-left font-kode text-sm">
          <thead><tr class="text-teal-tua"><th class="px-2">#</th><th class="px-2">jenis</th><th class="px-2">baris</th><th class="px-2">x</th><th class="px-2">y</th><th class="px-2">arah</th><th class="px-2">item</th></tr></thead>
          <tbody data-isi-jejak></tbody>
        </table>
      </div>

      <div class="kartu mt-6 overflow-x-auto" data-tes hidden>
        <h2 class="kartu-judul">Tes otomatis (${KASUS_UJI.length} kasus)</h2>
        <p class="font-bold" data-ringkasan-tes></p>
        <table class="mt-3 w-full text-left text-sm">
          <thead><tr class="text-teal-tua"><th class="px-2">Status</th><th class="px-2">Kasus</th><th class="px-2">Keterangan</th></tr></thead>
          <tbody data-isi-tes></tbody>
        </table>
      </div>
    </section>`;

  const $ = (s) => halaman.querySelector(s);
  const pilihContoh = $('[data-contoh]');
  const kotakKode = $('[data-kode]');
  let duniaAktif = null;

  function muatContoh() {
    const c = CONTOH[Number(pilihContoh.value)];
    duniaAktif = duniaDariTeks(c.peta);
    kotakKode.value = c.kode;
    $('[data-grid-awal]').textContent = duniaKeTeks(duniaAktif);
  }
  pilihContoh.addEventListener('change', muatContoh);
  muatContoh();

  const daftarTersedia = () => {
    const teks = $('[data-tersedia]').value.trim();
    return teks ? teks.split(',').map((s) => s.trim()).filter(Boolean) : null;
  };

  $('[data-jalankan]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const hasil = await jalankanKodeSiswa(kotakKode.value, duniaAktif, { perintahTersedia: daftarTersedia() });
    btn.disabled = false;

    $('[data-hasil]').hidden = false;
    $('[data-ringkasan]').innerHTML = `
      <p class="inline-block rounded-xl px-3 py-1 font-bold ${hasil.berhasil ? 'bg-mint' : 'bg-oranye'}">${hasil.berhasil ? 'BERHASIL' : 'GAGAL'}</p>
      <p class="mt-2 font-bold">${esc(hasil.alasan)}</p>
      <p class="mt-1 font-kode text-sm">jumlahBaris: ${hasil.jumlahBaris} · jumlahLangkah: ${hasil.jumlahLangkah} · item diambil: ${hasil.itemDiambil}</p>`;
    const diambil = hasil.jejak.filter((j) => j.jenis === 'ambil' && j.item).map((j) => j.item);
    $('[data-grid-akhir]').textContent = hasil.posisiAkhir
      ? duniaKeTeks(duniaAktif, { robot: hasil.posisiAkhir, itemDiambil: diambil })
      : '(tidak ada)';
    $('[data-jejak]').hidden = false;
    $('[data-isi-jejak]').innerHTML = hasil.jejak.map(barisJejak).join('')
      || '<tr><td class="px-2 py-1" colspan="7">Belum ada peristiwa.</td></tr>';
  });

  $('[data-semua-tes]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    $('[data-tes]').hidden = false;
    $('[data-ringkasan-tes]').textContent = 'Menjalankan...';
    $('[data-isi-tes]').innerHTML = '';
    const laporan = await jalankanSemuaUji(jalankanKodeSiswa);
    btn.disabled = false;

    const lulus = laporan.filter((l) => l.lulus).length;
    $('[data-ringkasan-tes]').textContent = `${lulus} dari ${laporan.length} kasus lulus.`;
    $('[data-isi-tes]').innerHTML = laporan.map((l) => `
      <tr class="border-t border-mint align-top">
        <td class="px-2 py-1.5"><span class="rounded-lg px-2 py-0.5 font-bold ${l.lulus ? 'bg-mint' : 'bg-oranye'}">${l.lulus ? 'LULUS' : 'GAGAL'}</span></td>
        <td class="px-2 py-1.5 font-bold">${esc(l.nama)}</td>
        <td class="px-2 py-1.5">${esc(l.catatan)}</td>
      </tr>`).join('');
    toast(`${lulus}/${laporan.length} tes lulus`, lulus === laporan.length ? 'sukses' : 'peringatan');
  });
}
