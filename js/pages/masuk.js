// js/pages/masuk.js — halaman masuk siswa (#/masuk)
// Username + PIN 4 angka. PIN bisa diketik atau ditekan lewat papan angka besar.

import { robot, tombol, toast, aturPesan, goyangkan, kotakPinHTML, pasangKotakPin } from '../ui.js';
import { masukSiswa, statusTahan } from '../store.js';
import { pindah } from '../router.js';
import { kotakAkunDemo, pasangKotakAkunDemo } from './akun-demo.js';

const IKON_HAPUS = `
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="M17 9l-5 5M12 9l5 5"/>
  </svg>`;

function papanAngkaHTML() {
  const angka = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  return `
    <div class="grid grid-cols-3 gap-2 sm:gap-3 mt-2" role="group" aria-label="Papan angka PIN">
      ${angka.map((n) => `<button type="button" class="tombol-angka" data-angka="${n}">${n}</button>`).join('')}
      <button type="button" class="tombol-angka grid place-items-center" data-hapus aria-label="Hapus angka">${IKON_HAPUS}</button>
      <button type="button" class="tombol-angka" data-angka="0">0</button>
      <button type="button" class="tombol-angka tombol-angka-ok" data-ok aria-label="Masuk">OK</button>
    </div>`;
}

/** Tujuan setelah masuk: hanya rute siswa yang diizinkan. */
function tujuanAman(ke) {
  return typeof ke === 'string' && (ke === '/peta' || ke.startsWith('/peta/') || ke.startsWith('/level/')) ? ke : '/peta';
}

