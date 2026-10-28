// js/guru/siswa.js — #/guru/siswa: tabel siswa (cari, filter, urut, halaman), tambah, impor CSV,
// serta aksi per siswa yang juga dipakai halaman detail.
// Satu siswa boleh anggota banyak kelas (mis. kelas reguler + ekskul). "Keluarkan dari kelas" hanya
// melepas satu keanggotaan; "Hapus akun" menghapus akun beserta kemajuannya di SEMUA kelas.

import { esc, bukaModal, bukaFormModal, toast, unduhBerkas } from '../ui.js';
import {
  guruDaftarSiswa, guruTambahSiswa, guruUbahSiswa, guruTambahAnggota, guruKeluarkanDariKelas, guruResetPin, guruHapusSiswa,
  guruPratinjauImpor, guruImporSiswa, simpanPreferensi
} from '../store.js';
import { muatUlang } from '../router.js';
import { IKON, kosong, tombolAksi, avatarSiswa, waktuRelatif, bacaCSV, buatCSV } from './komponen.js';

const PER_HALAMAN = 20;
const KOLOM_CSV = ['namaLengkap', 'namaPanggilan', 'jenisKelamin', 'kelas'];

const KOLOM = [
  { id: 'avatar', teks: '', urut: false },
  { id: 'namaLengkap', teks: 'Nama lengkap' },
  { id: 'namaPanggilan', teks: 'Panggilan' },
  { id: 'kelasDiikuti', teks: 'Kelas yang diikuti' },
  { id: 'username', teks: 'Username' },
  { id: 'levelSelesai', teks: 'Level selesai', angka: true },
  { id: 'totalBintang', teks: 'Bintang', angka: true },
  { id: 'nilai', teks: 'Nilai', angka: true },
  { id: 'terakhirAktif', teks: 'Terakhir aktif' },
  { id: 'aksi', teks: 'Aksi', urut: false }
];

// =====================================================================
// Aksi per siswa (dipakai juga di halaman detail). Mengembalikan true jika berhasil.
// =====================================================================
const pilihanKelas = (kelas, terpilih) =>
  kelas.map((k) => `<option value="${esc(k.id)}" ${k.id === terpilih ? 'selected' : ''}>${esc(k.nama)}</option>`).join('');

/** Modal yang menampilkan username & PIN sekali saja. */
export async function tampilkanAkunBaru({ judul, nama, username, pin }) {
  await bukaModal({
    judul,
    isi: `
      <p>Catat data masuk untuk <strong>${esc(nama)}</strong>. PIN <strong>tidak akan ditampilkan lagi</strong>.</p>
      <div class="dg-kotak-pin">
        <div><span>Username</span><strong>${esc(username)}</strong></div>
        <div><span>PIN</span><strong class="tracking-[.3em]">${esc(pin)}</strong></div>
      </div>`,
    tombol: [{ teks: 'Sudah saya catat', nilai: true }],
    bisaDitutup: false
  });
}

export async function aksiEditSiswa(siswa, konteks) {
  const hasil = await bukaFormModal({
    judul: `Edit ${siswa.namaPanggilan}`,
    isi: `
      <div class="dg-form-grid">
        <label class="dg-label">Nama lengkap<input name="namaLengkap" class="dg-input" maxlength="50" value="${esc(siswa.namaLengkap)}"></label>
        <label class="dg-label">Nama panggilan<input name="namaPanggilan" class="dg-input" maxlength="12" value="${esc(siswa.namaPanggilan)}"></label>
        <label class="dg-label">Username<input name="username" class="dg-input font-kode" maxlength="16" value="${esc(siswa.username)}"></label>
        <label class="dg-label">Avatar
          <select name="avatar" class="dg-input">
            <option value="pria" ${siswa.avatar === 'pria' ? 'selected' : ''}>Laki-laki</option>
            <option value="wanita" ${siswa.avatar === 'wanita' ? 'selected' : ''}>Perempuan</option>
          </select>
        </label>
      </div>`,
    saatSimpan: (fd) => guruUbahSiswa(siswa.id, {
      namaLengkap: String(fd.get('namaLengkap') || ''),
      namaPanggilan: String(fd.get('namaPanggilan') || ''),
      username: String(fd.get('username') || ''),
      avatar: fd.get('avatar')
    })
  });
  if (hasil) toast(`Data ${hasil.namaPanggilan} berhasil disimpan.`, 'sukses');
  return !!hasil;
}

