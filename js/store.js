// js/store.js — satu-satunya pintu akses data Coding Island
// Sekarang memakai localStorage (awalan kunci 'ci_'). Nanti cukup modul ini
// yang diganti menjadi fetch() ke Cloudflare Pages Functions + D1.
// Semua fungsi publik async dan mengembalikan salinan data, bukan objek asli.
// Data rahasia (passwordHash, pinHash, salt) tidak pernah keluar dari modul ini.
//
// Setiap kali data berubah, modul ini mengirim event di window:
//   window.addEventListener('ci:berubah', (e) => e.detail.entitas)  // 'siswa', 'sesi', ...

import { LEVEL_AWAL } from './data/levels.js';
import { ZONA } from './data/zona.js';
import { hitungKoin } from './game/skor.js';

const AWALAN = 'ci_';
const VERSI_DATA = 3;        // naikkan jika bentuk data berubah
const VERSI_ISI_ULANG = 2;   // data lebih tua dari versi ini diisi ulang total; selebihnya cukup dimigrasi
const MASA_SESI_MS = 8 * 60 * 60 * 1000;   // sesi berlaku 8 jam
const BATAS_GAGAL = 5;                       // salah 5 kali ...
const LAMA_TAHAN_MS = 60 * 1000;             // ... ditahan 1 menit
const BATAS_AKTIVITAS = 2000;
const SEED_DEMO = 20261022;                  // seed tetap agar progres contoh selalu sama

export const KOIN_AWAL = 20;

const KUNCI = {
  guru: 'guru',
  kelas: 'kelas',
  siswa: 'siswa',
  level: 'level',
  progres: 'progres',
  aktivitas: 'aktivitas',
  sesi: 'sesi',
  percobaan: 'percobaan',
  versi: 'versi',
  draf: 'draf',
  preferensi: 'preferensi'
};

// =====================================================================
// Helper penyimpanan
// =====================================================================
function baca(kunci, bawaan) {
  try {
    const mentah = localStorage.getItem(AWALAN + kunci);
    return mentah === null ? bawaan : JSON.parse(mentah);
  } catch {
    return bawaan;
  }
}

function tulis(kunci, nilai) {
  try {
    localStorage.setItem(AWALAN + kunci, JSON.stringify(nilai));
  } catch {
    throw new Error('Penyimpanan browser penuh atau diblokir.');
  }
  beritahu(kunci);
}

function hapusKunci(kunci) {
  try { localStorage.removeItem(AWALAN + kunci); } catch { /* abaikan */ }
  beritahu(kunci);
}

function hapusSemuaKunci() {
  const daftar = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(AWALAN)) daftar.push(k);
  }
  daftar.forEach((k) => localStorage.removeItem(k));
}

function beritahu(entitas) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ci:berubah', { detail: { entitas } }));
  }
}

const salin = (o) => (o == null ? o : structuredClone(o));
const sekarang = () => new Date().toISOString();

// Buang data rahasia sebelum dikirim ke halaman
function tanpaRahasia(o) {
  if (!o) return null;
  const { passwordHash, pinHash, salt, ...sisa } = o;
  return salin(sisa);
}

// =====================================================================
// Kriptografi: SHA-256 + salt acak (crypto.subtle)
// =====================================================================
function acakHex(jumlahByte = 16) {
  const a = new Uint8Array(jumlahByte);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashRahasia(rahasia, salt) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Browser ini tidak mendukung penyimpanan aman. Buka lewat localhost atau https.');
  }
  const data = new TextEncoder().encode(`${salt}:${rahasia}`);
  const hasil = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hasil)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function buatKredensial(rahasia) {
  const salt = acakHex();
  return { salt, hash: await hashRahasia(rahasia, salt) };
}

async function cocokRahasia(rahasia, salt, hash) {
  return (await hashRahasia(String(rahasia), salt)) === hash;
}

function buatId(awalan) {
  return `${awalan}_${Date.now().toString(36)}${acakHex(3)}`;
}

// Kode kelas 6 karakter tanpa huruf/angka yang mirip (O/0, I/1)
function buatKodeKelasAcak() {
  const huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return [...a].map((n) => huruf[n % huruf.length]).join('');
}

// =====================================================================
// Data contoh (diisi saat pertama kali dibuka & saat reset)
// =====================================================================
const GURU_CONTOH = [
  { id: 'guru_admin', nama: 'Admin Sekolah', username: 'admin', password: 'admin123', peran: 'admin', kelasIds: [] },
  { id: 'guru_sari', nama: 'Bu Sari', username: 'bu.sari', password: 'guru123', peran: 'guru', kelasIds: ['kelas_3a', 'kelas_4a'] },
  { id: 'guru_budi', nama: 'Pak Budi', username: 'pak.budi', password: 'guru123', peran: 'guru', kelasIds: ['kelas_5a', 'kelas_6a'] }
];

const KELAS_CONTOH = [
  { id: 'kelas_3a', nama: 'Kelas 3A', tingkat: 3, kodeKelas: 'PULAU3', guruIds: ['guru_sari'] },
  { id: 'kelas_4a', nama: 'Kelas 4A', tingkat: 4, kodeKelas: 'PULAU4', guruIds: ['guru_sari'] },
  { id: 'kelas_5a', nama: 'Kelas 5A', tingkat: 5, kodeKelas: 'PULAU5', guruIds: ['guru_budi'] },
  { id: 'kelas_6a', nama: 'Kelas 6A', tingkat: 6, kodeKelas: 'PULAU6', guruIds: ['guru_budi'] }
];