export async function renderMasuk(halaman, { query }) {
  const kotakDemo = await kotakAkunDemo('siswa');

  halaman.innerHTML = `
    <section class="min-h-screen py-8 sm:py-12 px-4 bg-gradient-to-b from-mint/60 to-latar">
      <div class="mx-auto max-w-md">
        <a href="#/" class="tautan inline-block mb-4">← Beranda</a>

        <form class="kartu muncul flex flex-col gap-2" novalidate data-form-masuk>
          <div class="flex flex-col items-center text-center mb-2">
            ${robot('hai', { kelas: 'w-24 h-auto melayang', alt: 'Robot Tutor' })}
            <h1 class="font-judul text-4xl font-extrabold text-teal-tua leading-tight">Masuk</h1>
            <p class="text-lg font-bold">Halo lagi! Ketik username dan PIN-mu.</p>
          </div>

          <div>
            <label for="m-username" class="label-kolom">Username</label>
            <input id="m-username" name="username" class="kolom-input font-kode" maxlength="16"
              autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="contoh: andi3"
              aria-describedby="pesan-username">
            <p id="pesan-username" class="pesan-kolom" data-pesan="username" aria-live="polite"></p>
          </div>

          <div data-bungkus-pin>
            ${kotakPinHTML({ nama: 'pin', label: 'PIN', idPesan: 'pesan-pin' })}
            <p id="pesan-pin" class="pesan-kolom" data-pesan="pin" aria-live="polite"></p>
          </div>

          ${papanAngkaHTML()}

          <p class="pesan-kolom text-center" data-pesan="umum" role="alert"></p>

          ${tombol({ teks: 'Masuk', type: 'submit', varian: 'utama', lebar: true, ikon: 'image/item/roket.png', attr: 'data-kirim' })}

          <p class="mt-3 text-center font-bold">Lupa PIN? Minta gurumu untuk mereset.</p>
          <p class="text-center">Belum punya akun? <a href="#/daftar" class="tautan">Daftar dulu</a></p>
        </form>

        <div class="mt-6" data-demo>${kotakDemo}</div>

        <p class="mt-6 text-center"><a href="#/guru/masuk" class="tautan">Masuk sebagai Guru</a></p>
      </div>
    </section>`;

  const form = halaman.querySelector('[data-form-masuk]');
  const inputUsername = form.querySelector('[name="username"]');
  const tombolKirim = form.querySelector('[data-kirim]');
  const pesanUmum = form.querySelector('[data-pesan="umum"]');
  let sedangKirim = false;
  let sedangIsiDemo = false;
  let timerTahan = null;

  const pin = pasangKotakPin(form.querySelector('[data-kolom="pin"]'), {
    saatUbah: () => aturPesan(form, 'pin'),
    // Masuk otomatis begitu 4 angka terisi dan username sudah ada
    saatLengkap: () => { if (!sedangIsiDemo && inputUsername.value.trim()) kirim(); }
  });

  inputUsername.addEventListener('input', () => {
    inputUsername.value = inputUsername.value.toLowerCase().replace(/\s/g, '');
    aturPesan(form, 'username');
  });

  // ---------- Tahan percobaan 1 menit ----------
  function aturNonaktif(ya) {
    inputUsername.disabled = ya;
    tombolKirim.disabled = ya;
    pin.nonaktif(ya);
    form.querySelectorAll('.tombol-angka').forEach((b) => { b.disabled = ya; });
  }

  function mulaiTahan(detik) {
    clearInterval(timerTahan);
    const selesaiPada = Date.now() + detik * 1000;
    aturNonaktif(true);
    const perbarui = () => {
      const sisa = Math.ceil((selesaiPada - Date.now()) / 1000);
      if (sisa <= 0) {
        clearInterval(timerTahan);
        aturNonaktif(false);
        pesanUmum.textContent = 'Sekarang kamu boleh mencoba lagi.';
        pesanUmum.className = 'pesan-kolom text-center pesan-oke';
        inputUsername.focus();
        return;
      }
      pesanUmum.textContent = `Terlalu banyak salah. Istirahat dulu ya, coba lagi dalam ${sisa} detik.`;
      pesanUmum.className = 'pesan-kolom text-center pesan-galat';
    };
    perbarui();
    timerTahan = setInterval(perbarui, 1000);
  }

  // ---------- Kirim ----------
  async function kirim() {
    if (sedangKirim) return;
    pesanUmum.textContent = '';
    pesanUmum.className = 'pesan-kolom text-center';

    const username = inputUsername.value.trim();
    let ok = true;
    if (!username) { aturPesan(form, 'username', 'Ketik username-mu dulu ya.'); ok = false; }
    if (!/^\d{4}$/.test(pin.nilai())) { aturPesan(form, 'pin', 'PIN harus 4 angka.'); ok = false; }
    if (!ok) {
      goyangkan(form);
      if (username) pin.fokus(); else inputUsername.focus();
      return;
    }

    sedangKirim = true;
    tombolKirim.disabled = true;
    try {
      const hasil = await masukSiswa(username, pin.nilai());
      if (hasil.ok) {
        toast(`Hai, ${hasil.siswa.namaPanggilan}! Ayo lanjut bertualang.`, 'sukses');
        pindah(tujuanAman(query.ke));
        return;
      }
      pin.kosongkan();
      goyangkan(form.querySelector('[data-bungkus-pin]'));
      if (hasil.tahanDetik) {
        mulaiTahan(hasil.tahanDetik);
      } else {
        pesanUmum.textContent = `${hasil.pesan} Sisa ${hasil.sisa} kesempatan lagi.`;
        pesanUmum.className = 'pesan-kolom text-center pesan-galat';
        pin.fokus();
      }
    } finally {
      sedangKirim = false;
      tombolKirim.disabled = inputUsername.disabled; // tetap mati selama ditahan
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); kirim(); });

  // Papan angka
  form.addEventListener('click', (e) => {
    const btnAngka = e.target.closest('[data-angka]');
    if (btnAngka) return pin.isi(btnAngka.dataset.angka);
    if (e.target.closest('[data-hapus]')) return pin.hapus();
    if (e.target.closest('[data-ok]')) return kirim();
  });

  // Tombol "Pakai" di kotak akun demo
  pasangKotakAkunDemo(halaman.querySelector('[data-demo]'), (username, rahasia) => {
    if (inputUsername.disabled) return;
    inputUsername.value = username;
    aturPesan(form, 'username');
    pin.kosongkan();
    sedangIsiDemo = true;
    [...rahasia].forEach((d) => pin.isi(d));
    sedangIsiDemo = false;
    tombolKirim.focus(); // tinggal tekan Masuk
  });

  // Lanjutkan hitungan mundur jika sebelumnya sudah ditahan
  const tahan = await statusTahan('siswa');
  if (tahan) mulaiTahan(tahan);

  return () => clearInterval(timerTahan);
}
