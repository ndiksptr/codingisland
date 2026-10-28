// js/pages/pilih-kelas.js — kelas murid
// #/pilih-kelas  : murid anggota lebih dari satu kelas memilih "mau main sebagai apa" (kartu besar per kelas).
//                  Murid dengan satu kelas tidak pernah melihat layar ini (kelasnya langsung dipakai).
// #/gabung-kelas : murid yang belum punya kelas (atau ingin ikut kelas lain) memasukkan kode kelas.
// Form kode kelas juga dipakai di halaman Profil (formGabungHTML + pasangFormGabung).

import { esc, robot, toast, jenisGalat, aturPesan } from '../ui.js';
import { sesiAktif, pilihKelasAktif, gabungKelas } from '../store.js';
import { pindah } from '../router.js';

// Hanya halaman murid yang boleh menjadi tujuan setelah memilih kelas
function tujuanAman(ke) {
  return typeof ke === 'string' && (ke === '/peta' || ke === '/juara' || ke === '/profil' || ke.startsWith('/peta/') || ke.startsWith('/level/')) ? ke : '/peta';
}

function kartuInfo(isi) {
  return `
    <section class="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div class="kartu muncul flex flex-col items-center text-center gap-3">${isi}</div>
    </section>`;
}

/** Form kode kelas (dipakai #/gabung-kelas dan halaman Profil). */
export function formGabungHTML({ teksTombol = 'Gabung' } = {}) {
  return `
    <form class="flex flex-col gap-2 w-full max-w-sm text-left" data-form-gabung novalidate>
      <label for="kode-gabung" class="label-kolom">Kode kelas dari guru</label>
      <div class="flex gap-2">
        <input id="kode-gabung" name="kodeKelas" class="kolom-input kolom-kode" maxlength="6" placeholder="ABC123"
          autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="pesan-kodeKelas">
        <button type="submit" class="tombol tombol-utama shrink-0" data-kirim-gabung>${esc(teksTombol)}</button>
      </div>
      <p id="pesan-kodeKelas" class="pesan-kolom" data-pesan="kodeKelas" aria-live="polite"></p>
    </form>`;
}

/**
 * Pasang perilaku form kode kelas. saatBerhasil(kelas) dipanggil setelah murid resmi ikut kelas itu.
 * Bergabung TIDAK memberi koin awal lagi (koin awal hanya saat akun pertama kali dibuat).
 */
export function pasangFormGabung(akar, saatBerhasil) {
  const form = akar.querySelector('[data-form-gabung]');
  const kolom = form.querySelector('[name="kodeKelas"]');
  const tombolKirim = form.querySelector('[data-kirim-gabung]');
  kolom.addEventListener('input', () => {
    kolom.value = kolom.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    aturPesan(form, 'kodeKelas', '');
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const kode = kolom.value.trim();
    if (!/^[A-Z0-9]{6}$/.test(kode)) {
      aturPesan(form, 'kodeKelas', kode ? 'Kode kelas terdiri dari 6 huruf atau angka.' : 'Ketik kode kelas dari gurumu ya.');
      kolom.focus();
      return;
    }
    tombolKirim.disabled = true;
    try {
      const hasil = await gabungKelas(kode);
      if (!hasil.ok) {
        aturPesan(form, 'kodeKelas', hasil.pesan);
        kolom.focus();
        return;
      }
      kolom.value = '';
      await saatBerhasil(hasil.kelas);
    } catch (err) {
      toast(err.message, jenisGalat(err));
    } finally {
      tombolKirim.disabled = false;
    }
  });
}

/** Kartu besar untuk satu kelas yang diikuti murid. */
function kartuKelasHTML(k, aktif) {
  return `
    <li>
      <button type="button" class="kartu-kelas" data-pilih-kelas="${esc(k.id)}" ${aktif ? 'aria-current="true"' : ''}>
        <img src="image/item/roket.png" alt="" class="kartu-kelas-ikon">
        <span class="flex-1 min-w-0">
          <span class="block font-judul text-2xl sm:text-3xl font-extrabold leading-tight truncate">${esc(k.nama)}</span>
          <span class="block font-bold">${aktif ? 'Sedang dimainkan' : 'Main sebagai anggota kelas ini'}</span>
        </span>
      </button>
    </li>`;
}

export async function renderPilihKelas(halaman, { query }) {
  const sesi = await sesiAktif();
  const daftar = sesi?.pengguna?.kelas || [];
  if (!daftar.length) return pindah('/gabung-kelas');

  halaman.innerHTML = kartuInfo(`
    ${robot('gembira', { kelas: 'w-24 sm:w-28 h-auto melayang', alt: '' })}
    <h1 class="font-judul text-3xl sm:text-4xl font-extrabold text-teal-tua">Kamu mau main sebagai apa?</h1>
    <p class="text-lg">Soal, pulau, dan bintangmu mengikuti kelas yang kamu pilih. Koinmu tetap sama di semua kelas.</p>
    <ul class="mt-2 grid gap-3 w-full">
      ${daftar.map((k) => kartuKelasHTML(k, k.id === sesi.pengguna.kelasId)).join('')}
    </ul>
    <a href="#/gabung-kelas" class="font-bold text-teal-tua underline">Punya kode kelas lain?</a>`);

  halaman.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-pilih-kelas]');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    try {
      const { kelas } = await pilihKelasAktif(btn.dataset.pilihKelas);
      toast(`Ayo main sebagai ${kelas.nama}!`, 'sukses');
      pindah(tujuanAman(query.ke));
    } catch (err) {
      toast(err.message, jenisGalat(err));
    } finally {
      btn.disabled = false;
    }
  });
}

export async function renderGabungKelas(halaman) {
  const sesi = await sesiAktif();
  const punyaKelas = (sesi?.pengguna?.kelas || []).length > 0;

  halaman.innerHTML = kartuInfo(`
    ${robot('berpikir', { kelas: 'w-24 sm:w-28 h-auto melayang', alt: '' })}
    <h1 class="font-judul text-3xl sm:text-4xl font-extrabold text-teal-tua">${punyaKelas ? 'Ikut kelas lain' : 'Kamu belum punya kelas'}</h1>
    <p class="text-lg">${punyaKelas
      ? 'Punya kode kelas lain, misalnya kelas ekskul? Masukkan di sini ya.'
      : 'Minta kode kelas ke gurumu, lalu ketik di bawah ini supaya bisa mulai bermain.'}</p>
    ${formGabungHTML()}
    ${punyaKelas ? '<a href="#/pilih-kelas" class="font-bold text-teal-tua underline">Kembali ke daftar kelasku</a>' : ''}`);

  pasangFormGabung(halaman, async (kelas) => {
    toast(`Hore, kamu sekarang ikut ${kelas.nama}!`, 'sukses');
    const baru = await sesiAktif();
    // Murid baru punya kelas pertamanya: langsung ke peta. Murid yang sudah punya kelas: pilih mau main yang mana.
    pindah(baru?.pengguna?.kelasId && baru.pengguna.kelas.length === 1 ? '/peta' : '/pilih-kelas');
  });
}