// [nama lengkap, nama panggilan, jenis kelamin]
const SISWA_CONTOH = {
  kelas_3a: [['Andi Pratama', 'Andi', 'L'], ['Siti Aisyah', 'Aisyah', 'P'], ['Rizky Ramadhan', 'Rizky', 'L'], ['Nabila Putri', 'Nabila', 'P'], ['Fajar Nugroho', 'Fajar', 'L']],
  kelas_4a: [['Dimas Saputra', 'Dimas', 'L'], ['Zahra Amelia', 'Zahra', 'P'], ['Bima Ardiansyah', 'Bima', 'L'], ['Keisha Ananda', 'Keisha', 'P'], ['Raka Firmansyah', 'Raka', 'L']],
  kelas_5a: [['Farhan Hidayat', 'Farhan', 'L'], ['Salsabila Rahma', 'Salsa', 'P'], ['Yusuf Maulana', 'Yusuf', 'L'], ['Alya Safitri', 'Alya', 'P'], ['Hafiz Akbar', 'Hafiz', 'L']],
  kelas_6a: [['Naufal Rizqi', 'Naufal', 'L'], ['Aurel Kirana', 'Aurel', 'P'], ['Galih Permana', 'Galih', 'L'], ['Intan Permata', 'Intan', 'P'], ['Rafi Kurniawan', 'Rafi', 'L']]
};
const PIN_CONTOH = '1234';

// Level contoh berurutan sesuai urutan zona, lalu urutan level
const LEVEL_CONTOH_URUT = ZONA.flatMap((z) =>
  LEVEL_AWAL.filter((l) => l.zona === z.id).sort((a, b) => a.urutan - b.urutan));

// Zona yang terbuka jika level-level ini selesai (boss zona sebelumnya selesai)
function zonaTerbukaDari(idSelesai) {
  return ZONA.filter((z, i) => {
    if (i === 0) return true;
    const bossSebelum = LEVEL_AWAL.filter((l) => l.zona === ZONA[i - 1].id && l.jenis === 'boss');
    return bossSebelum.length > 0 && bossSebelum.every((l) => idSelesai.has(l.id));
  }).map((z) => z.id);
}

