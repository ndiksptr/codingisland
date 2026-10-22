// js/pages/daftar.js — pendaftaran siswa tiga langkah (#/daftar)
// Langkah 1: nama & avatar, Langkah 2: kelas & kode kelas, Langkah 3: username & PIN.

import {
  esc, robot, tombol, bukaModal, aturPesan, goyangkan, kotakPinHTML, pasangKotakPin
} from '../ui.js';
import {
  daftarKelasPublik, cekKodeKelas, cekUsernameSiswa, sarankanUsername,
  daftarSiswa, periksaKolomSiswa, KOIN_AWAL
} from '../store.js';
import { pindah } from '../router.js';

const LANGKAH = [
  { nomor: 1, label: 'Nama' },
  { nomor: 2, label: 'Kelas' },
  { nomor: 3, label: 'Akun' }
];

function indikatorHTML() {
  return `
    <ol class="flex items-start gap-2 sm:gap-3 mb-6" aria-label="Langkah pendaftaran">
      ${LANGKAH.map((l, i) => `
        <li class="flex flex-col items-center gap-1 shrink-0" data-indikator="${l.nomor}">
          <span class="titik-langkah">${l.nomor}</span>
          <span class="label-langkah">${l.label}</span>
        </li>
        ${i < LANGKAH.length - 1 ? `<li class="garis-langkah" aria-hidden="true" data-garis="${l.nomor}"></li>` : ''}`).join('')}
    </ol>`;
}

// Satu kolom isian beserta tempat pesannya
function kolom({ id, nama, label, placeholder = '', maks = 50, ekstra = '', kelas = '' }) {
  return `
    <div>
      <label for="${id}" class="label-kolom">${esc(label)}</label>
      <input id="${id}" name="${nama}" class="kolom-input ${kelas}" maxlength="${maks}"
        placeholder="${esc(placeholder)}" aria-describedby="pesan-${nama}" ${ekstra}>
      <p id="pesan-${nama}" class="pesan-kolom" data-pesan="${nama}" aria-live="polite"></p>
    </div>`;
}

function kartuAvatar(nilai, label) {
  return `
    <label class="pilih-avatar">
      <input type="radio" name="avatar" value="${nilai}">
      <span class="tanda-pilih" aria-hidden="true">✓</span>
      <img src="image/profile/${nilai}.png" alt="" class="w-24 h-24 sm:w-32 sm:h-32 object-contain">
      <span class="font-judul text-xl font-extrabold">${label}</span>
    </label>`;
}

function langkah1() {
  return `
    <div data-langkah="1" class="flex flex-col gap-2">
      <h2 class="font-judul text-3xl font-extrabold text-teal-tua mb-2">Siapa namamu?</h2>
      ${kolom({ id: 'd-nama', nama: 'namaLengkap', label: 'Nama lengkap', placeholder: 'Contoh: Andi Pratama', maks: 50, ekstra: 'autocomplete="name"' })}
      ${kolom({ id: 'd-panggilan', nama: 'namaPanggilan', label: 'Nama panggilan', placeholder: 'Contoh: Andi', maks: 12, ekstra: 'autocomplete="nickname"' })}
      <fieldset aria-describedby="pesan-avatar">
        <legend class="label-kolom">Pilih gambarmu</legend>
        <div class="grid grid-cols-2 gap-3 sm:gap-4">
          ${kartuAvatar('pria', 'Laki-laki')}
          ${kartuAvatar('wanita', 'Perempuan')}
        </div>
        <p id="pesan-avatar" class="pesan-kolom" data-pesan="avatar" aria-live="polite"></p>
      </fieldset>
    </div>`;
}

