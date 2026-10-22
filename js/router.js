// js/router.js — router hash sederhana
// Contoh rute: '#/', '#/peta', '#/level/pantai-1', '#/guru/siswa'
//
// Fungsi render halaman menerima (halaman, konteks):
//   - halaman  : elemen <div> baru yang harus diisi. Elemen ini baru
//                ditempel ke layar setelah render selesai, jadi cari
//                elemen dengan halaman.querySelector(), bukan document.
//   - konteks  : { params, query, path }
// Render boleh async. Jika render mengembalikan fungsi, fungsi itu
// dipanggil saat pindah halaman (untuk membersihkan timer, worker, dll).

import { loader, robot } from './ui.js';

const daftarRute = [];
const NAMA_APLIKASI = 'Coding Island';

let wadah = null;
let render404 = null;
let penjaga = null;
let bersihkan = null;
let nomorNavigasi = 0;

// Ubah pola '/level/:id' menjadi regex dan daftar nama parameter
function buatPola(pola) {
  const namaParam = [];
  const bagian = pola.replace(/\/+$/, '').split('/').map((seg) => {
    if (seg.startsWith(':')) {
      namaParam.push(seg.slice(1));
      return '([^/]+)';
    }
    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return { regex: new RegExp('^' + bagian.join('/') + '/?$'), namaParam };
}

/** Daftarkan satu rute. */
export function rute(pola, render, judul = '') {
  daftarRute.push({ pola, render, judul, ...buatPola(pola) });
}

/**
 * Pasang penjaga rute. fn(path, query) boleh async dan mengembalikan
 * path tujuan pengalihan (mis. '/masuk?ke=%2Fpeta'), atau null jika boleh lewat.
 */
export function aturPenjaga(fn) {
  penjaga = fn;
}

/** Pindah halaman lewat kode, mis. pindah('/peta'). */
export function pindah(path) {
  const tujuan = '#' + (path.startsWith('/') ? path : '/' + path);
  if (location.hash === tujuan) tampilkan();
  else location.hash = tujuan;
}

/** Render ulang halaman saat ini (mis. setelah data berubah). */
export function muatUlang() {
  if (wadah) tampilkan();
}

/** Ambil path dan query dari hash saat ini. */
function ambilLokasi() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = hash.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(qs)) };
}

function cariRute(path) {
  for (const r of daftarRute) {
    const cocok = path.match(r.regex);
    if (!cocok) continue;
    const params = {};
    r.namaParam.forEach((nama, i) => {
      try { params[nama] = decodeURIComponent(cocok[i + 1]); }
      catch { params[nama] = cocok[i + 1]; }
    });
    return { rute: r, params };
  }
  return null;
}

function gulirKeAtas() {
  try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }
  catch { window.scrollTo(0, 0); }
}

// Halaman cadangan jika render gagal
function halamanError() {
  return `
    <section class="tinggi-layar flex flex-col items-center justify-center gap-4 px-4 text-center">
      ${robot('sedih', { kelas: 'w-40 h-auto', alt: 'Robot Tutor sedih' })}
      <h1 class="font-judul text-4xl font-extrabold text-teal-tua">Ups, ada yang rusak</h1>
      <p class="text-xl max-w-md">Coba muat ulang halaman ini ya.</p>
      <button type="button" class="tombol tombol-utama" onclick="location.reload()">Muat Ulang</button>
    </section>`;
}

/** Render halaman sesuai hash saat ini. */
async function tampilkan() {
  const nomor = ++nomorNavigasi;

  // Bersihkan sisa halaman sebelumnya
  if (typeof bersihkan === 'function') {
    try { bersihkan(); } catch (err) { console.error(err); }
  }
  bersihkan = null;

  const { path, query } = ambilLokasi();

  // Penjaga rute: alihkan pengunjung yang tidak berhak
  if (penjaga) {
    let alih = null;
    try { alih = await penjaga(path, query); } catch (err) { console.error(err); }
    if (nomor !== nomorNavigasi) return;
    if (alih && alih.split('?')[0] !== path) {
      location.replace('#' + alih); // replace agar tombol kembali tidak berputar
      return;
    }
  }

  const hasilCari = cariRute(path);
  const render = hasilCari ? hasilCari.rute.render : render404;
  const judul = hasilCari?.rute.judul || (hasilCari ? '' : 'Pulau tidak ditemukan');
  document.title = judul ? `${judul} · ${NAMA_APLIKASI}` : NAMA_APLIKASI;

  // Loader hanya muncul jika render agak lama, supaya tidak berkedip
  const timerLoader = setTimeout(() => {
    if (nomor === nomorNavigasi) wadah.innerHTML = loader();
  }, 150);

  const halaman = document.createElement('div');
  halaman.className = 'halaman-masuk';

  try {
    const hasil = await render(halaman, { params: hasilCari?.params || {}, query, path });
    clearTimeout(timerLoader);
    // Abaikan jika pengguna sudah pindah halaman lagi
    if (nomor !== nomorNavigasi) {
      if (typeof hasil === 'function') hasil();
      return;
    }
    bersihkan = typeof hasil === 'function' ? hasil : null;
    wadah.replaceChildren(halaman);
  } catch (err) {
    clearTimeout(timerLoader);
    console.error(err);
    if (nomor === nomorNavigasi) wadah.innerHTML = halamanError();
  }

  gulirKeAtas();
  wadah.focus({ preventScroll: true });
}

/** Mulai router. */
export function mulaiRouter(elemenWadah, renderTidakDitemukan) {
  wadah = elemenWadah;
  render404 = renderTidakDitemukan;
  window.addEventListener('hashchange', tampilkan);
  tampilkan();
}