// Kelas yang diikuti murid dibaca dari semuaKelas (lengkap, tanpa saringan akses). Pilihan kelas yang bisa
// DIKELOLA tetap dibatasi konteks.kelas (kelas yang diampu) di aksi Tambahkan / Keluarkan di bawah.
const daftarNamaKelas = (kelas) => (kelas || []).map((k) => `<strong>${esc(k.nama)}</strong>`).join(', ') || 'belum ada';
const chipKelas = (kelas) => (kelas?.length
  ? kelas.map((k) => `<span class="dg-chip">${esc(k.nama)}</span>`).join(' ')
  : '<span class="text-sm text-[#B24E1C] font-bold">Belum punya kelas</span>');

/** Tambahkan siswa ini ke kelas lain yang Anda ampu (tanpa memindahkan dari kelas lamanya). */
export async function aksiTambahKeKelas(siswa, konteks) {
  const sudah = new Set((siswa.semuaKelas || []).map((k) => k.id));
  const pilihan = konteks.kelas.filter((k) => !sudah.has(k.id));
  if (!pilihan.length) { toast(`${siswa.namaPanggilan} sudah menjadi anggota semua kelas yang Anda ampu.`, 'info'); return false; }
  const hasil = await bukaFormModal({
    judul: `Tambahkan ${siswa.namaPanggilan} ke kelas lain`,
    isi: `
      <p class="mb-3">Kelas sekarang: ${daftarNamaKelas(siswa.semuaKelas)}. ${esc(siswa.namaPanggilan)} tetap di kelas itu, dan akun,
        koin, serta kemajuannya tidak berubah. Di kelas baru, kemajuannya dimulai dari awal.</p>
      <label class="dg-label">Kelas yang ditambahkan
        <select name="kelasId" class="dg-input">${pilihanKelas(pilihan, '')}</select>
      </label>`,
    teksSimpan: 'Tambahkan ke kelas',
    saatSimpan: (fd) => guruTambahAnggota(siswa.username, fd.get('kelasId'))
  });
  if (hasil) toast(`${siswa.namaPanggilan} berhasil ditambahkan ke ${hasil.kelas.nama}.`, 'sukses');
  return !!hasil;
}

/** KELUARKAN dari satu kelas — bukan hapus akun. Akun & kemajuan di kelas lain tetap utuh. */
export async function aksiKeluarkanDariKelas(siswa, konteks, kelasTerpilih = null) {
  const boleh = new Set(konteks.kelas.map((k) => k.id));
  const pilihan = (siswa.semuaKelas || []).filter((k) => boleh.has(k.id));
  if (!pilihan.length) { toast(`${siswa.namaPanggilan} bukan anggota kelas yang Anda ampu.`, 'info'); return false; }
  const hasil = await bukaFormModal({
    judul: `Keluarkan ${siswa.namaPanggilan} dari kelas?`,
    isi: `
      <p class="rounded-xl bg-mint p-3 mb-3"><strong>Ini bukan menghapus akun.</strong> ${esc(siswa.namaLengkap)} hanya keluar dari kelas yang
        dipilih. Akun, koin, berlian, dan kemajuannya di kelas lain tetap utuh, dan ia tetap bisa masuk seperti biasa.</p>
      <label class="dg-label">Keluarkan dari kelas
        <select name="kelasId" class="dg-input">${pilihanKelas(pilihan, kelasTerpilih || '')}</select>
      </label>
      <p class="mt-2 text-sm">Kemajuannya di kelas itu tidak lagi dihitung, dan muncul kembali bila ia ditambahkan lagi ke kelas tersebut.</p>`,
    teksSimpan: 'Keluarkan dari kelas',
    saatSimpan: async (fd) => {
      await guruKeluarkanDariKelas(siswa.id, fd.get('kelasId'));
      return pilihan.find((k) => k.id === fd.get('kelasId'));
    }
  });
  if (hasil) toast(`${siswa.namaPanggilan} berhasil dikeluarkan dari ${hasil.nama}. Akunnya tetap ada.`, 'sukses');
  return !!hasil;
}