function langkah2(daftarKelas) {
  return `
    <div data-langkah="2" class="flex flex-col gap-2" hidden>
      <h2 class="font-judul text-3xl font-extrabold text-teal-tua mb-2">Kamu kelas berapa?</h2>
      <div>
        <label for="d-kelas" class="label-kolom">Kelas</label>
        <select id="d-kelas" name="kelasId" class="kolom-input" aria-describedby="pesan-kelasId">
          <option value="">Pilih kelasmu</option>
          ${daftarKelas.map((k) => `<option value="${esc(k.id)}">${esc(k.nama)}</option>`).join('')}
        </select>
        <p id="pesan-kelasId" class="pesan-kolom" data-pesan="kelasId" aria-live="polite"></p>
      </div>
      ${kolom({ id: 'd-kode', nama: 'kodeKelas', label: 'Kode kelas dari guru', placeholder: 'ABC123', maks: 6, kelas: 'kolom-kode', ekstra: 'autocomplete="off" autocapitalize="characters" spellcheck="false"' })}
      <div class="flex items-center gap-3 rounded-2xl bg-kuning p-3">
        ${robot('berpikir', { kelas: 'w-14 h-auto shrink-0', alt: '' })}
        <p class="font-bold">Kode kelas terdiri dari 6 huruf atau angka. Tanyakan ke gurumu ya!</p>
      </div>
    </div>`;
}

function langkah3() {
  return `
    <div data-langkah="3" class="flex flex-col gap-2" hidden>
      <h2 class="font-judul text-3xl font-extrabold text-teal-tua mb-2">Buat akunmu</h2>
      <div>
        <label for="d-username" class="label-kolom">Username</label>
        <div class="flex gap-2">
          <input id="d-username" name="username" class="kolom-input font-kode" maxlength="16"
            autocomplete="username" autocapitalize="none" spellcheck="false" aria-describedby="pesan-username">
          <button type="button" class="tombol tombol-sekunder tombol-kecil shrink-0" data-saran-lain>Ganti</button>
        </div>
        <p id="pesan-username" class="pesan-kolom" data-pesan="username" aria-live="polite"></p>
      </div>
      <div>
        ${kotakPinHTML({ nama: 'pin', label: 'PIN 4 angka', idPesan: 'pesan-pin' })}
        <p id="pesan-pin" class="pesan-kolom" data-pesan="pin" aria-live="polite"></p>
      </div>
      <div>
        ${kotakPinHTML({ nama: 'pinUlang', label: 'Ketik PIN sekali lagi', idPesan: 'pesan-pinUlang' })}
        <p id="pesan-pinUlang" class="pesan-kolom" data-pesan="pinUlang" aria-live="polite"></p>
      </div>
      <label class="inline-flex items-center gap-2 font-bold cursor-pointer self-start">
        <input type="checkbox" data-lihat-pin class="w-5 h-5 accent-teal-tua"> Tampilkan PIN
      </label>
      <p class="rounded-2xl bg-mint p-3 font-bold">Ingat username dan PIN-mu ya. Kamu butuh keduanya untuk masuk.</p>
    </div>`;
}

