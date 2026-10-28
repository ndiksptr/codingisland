// js/ui.js — helper antarmuka yang dipakai ulang di semua tahap
// Helper berbentuk string HTML (tombol, kartu, loader, robot) dan
// fungsi yang langsung tampil di layar (bukaModal, toast).

/** Amankan teks agar tidak dibaca sebagai HTML. Wajib untuk data dari pengguna. */
export function esc(teks = '') {
  return String(teks)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Robot Tutor ----------
// Pose yang boleh dipakai untuk siswa (marah.png sengaja tidak dimasukkan)
const POSE_ROBOT = ['hai', 'berpikir', 'gembira', 'benar', 'salah', 'kaget', 'sedih', 'melamun', 'terbang'];

/** Path gambar robot; pose yang tidak dikenal jatuh ke 'hai'. */
export function gambarRobot(pose = 'hai') {
  return `image/robot/${POSE_ROBOT.includes(pose) ? pose : 'hai'}.png`;
}

/** Tag <img> Robot Tutor. */
export function robot(pose = 'hai', { kelas = '', alt = 'Robot Tutor', lambat = false } = {}) {
  return `<img src="${gambarRobot(pose)}" alt="${esc(alt)}" class="${kelas}" draggable="false" decoding="async"${lambat ? ' loading="lazy"' : ''}>`;
}

// ---------- Pramuat gambar (mis. background zona saat kartunya disorot) ----------
const sudahDipramuat = new Set();
export function pramuatGambar(url) {
  if (!url || sudahDipramuat.has(url)) return;
  sudahDipramuat.add(url);
  const tautan = document.createElement('link');
  tautan.rel = 'preload';
  tautan.as = 'image';
  tautan.href = url;
  document.head.appendChild(tautan);
}

// ---------- Tombol besar ----------
const KELAS_VARIAN = {
  utama: 'tombol-utama',
  sekunder: 'tombol-sekunder',
  bahaya: 'tombol-bahaya'
};

/**
 * Tombol besar. Jika ada href, hasilnya <a>; selain itu <button>.
 * varian: 'utama' | 'sekunder' | 'bahaya'
 * attr  : atribut tambahan mentah, mis. 'data-aksi="simpan"'
 */
export function tombol({
  teks,
  varian = 'utama',
  href = '',
  id = '',
  ikon = '',
  kelas = '',
  type = 'button',
  kecil = false,
  lebar = false,
  attr = ''
} = {}) {
  const k = [
    'tombol',
    KELAS_VARIAN[varian] || KELAS_VARIAN.utama,
    kecil ? 'tombol-kecil' : '',
    lebar ? 'tombol-lebar' : '',
    kelas
  ].filter(Boolean).join(' ');
  const isi = `${ikon ? `<img src="${esc(ikon)}" alt="" class="tombol-ikon">` : ''}<span>${esc(teks)}</span>`;
  const atributId = id ? ` id="${esc(id)}"` : '';
  if (href) return `<a href="${esc(href)}" class="${k}"${atributId} ${attr}>${isi}</a>`;
  return `<button type="${esc(type)}" class="${k}"${atributId} ${attr}>${isi}</button>`;
}

// ---------- Kartu ----------
/**
 * Kartu bersudut besar. isi berupa HTML (pastikan sudah di-esc bila dari pengguna).
 * varian: 'putih' | 'mint' | 'kuning'
 */
export function kartu({ isi = '', judul = '', varian = 'putih', kelas = '' } = {}) {
  const kelasVarian = varian === 'mint' ? 'kartu-mint' : varian === 'kuning' ? 'kartu-kuning' : '';
  return `
    <div class="kartu ${kelasVarian} ${kelas}">
      ${judul ? `<h3 class="kartu-judul">${esc(judul)}</h3>` : ''}
      ${isi}
    </div>`;
}

// ---------- Loader ----------
/** Loader berbentuk Robot Tutor yang sedang berpikir. */
export function loader(teks = 'Sebentar ya') {
  return `
    <div class="loader" role="status" aria-live="polite">
      ${robot('berpikir', { kelas: 'loader-robot melayang', alt: '' })}
      <p class="loader-teks">${esc(teks)}<span class="loader-titik" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></p>
    </div>`;
}

// ---------- Modal ----------
const IKON_TUTUP = `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

const SELEKTOR_FOKUS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Buka modal. Mengembalikan Promise berisi `nilai` tombol yang ditekan,
 * atau null jika ditutup (tombol X, Esc, atau klik di luar kotak).
 *
 * bukaModal({
 *   judul: 'Hebat!',
 *   isi: '<p>Kamu dapat 3 bintang.</p>',      // HTML
 *   pose: 'gembira',                           // pose Robot Tutor (opsional)
 *   tombol: [{ teks: 'Lanjut', nilai: 'lanjut' }],
 *   bisaDitutup: true,
 *   saatBuka: (kotak, tutup) => {}             // pasang event tambahan; tutup(nilai) menutup modal (opsional)
 *   lebar: false                               // true untuk modal lebar (tabel, kode)
 * })
 */
export function bukaModal({
  judul = '',
  isi = '',
  pose = '',
  tombol: daftarTombol = [{ teks: 'Oke', nilai: true }],
  bisaDitutup = true,
  saatBuka = null,
  lebar = false
} = {}) {
  return new Promise((resolve) => {
    const fokusSebelumnya = document.activeElement;
    const idJudul = `modal-judul-${Date.now()}`;

    const latar = document.createElement('div');
    latar.className = 'modal-latar';
    latar.innerHTML = `
      <div class="modal-kotak muncul ${lebar ? 'modal-lebar' : ''}" role="dialog" aria-modal="true" aria-labelledby="${idJudul}">
        ${bisaDitutup ? `<button type="button" class="modal-tutup" aria-label="Tutup" data-tutup>${IKON_TUTUP}</button>` : ''}
        ${pose ? robot(pose, { kelas: 'modal-gambar melayang', alt: '' }) : ''}
        <h2 id="${idJudul}" class="modal-judul">${esc(judul)}</h2>
        <div class="modal-isi">${isi}</div>
        ${daftarTombol.length ? `<div class="modal-aksi">
          ${daftarTombol.map((t, i) => tombol({ ...t, attr: `data-indeks="${i}"` })).join('')}
        </div>` : ''}
      </div>`;

    const kotak = latar.querySelector('[role="dialog"]');

    function tutup(nilai) {
      document.removeEventListener('keydown', saatTombolKeyboard, true);
      latar.remove();
      if (!document.querySelector('.modal-latar')) document.body.classList.remove('modal-terbuka');
      if (fokusSebelumnya && typeof fokusSebelumnya.focus === 'function') fokusSebelumnya.focus();
      resolve(nilai);
    }

    // Kunci fokus di dalam modal + tutup dengan Esc
    function saatTombolKeyboard(e) {
      if (e.key === 'Escape' && bisaDitutup) {
        e.preventDefault();
        tutup(null);
        return;
      }
      if (e.key !== 'Tab') return;
      const fokusan = [...kotak.querySelectorAll(SELEKTOR_FOKUS)].filter((el) => el.offsetParent !== null);
      if (!fokusan.length) { e.preventDefault(); kotak.focus(); return; }
      const pertama = fokusan[0];
      const terakhir = fokusan[fokusan.length - 1];
      if (e.shiftKey && (document.activeElement === pertama || !kotak.contains(document.activeElement))) {
        e.preventDefault();
        terakhir.focus();
      } else if (!e.shiftKey && (document.activeElement === terakhir || !kotak.contains(document.activeElement))) {
        e.preventDefault();
        pertama.focus();
      }
    }

    latar.addEventListener('click', (e) => {
      if (e.target === latar && bisaDitutup) return tutup(null);
      if (e.target.closest('[data-tutup]')) return tutup(null);
      const btn = e.target.closest('[data-indeks]');
      if (btn) {
        const t = daftarTombol[Number(btn.dataset.indeks)];
        tutup(t && 'nilai' in t ? t.nilai : t?.teks);
      }
    });

    document.addEventListener('keydown', saatTombolKeyboard, true);
    document.body.appendChild(latar);
    document.body.classList.add('modal-terbuka');

    kotak.setAttribute('tabindex', '-1');
    if (typeof saatBuka === 'function') saatBuka(kotak, tutup);
    // Fokus ke tombol aksi pertama, atau ke kotak modal
    const fokusAwal = kotak.querySelector('.modal-aksi .tombol') || kotak.querySelector(SELEKTOR_FOKUS) || kotak;
    fokusAwal.focus();
  });
}

// ---------- Toast ----------
const IKON_TOAST = {
  sukses: 'image/item/benar.png',
  peringatan: 'image/item/salah.png',
  info: 'image/robot/hai.png',
  galat: 'image/robot/kaget.png' // kesalahan tak terduga: robot kaget
};

function ambilWadahToast() {
  let wadah = document.querySelector('.wadah-toast');
  if (!wadah) {
    wadah = document.createElement('div');
    wadah.className = 'wadah-toast';
    wadah.setAttribute('aria-live', 'polite');
    wadah.setAttribute('aria-atomic', 'false');
    document.body.appendChild(wadah);
  }
  return wadah;
}

/**
 * Tampilkan notifikasi kecil di pojok kanan atas.
 * jenis: 'info'       keterangan biasa, bukan hasil tindakan
 *        'sukses'     tindakan benar-benar berhasil
 *        'peringatan' pengguna perlu memperbaiki sesuatu, atau tindakan berhasil sebagian
 *        'galat'      tindakan gagal bukan karena pengguna (jaringan putus, server bermasalah)
 */
export function toast(pesan, jenis = 'info', durasi = 3200) {
  const jenisAman = IKON_TOAST[jenis] ? jenis : 'info';
  const el = document.createElement('div');
  el.className = `toast toast-${jenisAman}`;
  el.setAttribute('role', jenisAman === 'peringatan' || jenisAman === 'galat' ? 'alert' : 'status');
  el.innerHTML = `<img src="${IKON_TOAST[jenisAman]}" alt=""><span>${esc(pesan)}</span>`;
  ambilWadahToast().appendChild(el);

  setTimeout(() => {
    el.classList.add('toast-keluar');
    setTimeout(() => el.remove(), 300);
  }, durasi);
  return el;
}

/**
 * Jenis toast untuk galat yang ditangkap: jaringan putus atau server bermasalah (5xx) = 'galat';
 * ditolak server (4xx) atau salah isian yang diperiksa di browser = 'peringatan'.
 */
export const jenisGalat = (err) => (err?.jaringan || err?.status >= 500 ? 'galat' : 'peringatan');

// ---------- Pesan validasi di bawah kolom ----------
/**
 * Tampilkan pesan ramah di elemen [data-pesan="nama"] dan tandai kolomnya.
 * jenis: 'galat' (oranye) | 'oke' (teal). Pesan kosong = hapus pesan.
 */
export function aturPesan(akar, nama, pesan = '', jenis = 'galat') {
  const p = akar.querySelector(`[data-pesan="${nama}"]`);
  if (p) {
    p.textContent = pesan;
    p.classList.toggle('pesan-galat', !!pesan && jenis === 'galat');
    p.classList.toggle('pesan-oke', !!pesan && jenis === 'oke');
  }
  akar.querySelectorAll(`[name="${nama}"]:not([type="radio"]), [data-kolom="${nama}"] input`).forEach((el) => {
    if (pesan && jenis === 'galat') el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
  });
}

/** Mainkan animasi goyang (untuk jawaban/isian salah). */
export function goyangkan(el) {
  if (!el) return;
  el.classList.remove('goyang', 'muncul');
  void el.offsetWidth; // mulai ulang animasi
  el.classList.add('goyang');
}

// ---------- Kotak PIN 4 angka ----------
/** HTML empat kotak PIN. Pasang perilakunya dengan pasangKotakPin(). */
export function kotakPinHTML({ nama = 'pin', label = 'PIN', idPesan = '' } = {}) {
  return `
    <fieldset class="kotak-pin" data-kolom="${esc(nama)}" ${idPesan ? `aria-describedby="${esc(idPesan)}"` : ''}>
      <legend class="label-kolom">${esc(label)}</legend>
      <div class="flex gap-2 sm:gap-3">
        ${[0, 1, 2, 3].map((i) => `
          <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="off"
            class="kotak-pin-input" data-indeks="${i}" aria-label="${esc(label)} angka ke-${i + 1}">`).join('')}
      </div>
    </fieldset>`;
}

/**
 * Hidupkan kotak PIN: pindah otomatis, Backspace mundur, tempel 4 angka.
 * Mengembalikan kendali: { nilai, isi, hapus, kosongkan, fokus, nonaktif, tampilkan }
 */
export function pasangKotakPin(fieldset, { saatUbah = null, saatLengkap = null } = {}) {
  const kotak = [...fieldset.querySelectorAll('.kotak-pin-input')];
  const nilai = () => kotak.map((k) => k.value).join('');
  const kabari = () => {
    saatUbah?.(nilai());
    if (/^\d{4}$/.test(nilai())) saatLengkap?.(nilai());
  };

  kotak.forEach((k, i) => {
    k.addEventListener('input', () => {
      const angka = k.value.replace(/\D/g, '');
      k.value = angka.slice(-1);
      if (k.value && i < kotak.length - 1) kotak[i + 1].focus();
      kabari();
    });
    k.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !k.value && i > 0) {
        e.preventDefault();
        kotak[i - 1].value = '';
        kotak[i - 1].focus();
        kabari();
      } else if (e.key === 'ArrowLeft' && i > 0) {
        e.preventDefault();
        kotak[i - 1].focus();
      } else if (e.key === 'ArrowRight' && i < kotak.length - 1) {
        e.preventDefault();
        kotak[i + 1].focus();
      }
    });
    k.addEventListener('focus', () => k.select());
    k.addEventListener('paste', (e) => {
      const angka = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 4);
      if (!angka) return;
      e.preventDefault();
      kotak.forEach((x, j) => { x.value = angka[j] || ''; });
      kotak[Math.min(angka.length, kotak.length) - 1].focus();
      kabari();
    });
  });

  return {
    nilai,
    /** Isi satu angka ke kotak kosong pertama (untuk papan angka). */
    isi(digit) {
      const kosong = kotak.find((k) => !k.value);
      if (!kosong) return;
      kosong.value = String(digit);
      const berikut = kotak[kotak.indexOf(kosong) + 1];
      (berikut || kosong).focus({ preventScroll: true });
      kabari();
    },
    /** Hapus angka terakhir. */
    hapus() {
      const terisi = kotak.filter((k) => k.value);
      const akhir = terisi[terisi.length - 1];
      if (!akhir) return;
      akhir.value = '';
      akhir.focus({ preventScroll: true });
      kabari();
    },
    kosongkan() {
      kotak.forEach((k) => { k.value = ''; });
      saatUbah?.('');
    },
    fokus() {
      (kotak.find((k) => !k.value) || kotak[0]).focus();
    },
    nonaktif(ya) {
      kotak.forEach((k) => { k.disabled = ya; });
    },
    tampilkan(ya) {
      kotak.forEach((k) => { k.type = ya ? 'text' : 'password'; });
    }
  };
}


// ---------- Modal berisi form ----------
/**
 * Modal form yang tetap terbuka jika simpan gagal.
 * isi: HTML kolom-kolom form. saatSimpan(formData, form) boleh async:
 *   - kembalikan { galat: 'pesan' } untuk menampilkan pesan dan tetap membuka modal
 *   - melempar Error juga menampilkan pesannya
 *   - nilai lain menutup modal dan menjadi hasil Promise (null jika dibatalkan)
 */
export function bukaFormModal({ judul, isi, teksSimpan = 'Simpan', varianSimpan = 'utama', lebar = false, saatSimpan, saatBuka = null }) {
  return bukaModal({
    judul,
    lebar,
    tombol: [],
    isi: `
      <form class="form-modal" novalidate>
        ${isi}
        <p class="pesan-kolom pesan-galat" data-galat-form role="alert"></p>
        <div class="form-aksi">
          <button type="button" class="tombol tombol-sekunder tombol-kecil" data-batal>Batal</button>
          <button type="submit" class="tombol tombol-${esc(varianSimpan)} tombol-kecil" data-simpan>${esc(teksSimpan)}</button>
        </div>
      </form>`,
    saatBuka: (kotak, tutup) => {
      const form = kotak.querySelector('form');
      const galat = form.querySelector('[data-galat-form]');
      const tombolSimpan = form.querySelector('[data-simpan]');
      form.querySelector('[data-batal]').addEventListener('click', () => tutup(null));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        galat.textContent = '';
        tombolSimpan.disabled = true;
        try {
          const hasil = await saatSimpan(new FormData(form), form);
          if (hasil && hasil.galat) {
            galat.textContent = hasil.galat;
            return;
          }
          tutup(hasil ?? true);
        } catch (err) {
          galat.textContent = err.message || 'Perubahan belum tersimpan. Coba lagi.';
        } finally {
          tombolSimpan.disabled = false;
        }
      });
      // Fokus ke kolom pertama setelah modal tampil
      setTimeout(() => form.querySelector('input:not([type="hidden"]), select, textarea')?.focus(), 0);
      // Pemanggil boleh memasang perilaku tambahan pada isi form (mis. tombol Acak PIN)
      if (saatBuka) saatBuka(form);
    }
  });
}

// ---------- Unduh berkas teks (CSV) ----------
export function unduhBerkas(namaBerkas, isi, tipe = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿', isi], { type: tipe }); // BOM agar Excel membaca UTF-8
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaBerkas;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