/** Tambahkan siswa yang SUDAH punya akun (dari kelas lain) ke kelas Anda, lewat username-nya. */
async function aksiTambahSiswaLama(konteks, kelasId) {
  if (!konteks.kelas.length) { toast('Buat kelas dulu sebelum menambah siswa.', 'peringatan'); return false; }
  const hasil = await bukaFormModal({
    judul: 'Tambahkan siswa yang sudah punya akun',
    isi: `
      <p class="mb-3">Untuk siswa yang sudah punya akun di kelas lain, misalnya anggota ekskul. Akun, koin, dan kemajuannya
        di kelas lain tidak berubah. Siswa juga bisa bergabung sendiri dengan kode kelas dari halaman Profilnya.</p>
      <div class="dg-form-grid">
        <label class="dg-label">Username siswa<input name="username" class="dg-input font-kode" maxlength="16" autocomplete="off" placeholder="Contoh: rani12"></label>
        <label class="dg-label">Kelas<select name="kelasId" class="dg-input">${pilihanKelas(konteks.kelas, kelasId)}</select></label>
      </div>`,
    teksSimpan: 'Tambahkan ke kelas',
    saatSimpan: (fd) => {
      const username = String(fd.get('username') || '').trim().toLowerCase();
      if (!username) return { galat: 'Ketik username siswa yang ingin ditambahkan.' };
      return guruTambahAnggota(username, fd.get('kelasId'));
    }
  });
  if (hasil) toast(`${hasil.siswa.namaLengkap} berhasil ditambahkan ke ${hasil.kelas.nama}.`, 'sukses');
  return !!hasil;
}

// 4 angka acak (boleh diubah guru sebelum disimpan)
const pinAcak = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0');

/** Guru/admin mengetik PIN baru murid (atau menekan Acak). PIN ditampilkan sekali setelah tersimpan. */
export async function aksiResetPin(siswa) {
  const hasil = await bukaFormModal({
    judul: `Ganti PIN ${siswa.namaPanggilan}`,
    isi: `
      <p class="mb-3">PIN lama tidak bisa dipakai lagi, dan ${esc(siswa.namaPanggilan)} akan keluar dari semua perangkat. PIN baru ditampilkan sekali untuk Anda catat.</p>
      <label for="pin-baru" class="dg-label">PIN baru (4 angka)</label>
      <div class="flex gap-2 mt-1">
        <input id="pin-baru" name="pin" class="dg-input font-kode tracking-[.3em]" inputmode="numeric" maxlength="8" autocomplete="off" placeholder="0000">
        <button type="button" class="tombol tombol-sekunder tombol-kecil shrink-0" data-acak-pin>Acak</button>
      </div>`,
    teksSimpan: 'Simpan PIN',
    saatBuka: (form) => {
      const kolom = form.querySelector('[name="pin"]');
      form.querySelector('[data-acak-pin]').addEventListener('click', () => {
        kolom.value = pinAcak();
        kolom.focus();
      });
    },
    saatSimpan: async (fd) => {
      const pin = String(fd.get('pin') || '').trim();
      // Tepat 4 angka 0–9, tanpa aturan lain (1111 atau 1234 boleh). Server memeriksa ulang.
      if (!/^[0-9]{4}$/.test(pin)) return { galat: 'PIN harus tepat 4 angka (0–9), tanpa huruf atau spasi.' };
      return { pin: await guruResetPin(siswa.id, pin) };
    }
  });
  if (!hasil) return false;
  toast(`PIN ${siswa.namaPanggilan} berhasil diganti.`, 'sukses');
  await tampilkanAkunBaru({ judul: 'PIN baru', nama: siswa.namaLengkap, username: siswa.username, pin: hasil.pin });
  return true;
}

export async function aksiHapusSiswa(siswa) {
  const hasil = await bukaFormModal({
    judul: `Hapus akun ${siswa.namaLengkap}?`,
    varianSimpan: 'bahaya',
    teksSimpan: 'Hapus akun permanen',
    isi: `
      <p>Akun ini akan <strong>dihapus permanen dari semua kelas</strong> (${daftarNamaKelas(siswa.semuaKelas)}), beserta koin, berlian,
        seluruh kemajuan, dan aktivitasnya. Tindakan ini tidak bisa dibatalkan.</p>
      <p class="mt-2 text-sm">Kalau siswa ini hanya perlu keluar dari satu kelas, batalkan dan pakai <strong>Keluarkan dari kelas</strong>.</p>
      <label class="dg-label mt-3">Ketik <code class="dg-kode">${esc(siswa.username)}</code> untuk konfirmasi
        <input name="konfirmasi" class="dg-input font-kode" autocomplete="off">
      </label>`,
    saatSimpan: async (fd) => {
      if (String(fd.get('konfirmasi') || '').trim().toLowerCase() !== siswa.username) return { galat: `Username yang diketik belum sama dengan ${siswa.username}.` };
      await guruHapusSiswa(siswa.id);
      return true;
    }
  });
  if (hasil) toast(`Akun ${siswa.namaLengkap} berhasil dihapus.`, 'sukses');
  return !!hasil;
}

