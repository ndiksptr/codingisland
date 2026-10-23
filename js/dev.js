// js/dev.js — alat bantu pengembang (panel Dev, ciDev)
// File ini HANYA diimpor oleh main.js bila server melaporkan modeDev (MODE_DEV=1 di .dev.vars),
// jadi tidak pernah dimuat di situs online. Cara pakai saat uji lokal (http://localhost:8787):
// 1. Panel di layar: klik tombol "Dev" di pojok kiri bawah.
// 2. Console: ciDev.selesaikanLevel('pantai-4', 3) | ciDev.resetProgres() | ciDev.validasiLevel() | ciDev.bantuan()
//    (Chrome meminta mengetik "allow pasting" dulu jika perintah ditempel, bukan diketik.)

import { sesiAktif, daftarLevel, getLevel, getProgres, simpanProgres, hapusProgres, aturZonaTerlihat } from './store.js';
import { muatUlang } from './router.js';
import { ZONA } from './data/zona.js';
import { NILAI_BINTANG } from './game/skor.js';
import { esc, toast } from './ui.js';
import { validasiLevel } from './game/validasi-level.js';

async function siswaAktif() {
  const sesi = await sesiAktif();
  if (sesi?.jenis !== 'siswa') throw new Error('Masuk sebagai siswa dulu, lalu coba lagi.');
  return sesi.pengguna;
}

async function tandaiSelesai(siswaId, id, bintang) {
  const b = Math.min(3, Math.max(1, Math.round(Number(bintang) || 3)));
  const lama = await getProgres(siswaId, id);
  await simpanProgres(siswaId, id, {
    selesai: true,
    bintang: Math.max(b, lama?.bintang || 0),
    nilai: Math.max(NILAI_BINTANG[b], lama?.nilai || 0),
    percobaan: (lama?.percobaan || 0) + 1
  });
  return b;
}

// Jalankan perintah, tampilkan hasil sebagai toast + console, lalu gambar ulang halaman
async function jalankan(perintah) {
  try {
    const pesan = await perintah();
    console.info(`[ciDev] ${pesan}`);
    toast(pesan, 'sukses');
    muatUlang();
    return true;
  } catch (err) {
    console.warn(`[ciDev] ${err.message}`);
    toast(err.message, 'peringatan');
    return false;
  }
}

const perintahDev = {
  /** Tandai satu level selesai untuk siswa yang sedang masuk. bintang: 1–3 */
  selesaikanLevel(id, bintang = 3) {
    return jalankan(async () => {
      const siswa = await siswaAktif();
      if (!(await getLevel(id))) throw new Error(`Level "${id}" tidak ada.`);
      const b = await tandaiSelesai(siswa.id, id, bintang);
      return `${id} selesai dengan ${b} bintang.`;
    });
  },

  /** Tandai semua level di satu pulau selesai (boss ikut selesai, pulau berikutnya terbuka). */
  tuntaskanPulau(zona, bintang = 3) {
    return jalankan(async () => {
      const siswa = await siswaAktif();
      const levels = await daftarLevel({ zona });
      if (!levels.length) throw new Error(`Pulau "${zona}" tidak ada.`);
      for (const l of levels) await tandaiSelesai(siswa.id, l.id, bintang);
      return `Semua ${levels.length} level di ${zona} selesai.`;
    });
  },

  /** Hapus semua progres siswa yang sedang masuk (koin tidak berubah). */
  resetProgres() {
    return jalankan(async () => {
      const siswa = await siswaAktif();
      await hapusProgres(siswa.id);
      await aturZonaTerlihat(siswa.id, [ZONA[0].id]);
      return 'Progres dihapus. Semua pulau kecuali Pantai terkunci lagi.';
    });
  },

  /**
   * Jalankan solusi setiap level lewat interpreter dan tampilkan console.table.
   * Level debug: kodeAwal harus gagal dan solusi harus berhasil.
   */
  async validasiLevel() {
    const baris = validasiLevel(await daftarLevel());
    console.table(baris.map(({ id, jenis, berhasil, jumlahBaris, batasBaris, kodeAwalGagal, lulus, catatan }) =>
      ({ id, jenis, berhasil, jumlahBaris, batasBaris, kodeAwalGagal, lulus, catatan })));
    const gagal = baris.filter((b) => !b.lulus);
    const pesan = gagal.length
      ? `${gagal.length} level bermasalah: ${gagal.map((b) => b.id).join(', ')}. Lihat Console.`
      : `Semua ${baris.length} level lulus validasi.`;
    console.info(`[ciDev] ${pesan}`);
    toast(pesan, gagal.length ? 'peringatan' : 'sukses');
    return baris;
  },

  bantuan() {
    console.info([
      'ciDev.selesaikanLevel(id, bintang)   contoh: ciDev.selesaikanLevel("pantai-4", 3)',
      'ciDev.tuntaskanPulau(zona, bintang)  contoh: ciDev.tuntaskanPulau("pantai")',
      'ciDev.resetProgres()                 hapus progres siswa yang sedang masuk',
      'ciDev.validasiLevel()                periksa solusi semua level (console.table)',
      'Lebih mudah: klik tombol "Dev" di pojok kiri bawah.'
    ].join('\n'));
  }
};