// Pembangkit angka acak dengan seed (mulberry32): hasil selalu sama
function buatAcak(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function isiDataContoh() {
  hapusSemuaKunci();
  const acak = buatAcak(SEED_DEMO);
  const angka = (min, max) => min + Math.floor(acak() * (max - min + 1));
  const HARI = 864e5;
  const awal = Date.parse('2026-09-01T07:30:00+07:00');

  const guru = [];
  for (const g of GURU_CONTOH) {
    const { salt, hash } = await buatKredensial(g.password);
    guru.push({ id: g.id, nama: g.nama, username: g.username, passwordHash: hash, salt, peran: g.peran, kelasIds: [...g.kelasIds] });
  }

  const kelas = KELAS_CONTOH.map((k) => ({ ...k, guruIds: [...k.guruIds] }));
  const siswa = [];
  const progres = [];
  const aktivitas = [];

  for (const k of kelas) {
    const daftar = SISWA_CONTOH[k.id];
    for (let i = 0; i < daftar.length; i++) {
      const [namaLengkap, namaPanggilan, jenisKelamin] = daftar[i];
      const id = `siswa_${k.id.replace('kelas_', '')}_${i + 1}`;
      const { salt, hash } = await buatKredensial(PIN_CONTOH);
      const dibuatPada = new Date(awal + angka(0, 6) * HARI).toISOString();
      aktivitas.push({ waktu: dibuatPada, siswaId: id, jenis: 'daftar', keterangan: 'Mendaftar di Coding Island' });

      // Kelas lebih tinggi rata-rata sudah lebih jauh
      const jumlahSelesai = Math.min(LEVEL_CONTOH_URUT.length, angka(1, 4) + (k.tingkat - 3) * 3);
      let waktu = Date.parse(dibuatPada);
      let totalBintang = 0;
      let totalClue = 0;
      let berlian = 0;
      const idSelesai = new Set();

      for (let j = 0; j < jumlahSelesai; j++) {
        const level = LEVEL_CONTOH_URUT[j];
        const r = acak();
        const bintang = r < 0.45 ? 3 : r < 0.8 ? 2 : 1;
        const nilai = bintang === 3 ? angka(85, 100) : bintang === 2 ? angka(70, 84) : angka(55, 69);
        const clueDibeli = angka(0, 3) === 0 ? angka(1, 2) : 0;
        waktu += angka(1, 2) * HARI;
        const iso = new Date(waktu).toISOString();
        progres.push({
          siswaId: id, levelId: level.id, selesai: true, bintang, nilai,
          percobaan: angka(1, 5), clueDibeli, kodeTerakhir: '', detik: angka(40, 420), diperbarui: iso
        });
        aktivitas.push({ waktu: iso, siswaId: id, jenis: 'selesai', keterangan: `Menyelesaikan level ${level.judul} dengan ${bintang} bintang` });
        totalBintang += bintang;
        totalClue += clueDibeli;
        idSelesai.add(level.id);
        if (level.jenis === 'boss') berlian += 1; // bonus boss
      }

      // Sebagian siswa sedang mencoba level berikutnya
      if (jumlahSelesai < LEVEL_CONTOH_URUT.length && acak() < 0.6) {
        progres.push({
          siswaId: id, levelId: LEVEL_CONTOH_URUT[jumlahSelesai].id, selesai: false, bintang: 0, nilai: 0,
          percobaan: angka(1, 3), clueDibeli: 0, kodeTerakhir: '', detik: angka(20, 200),
          diperbarui: new Date(waktu + HARI).toISOString()
        });
      }

      siswa.push({
        id, namaLengkap, namaPanggilan, jenisKelamin,
        avatar: jenisKelamin === 'L' ? 'pria' : 'wanita',
        kelasId: k.id,
        username: `${namaPanggilan.toLowerCase()}${k.tingkat}`,
        pinHash: hash, salt,
        koin: Math.max(0, KOIN_AWAL + totalBintang * 5 - totalClue * 5),
        berlian,
        zonaTerlihat: zonaTerbukaDari(idSelesai), // animasi pulau baru tidak diputar untuk data lama
        dibuatPada
      });
    }
  }

  aktivitas.sort((a, b) => b.waktu.localeCompare(a.waktu)); // terbaru di depan

  tulis(KUNCI.guru, guru);
  tulis(KUNCI.kelas, kelas);
  tulis(KUNCI.siswa, siswa);
  tulis(KUNCI.level, salin(LEVEL_AWAL)); // semua level awal terbit untuk semua kelas
  tulis(KUNCI.progres, progres);
  tulis(KUNCI.aktivitas, aktivitas);
  tulis(KUNCI.versi, VERSI_DATA);
  beritahu('sesi');
}

// Migrasi ringan: perbarui level bawaan tanpa menghapus akun dan progres
function migrasiData() {
  const level = baca(KUNCI.level, []);
  for (const awal of LEVEL_AWAL) {
    const i = level.findIndex((l) => l.id === awal.id);
    if (i >= 0) level[i] = { ...level[i], ...salin(awal) };
    else level.push(salin(awal));
  }
  tulis(KUNCI.level, level);
  tulis(KUNCI.versi, VERSI_DATA);
}

// Pastikan data contoh sudah ada sebelum fungsi publik bekerja
let janjiSiap = null;
function siap() {
  if (!janjiSiap) {
    janjiSiap = (async () => {
      const versi = baca(KUNCI.versi, 0);
      if (versi < VERSI_ISI_ULANG) await isiDataContoh();
      else if (versi < VERSI_DATA) migrasiData();
    })().catch((err) => {
      janjiSiap = null;
      throw err;
    });
  }
  return janjiSiap;
}

/** Kembalikan semua data ke kondisi contoh awal (sesi ikut terhapus). */
export async function resetDataDemo() {
  janjiSiap = isiDataContoh();
  await janjiSiap;
  return true;
}

/** Daftar akun contoh untuk ditampilkan di halaman masuk. */
export async function getAkunDemo() {
  await siap();
  const guru = baca(KUNCI.guru, []);
  const kelas = baca(KUNCI.kelas, []);
  const siswa = baca(KUNCI.siswa, []);
  return {
    guru: GURU_CONTOH
      .filter((g) => guru.some((x) => x.id === g.id && x.username === g.username))
      .map((g) => ({ nama: g.nama, username: g.username, password: g.password, peran: g.peran })),
    siswa: siswa
      .filter((s) => /^siswa_\d[a-z]_\d+$/.test(s.id))
      .map((s) => ({
        namaPanggilan: s.namaPanggilan,
        username: s.username,
        pin: PIN_CONTOH,
        kelas: kelas.find((k) => k.id === s.kelasId)?.nama || '-'
      }))
  };
}

// =====================================================================
// Validasi (dipakai halaman dan store, agar pesannya sama)
// =====================================================================
/** Periksa satu kolom data siswa. Mengembalikan pesan ramah, atau '' jika benar. */
export function periksaKolomSiswa(kolom, nilai) {
  const v = typeof nilai === 'string' ? nilai.trim() : nilai;
  switch (kolom) {
    case 'namaLengkap':
      if (!v) return 'Tulis nama lengkapmu dulu ya.';
      if (v.length < 3) return 'Nama lengkap minimal 3 huruf.';
      if (v.length > 50) return 'Nama lengkap terlalu panjang.';
      if (!/^[A-Za-zÀ-ɏ' .-]+$/.test(v)) return 'Nama hanya boleh berisi huruf dan spasi.';
      return '';
    case 'namaPanggilan':
      if (!v) return 'Tulis nama panggilanmu ya.';
      if (!/^[A-Za-zÀ-ɏ]+$/.test(v)) return 'Nama panggilan cukup huruf saja, tanpa spasi.';
      if (v.length < 2 || v.length > 12) return 'Nama panggilan 2 sampai 12 huruf.';
      return '';
    case 'avatar':
      return v === 'pria' || v === 'wanita' ? '' : 'Pilih salah satu gambar ya.';
    case 'kelasId':
      return v ? '' : 'Pilih kelasmu dulu ya.';
    case 'kodeKelas':
      if (!v) return 'Ketik kode kelas dari gurumu ya.';
      if (!/^[A-Za-z0-9]{6}$/.test(v)) return 'Kode kelas terdiri dari 6 huruf atau angka.';
      return '';
    case 'username':
      if (!v) return 'Username tidak boleh kosong.';
      if (!/^[a-z][a-z0-9]{2,15}$/.test(v)) return 'Username 3–16 huruf kecil atau angka, diawali huruf.';
      return '';
    case 'pin':
      return /^\d{4}$/.test(String(v ?? '')) ? '' : 'PIN harus 4 angka.';
    default:
      return '';
  }
}

// =====================================================================
// Batas percobaan masuk (per jenis: 'siswa' / 'guru', per perangkat)
// =====================================================================
function bacaPercobaan(jenis) {
  const semua = baca(KUNCI.percobaan, {});
  return { semua, data: semua[jenis] || { gagal: 0, tahanSampai: 0 } };
}

function sisaTahanDetik(data) {
  return Math.max(0, Math.ceil((data.tahanSampai - Date.now()) / 1000));
}

/** Berapa detik lagi percobaan masuk ditahan (0 berarti boleh mencoba). */
export async function statusTahan(jenis) {
  await siap();
  return sisaTahanDetik(bacaPercobaan(jenis).data);
}

function catatGagal(jenis) {
  const { semua, data } = bacaPercobaan(jenis);
  data.gagal += 1;
  let tahanDetik = 0;
  if (data.gagal >= BATAS_GAGAL) {
    data.gagal = 0;
    data.tahanSampai = Date.now() + LAMA_TAHAN_MS;
    tahanDetik = Math.ceil(LAMA_TAHAN_MS / 1000);
  }
  semua[jenis] = data;
  tulis(KUNCI.percobaan, semua);
  return { sisa: tahanDetik ? 0 : BATAS_GAGAL - data.gagal, tahanDetik };
}

function hapusGagal(jenis) {
  const { semua } = bacaPercobaan(jenis);
  delete semua[jenis];
  tulis(KUNCI.percobaan, semua);
}

// =====================================================================
// Sesi
// =====================================================================
function buatSesi(jenis, id) {
  tulis(KUNCI.sesi, { jenis, id, kadaluarsa: Date.now() + MASA_SESI_MS });
}

/**
 * Sesi yang sedang aktif, atau null.
 * Hasil: { jenis: 'siswa'|'guru', peran: 'siswa'|'guru'|'admin', kadaluarsa, pengguna }
 */
export async function sesiAktif() {
  await siap();
  const s = baca(KUNCI.sesi, null);
  if (!s) return null;
  if (Date.now() > s.kadaluarsa) {
    hapusKunci(KUNCI.sesi);
    return null;
  }
  if (s.jenis === 'siswa') {
    const siswa = baca(KUNCI.siswa, []).find((x) => x.id === s.id);
    if (!siswa) { hapusKunci(KUNCI.sesi); return null; }
    return { jenis: 'siswa', peran: 'siswa', kadaluarsa: s.kadaluarsa, pengguna: tanpaRahasia(siswa) };
  }
  if (s.jenis === 'guru') {
    const guru = baca(KUNCI.guru, []).find((x) => x.id === s.id);
    if (!guru) { hapusKunci(KUNCI.sesi); return null; }
    return { jenis: 'guru', peran: guru.peran, kadaluarsa: s.kadaluarsa, pengguna: tanpaRahasia(guru) };
  }
  return null;
}

export async function keluar() {
  await siap();
  hapusKunci(KUNCI.sesi);
}

// =====================================================================
// Pendaftaran & masuk
// =====================================================================
/** Kelas untuk dropdown pendaftaran (tanpa kode kelas). */
export async function daftarKelasPublik() {
  await siap();
  return baca(KUNCI.kelas, [])
    .map(({ id, nama, tingkat }) => ({ id, nama, tingkat }))
    .sort((a, b) => a.tingkat - b.tingkat || a.nama.localeCompare(b.nama));
}

/** Cocokkan kode kelas tanpa membedakan huruf besar/kecil. */
export async function cekKodeKelas(kelasId, kode) {
  await siap();
  const kelas = baca(KUNCI.kelas, []).find((k) => k.id === kelasId);
  return !!kelas && kelas.kodeKelas.toUpperCase() === String(kode || '').trim().toUpperCase();
}

/** Cek username siswa. Hasil: { tersedia, pesan } */
export async function cekUsernameSiswa(username, kecualiId = null) {
  await siap();
  const u = String(username || '').trim().toLowerCase();
  const pesan = periksaKolomSiswa('username', u);
  if (pesan) return { tersedia: false, pesan };
  const dipakai = baca(KUNCI.siswa, []).some((s) => s.username === u && s.id !== kecualiId);
  return dipakai
    ? { tersedia: false, pesan: 'Username ini sudah dipakai. Coba yang lain ya.' }
    : { tersedia: true, pesan: 'Username bisa dipakai!' };
}

/** Saran username: nama panggilan + angka, dijamin belum dipakai. */
export async function sarankanUsername(namaPanggilan) {
  await siap();
  let dasar = String(namaPanggilan || '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').slice(0, 12);
  if (!dasar) dasar = 'robot';
  const dipakai = new Set(baca(KUNCI.siswa, []).map((s) => s.username));
  for (let i = 0; i < 50; i++) {
    const angka = i < 30 ? 10 + Math.floor(Math.random() * 90) : 100 + Math.floor(Math.random() * 900);
    const calon = `${dasar}${angka}`;
    if (!dipakai.has(calon)) return calon;
  }
  return `${dasar}${Date.now() % 10000}`;
}

/**
 * Daftarkan siswa baru, lalu langsung masuk.
 * data: { namaLengkap, namaPanggilan, avatar, kelasId, kodeKelas, username, pin }
 * Hasil: { ok: true, siswa } atau { ok: false, kolom, pesan }
 */
export async function daftarSiswa(data) {
  await siap();
  const d = {
    namaLengkap: String(data.namaLengkap || '').trim().replace(/\s+/g, ' '),
    namaPanggilan: String(data.namaPanggilan || '').trim(),
    avatar: data.avatar,
    kelasId: data.kelasId,
    kodeKelas: String(data.kodeKelas || '').trim(),
    username: String(data.username || '').trim().toLowerCase(),
    pin: String(data.pin || '')
  };

  for (const kolom of ['namaLengkap', 'namaPanggilan', 'avatar', 'kelasId', 'kodeKelas', 'username', 'pin']) {
    const pesan = periksaKolomSiswa(kolom, d[kolom]);
    if (pesan) return { ok: false, kolom, pesan };
  }
  if (!(await cekKodeKelas(d.kelasId, d.kodeKelas))) {
    return { ok: false, kolom: 'kodeKelas', pesan: 'Kode kelas belum cocok. Tanya gurumu ya.' };
  }
  const cek = await cekUsernameSiswa(d.username);
  if (!cek.tersedia) return { ok: false, kolom: 'username', pesan: cek.pesan };

  const { salt, hash } = await buatKredensial(d.pin);
  const siswa = {
    id: buatId('siswa'),
    namaLengkap: d.namaLengkap,
    namaPanggilan: d.namaPanggilan,
    jenisKelamin: d.avatar === 'pria' ? 'L' : 'P',
    avatar: d.avatar,
    kelasId: d.kelasId,
    username: d.username,
    pinHash: hash,
    salt,
    koin: KOIN_AWAL,
    berlian: 0,
    zonaTerlihat: [ZONA[0].id],
    dibuatPada: sekarang()
  };
  const semua = baca(KUNCI.siswa, []);
  semua.push(siswa);
  tulis(KUNCI.siswa, semua);
  tambahAktivitas(siswa.id, 'daftar', 'Mendaftar di Coding Island');
  buatSesi('siswa', siswa.id);
  return { ok: true, siswa: tanpaRahasia(siswa) };
}

/** Hasil: { ok: true, siswa } atau { ok: false, pesan, sisa, tahanDetik } */
export async function masukSiswa(username, pin) {
  await siap();
  const tahan = sisaTahanDetik(bacaPercobaan('siswa').data);
  if (tahan) return { ok: false, pesan: 'Istirahat sebentar dulu ya.', sisa: 0, tahanDetik: tahan };

  const u = String(username || '').trim().toLowerCase();
  const siswa = baca(KUNCI.siswa, []).find((s) => s.username === u);
  const benar = siswa ? await cocokRahasia(pin, siswa.salt, siswa.pinHash) : false;
  if (!benar) {
    const { sisa, tahanDetik } = catatGagal('siswa');
    return { ok: false, pesan: 'Username atau PIN belum cocok.', sisa, tahanDetik };
  }
  hapusGagal('siswa');
  buatSesi('siswa', siswa.id);
  tambahAktivitas(siswa.id, 'masuk', 'Masuk ke Coding Island');
  return { ok: true, siswa: tanpaRahasia(siswa) };
}

/** Hasil: { ok: true, guru } atau { ok: false, pesan, sisa, tahanDetik } */
export async function masukGuru(username, password) {
  await siap();
  const tahan = sisaTahanDetik(bacaPercobaan('guru').data);
  if (tahan) return { ok: false, pesan: 'Terlalu banyak percobaan.', sisa: 0, tahanDetik: tahan };

  const u = String(username || '').trim().toLowerCase();
  const guru = baca(KUNCI.guru, []).find((g) => g.username === u);
  const benar = guru ? await cocokRahasia(password, guru.salt, guru.passwordHash) : false;
  if (!benar) {
    const { sisa, tahanDetik } = catatGagal('guru');
    return { ok: false, pesan: 'Username atau password salah.', sisa, tahanDetik };
  }
  hapusGagal('guru');
  buatSesi('guru', guru.id);
  return { ok: true, guru: tanpaRahasia(guru) };
}

// =====================================================================
// CRUD Guru
// =====================================================================
// Jaga relasi dua arah guru.kelasIds <-> kelas.guruIds
function sinkronDariGuru(guruId, kelasIds) {
  const kelas = baca(KUNCI.kelas, []);
  for (const k of kelas) {
    const punya = k.guruIds.includes(guruId);
    const harus = kelasIds.includes(k.id);
    if (harus && !punya) k.guruIds.push(guruId);
    if (!harus && punya) k.guruIds = k.guruIds.filter((g) => g !== guruId);
  }
  tulis(KUNCI.kelas, kelas);
}

function sinkronDariKelas(kelasId, guruIds) {
  const guru = baca(KUNCI.guru, []);
  for (const g of guru) {
    const punya = g.kelasIds.includes(kelasId);
    const harus = guruIds.includes(g.id);
    if (harus && !punya) g.kelasIds.push(kelasId);
    if (!harus && punya) g.kelasIds = g.kelasIds.filter((k) => k !== kelasId);
  }
  tulis(KUNCI.guru, guru);
}

function periksaGuru(d) {
  if (!d.nama || d.nama.trim().length < 2) throw new Error('Nama guru minimal 2 huruf.');
  if (!/^[a-z][a-z0-9._]{2,23}$/.test(d.username || '')) throw new Error('Username guru 3–24 huruf kecil, angka, titik, atau garis bawah.');
  if (!['admin', 'guru'].includes(d.peran)) throw new Error('Peran harus admin atau guru.');
}

export async function getSemuaGuru() {
  await siap();
  return baca(KUNCI.guru, []).map(tanpaRahasia);
}

export async function getGuru(id) {
  await siap();
  return tanpaRahasia(baca(KUNCI.guru, []).find((g) => g.id === id));
}

/** data: { nama, username, password, peran, kelasIds } */
export async function tambahGuru(data) {
  await siap();
  const d = {
    nama: String(data.nama || '').trim(),
    username: String(data.username || '').trim().toLowerCase(),
    peran: data.peran || 'guru',
    kelasIds: [...(data.kelasIds || [])]
  };
  periksaGuru(d);
  if (!data.password || String(data.password).length < 6) throw new Error('Password minimal 6 karakter.');
  const semua = baca(KUNCI.guru, []);
  if (semua.some((g) => g.username === d.username)) throw new Error('Username guru sudah dipakai.');
  const { salt, hash } = await buatKredensial(String(data.password));
  const guru = { id: buatId('guru'), ...d, passwordHash: hash, salt };
  semua.push(guru);
  tulis(KUNCI.guru, semua);
  sinkronDariGuru(guru.id, guru.kelasIds);
  return tanpaRahasia(guru);
}

/** perubahan boleh berisi: nama, username, peran, kelasIds, password */
export async function ubahGuru(id, perubahan) {
  await siap();
  const semua = baca(KUNCI.guru, []);
  const guru = semua.find((g) => g.id === id);
  if (!guru) throw new Error('Guru tidak ditemukan.');
  const baru = {
    ...guru,
    ...('nama' in perubahan ? { nama: String(perubahan.nama).trim() } : {}),
    ...('username' in perubahan ? { username: String(perubahan.username).trim().toLowerCase() } : {}),
    ...('peran' in perubahan ? { peran: perubahan.peran } : {}),
    ...('kelasIds' in perubahan ? { kelasIds: [...perubahan.kelasIds] } : {})
  };
  periksaGuru(baru);
  if (semua.some((g) => g.username === baru.username && g.id !== id)) throw new Error('Username guru sudah dipakai.');
  if (guru.peran === 'admin' && baru.peran !== 'admin' && semua.filter((g) => g.peran === 'admin').length <= 1) {
    throw new Error('Harus ada minimal satu admin.');
  }
  if (perubahan.password) {
    if (String(perubahan.password).length < 6) throw new Error('Password minimal 6 karakter.');
    const { salt, hash } = await buatKredensial(String(perubahan.password));
    baru.salt = salt;
    baru.passwordHash = hash;
  }
  Object.assign(guru, baru);
  tulis(KUNCI.guru, semua);
  if ('kelasIds' in perubahan) sinkronDariGuru(id, guru.kelasIds);
  return tanpaRahasia(guru);
}

export async function hapusGuru(id) {
  await siap();
  const semua = baca(KUNCI.guru, []);
  const guru = semua.find((g) => g.id === id);
  if (!guru) return false;
  if (guru.peran === 'admin' && semua.filter((g) => g.peran === 'admin').length <= 1) {
    throw new Error('Admin terakhir tidak bisa dihapus.');
  }
  tulis(KUNCI.guru, semua.filter((g) => g.id !== id));
  sinkronDariGuru(id, []);
  const sesi = baca(KUNCI.sesi, null);
  if (sesi?.jenis === 'guru' && sesi.id === id) hapusKunci(KUNCI.sesi);
  return true;
}

// =====================================================================
// CRUD Kelas
// =====================================================================
function periksaKelas(d) {
  if (!d.nama || d.nama.trim().length < 2) throw new Error('Nama kelas belum diisi.');
  if (![3, 4, 5, 6].includes(Number(d.tingkat))) throw new Error('Tingkat kelas harus 3 sampai 6.');
  if (!/^[A-Z0-9]{6}$/.test(d.kodeKelas)) throw new Error('Kode kelas harus 6 huruf atau angka.');
}

export async function getSemuaKelas() {
  await siap();
  return salin(baca(KUNCI.kelas, []))
    .sort((a, b) => a.tingkat - b.tingkat || a.nama.localeCompare(b.nama));
}

export async function getKelas(id) {
  await siap();
  return salin(baca(KUNCI.kelas, []).find((k) => k.id === id) || null);
}

/** Buat kode kelas acak yang belum dipakai. */
export async function buatKodeKelas() {
  await siap();
  const dipakai = new Set(baca(KUNCI.kelas, []).map((k) => k.kodeKelas));
  let kode;
  do { kode = buatKodeKelasAcak(); } while (dipakai.has(kode));
  return kode;
}

/** data: { nama, tingkat, kodeKelas?, guruIds? } */
export async function tambahKelas(data) {
  await siap();
  const d = {
    nama: String(data.nama || '').trim(),
    tingkat: Number(data.tingkat),
    kodeKelas: String(data.kodeKelas || (await buatKodeKelas())).trim().toUpperCase(),
    guruIds: [...(data.guruIds || [])]
  };
  periksaKelas(d);
  const semua = baca(KUNCI.kelas, []);
  if (semua.some((k) => k.kodeKelas === d.kodeKelas)) throw new Error('Kode kelas sudah dipakai kelas lain.');
  const kelas = { id: buatId('kelas'), ...d };
  semua.push(kelas);
  tulis(KUNCI.kelas, semua);
  sinkronDariKelas(kelas.id, kelas.guruIds);
  return salin(kelas);
}

/** perubahan boleh berisi: nama, tingkat, kodeKelas, guruIds */
export async function ubahKelas(id, perubahan) {
  await siap();
  const semua = baca(KUNCI.kelas, []);
  const kelas = semua.find((k) => k.id === id);
  if (!kelas) throw new Error('Kelas tidak ditemukan.');
  const baru = {
    ...kelas,
    ...('nama' in perubahan ? { nama: String(perubahan.nama).trim() } : {}),
    ...('tingkat' in perubahan ? { tingkat: Number(perubahan.tingkat) } : {}),
    ...('kodeKelas' in perubahan ? { kodeKelas: String(perubahan.kodeKelas).trim().toUpperCase() } : {}),
    ...('guruIds' in perubahan ? { guruIds: [...perubahan.guruIds] } : {})
  };
  periksaKelas(baru);
  if (semua.some((k) => k.kodeKelas === baru.kodeKelas && k.id !== id)) throw new Error('Kode kelas sudah dipakai kelas lain.');
  Object.assign(kelas, baru);
  tulis(KUNCI.kelas, semua);
  if ('guruIds' in perubahan) sinkronDariKelas(id, kelas.guruIds);
  return salin(kelas);
}

/** Hapus kelas. Siswanya tetap ada, tetapi tanpa kelas (kelasId null). */
export async function hapusKelas(id) {
  await siap();
  const semua = baca(KUNCI.kelas, []);
  if (!semua.some((k) => k.id === id)) return false;
  tulis(KUNCI.kelas, semua.filter((k) => k.id !== id));
  sinkronDariKelas(id, []);
  const siswa = baca(KUNCI.siswa, []);
  siswa.forEach((s) => { if (s.kelasId === id) s.kelasId = null; });
  tulis(KUNCI.siswa, siswa);
  return true;
}

// =====================================================================
// CRUD Siswa
// =====================================================================
/** filter: { kelasId } (opsional) */
export async function getSemuaSiswa({ kelasId } = {}) {
  await siap();
  return baca(KUNCI.siswa, [])
    .filter((s) => !kelasId || s.kelasId === kelasId)
    .map(tanpaRahasia)
    .sort((a, b) => a.namaLengkap.localeCompare(b.namaLengkap));
}

export async function getSiswa(id) {
  await siap();
  return tanpaRahasia(baca(KUNCI.siswa, []).find((s) => s.id === id));
}

/** Tambah siswa oleh guru (tanpa kode kelas, tanpa masuk otomatis). */
export async function tambahSiswa(data) {
  await siap();
  const d = {
    namaLengkap: String(data.namaLengkap || '').trim().replace(/\s+/g, ' '),
    namaPanggilan: String(data.namaPanggilan || '').trim(),
    avatar: data.avatar,
    kelasId: data.kelasId,
    username: String(data.username || '').trim().toLowerCase(),
    pin: String(data.pin || '')
  };
  for (const kolom of ['namaLengkap', 'namaPanggilan', 'avatar', 'kelasId', 'username', 'pin']) {
    const pesan = periksaKolomSiswa(kolom, d[kolom]);
    if (pesan) throw new Error(pesan);
  }
  const cek = await cekUsernameSiswa(d.username);
  if (!cek.tersedia) throw new Error(cek.pesan);
  const { salt, hash } = await buatKredensial(d.pin);
  const siswa = {
    id: buatId('siswa'), namaLengkap: d.namaLengkap, namaPanggilan: d.namaPanggilan,
    jenisKelamin: d.avatar === 'pria' ? 'L' : 'P', avatar: d.avatar, kelasId: d.kelasId,
    username: d.username, pinHash: hash, salt, koin: KOIN_AWAL, berlian: 0,
    zonaTerlihat: [ZONA[0].id], dibuatPada: sekarang()
  };
  const semua = baca(KUNCI.siswa, []);
  semua.push(siswa);
  tulis(KUNCI.siswa, semua);
  return tanpaRahasia(siswa);
}

/** perubahan boleh berisi: namaLengkap, namaPanggilan, avatar, kelasId, username, koin, berlian, pin */
export async function ubahSiswa(id, perubahan) {
  await siap();
  const semua = baca(KUNCI.siswa, []);
  const siswa = semua.find((s) => s.id === id);
  if (!siswa) throw new Error('Siswa tidak ditemukan.');

  const bolehTeks = ['namaLengkap', 'namaPanggilan', 'avatar', 'kelasId', 'username'];
  for (const kolom of bolehTeks) {
    if (!(kolom in perubahan)) continue;
    let nilai = perubahan[kolom];
    if (typeof nilai === 'string') nilai = nilai.trim();
    if (kolom === 'username') nilai = String(nilai).toLowerCase();
    const pesan = periksaKolomSiswa(kolom, nilai);
    if (pesan) throw new Error(pesan);
    if (kolom === 'username') {
      const cek = await cekUsernameSiswa(nilai, id);
      if (!cek.tersedia) throw new Error(cek.pesan);
    }
    siswa[kolom] = nilai;
    if (kolom === 'avatar') siswa.jenisKelamin = nilai === 'pria' ? 'L' : 'P';
  }
  for (const kolom of ['koin', 'berlian']) {
    if (kolom in perubahan) siswa[kolom] = Math.max(0, Math.floor(Number(perubahan[kolom]) || 0));
  }
  if ('pin' in perubahan) {
    const pesan = periksaKolomSiswa('pin', perubahan.pin);
    if (pesan) throw new Error(pesan);
    const { salt, hash } = await buatKredensial(String(perubahan.pin));
    siswa.salt = salt;
    siswa.pinHash = hash;
  }
  tulis(KUNCI.siswa, semua);
  return tanpaRahasia(siswa);
}

/** Simpan daftar zona yang animasi "pulau baru"-nya sudah pernah dilihat siswa. */
export async function aturZonaTerlihat(id, zonaIds) {
  await siap();
  const semua = baca(KUNCI.siswa, []);
  const siswa = semua.find((s) => s.id === id);
  if (!siswa) throw new Error('Siswa tidak ditemukan.');
  siswa.zonaTerlihat = [...new Set(zonaIds)].filter((z) => ZONA.some((x) => x.id === z));
  tulis(KUNCI.siswa, semua);
  return tanpaRahasia(siswa);
}

/** Dipakai guru saat siswa lupa PIN. */
export async function resetPinSiswa(id, pinBaru) {
  return ubahSiswa(id, { pin: pinBaru });
}

/** Tambah atau kurangi koin/berlian (jumlah boleh negatif). Hasil: siswa terbaru. */
export async function tambahKoin(id, jumlah = 0, jumlahBerlian = 0) {
  await siap();
  const siswa = baca(KUNCI.siswa, []).find((s) => s.id === id);
  if (!siswa) throw new Error('Siswa tidak ditemukan.');
  if (siswa.koin + jumlah < 0) throw new Error('Koinmu belum cukup.');
  return ubahSiswa(id, { koin: siswa.koin + jumlah, berlian: siswa.berlian + jumlahBerlian });
}

/** Hapus siswa beserta progres dan aktivitasnya. */
export async function hapusSiswa(id) {
  await siap();
  const semua = baca(KUNCI.siswa, []);
  if (!semua.some((s) => s.id === id)) return false;
  tulis(KUNCI.siswa, semua.filter((s) => s.id !== id));
  tulis(KUNCI.progres, baca(KUNCI.progres, []).filter((p) => p.siswaId !== id));
  tulis(KUNCI.aktivitas, baca(KUNCI.aktivitas, []).filter((a) => a.siswaId !== id));
  const sesi = baca(KUNCI.sesi, null);
  if (sesi?.jenis === 'siswa' && sesi.id === id) hapusKunci(KUNCI.sesi);
  return true;
}

// =====================================================================
// Level (isi soal menyusul di Tahap 5)
// =====================================================================
/** filter: { zona } (opsional). Diurutkan menurut kolom 'urutan'. */
export async function daftarLevel({ zona } = {}) {
  await siap();
  return salin(baca(KUNCI.level, []))
    .filter((l) => !zona || l.zona === zona)
    .sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0));
}

export async function getLevel(id) {
  await siap();
  return salin(baca(KUNCI.level, []).find((l) => l.id === id) || null);
}

/** Tambah atau timpa level berdasarkan id. */
export async function simpanLevel(level) {
  await siap();
  if (!level?.id) throw new Error('Level harus punya id.');
  const semua = baca(KUNCI.level, []);
  const i = semua.findIndex((l) => l.id === level.id);
  const baru = { ...salin(level), diperbarui: sekarang() };
  if (i >= 0) semua[i] = baru; else semua.push(baru);
  tulis(KUNCI.level, semua);
  return salin(baru);
}

/**
 * Level yang sudah terbit untuk satu kelas (kelasIds null = semua kelas).
 * filter: { kelasId, zona } (opsional)
 */
export async function daftarLevelTerbit({ kelasId, zona } = {}) {
  const semua = await daftarLevel({ zona });
  return semua.filter((l) => l.terbit !== false && (!l.kelasIds || !kelasId || l.kelasIds.includes(kelasId)));
}

export async function hapusLevel(id) {
  await siap();
  const semua = baca(KUNCI.level, []);
  if (!semua.some((l) => l.id === id)) return false;
  tulis(KUNCI.level, semua.filter((l) => l.id !== id));
  return true;
}

// =====================================================================
// Progres
// =====================================================================
const PROGRES_KOSONG = {
  selesai: false, bintang: 0, nilai: 0, percobaan: 0, clueDibeli: 0, kodeTerakhir: '', detik: 0
};

/** filter: { siswaId, levelId } (opsional) */
export async function getSemuaProgres({ siswaId, levelId } = {}) {
  await siap();
  return salin(baca(KUNCI.progres, []))
    .filter((p) => (!siswaId || p.siswaId === siswaId) && (!levelId || p.levelId === levelId));
}

export async function getProgres(siswaId, levelId) {
  await siap();
  return salin(baca(KUNCI.progres, []).find((p) => p.siswaId === siswaId && p.levelId === levelId) || null);
}

/** Gabungkan perubahan ke progres siswa pada satu level (dibuat jika belum ada). */
export async function simpanProgres(siswaId, levelId, perubahan = {}) {
  await siap();
  const semua = baca(KUNCI.progres, []);
  let p = semua.find((x) => x.siswaId === siswaId && x.levelId === levelId);
  if (!p) {
    p = { siswaId, levelId, ...PROGRES_KOSONG };
    semua.push(p);
  }
  const { siswaId: _a, levelId: _b, ...isi } = perubahan;
  Object.assign(p, isi, { diperbarui: sekarang() });
  if ('nilai' in isi) p.nilai = Math.min(100, Math.max(0, Math.round(Number(p.nilai) || 0)));
  if ('bintang' in isi) p.bintang = Math.min(3, Math.max(0, Math.round(Number(p.bintang) || 0)));
  tulis(KUNCI.progres, semua);
  return salin(p);
}

export async function hapusProgres(siswaId, levelId = null) {
  await siap();
  const semua = baca(KUNCI.progres, []);
  tulis(KUNCI.progres, semua.filter((p) => !(p.siswaId === siswaId && (!levelId || p.levelId === levelId))));
  return true;
}

/**
 * Catat satu kali menekan Jalankan.
 * hasil: { berhasil, bintang, nilai, kode, detik, judul }
 * Menyimpan bintang & nilai terbaik, kode terakhir, lama bermain, memberi koin, dan mencatat aktivitas.
 * Hasil: { progres, koinDidapat, pertamaKali, bintangLama, siswa }
 */
export async function catatPercobaan(siswaId, levelId, hasil) {
  await siap();
  const semua = baca(KUNCI.progres, []);
  let p = semua.find((x) => x.siswaId === siswaId && x.levelId === levelId);
  if (!p) {
    p = { siswaId, levelId, ...PROGRES_KOSONG };
    semua.push(p);
  }
  const bintangLama = p.bintang || 0;
  const pertamaKali = !!hasil.berhasil && !p.selesai;
  p.percobaan = (p.percobaan || 0) + 1;
  p.kodeTerakhir = String(hasil.kode ?? '');
  p.detik = (p.detik || 0) + Math.max(0, Math.round(Number(hasil.detik) || 0));
  let koinDidapat = 0;
  if (hasil.berhasil) {
    const bintang = Math.min(3, Math.max(1, Math.round(hasil.bintang || 1)));
    koinDidapat = hitungKoin({ pertamaKali, bintangLama, bintangBaru: bintang });
    p.selesai = true;
    p.bintang = Math.max(bintangLama, bintang);
    p.nilai = Math.max(p.nilai || 0, Math.min(100, Math.round(hasil.nilai || 0)));
  }
  p.diperbarui = sekarang();
  tulis(KUNCI.progres, semua);

  const judul = hasil.judul || levelId;
  tambahAktivitas(siswaId, hasil.berhasil ? 'selesai' : 'coba', hasil.berhasil
    ? `Menyelesaikan level ${judul} dengan ${hasil.bintang} bintang`
    : `Mencoba level ${judul} (belum berhasil)`);

  let siswa = null;
  if (koinDidapat > 0) {
    const daftar = baca(KUNCI.siswa, []);
    const s = daftar.find((x) => x.id === siswaId);
    if (s) {
      s.koin = (s.koin || 0) + koinDidapat;
      tulis(KUNCI.siswa, daftar);
      siswa = tanpaRahasia(s);
    }
  }
  return { progres: salin(p), koinDidapat, pertamaKali, bintangLama, siswa };
}

/** Tambah lama bermain (detik) tanpa menambah percobaan, mis. saat meninggalkan halaman level. */
export async function tambahLamaBermain(siswaId, levelId, detik) {
  await siap();
  const d = Math.max(0, Math.round(Number(detik) || 0));
  if (!d) return null;
  const semua = baca(KUNCI.progres, []);
  let p = semua.find((x) => x.siswaId === siswaId && x.levelId === levelId);
  if (!p) {
    p = { siswaId, levelId, ...PROGRES_KOSONG };
    semua.push(p);
  }
  p.detik = (p.detik || 0) + d;
  p.diperbarui = sekarang();
  tulis(KUNCI.progres, semua);
  return salin(p);
}

// =====================================================================
// Draf kode (disimpan otomatis saat mengetik)
// =====================================================================
export async function getDrafKode(siswaId, levelId) {
  await siap();
  const semua = baca(KUNCI.draf, {});
  return semua[`${siswaId}|${levelId}`] ?? null;
}

export async function simpanDrafKode(siswaId, levelId, kode) {
  await siap();
  const semua = baca(KUNCI.draf, {});
  semua[`${siswaId}|${levelId}`] = String(kode ?? '').slice(0, 20000);
  // Ditulis langsung tanpa event agar tidak memicu gambar ulang di setiap ketikan
  try { localStorage.setItem(AWALAN + KUNCI.draf, JSON.stringify(semua)); } catch { /* abaikan */ }
  return true;
}

// =====================================================================
// Preferensi tampilan per perangkat (kecepatan, petak, bantu ketik)
// =====================================================================
export async function getPreferensi() {
  await siap();
  return baca(KUNCI.preferensi, {});
}

export async function simpanPreferensi(perubahan) {
  await siap();
  const pref = { ...baca(KUNCI.preferensi, {}), ...perubahan };
  try { localStorage.setItem(AWALAN + KUNCI.preferensi, JSON.stringify(pref)); } catch { /* abaikan */ }
  return pref;
}

// =====================================================================
// Aktivitas
// =====================================================================
function tambahAktivitas(siswaId, jenis, keterangan) {
  const semua = baca(KUNCI.aktivitas, []);
  const baru = { waktu: sekarang(), siswaId, jenis, keterangan };
  semua.unshift(baru);
  tulis(KUNCI.aktivitas, semua.slice(0, BATAS_AKTIVITAS));
  return baru;
}

export async function catatAktivitas(siswaId, jenis, keterangan = '') {
  await siap();
  return salin(tambahAktivitas(siswaId, jenis, keterangan));
}

/** filter: { siswaId, siswaIds, batas } — hasil terbaru di depan */
export async function getAktivitas({ siswaId, siswaIds, batas = 50 } = {}) {
  await siap();
  return salin(baca(KUNCI.aktivitas, []))
    .filter((a) => (!siswaId || a.siswaId === siswaId) && (!siswaIds || siswaIds.includes(a.siswaId)))
    .slice(0, batas);
}

export async function hapusAktivitas({ siswaId } = {}) {
  await siap();
  tulis(KUNCI.aktivitas, siswaId ? baca(KUNCI.aktivitas, []).filter((a) => a.siswaId !== siswaId) : []);
  return true;
}
