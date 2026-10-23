// js/pages/pasang.js — pemasangan pertama Coding Island (#/pasang)
// Hanya bisa dipakai selama belum ada akun guru sama sekali. Membuat akun admin pertama
// dengan kode pemasangan (rahasia KODE_PASANG di server), lalu langsung masuk ke dashboard.

import { robot, tombol, toast, aturPesan, goyangkan } from '../ui.js';
import { statusPasang, pasangAdmin } from '../store.js';
import { pindah } from '../router.js';

const KOLOM = ['kode', 'nama', 'username', 'password', 'konfirmasi'];

function kartuSudahTerpasang() {
  return `
    <div class="kartu muncul flex flex-col items-center gap-3 text-center">
      ${robot('gembira', { kelas: 'w-24 h-auto', alt: 'Robot Tutor' })}
      <h1 class="font-judul text-3xl font-extrabold text-teal-tua leading-tight">Coding Island sudah terpasang</h1>
      <p>Akun admin sudah dibuat. Silakan masuk sebagai guru atau admin.</p>
      ${tombol({ teks: 'Masuk Guru', href: '#/guru/masuk', varian: 'utama' })}
    </div>`;
}

function kolomHTML({ nama, label, jenis = 'text', maks = 64, auto = 'off', bantuan = '' }) {
  return `
    <div>
      <label for="p-${nama}" class="label-kolom">${label}</label>
      <input id="p-${nama}" name="${nama}" type="${jenis}" class="kolom-input" maxlength="${maks}"
        autocomplete="${auto}" autocapitalize="none" spellcheck="false" aria-describedby="pesan-${nama}">
      ${bantuan ? `<p class="text-sm mt-1">${bantuan}</p>` : ''}
      <p id="pesan-${nama}" class="pesan-kolom" data-pesan="${nama}" aria-live="polite"></p>
    </div>`;
}

export async function renderPasang(halaman) {
  const { perluPasang } = await statusPasang();

  halaman.innerHTML = `
    <section class="min-h-screen py-8 sm:py-12 px-4 bg-teal-tua">
      <div class="mx-auto max-w-md">
        <a href="#/" class="inline-block mb-4 font-bold text-white underline underline-offset-4 hover:text-kuning">← Beranda</a>
        ${perluPasang ? `
        <form class="kartu muncul flex flex-col gap-2" novalidate data-form-pasang>
          <div class="flex items-center gap-3 mb-2">
            ${robot('hai', { kelas: 'w-20 h-auto shrink-0', alt: 'Robot Tutor' })}
            <div>
              <h1 class="font-judul text-3xl sm:text-4xl font-extrabold text-teal-tua leading-tight">Pemasangan</h1>
              <p class="font-bold">Buat akun admin pertama sekolah.</p>
            </div>
          </div>

          ${kolomHTML({ nama: 'kode', label: 'Kode pemasangan', jenis: 'password', bantuan: 'Kode rahasia dari pengelola server (KODE_PASANG).' })}
          ${kolomHTML({ nama: 'nama', label: 'Nama admin', maks: 40, auto: 'name' })}
          ${kolomHTML({ nama: 'username', label: 'Username', maks: 24, auto: 'username', bantuan: 'Huruf kecil, angka, titik, atau garis bawah. Contoh: admin.sekolah' })}
          ${kolomHTML({ nama: 'password', label: 'Password', jenis: 'password', auto: 'new-password', bantuan: 'Minimal 8 karakter.' })}
          ${kolomHTML({ nama: 'konfirmasi', label: 'Ulangi password', jenis: 'password', auto: 'new-password' })}

          <p class="pesan-kolom text-center" data-pesan="umum" role="alert"></p>
          ${tombol({ teks: 'Pasang & Masuk', type: 'submit', varian: 'utama', lebar: true, attr: 'data-kirim' })}
        </form>` : kartuSudahTerpasang()}
      </div>
    </section>`;

  const form = halaman.querySelector('[data-form-pasang]');
  if (!form) return;
  const tombolKirim = form.querySelector('[data-kirim]');
  const input = Object.fromEntries(KOLOM.map((k) => [k, form.querySelector(`[name="${k}"]`)]));
  const pesanUmum = form.querySelector('[data-pesan="umum"]');
  let sedangKirim = false;

  for (const k of KOLOM) input[k].addEventListener('input', () => aturPesan(form, k));

  // Pemeriksaan ringan di browser; aturan sebenarnya tetap diperiksa server
  function periksa(d) {
    if (!d.kode) return ['kode', 'Kode pemasangan belum diisi.'];
    if (d.nama.length < 2) return ['nama', 'Nama admin minimal 2 huruf.'];
    if (!/^[a-z][a-z0-9._]{2,23}$/.test(d.username)) return ['username', 'Username 3–24 huruf kecil, angka, titik, atau garis bawah, diawali huruf.'];
    if (d.password.length < 8) return ['password', 'Password minimal 8 karakter.'];
    if (d.konfirmasi !== d.password) return ['konfirmasi', 'Konfirmasi password belum sama.'];
    return null;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sedangKirim) return;
    pesanUmum.textContent = '';
    const d = {
      kode: input.kode.value.trim(),
      nama: input.nama.value.trim(),
      username: input.username.value.trim().toLowerCase(),
      password: input.password.value,
      konfirmasi: input.konfirmasi.value
    };
    const salah = periksa(d);
    if (salah) {
      aturPesan(form, salah[0], salah[1]);
      goyangkan(form);
      input[salah[0]].focus();
      return;
    }

    sedangKirim = true;
    tombolKirim.disabled = true;
    try {
      const hasil = await pasangAdmin(d);
      if (hasil.ok) {
        toast(`Coding Island terpasang. Selamat datang, ${hasil.guru.nama}!`, 'sukses');
        pindah('/guru');
        return;
      }
      aturPesan(form, hasil.kolom || 'kode', hasil.pesan);
      goyangkan(form);
      if (hasil.kolom === 'kode') input.kode.value = '';
      input[hasil.kolom || 'kode']?.focus();
    } catch (err) {
      // Termasuk penolakan permanen "Coding Island sudah terpasang."
      pesanUmum.textContent = err.message;
      pesanUmum.className = 'pesan-kolom text-center pesan-galat';
      if (/sudah terpasang/i.test(err.message)) halaman.querySelector('.mx-auto').insertAdjacentHTML('beforeend', `<div class="mt-6">${kartuSudahTerpasang()}</div>`);
    } finally {
      sedangKirim = false;
      tombolKirim.disabled = false;
    }
  });
}