export async function renderDaftar(halaman) {
  const daftarKelas = await daftarKelasPublik();

  halaman.innerHTML = `
    <section class="min-h-screen py-8 sm:py-12 px-4 bg-gradient-to-b from-mint/60 to-latar">
      <div class="mx-auto max-w-xl">
        <a href="#/" class="tautan inline-block mb-4">← Beranda</a>
        <div class="flex items-center gap-3 mb-6">
          ${robot('hai', { kelas: 'w-20 sm:w-24 h-auto melayang shrink-0', alt: 'Robot Tutor' })}
          <div>
            <h1 class="font-judul text-4xl sm:text-5xl font-extrabold text-teal-tua leading-none">Daftar</h1>
            <p class="text-lg font-bold mt-1">Isi tiga langkah mudah ini ya!</p>
          </div>
        </div>

        ${indikatorHTML()}

        <form class="kartu muncul" novalidate data-form-daftar>
          ${langkah1()}
          ${langkah2(daftarKelas)}
          ${langkah3()}
          <div class="mt-6 flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
            ${tombol({ teks: 'Kembali', varian: 'sekunder', attr: 'data-kembali hidden' })}
            ${tombol({ teks: 'Lanjut', varian: 'utama', type: 'submit', kelas: 'sm:ml-auto', attr: 'data-lanjut' })}
          </div>
        </form>

        <p class="mt-6 text-center text-lg">Sudah punya akun? <a href="#/masuk" class="tautan">Masuk di sini</a></p>
      </div>
    </section>`;

  const form = halaman.querySelector('[data-form-daftar]');
  const el = (sel) => form.querySelector(sel);
  const tombolKembali = el('[data-kembali]');
  const tombolLanjut = el('[data-lanjut]');
  const inputUsername = el('[name="username"]');

  const pin = pasangKotakPin(el('[data-kolom="pin"]'), { saatUbah: () => aturPesan(form, 'pin') });
  const pinUlang = pasangKotakPin(el('[data-kolom="pinUlang"]'), { saatUbah: () => aturPesan(form, 'pinUlang') });

  let langkahAktif = 1;
  let usernameDiubahSendiri = false;
  let panggilanTerakhirDisarankan = '';
  let sedangKirim = false;

  const nilai = (nama) => {
    if (nama === 'avatar') return el('[name="avatar"]:checked')?.value || '';
    return el(`[name="${nama}"]`)?.value.trim() || '';
  };

  // ---------- Tampilan langkah ----------
  function tampilkanLangkah(n) {
    langkahAktif = n;
    form.querySelectorAll('[data-langkah]').forEach((d) => { d.hidden = Number(d.dataset.langkah) !== n; });
    halaman.querySelectorAll('[data-indikator]').forEach((li) => {
      const nomor = Number(li.dataset.indikator);
      li.dataset.status = nomor === n ? 'aktif' : nomor < n ? 'selesai' : 'belum';
      if (nomor === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    halaman.querySelectorAll('[data-garis]').forEach((g) => { g.dataset.selesai = String(Number(g.dataset.garis) < n); });
    tombolKembali.hidden = n === 1;
    tombolLanjut.querySelector('span').textContent = n === 3 ? 'Daftar Sekarang' : 'Lanjut';
    if (n === 3) siapkanUsername();
    // Fokus ke judul langkah agar pembaca layar mengikuti
    const judul = form.querySelector(`[data-langkah="${n}"] h2`);
    judul.setAttribute('tabindex', '-1');
    judul.focus({ preventScroll: true });
    form.scrollIntoView({ block: 'nearest' });
  }

  // ---------- Validasi per kolom ----------
  function periksa(nama) {
    const pesan = periksaKolomSiswa(nama, nilai(nama));
    aturPesan(form, nama, pesan);
    return !pesan;
  }

  // Perbaiki pesan secara langsung setelah kolom pernah salah
  ['namaLengkap', 'namaPanggilan', 'kodeKelas'].forEach((nama) => {
    const input = el(`[name="${nama}"]`);
    input.addEventListener('input', () => { if (input.hasAttribute('aria-invalid')) periksa(nama); });
    input.addEventListener('blur', () => { if (input.value.trim()) periksa(nama); });
  });
  el('[name="kelasId"]').addEventListener('change', () => periksa('kelasId'));
  form.querySelectorAll('[name="avatar"]').forEach((r) => r.addEventListener('change', () => aturPesan(form, 'avatar')));
  el('[name="kodeKelas"]').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase();
  });

  // ---------- Username: saran & cek unik langsung ----------
  let timerCek = null;
  let nomorCek = 0;
  async function cekUsername() {
    const n = ++nomorCek;
    const hasil = await cekUsernameSiswa(inputUsername.value.trim());
    if (n !== nomorCek) return hasil; // abaikan hasil lama
    aturPesan(form, 'username', hasil.pesan, hasil.tersedia ? 'oke' : 'galat');
    return hasil;
  }

  async function siapkanUsername(paksa = false) {
    const panggilan = nilai('namaPanggilan');
    if (!paksa && usernameDiubahSendiri && inputUsername.value) return;
    if (!paksa && inputUsername.value && panggilan === panggilanTerakhirDisarankan) return;
    inputUsername.value = await sarankanUsername(panggilan);
    panggilanTerakhirDisarankan = panggilan;
    usernameDiubahSendiri = false;
    cekUsername();
  }

  inputUsername.addEventListener('input', () => {
    // Paksa huruf kecil dan buang karakter yang tidak boleh
    inputUsername.value = inputUsername.value.toLowerCase().replace(/[^a-z0-9]/g, '');
    usernameDiubahSendiri = true;
    clearTimeout(timerCek);
    timerCek = setTimeout(cekUsername, 250);
  });
  el('[data-saran-lain]').addEventListener('click', () => siapkanUsername(true));

  el('[data-lihat-pin]').addEventListener('change', (e) => {
    pin.tampilkan(e.target.checked);
    pinUlang.tampilkan(e.target.checked);
  });

  // ---------- Validasi tiap langkah ----------
  function fokusSalah() {
    const salah = form.querySelector(`[data-langkah="${langkahAktif}"] [aria-invalid="true"]`);
    if (salah) salah.focus();
    else if (langkahAktif === 1 && !nilai('avatar')) el('[name="avatar"]').focus();
    goyangkan(form);
  }

  async function validasiLangkah(n) {
    if (n === 1) {
      const ok = [periksa('namaLengkap'), periksa('namaPanggilan'), periksa('avatar')].every(Boolean);
      return ok;
    }
    if (n === 2) {
      const ok = [periksa('kelasId'), periksa('kodeKelas')].every(Boolean);
      if (!ok) return false;
      if (!(await cekKodeKelas(nilai('kelasId'), nilai('kodeKelas')))) {
        aturPesan(form, 'kodeKelas', 'Kode kelas belum cocok. Tanya gurumu ya.');
        return false;
      }
      return true;
    }
    // Langkah 3
    clearTimeout(timerCek);
    const hasil = await cekUsername();
    let ok = hasil.tersedia;
    const pesanPin = periksaKolomSiswa('pin', pin.nilai());
    aturPesan(form, 'pin', pesanPin);
    if (pesanPin) ok = false;
    if (!pesanPin) {
      const sama = pin.nilai() === pinUlang.nilai();
      aturPesan(form, 'pinUlang', sama ? '' : 'PIN belum sama. Coba ketik lagi.');
      if (!sama) { pinUlang.kosongkan(); ok = false; }
    }
    return ok;
  }

  // ---------- Kirim ----------
  async function kirim() {
    const hasil = await daftarSiswa({
      namaLengkap: nilai('namaLengkap'),
      namaPanggilan: nilai('namaPanggilan'),
      avatar: nilai('avatar'),
      kelasId: nilai('kelasId'),
      kodeKelas: nilai('kodeKelas'),
      username: inputUsername.value.trim(),
      pin: pin.nilai()
    });

    if (!hasil.ok) {
      // Kembali ke langkah tempat kolom yang salah
      const langkahKolom = { namaLengkap: 1, namaPanggilan: 1, avatar: 1, kelasId: 2, kodeKelas: 2 }[hasil.kolom] || 3;
      tampilkanLangkah(langkahKolom);
      aturPesan(form, hasil.kolom, hasil.pesan);
      fokusSalah();
      return;
    }

    await bukaModal({
      judul: `Halo, ${hasil.siswa.namaPanggilan}!`,
      pose: 'hai',
      isi: `
        <p class="text-xl font-bold">Selamat datang di Coding Island</p>
        <div class="mt-4 inline-flex items-center gap-2 rounded-2xl bg-kuning px-4 py-2 font-judul text-2xl font-extrabold">
          <img src="image/item/koin.png" alt="" class="w-10 h-10 object-contain"> +${KOIN_AWAL} koin
        </div>
        <p class="mt-3">Ini hadiah awal dari Robot Tutor. Pakai koin untuk membeli petunjuk ya!</p>`,
      tombol: [{ teks: 'Ayo ke Peta!', nilai: true, ikon: 'image/item/roket.png' }]
    });
    pindah('/peta');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sedangKirim) return;
    sedangKirim = true;
    tombolLanjut.disabled = true;
    try {
      const ok = await validasiLangkah(langkahAktif);
      if (!ok) { fokusSalah(); return; }
      if (langkahAktif < 3) tampilkanLangkah(langkahAktif + 1);
      else await kirim();
    } finally {
      sedangKirim = false;
      tombolLanjut.disabled = false;
    }
  });

  tombolKembali.addEventListener('click', () => {
    if (langkahAktif > 1) tampilkanLangkah(langkahAktif - 1);
  });

  // Tampilan awal tanpa memindahkan fokus dari judul halaman
  form.querySelectorAll('[data-langkah]').forEach((d) => { d.hidden = d.dataset.langkah !== '1'; });
  halaman.querySelectorAll('[data-indikator]').forEach((li) => {
    li.dataset.status = li.dataset.indikator === '1' ? 'aktif' : 'belum';
  });

  return () => clearTimeout(timerCek);
}