async function aksiTambahSiswa(konteks, kelasId) {
  if (!konteks.kelas.length) { toast('Buat kelas dulu sebelum menambah siswa.', 'peringatan'); return false; }
  const hasil = await bukaFormModal({
    judul: 'Tambah siswa',
    teksSimpan: 'Buat akun',
    isi: `
      <div class="dg-form-grid">
        <label class="dg-label">Nama lengkap<input name="namaLengkap" class="dg-input" maxlength="50" placeholder="Contoh: Budi Santoso"></label>
        <label class="dg-label">Nama panggilan<input name="namaPanggilan" class="dg-input" maxlength="12" placeholder="Contoh: Budi"></label>
        <label class="dg-label">Jenis kelamin
          <select name="jenisKelamin" class="dg-input"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select>
        </label>
        <label class="dg-label">Kelas<select name="kelasId" class="dg-input">${pilihanKelas(konteks.kelas, kelasId)}</select></label>
        <label class="dg-label sm:col-span-2">Username <span class="font-normal text-sm">(kosongkan agar dibuat otomatis)</span>
          <input name="username" class="dg-input font-kode" maxlength="16" autocomplete="off">
        </label>
      </div>
      <p class="mt-2 text-sm text-teal-tua">PIN 4 angka dibuat acak dan ditampilkan setelah akun dibuat.</p>`,
    saatSimpan: (fd) => guruTambahSiswa({
      namaLengkap: String(fd.get('namaLengkap') || ''),
      namaPanggilan: String(fd.get('namaPanggilan') || ''),
      jenisKelamin: fd.get('jenisKelamin'),
      kelasId: fd.get('kelasId'),
      username: String(fd.get('username') || '')
    })
  });
  if (!hasil) return false;
  toast(`Akun ${hasil.siswa.namaPanggilan} berhasil dibuat.`, 'sukses');
  await tampilkanAkunBaru({ judul: 'Akun siswa baru', nama: hasil.siswa.namaLengkap, username: hasil.siswa.username, pin: hasil.pin });
  return true;
}

// =====================================================================
// Impor CSV
// =====================================================================
function contohCSV(konteks) {
  const kelas = konteks.kelas[0]?.nama || 'Kelas 3A';
  return buatCSV(KOLOM_CSV, [
    { namaLengkap: 'Budi Santoso', namaPanggilan: 'Budi', jenisKelamin: 'L', kelas },
    { namaLengkap: 'Citra Lestari', namaPanggilan: 'Citra', jenisKelamin: 'P', kelas }
  ]);
}