// =====================================================================
// Panel pengembang di layar
// =====================================================================
async function isiPanel(panel) {
  const sesi = await sesiAktif();
  const levels = await daftarLevel();
  const status = sesi?.jenis === 'siswa'
    ? `Masuk sebagai <strong>${esc(sesi.pengguna.namaPanggilan)}</strong> (${esc(sesi.pengguna.username)})`
    : '<span class="text-oranye">Belum masuk sebagai siswa.</span> Masuk dulu di <a class="tautan" href="#/masuk">#/masuk</a>.';
  const opsiBintang = [3, 2, 1].map((b) => `<option value="${b}">${b} bintang</option>`).join('');

  panel.innerHTML = `
    <div class="flex items-center justify-between gap-2">
      <p class="font-judul text-xl font-extrabold text-teal-tua">Panel Pengembang</p>
      <button type="button" class="tombol tombol-sekunder tombol-kecil" data-dev-tutup aria-label="Tutup panel">Tutup</button>
    </div>
    <p class="text-sm mt-1">${status}</p>

    <label class="label-kolom text-base mt-3" for="dev-level">Selesaikan satu level</label>
    <div class="flex gap-2">
      <select id="dev-level" class="kolom-input text-base min-h-0 py-2" data-dev-level>
        ${ZONA.map((z) => `<optgroup label="${esc(z.nama)}">${levels.filter((l) => l.zona === z.id)
          .map((l) => `<option value="${esc(l.id)}">${esc(l.id)} · ${esc(l.judul)}</option>`).join('')}</optgroup>`).join('')}
      </select>
      <select class="kolom-input text-base min-h-0 py-2 w-28" data-dev-bintang aria-label="Jumlah bintang">${opsiBintang}</select>
    </div>
    <button type="button" class="tombol tombol-utama tombol-kecil tombol-lebar mt-2" data-dev-aksi="level">Selesaikan level</button>

    <label class="label-kolom text-base mt-3" for="dev-zona">Tuntaskan satu pulau (membuka pulau berikutnya)</label>
    <div class="flex gap-2">
      <select id="dev-zona" class="kolom-input text-base min-h-0 py-2" data-dev-zona>
        ${ZONA.map((z) => `<option value="${esc(z.id)}">${esc(z.nama)}</option>`).join('')}
      </select>
      <button type="button" class="tombol tombol-utama tombol-kecil shrink-0" data-dev-aksi="pulau">Tuntaskan</button>
    </div>

    <button type="button" class="tombol tombol-bahaya tombol-kecil tombol-lebar mt-3" data-dev-aksi="reset">Reset progres saya</button>
    <button type="button" class="tombol tombol-sekunder tombol-kecil tombol-lebar mt-2" data-dev-aksi="validasi">Validasi semua level (lihat Console)</button>

    <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold">
      <a class="tautan" href="#/peta">Peta</a>
      <a class="tautan" href="#/masuk">Masuk siswa</a>
    </div>`;
}

function pasangPanel() {
  const tombolBuka = document.createElement('button');
  tombolBuka.type = 'button';
  tombolBuka.className = 'tombol-dev';
  tombolBuka.textContent = 'Dev';
  tombolBuka.setAttribute('aria-label', 'Buka panel pengembang');

  const panel = document.createElement('div');
  panel.className = 'panel-dev kartu';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Panel pengembang');

  tombolBuka.addEventListener('click', async () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) await isiPanel(panel);
  });

  panel.addEventListener('click', async (e) => {
    if (e.target.closest('[data-dev-tutup]')) { panel.hidden = true; tombolBuka.focus(); return; }
    if (e.target.closest('a')) { panel.hidden = true; return; }
    const aksi = e.target.closest('[data-dev-aksi]')?.dataset.devAksi;
    if (!aksi) return;
    const bintang = panel.querySelector('[data-dev-bintang]').value;
    if (aksi === 'level') await perintahDev.selesaikanLevel(panel.querySelector('[data-dev-level]').value, bintang);
    if (aksi === 'pulau') await perintahDev.tuntaskanPulau(panel.querySelector('[data-dev-zona]').value, bintang);
    if (aksi === 'reset') await perintahDev.resetProgres();
    if (aksi === 'validasi') { await perintahDev.validasiLevel(); return; }
    await isiPanel(panel);
  });

  // Status panel ikut berubah saat masuk/keluar
  window.addEventListener('ci:berubah', (e) => {
    if (!panel.hidden && e.detail?.entitas === 'sesi') isiPanel(panel);
  });

  document.body.append(tombolBuka, panel);
}

/** Pasang semua alat pengembang. Dipanggil main.js sebelum router mulai. */
export function pasangAlatDev() {
  window.ciDev = perintahDev;
  console.info('[ciDev] Mode pengembang aktif. Ketik ciDev.bantuan() untuk melihat perintah.');
  pasangPanel();
}
