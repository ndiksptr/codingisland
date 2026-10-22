// js/pages/guru-masuk.js — halaman masuk guru & admin (#/guru/masuk)

import { robot, tombol, toast, aturPesan, goyangkan } from '../ui.js';
import { masukGuru, statusTahan } from '../store.js';
import { pindah } from '../router.js';
import { kotakAkunDemo, pasangKotakAkunDemo } from './akun-demo.js';

/** Tujuan setelah masuk: hanya rute guru. */
function tujuanAman(ke) {
  return typeof ke === 'string' && (ke === '/guru' || ke.startsWith('/guru/')) && ke !== '/guru/masuk' ? ke : '/guru';
}

export async function renderGuruMasuk(halaman, { query }) {
  const kotakDemo = await kotakAkunDemo('guru');

  halaman.innerHTML = `
    <section class="min-h-screen py-8 sm:py-12 px-4 bg-teal-tua">
      <div class="mx-auto max-w-md">
        <a href="#/" class="inline-block mb-4 font-bold text-white underline underline-offset-4 hover:text-kuning">← Beranda</a>

        <form class="kartu muncul flex flex-col gap-2" novalidate data-form-guru>
          <div class="flex items-center gap-3 mb-2">
            ${robot('berpikir', { kelas: 'w-20 h-auto shrink-0', alt: 'Robot Tutor' })}
            <div>
              <h1 class="font-judul text-3xl sm:text-4xl font-extrabold text-teal-tua leading-tight">Masuk Guru</h1>
              <p class="font-bold">Untuk guru dan admin sekolah.</p>
            </div>
          </div>

          <div>
            <label for="g-username" class="label-kolom">Username</label>
            <input id="g-username" name="username" class="kolom-input" maxlength="24"
              autocomplete="username" autocapitalize="none" spellcheck="false" aria-describedby="pesan-username">
            <p id="pesan-username" class="pesan-kolom" data-pesan="username" aria-live="polite"></p>
          </div>

          <div>
            <label for="g-password" class="label-kolom">Password</label>
            <div class="flex gap-2">
              <input id="g-password" name="password" type="password" class="kolom-input" maxlength="64"
                autocomplete="current-password" aria-describedby="pesan-password">
              <button type="button" class="tombol tombol-sekunder tombol-kecil shrink-0" data-lihat aria-pressed="false">Lihat</button>
            </div>
            <p id="pesan-password" class="pesan-kolom" data-pesan="password" aria-live="polite"></p>
          </div>

          <p class="pesan-kolom text-center" data-pesan="umum" role="alert"></p>

          ${tombol({ teks: 'Masuk', type: 'submit', varian: 'utama', lebar: true, attr: 'data-kirim' })}
          <p class="mt-2 text-center text-sm">Lupa password? Hubungi admin sekolah.</p>
        </form>

        <div class="mt-6" data-demo>${kotakDemo}</div>

        <p class="mt-6 text-center"><a href="#/masuk" class="font-bold text-white underline underline-offset-4 hover:text-kuning">Masuk sebagai Siswa</a></p>
      </div>
    </section>`;

  const form = halaman.querySelector('[data-form-guru]');
  const inputUsername = form.querySelector('[name="username"]');
  const inputPassword = form.querySelector('[name="password"]');
  const tombolKirim = form.querySelector('[data-kirim]');
  const tombolLihat = form.querySelector('[data-lihat]');
  const pesanUmum = form.querySelector('[data-pesan="umum"]');
  let timerTahan = null;
  let sedangKirim = false;

  const aturUmum = (teks, jenis = '') => {
    pesanUmum.textContent = teks;
    pesanUmum.className = `pesan-kolom text-center ${jenis ? `pesan-${jenis}` : ''}`;
  };

  inputUsername.addEventListener('input', () => aturPesan(form, 'username'));
  inputPassword.addEventListener('input', () => aturPesan(form, 'password'));

  tombolLihat.addEventListener('click', () => {
    const lihat = inputPassword.type === 'password';
    inputPassword.type = lihat ? 'text' : 'password';
    tombolLihat.setAttribute('aria-pressed', String(lihat));
    tombolLihat.querySelector('span').textContent = lihat ? 'Sembunyi' : 'Lihat';
  });

  function aturNonaktif(ya) {
    [inputUsername, inputPassword, tombolKirim, tombolLihat].forEach((el) => { el.disabled = ya; });
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
        aturUmum('Silakan coba masuk lagi.', 'oke');
        inputUsername.focus();
        return;
      }
      aturUmum(`Terlalu banyak percobaan salah. Coba lagi dalam ${sisa} detik.`, 'galat');
    };
    perbarui();
    timerTahan = setInterval(perbarui, 1000);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sedangKirim) return;
    aturUmum('');

    const username = inputUsername.value.trim();
    const password = inputPassword.value;
    let ok = true;
    if (!username) { aturPesan(form, 'username', 'Username belum diisi.'); ok = false; }
    if (!password) { aturPesan(form, 'password', 'Password belum diisi.'); ok = false; }
    if (!ok) {
      goyangkan(form);
      (username ? inputPassword : inputUsername).focus();
      return;
    }

    sedangKirim = true;
    tombolKirim.disabled = true;
    try {
      const hasil = await masukGuru(username, password);
      if (hasil.ok) {
        toast(`Selamat datang, ${hasil.guru.nama}!`, 'sukses');
        pindah(tujuanAman(query.ke));
        return;
      }
      inputPassword.value = '';
      goyangkan(form);
      if (hasil.tahanDetik) mulaiTahan(hasil.tahanDetik);
      else {
        aturUmum(`${hasil.pesan} Sisa ${hasil.sisa} kesempatan lagi.`, 'galat');
        inputPassword.focus();
      }
    } finally {
      sedangKirim = false;
      tombolKirim.disabled = inputUsername.disabled;
    }
  });

  pasangKotakAkunDemo(halaman.querySelector('[data-demo]'), (username, password) => {
    if (inputUsername.disabled) return;
    inputUsername.value = username;
    inputPassword.value = password;
    aturPesan(form, 'username');
    aturPesan(form, 'password');
    tombolKirim.focus();
  });

  const tahan = await statusTahan('guru');
  if (tahan) mulaiTahan(tahan);

  return () => clearInterval(timerTahan);
}