async function aksiImporCSV(konteks) {
  let dibuat = 0;
  await bukaModal({
    judul: 'Impor siswa dari CSV',
    lebar: true,
    tombol: [],
    isi: `
      <div class="text-left" data-impor>
        <p>Kolom wajib: <code class="dg-kode">namaLengkap</code>, <code class="dg-kode">namaPanggilan</code>,
          <code class="dg-kode">jenisKelamin</code> (L/P), <code class="dg-kode">kelas</code> (mis. ${esc(konteks.kelas[0]?.nama || 'Kelas 3A')}).
          Pemisah koma atau titik koma.</p>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <label class="tombol tombol-utama tombol-kecil cursor-pointer">${IKON.unggah}<span>Pilih file CSV</span>
            <input type="file" accept=".csv,text/csv" class="sr-only" data-berkas>
          </label>
          <button type="button" class="tombol tombol-sekunder tombol-kecil" data-contoh>${IKON.unduh}<span>Unduh contoh CSV</span></button>
        </div>
        <div class="mt-4" data-pratinjau></div>
        <div class="form-aksi">
          <button type="button" class="tombol tombol-sekunder tombol-kecil" data-tutup-impor>Tutup</button>
        </div>
      </div>`,
    saatBuka: (kotak, tutup) => {
      const el = kotak.querySelector('[data-impor]');
      const pratinjau = el.querySelector('[data-pratinjau]');
      let barisValid = [];
      let hasilAkun = [];

      el.querySelector('[data-tutup-impor]').addEventListener('click', () => tutup(true));
      el.querySelector('[data-contoh]').addEventListener('click', () => unduhBerkas('contoh-impor-siswa.csv', contohCSV(konteks)));

      el.querySelector('[data-berkas]').addEventListener('change', async (e) => {
        const berkas = e.target.files?.[0];
        if (!berkas) return;
        const { kolom, data } = bacaCSV(await berkas.text());
        const kurang = KOLOM_CSV.filter((k) => !kolom.includes(k));
        if (kurang.length) {
          pratinjau.innerHTML = `<p class="pesan-kolom pesan-galat">Kolom berikut tidak ditemukan: ${esc(kurang.join(', '))}. Periksa baris judul CSV.</p>`;
          return;
        }
        if (!data.length) { pratinjau.innerHTML = '<p class="pesan-kolom pesan-galat">File CSV tidak berisi data siswa.</p>'; return; }
        const cek = await guruPratinjauImpor(data);
        barisValid = data.filter((_, i) => cek[i].ok);
        const salah = cek.filter((c) => !c.ok).length;
        pratinjau.innerHTML = `
          <p class="font-bold"><span class="text-teal-tua">${barisValid.length} baris siap dibuat</span>${salah ? ` · <span class="text-[#B24E1C]">${salah} baris bermasalah (dilewati)</span>` : ''}</p>
          <div class="dg-tabel-wadah mt-2 max-h-72 overflow-y-auto">
            <table class="dg-tabel">
              <thead><tr><th>#</th><th>Nama lengkap</th><th>Panggilan</th><th>JK</th><th>Kelas</th><th>Status</th></tr></thead>
              <tbody>
                ${cek.map((c) => `
                  <tr class="${c.ok ? '' : 'dg-baris-salah'}">
                    <td>${c.nomor}</td><td>${esc(c.data.namaLengkap)}</td><td>${esc(c.data.namaPanggilan)}</td>
                    <td>${esc(c.data.jenisKelamin || '?')}</td><td>${esc(c.data.kelasNama)}</td>
                    <td>${c.ok ? '<span class="dg-lencana" data-jenis="selesai">OK</span>' : `<span class="text-sm font-bold text-[#B24E1C]">${esc(c.pesan)}</span>`}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <button type="button" class="tombol tombol-utama tombol-kecil mt-3" data-buat ${barisValid.length ? '' : 'disabled'}>Buat ${barisValid.length} akun</button>`;
      });

      pratinjau.addEventListener('click', async (e) => {
        if (e.target.closest('[data-unduh-hasil]')) {
          unduhBerkas(`akun-siswa-${new Date().toISOString().slice(0, 10)}.csv`, buatCSV(
            ['namaLengkap', 'namaPanggilan', 'kelas', 'username', 'pin'],
            hasilAkun.map((h) => ({ namaLengkap: h.data.namaLengkap, namaPanggilan: h.data.namaPanggilan, kelas: h.data.kelasNama, username: h.username, pin: h.pin }))
          ));
          return;
        }
        const tombolBuat = e.target.closest('[data-buat]');
        if (!tombolBuat || !barisValid.length) return;
        tombolBuat.disabled = true;
        tombolBuat.textContent = 'Membuat akun...';
        const hasil = await guruImporSiswa(barisValid);
        hasilAkun = hasil.filter((h) => h.ok);
        dibuat += hasilAkun.length;
        toast(`${hasilAkun.length} akun siswa berhasil dibuat.`, 'sukses');
        pratinjau.innerHTML = `
          <div class="dg-kotak-sukses">
            <p class="font-bold">${hasilAkun.length} akun berhasil dibuat${hasil.length - hasilAkun.length ? `, ${hasil.length - hasilAkun.length} gagal` : ''}.</p>
            <p class="text-sm">Unduh daftar username dan PIN sekarang. PIN tidak bisa dilihat lagi setelah jendela ini ditutup.</p>
            <button type="button" class="tombol tombol-utama tombol-kecil mt-2" data-unduh-hasil>${IKON.unduh}<span>Unduh CSV username & PIN</span></button>
          </div>`;
      });
    }
  });
  return dibuat > 0;
}

// =====================================================================
// Halaman daftar siswa
// =====================================================================
export async function renderSiswa(wadah, { konteks, kelasId }) {
  const semua = await guruDaftarSiswa({ kelasId });
  // Kunci urut kolom "Kelas yang diikuti" (urutan nama mengikuti daftar kelas: ekskul dulu)
  semua.forEach((s) => { s.kelasDiikuti = (s.semuaKelas || []).map((k) => k.nama).join(', '); });
  const status = { cari: '', urut: 'namaLengkap', arah: 1, halaman: 1 };

  wadah.innerHTML = `
    <div class="dg-kartu">
      <div class="dg-kartu-kepala">
        <div>
          <h2 class="dg-subjudul">Daftar siswa</h2>
          <p class="text-sm" data-jumlah></p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="tombol tombol-sekunder tombol-kecil" data-impor-csv>${IKON.unggah}<span>Impor CSV</span></button>
          <button type="button" class="tombol tombol-sekunder tombol-kecil" data-tambah-lama>${IKON.siswa}<span>Tambah Siswa yang Sudah Ada</span></button>
          <button type="button" class="tombol tombol-utama tombol-kecil" data-tambah-siswa>${IKON.tambah}<span>Tambah Siswa Baru</span></button>
        </div>
      </div>
      <div class="dg-alat">
        <label class="dg-cari">
          <span class="sr-only">Cari siswa</span>
          <input type="search" class="dg-input" placeholder="Cari nama atau username..." data-cari>
        </label>
        <label class="dg-label-sebaris">Kelas
          <select class="dg-input" data-filter-lokal>
            <option value="">Semua</option>${pilihanKelas(konteks.kelas, kelasId)}
          </select>
        </label>
      </div>
      <div data-tabel></div>
      <nav class="dg-halaman" data-halaman aria-label="Halaman tabel"></nav>
    </div>`;

  const elTabel = wadah.querySelector('[data-tabel]');
  const elHalaman = wadah.querySelector('[data-halaman]');
  const elJumlah = wadah.querySelector('[data-jumlah]');

  function tersaring() {
    const q = status.cari.toLowerCase();
    const hasil = semua.filter((s) => !q || [s.namaLengkap, s.namaPanggilan, s.username].some((t) => t.toLowerCase().includes(q)));
    const k = status.urut;
    return hasil.sort((a, b) => {
      const x = a[k] ?? '';
      const y = b[k] ?? '';
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * status.arah;
    });
  }

  function gambar() {
    const data = tersaring();
    const jumlahHalaman = Math.max(1, Math.ceil(data.length / PER_HALAMAN));
    status.halaman = Math.min(status.halaman, jumlahHalaman);
    const potong = data.slice((status.halaman - 1) * PER_HALAMAN, status.halaman * PER_HALAMAN);
    elJumlah.textContent = `${data.length} siswa${status.cari ? ' cocok dengan pencarian' : ''}`;

    if (!semua.length) {
      elTabel.innerHTML = kosong('Belum ada siswa', 'Bagikan kode kelas agar siswa mendaftar, atau klik Tambah Siswa Baru / Impor CSV.');
      elHalaman.innerHTML = '';
      return;
    }
    if (!data.length) {
      elTabel.innerHTML = kosong('Siswa tidak ditemukan', 'Coba kata kunci lain.');
      elHalaman.innerHTML = '';
      return;
    }

    elTabel.innerHTML = `
      <div class="dg-tabel-wadah">
        <table class="dg-tabel">
          <thead><tr>
            ${KOLOM.map((c) => (c.urut === false
              ? `<th class="${c.id === 'aksi' ? 'text-right' : ''}">${c.teks ? esc(c.teks) : '<span class="sr-only">Avatar</span>'}</th>`
              : `<th class="${c.angka ? 'text-right' : ''}" aria-sort="${status.urut === c.id ? (status.arah > 0 ? 'ascending' : 'descending') : 'none'}">
                   <button type="button" class="dg-urut" data-urut="${c.id}">${esc(c.teks)} ${IKON.urut}</button>
                 </th>`)).join('')}
          </tr></thead>
          <tbody>
            ${potong.map((s) => `
              <tr>
                <td>${avatarSiswa(s.avatar)}</td>
                <td class="font-bold"><a class="dg-tautan" href="#/guru/siswa/${esc(s.id)}">${esc(s.namaLengkap)}</a></td>
                <td>${esc(s.namaPanggilan)}</td>
                <td>${chipKelas(s.semuaKelas)}</td>
                <td><code class="dg-kode">${esc(s.username)}</code></td>
                <td class="text-right">${s.levelSelesai}/${s.totalLevel}</td>
                <td class="text-right">${s.totalBintang}</td>
                <td class="text-right">${s.nilai || '-'}</td>
                <td class="whitespace-nowrap">${esc(waktuRelatif(s.terakhirAktif))}</td>
                <td class="text-right whitespace-nowrap">
                  <a class="dg-tombol-ikon" href="#/guru/siswa/${esc(s.id)}" aria-label="Lihat detail ${esc(s.namaLengkap)}" title="Lihat detail">${IKON.lihat}</a>
                  ${tombolAksi(IKON.edit, `Edit ${s.namaLengkap}`, `data-aksi="edit" data-id="${esc(s.id)}"`)}
                  ${tombolAksi(IKON.pindah, `Tambahkan ${s.namaLengkap} ke kelas lain`, `data-aksi="tambah-kelas" data-id="${esc(s.id)}"`)}
                  ${tombolAksi(IKON.keluar, `Keluarkan ${s.namaLengkap} dari kelas (akun tetap ada)`, `data-aksi="keluarkan" data-id="${esc(s.id)}"`)}
                  ${tombolAksi(IKON.kunci, `Ganti PIN ${s.namaLengkap}`, `data-aksi="pin" data-id="${esc(s.id)}"`)}
                  ${tombolAksi(IKON.hapus, `Hapus akun ${s.namaLengkap} permanen`, `data-aksi="hapus" data-id="${esc(s.id)}"`, true)}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    elHalaman.innerHTML = jumlahHalaman > 1 ? `
      <button type="button" class="tombol tombol-sekunder tombol-kecil" data-hal="${status.halaman - 1}" ${status.halaman === 1 ? 'disabled' : ''}>Sebelumnya</button>
      <span class="font-bold">Halaman ${status.halaman} dari ${jumlahHalaman}</span>
      <button type="button" class="tombol tombol-sekunder tombol-kecil" data-hal="${status.halaman + 1}" ${status.halaman === jumlahHalaman ? 'disabled' : ''}>Berikutnya</button>` : '';
  }
  gambar();

  let timerCari = null;
  wadah.querySelector('[data-cari]').addEventListener('input', (e) => {
    clearTimeout(timerCari);
    timerCari = setTimeout(() => { status.cari = e.target.value.trim(); status.halaman = 1; gambar(); }, 200);
  });
  // Filter lokal sama dengan filter global (disimpan agar konsisten di semua halaman)
  wadah.querySelector('[data-filter-lokal]').addEventListener('change', async (e) => {
    await simpanPreferensi({ kelasGuru: e.target.value });
    muatUlang();
  });

  wadah.addEventListener('click', async (e) => {
    const urut = e.target.closest('[data-urut]');
    if (urut) {
      const id = urut.dataset.urut;
      status.arah = status.urut === id ? -status.arah : (KOLOM.find((c) => c.id === id)?.angka ? -1 : 1);
      status.urut = id;
      gambar();
      return;
    }
    const hal = e.target.closest('[data-hal]');
    if (hal && !hal.disabled) { status.halaman = Number(hal.dataset.hal); gambar(); return; }

    if (e.target.closest('[data-tambah-siswa]')) { if (await aksiTambahSiswa(konteks, kelasId)) muatUlang(); return; }
    if (e.target.closest('[data-tambah-lama]')) { if (await aksiTambahSiswaLama(konteks, kelasId)) muatUlang(); return; }
    if (e.target.closest('[data-impor-csv]')) { if (await aksiImporCSV(konteks)) muatUlang(); return; }

    const aksi = e.target.closest('[data-aksi]');
    if (!aksi) return;
    const siswa = semua.find((s) => s.id === aksi.dataset.id);
    if (!siswa) return;
    const jalan = {
      edit: () => aksiEditSiswa(siswa, konteks),
      'tambah-kelas': () => aksiTambahKeKelas(siswa, konteks),
      keluarkan: () => aksiKeluarkanDariKelas(siswa, konteks, kelasId),
      pin: () => aksiResetPin(siswa),
      hapus: () => aksiHapusSiswa(siswa)
    }[aksi.dataset.aksi];
    if (jalan && (await jalan()) && aksi.dataset.aksi !== 'pin') muatUlang();
  });

  return () => clearTimeout(timerCari);
}
