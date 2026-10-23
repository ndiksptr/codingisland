// js/store-lokal.js — VERSI DEMO (localStorage) dari store.js, disimpan sebagai acuan.
// Tidak dipakai aplikasi. Dipakai scripts/buat-schema.mjs untuk membuat data awal schema.sql
// sehingga data contoh di D1 sama persis dengan versi demo.
//
// (Isi asli:) js/store.js — satu-satunya pintu akses data Coding Island
// Sekarang memakai localStorage (awalan kunci 'ci_'). Nanti cukup modul ini
// yang diganti menjadi fetch() ke Cloudflare Pages Functions + D1.
// Semua fungsi publik async dan mengembalikan salinan data, bukan objek asli.
// Data rahasia (passwordHash, pinHash, salt) tidak pernah keluar dari modul ini.
//
// Setiap kali data berubah, modul ini mengirim event di window:
//   window.addEventListener('ci:berubah', (e) => e.detail.entitas)  // 'siswa', 'sesi', ...

import { LEVEL_AWAL } from './data/levels.js';
import { ZONA } from './data/zona.js';
import { hitungKoin, CLUE, BERLIAN_BOSS } from './game/skor.js';
import { alasanBelumSiap } from './game/validasi-level.js';
import { SEMUA_PERINTAH } from './game/interpreter.js';

const AWALAN = 'ci_';
const VERSI_DATA = 5;        // naikkan jika bentuk data berubah
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
  preferensi: 'preferensi',
  catatan: 'catatan',
  pengaturan: 'pengaturan',
  nilaiTimpa: 'nilai_timpa'
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
  try {
    const daftar = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(AWALAN)) daftar.push(k);
    }
    daftar.forEach((k) => localStorage.removeItem(k));
  } catch { /* penyimpanan diblokir: tidak ada yang bisa dihapus */ }
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
        if (level.jenis === 'boss') berlian += BERLIAN_BOSS; // hadiah boss
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

// Migrasi ringan: perbarui isi level bawaan tanpa menghapus akun, progres, dan level buatan guru.
// Status terbit, urutan, dan kelas nonaktif yang diatur guru/admin tetap dipertahankan.
function migrasiData() {
  const level = baca(KUNCI.level, []);
  for (const awal of LEVEL_AWAL) {
    const i = level.findIndex((l) => l.id === awal.id);
    if (i >= 0) {
      const lama = level[i];
      level[i] = {
        ...lama,
        ...salin(awal),
        ...(lama.terbit === false ? { terbit: false } : {}),
        ...(lama.urutan != null ? { urutan: lama.urutan } : {}),
        ...(lama.kelasNonaktif ? { kelasNonaktif: lama.kelasNonaktif } : {})
      };
    } else level.push(salin(awal));
  }
  for (const z of ZONA) rapikanUrutan(level, z.id);
  tulis(KUNCI.level, level);
  tulis(KUNCI.versi, VERSI_DATA);
}

/** Level terlihat oleh siswa di kelas ini? (terbit, kelas tujuan cocok, tidak dinonaktifkan untuk kelas itu) */
function levelTerlihatUntukKelas(l, kelasId) {
  return l.terbit !== false &&
    (!l.kelasIds || l.kelasIds.includes(kelasId)) &&
    !(l.kelasNonaktif || []).includes(kelasId);
}

/** Urutkan ulang level satu zona menjadi 1..n dengan boss selalu di akhir. */
function rapikanUrutan(levels, zona) {
  const z = levels.filter((l) => l.zona === zona).sort((p, q) => (p.urutan ?? 0) - (q.urutan ?? 0));
  [...z.filter((l) => l.jenis !== 'boss'), ...z.filter((l) => l.jenis === 'boss')]
    .forEach((l, i) => { l.urutan = i + 1; });
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

// Saran username sinkron (dipakai pendaftaran, tambah siswa oleh guru, dan impor CSV)
function buatSaranUsername(namaPanggilan) {
  let dasar = String(namaPanggilan || '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').slice(0, 12);
  if (!dasar) dasar = 'robot';
  if (dasar.length < 2) dasar = `${dasar}${dasar}`;
  const dipakai = new Set(baca(KUNCI.siswa, []).map((s) => s.username));
  for (let i = 0; i < 50; i++) {
    const angka = i < 30 ? 10 + Math.floor(Math.random() * 90) : 100 + Math.floor(Math.random() * 900);
    const calon = `${dasar}${angka}`;
    if (!dipakai.has(calon)) return calon;
  }
  return `${dasar}${Date.now() % 10000}`;
}

/** Saran username: nama panggilan + angka, dijamin belum dipakai. */
export async function sarankanUsername(namaPanggilan) {
  await siap();
  return buatSaranUsername(namaPanggilan);
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
    koin: bacaPengaturan().koinAwal,
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
    username: d.username, pinHash: hash, salt, koin: bacaPengaturan().koinAwal, berlian: 0,
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
  return semua.filter((l) => (kelasId ? levelTerlihatUntukKelas(l, kelasId) : l.terbit !== false));
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

// Boss zona terakhir: menyelesaikannya berarti tamat (juara)
const idBossTerakhir = () => {
  const zonaAkhir = ZONA[ZONA.length - 1].id;
  return baca(KUNCI.level, []).filter((l) => l.zona === zonaAkhir && l.jenis === 'boss').map((l) => l.id);
};

/**
 * Catat satu kali menekan Jalankan.
 * hasil: { berhasil, bintang, nilai, kode, detik, judul }
 * Menyimpan bintang & nilai terbaik, kode terakhir, lama bermain, memberi koin
 * (dan 3 berlian saat boss pertama kali selesai), lalu mencatat aktivitas.
 * Hasil: { progres, koinDidapat, berlianDidapat, pertamaKali, bintangLama, juara, siswa }
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
  let berlianDidapat = 0;
  const level = baca(KUNCI.level, []).find((l) => l.id === levelId);
  if (hasil.berhasil) {
    const bintang = Math.min(3, Math.max(1, Math.round(hasil.bintang || 1)));
    koinDidapat = hitungKoin({ pertamaKali, bintangLama, bintangBaru: bintang });
    if (pertamaKali) {
      p.selesaiPada = sekarang();
      if (level?.jenis === 'boss') berlianDidapat = BERLIAN_BOSS;
    }
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
  if (koinDidapat > 0 || berlianDidapat > 0) {
    const daftar = baca(KUNCI.siswa, []);
    const s = daftar.find((x) => x.id === siswaId);
    if (s) {
      s.koin = (s.koin || 0) + koinDidapat;
      s.berlian = (s.berlian || 0) + berlianDidapat;
      tulis(KUNCI.siswa, daftar);
      siswa = tanpaRahasia(s);
    }
  }
  if (berlianDidapat) tambahAktivitas(siswaId, 'piala', `Mengalahkan ${judul} dan mendapat piala`);
  const juara = !!hasil.berhasil && pertamaKali && idBossTerakhir().includes(levelId);
  if (juara) tambahAktivitas(siswaId, 'juara', 'Menjadi Juara Coding Island');
  return { progres: salin(p), koinDidapat, berlianDidapat, pertamaKali, bintangLama, juara, siswa };
}

/**
 * Beli clue untuk satu level. Clue harus dibeli berurutan (1, 2, lalu 3).
 * Clue yang sudah dibeli bisa dibuka lagi tanpa bayar.
 * Hasil: { ok: true, clueDibeli, siswa, dibayar } atau { ok: false, alasan: 'koin' | 'urutan', kurang, pesan }
 */
export async function beliClue(siswaId, levelId, nomor) {
  await siap();
  const clue = CLUE.find((c) => c.nomor === nomor);
  if (!clue) return { ok: false, alasan: 'urutan', pesan: 'Clue tidak ada.' };

  const semuaProgres = baca(KUNCI.progres, []);
  let p = semuaProgres.find((x) => x.siswaId === siswaId && x.levelId === levelId);
  const sudah = p?.clueDibeli || 0;
  const daftar = baca(KUNCI.siswa, []);
  const s = daftar.find((x) => x.id === siswaId);
  if (!s) throw new Error('Siswa tidak ditemukan.');

  if (nomor <= sudah) return { ok: true, clueDibeli: sudah, siswa: tanpaRahasia(s), dibayar: 0 };
  if (nomor !== sudah + 1) return { ok: false, alasan: 'urutan', pesan: `Beli Clue ${sudah + 1} dulu ya.` };
  const harga = bacaPengaturan().hargaClue[nomor - 1];
  if ((s.koin || 0) < harga) {
    return {
      ok: false,
      alasan: 'koin',
      kurang: harga - (s.koin || 0),
      pesan: 'Koinmu belum cukup. Selesaikan atau ulangi level lain untuk mengumpulkan koin.'
    };
  }

  s.koin -= harga;
  tulis(KUNCI.siswa, daftar);
  if (!p) {
    p = { siswaId, levelId, ...PROGRES_KOSONG };
    semuaProgres.push(p);
  }
  p.clueDibeli = nomor;
  p.diperbarui = sekarang();
  tulis(KUNCI.progres, semuaProgres);
  const judul = baca(KUNCI.level, []).find((l) => l.id === levelId)?.judul || levelId;
  tambahAktivitas(siswaId, 'clue', `Membeli Clue ${nomor} di level ${judul}`);
  return { ok: true, clueDibeli: nomor, siswa: tanpaRahasia(s), dibayar: harga };
}

/**
 * Data sertifikat juara, atau null jika boss zona terakhir belum selesai.
 * Hasil: { namaLengkap, kelas, totalBintang, maksBintang, tanggal }
 */
export async function getRingkasanJuara(siswaId) {
  await siap();
  const siswa = baca(KUNCI.siswa, []).find((s) => s.id === siswaId);
  if (!siswa) return null;
  const progres = baca(KUNCI.progres, []).filter((p) => p.siswaId === siswaId);
  const bossAkhir = progres.find((p) => idBossTerakhir().includes(p.levelId) && p.selesai);
  if (!bossAkhir) return null;
  const level = baca(KUNCI.level, []).filter((l) => levelTerlihatUntukKelas(l, siswa.kelasId));
  const idLevel = new Set(level.map((l) => l.id));
  const kelas = baca(KUNCI.kelas, []).find((k) => k.id === siswa.kelasId);
  return {
    namaLengkap: siswa.namaLengkap,
    kelas: kelas?.nama || '-',
    totalBintang: progres.filter((p) => p.selesai && idLevel.has(p.levelId)).reduce((n, p) => n + (p.bintang || 0), 0),
    maksBintang: level.length * 3,
    tanggal: bossAkhir.selesaiPada || bossAkhir.diperbarui
  };
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


// =====================================================================
// Pengaturan permainan (diubah admin)
// =====================================================================
const PENGATURAN_BAWAAN = { hargaClue: CLUE.map((c) => c.harga), koinAwal: KOIN_AWAL };

function bacaPengaturan() {
  const p = baca(KUNCI.pengaturan, {});
  return {
    hargaClue: Array.isArray(p.hargaClue) && p.hargaClue.length === 3 ? p.hargaClue.slice() : PENGATURAN_BAWAAN.hargaClue.slice(),
    koinAwal: Number.isInteger(p.koinAwal) ? p.koinAwal : PENGATURAN_BAWAAN.koinAwal
  };
}

/** Harga Clue 1–3 yang berlaku sekarang (boleh dibaca siapa saja). */
export async function getHargaClue() {
  await siap();
  return bacaPengaturan().hargaClue;
}

// =====================================================================
// API DASHBOARD GURU
// Semua fungsi guru*/admin* membaca sesi guru yang sedang masuk dan MEMBATASI data
// pada kelas yang diampu guru tersebut (admin: semua kelas). Saat store ini diganti
// API Cloudflare Pages Functions + D1, pemeriksaan yang sama dilakukan di server.
// =====================================================================
const HARI_MS = 864e5;

function aksesGuru() {
  const sesi = baca(KUNCI.sesi, null);
  if (!sesi || sesi.jenis !== 'guru' || Date.now() > sesi.kadaluarsa) {
    throw new Error('Sesi guru sudah berakhir. Silakan masuk lagi.');
  }
  const guru = baca(KUNCI.guru, []).find((g) => g.id === sesi.id);
  if (!guru) throw new Error('Akun guru tidak ditemukan.');
  const admin = guru.peran === 'admin';
  const semuaKelas = baca(KUNCI.kelas, []);
  const kelas = admin ? semuaKelas : semuaKelas.filter((k) => guru.kelasIds.includes(k.id));
  return { guru, admin, kelas, kelasIds: new Set(kelas.map((k) => k.id)) };
}

function wajibAdmin(a) {
  if (!a.admin) throw new Error('Fitur ini khusus admin.');
}

function bolehKelas(a, kelasId) {
  if (!a.kelasIds.has(kelasId)) throw new Error('Kelas ini bukan kelas yang Anda ampu.');
}

// Filter kelas opsional; tetap harus di dalam akses
function saringKelas(a, kelasId) {
  if (!kelasId) return null;
  bolehKelas(a, kelasId);
  return kelasId;
}

// Siswa yang boleh dilihat (admin juga melihat siswa tanpa kelas)
function siswaDalamAkses(a, kelasId = null) {
  return baca(KUNCI.siswa, []).filter((s) =>
    (kelasId ? s.kelasId === kelasId : (a.admin || a.kelasIds.has(s.kelasId))));
}

function ambilSiswaBoleh(a, id) {
  const s = baca(KUNCI.siswa, []).find((x) => x.id === id);
  if (!s || !(a.admin || a.kelasIds.has(s.kelasId))) throw new Error('Siswa tidak ditemukan di kelas Anda.');
  return s;
}

const urutKelas = (x, y) => x.tingkat - y.tingkat || x.nama.localeCompare(y.nama);

function acakPin() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 10000).padStart(4, '0');
}

function acakPassword() {
  const huruf = 'abcdefghjkmnpqrstuvwxyz23456789';
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return [...a].map((n) => huruf[n % huruf.length]).join('');
}

function levelUntukKelas(levels, kelasId) {
  return levels.filter((l) => levelTerlihatUntukKelas(l, kelasId));
}

/**
 * Statistik per siswa. Nilai siswa = rata-rata nilai level yang sudah selesai.
 * Terakhir aktif = waktu terbaru dari aktivitas, progres, atau tanggal daftar.
 */
function hitungStatistik(daftarSiswa) {
  const levels = baca(KUNCI.level, []);
  const progres = baca(KUNCI.progres, []);
  const kelas = baca(KUNCI.kelas, []);
  const terakhir = new Map();
  for (const a of baca(KUNCI.aktivitas, [])) if (!terakhir.has(a.siswaId)) terakhir.set(a.siswaId, a.waktu); // terbaru di depan
  return daftarSiswa.map((s) => {
    const lv = levelUntukKelas(levels, s.kelasId);
    const ids = new Set(lv.map((l) => l.id));
    const pr = progres.filter((p) => p.siswaId === s.id && ids.has(p.levelId));
    const selesai = pr.filter((p) => p.selesai);
    const waktu = [terakhir.get(s.id), s.dibuatPada, ...pr.map((p) => p.diperbarui)].filter(Boolean).sort();
    return {
      siswa: s,
      levels: lv,
      progres: pr,
      baris: {
        id: s.id,
        namaLengkap: s.namaLengkap,
        namaPanggilan: s.namaPanggilan,
        avatar: s.avatar,
        jenisKelamin: s.jenisKelamin,
        kelasId: s.kelasId,
        kelasNama: kelas.find((k) => k.id === s.kelasId)?.nama || 'Tanpa kelas',
        username: s.username,
        koin: s.koin || 0,
        berlian: s.berlian || 0,
        levelSelesai: selesai.length,
        totalLevel: lv.length,
        totalBintang: selesai.reduce((n, p) => n + (p.bintang || 0), 0),
        nilai: selesai.length ? Math.round(selesai.reduce((n, p) => n + (p.nilai || 0), 0) / selesai.length) : 0,
        terakhirAktif: waktu[waktu.length - 1] || null,
        dibuatPada: s.dibuatPada
      }
    };
  });
}

const rataRata = (angka) => (angka.length ? Math.round(angka.reduce((n, x) => n + x, 0) / angka.length) : 0);

/** Profil guru yang masuk, kelas yang boleh diakses, dan pengaturan. */
export async function guruKonteks() {
  await siap();
  const a = aksesGuru();
  return {
    guru: tanpaRahasia(a.guru),
    admin: a.admin,
    kelas: a.kelas.map(salin).sort(urutKelas),
    pengaturan: bacaPengaturan()
  };
}

/** Data halaman Ringkasan. filter: { kelasId } */
export async function guruRingkasan({ kelasId } = {}) {
  await siap();
  const a = aksesGuru();
  const k = saringKelas(a, kelasId);
  const kelasDipakai = k ? a.kelas.filter((x) => x.id === k) : a.kelas;
  const stat = hitungStatistik(siswaDalamAkses(a, k));
  const levels = baca(KUNCI.level, []);
  const sekarangMs = Date.now();
  const batas7 = sekarangMs - 7 * HARI_MS;

  const levelTerbit = levels.filter((l) => kelasDipakai.some((kk) => levelTerlihatUntukKelas(l, kk.id))).length;

  // Siswa yang perlu bantuan: macet (>= 5 percobaan tanpa selesai) atau tidak aktif 7 hari
  const perluBantuan = [];
  for (const x of stat) {
    const alasan = [];
    let macet = false;
    for (const p of x.progres.filter((pp) => !pp.selesai && (pp.percobaan || 0) >= 5)) {
      const judul = levels.find((l) => l.id === p.levelId)?.judul || p.levelId;
      alasan.push(`${p.percobaan} kali mencoba "${judul}" tetapi belum selesai`);
      macet = true;
    }
    const terakhirMs = x.baris.terakhirAktif ? Date.parse(x.baris.terakhirAktif) : 0;
    const hariDiam = Math.floor((sekarangMs - terakhirMs) / HARI_MS);
    if (terakhirMs < batas7) alasan.push(`Tidak aktif ${hariDiam} hari`);
    if (alasan.length) perluBantuan.push({ ...x.baris, alasan, macet, hariDiam });
  }
  perluBantuan.sort((p, q) => Number(q.macet) - Number(p.macet) || q.hariDiam - p.hariDiam);

  // Rata-rata progres per zona (persen level selesai)
  const progresZona = ZONA.map((z) => {
    const persen = stat.map((x) => {
      const lvZ = x.levels.filter((l) => l.zona === z.id);
      if (!lvZ.length) return 0;
      const selesai = x.progres.filter((p) => p.selesai && lvZ.some((l) => l.id === p.levelId)).length;
      return (selesai / lvZ.length) * 100;
    });
    return { id: z.id, nama: z.nama, warna: z.warna, persen: rataRata(persen) };
  });

  const peta = new Map(stat.map((x) => [x.siswa.id, x.baris]));
  const aktivitas = baca(KUNCI.aktivitas, [])
    .filter((ak) => peta.has(ak.siswaId))
    .slice(0, 10)
    .map((ak) => ({ ...ak, namaSiswa: peta.get(ak.siswaId).namaPanggilan, kelasNama: peta.get(ak.siswaId).kelasNama }));

  const bernilai = stat.filter((x) => x.baris.levelSelesai > 0).map((x) => x.baris.nilai);
  return {
    statistik: {
      jumlahSiswa: stat.length,
      jumlahKelas: kelasDipakai.length,
      levelTerbit,
      rataNilai: rataRata(bernilai),
      aktif7: stat.filter((x) => x.baris.terakhirAktif && Date.parse(x.baris.terakhirAktif) >= batas7).length
    },
    perluBantuan,
    progresZona,
    aktivitas
  };
}

// ---------- Kelas ----------
export async function guruDaftarKelas() {
  await siap();
  const a = aksesGuru();
  const guruList = baca(KUNCI.guru, []);
  const stat = hitungStatistik(siswaDalamAkses(a));
  return a.kelas.map((k) => {
    const st = stat.filter((x) => x.siswa.kelasId === k.id);
    return {
      ...salin(k),
      guru: k.guruIds.map((id) => guruList.find((g) => g.id === id)).filter(Boolean).map((g) => ({ id: g.id, nama: g.nama })),
      jumlahSiswa: st.length,
      rataNilai: rataRata(st.filter((x) => x.baris.levelSelesai > 0).map((x) => x.baris.nilai))
    };
  }).sort(urutKelas);
}

/** Tambah (tanpa id) atau ubah kelas. guruIds hanya dipakai jika admin. */
export async function guruSimpanKelas(data) {
  await siap();
  const a = aksesGuru();
  const isi = {
    nama: data.nama,
    tingkat: Number(data.tingkat),
    ...(data.kodeKelas ? { kodeKelas: data.kodeKelas } : {})
  };
  if (data.id) {
    bolehKelas(a, data.id);
    if (a.admin && Array.isArray(data.guruIds)) isi.guruIds = data.guruIds;
    return ubahKelas(data.id, isi);
  }
  // Guru biasa otomatis menjadi pengampu kelas yang dibuatnya
  isi.guruIds = a.admin ? (data.guruIds || []) : [a.guru.id];
  return tambahKelas(isi);
}

export async function guruKodeKelasBaru(kelasId) {
  await siap();
  const a = aksesGuru();
  bolehKelas(a, kelasId);
  const kode = await buatKodeKelas();
  await ubahKelas(kelasId, { kodeKelas: kode });
  return kode;
}

/** Hapus kelas, hanya jika tidak ada siswanya. */
export async function guruHapusKelas(kelasId) {
  await siap();
  const a = aksesGuru();
  bolehKelas(a, kelasId);
  if (baca(KUNCI.siswa, []).some((s) => s.kelasId === kelasId)) {
    throw new Error('Kelas masih berisi siswa. Pindahkan atau hapus siswanya dulu.');
  }
  return hapusKelas(kelasId);
}

// ---------- Siswa ----------
/** Daftar siswa beserta statistik. filter: { kelasId } */
export async function guruDaftarSiswa({ kelasId } = {}) {
  await siap();
  const a = aksesGuru();
  const k = saringKelas(a, kelasId);
  return hitungStatistik(siswaDalamAkses(a, k)).map((x) => x.baris);
}

/** Detail satu siswa: profil, progres per zona, progres per level (termasuk kode terakhir), dan catatan guru. */
export async function guruDetailSiswa(siswaId) {
  await siap();
  const a = aksesGuru();
  const s = ambilSiswaBoleh(a, siswaId);
  const [x] = hitungStatistik([s]);
  const peta = new Map(x.progres.map((p) => [p.levelId, p]));
  const urutZona = (l) => ZONA.findIndex((z) => z.id === l.zona);
  const levels = x.levels.slice().sort((p, q) => urutZona(p) - urutZona(q) || (p.urutan ?? 0) - (q.urutan ?? 0));
  const catatan = baca(KUNCI.catatan, {})[siswaId] || null;
  return {
    siswa: x.baris,
    zona: ZONA.map((z) => {
      const lvZ = levels.filter((l) => l.zona === z.id);
      const selesai = lvZ.filter((l) => peta.get(l.id)?.selesai).length;
      return { id: z.id, nama: z.nama, warna: z.warna, selesai, total: lvZ.length, persen: lvZ.length ? Math.round((selesai / lvZ.length) * 100) : 0 };
    }),
    levels: levels.map((l) => {
      const p = peta.get(l.id);
      return {
        id: l.id, zona: l.zona, urutan: l.urutan, judul: l.judul, jenis: l.jenis,
        selesai: !!p?.selesai, bintang: p?.bintang || 0, nilai: p?.nilai || 0, percobaan: p?.percobaan || 0,
        clueDibeli: p?.clueDibeli || 0, detik: p?.detik || 0, diperbarui: p?.diperbarui || null,
        kodeTerakhir: p?.kodeTerakhir || ''
      };
    }),
    catatan: catatan ? salin(catatan) : null
  };
}

export async function guruSimpanCatatan(siswaId, teks) {
  await siap();
  const a = aksesGuru();
  ambilSiswaBoleh(a, siswaId);
  const semua = baca(KUNCI.catatan, {});
  semua[siswaId] = { teks: String(teks || '').slice(0, 4000), diperbarui: sekarang(), guruId: a.guru.id, guruNama: a.guru.nama };
  tulis(KUNCI.catatan, semua);
  return salin(semua[siswaId]);
}

/**
 * Tambah siswa oleh guru. Username dibuat otomatis jika kosong, PIN 4 angka selalu acak.
 * Hasil: { siswa, pin } (PIN hanya dikembalikan sekali untuk dicatat guru)
 */
export async function guruTambahSiswa(data) {
  await siap();
  const a = aksesGuru();
  bolehKelas(a, data.kelasId);
  const pin = acakPin();
  const avatar = data.avatar || (data.jenisKelamin === 'P' ? 'wanita' : 'pria');
  const username = String(data.username || '').trim().toLowerCase() || buatSaranUsername(data.namaPanggilan);
  const siswa = await tambahSiswa({ ...data, avatar, username, pin });
  tambahAktivitas(siswa.id, 'daftar', `Didaftarkan oleh ${a.guru.nama}`);
  return { siswa, pin };
}

export async function guruUbahSiswa(siswaId, perubahan) {
  await siap();
  const a = aksesGuru();
  ambilSiswaBoleh(a, siswaId);
  const boleh = {};
  for (const kunci of ['namaLengkap', 'namaPanggilan', 'avatar', 'kelasId', 'username']) {
    if (kunci in perubahan) boleh[kunci] = perubahan[kunci];
  }
  if ('kelasId' in boleh) bolehKelas(a, boleh.kelasId);
  return ubahSiswa(siswaId, boleh);
}

export async function guruPindahKelas(siswaId, kelasId) {
  return guruUbahSiswa(siswaId, { kelasId });
}

/** PIN baru 4 angka acak, dikembalikan sekali untuk dicatat guru. */
export async function guruResetPin(siswaId) {
  await siap();
  const a = aksesGuru();
  ambilSiswaBoleh(a, siswaId);
  const pin = acakPin();
  await ubahSiswa(siswaId, { pin });
  return pin;
}

export async function guruHapusSiswa(siswaId) {
  await siap();
  const a = aksesGuru();
  ambilSiswaBoleh(a, siswaId);
  const catatan = baca(KUNCI.catatan, {});
  if (catatan[siswaId]) { delete catatan[siswaId]; tulis(KUNCI.catatan, catatan); }
  return hapusSiswa(siswaId);
}

// ---------- Impor CSV ----------
const normalNamaKelas = (t) => String(t || '').toLowerCase().replace(/kelas/g, '').replace(/[^a-z0-9]/g, '');

function normalJenisKelamin(t) {
  const v = String(t || '').trim().toLowerCase();
  if (['l', 'lk', 'laki', 'laki-laki', 'laki laki', 'pria', 'putra'].includes(v)) return 'L';
  if (['p', 'pr', 'perempuan', 'wanita', 'putri'].includes(v)) return 'P';
  return null;
}

function periksaBarisImpor(a, baris, nomor) {
  const namaLengkap = String(baris.namaLengkap || '').trim().replace(/\s+/g, ' ');
  const namaPanggilan = String(baris.namaPanggilan || '').trim() || namaLengkap.split(' ')[0] || '';
  const jenisKelamin = normalJenisKelamin(baris.jenisKelamin);
  const kelas = a.kelas.find((k) => normalNamaKelas(k.nama) === normalNamaKelas(baris.kelas));
  const masalah = [];
  const p1 = periksaKolomSiswa('namaLengkap', namaLengkap);
  if (p1) masalah.push(p1);
  const p2 = periksaKolomSiswa('namaPanggilan', namaPanggilan);
  if (p2) masalah.push(`Nama panggilan: ${p2}`);
  if (!jenisKelamin) masalah.push('Jenis kelamin harus L atau P.');
  if (!kelas) masalah.push(`Kelas "${baris.kelas || ''}" tidak ditemukan atau bukan kelas Anda.`);
  return {
    nomor,
    data: { namaLengkap, namaPanggilan, jenisKelamin, kelasId: kelas?.id || null, kelasNama: kelas?.nama || String(baris.kelas || '') },
    ok: masalah.length === 0,
    pesan: masalah.join(' ')
  };
}

/** Periksa baris CSV tanpa membuat akun. baris: [{ namaLengkap, namaPanggilan, jenisKelamin, kelas }] */
export async function guruPratinjauImpor(baris) {
  await siap();
  const a = aksesGuru();
  return baris.map((b, i) => periksaBarisImpor(a, b, i + 1));
}

/** Buat akun untuk baris yang valid. Hasil per baris: { nomor, ok, pesan, data, username, pin } */
export async function guruImporSiswa(baris) {
  await siap();
  const a = aksesGuru();
  const hasil = [];
  for (const [i, b] of baris.entries()) {
    const cek = periksaBarisImpor(a, b, i + 1);
    if (!cek.ok) { hasil.push(cek); continue; }
    try {
      const { siswa, pin } = await guruTambahSiswa({
        namaLengkap: cek.data.namaLengkap,
        namaPanggilan: cek.data.namaPanggilan,
        avatar: cek.data.jenisKelamin === 'P' ? 'wanita' : 'pria',
        kelasId: cek.data.kelasId
      });
      hasil.push({ ...cek, username: siswa.username, pin });
    } catch (err) {
      hasil.push({ ...cek, ok: false, pesan: err.message });
    }
  }
  return hasil;
}

// ---------- Aktivitas ----------
/** filter: { kelasId, siswaId, jenis, batas } */
export async function guruAktivitas({ kelasId, siswaId, jenis, batas = 200 } = {}) {
  await siap();
  const a = aksesGuru();
  const k = saringKelas(a, kelasId);
  const stat = hitungStatistik(siswaDalamAkses(a, k));
  const peta = new Map(stat.map((x) => [x.siswa.id, x.baris]));
  if (siswaId && !peta.has(siswaId)) throw new Error('Siswa tidak ditemukan di kelas Anda.');
  const semua = baca(KUNCI.aktivitas, []).filter((ak) =>
    peta.has(ak.siswaId) && (!siswaId || ak.siswaId === siswaId) && (!jenis || ak.jenis === jenis));
  return {
    total: semua.length,
    daftar: semua.slice(0, batas).map((ak) => ({
      ...ak,
      namaSiswa: peta.get(ak.siswaId).namaLengkap,
      kelasNama: peta.get(ak.siswaId).kelasNama
    }))
  };
}

// ---------- Pengaturan akun sendiri ----------
export async function guruUbahNama(nama) {
  await siap();
  const a = aksesGuru();
  return ubahGuru(a.guru.id, { nama });
}

export async function guruUbahPassword(passwordLama, passwordBaru) {
  await siap();
  const a = aksesGuru();
  if (!(await cocokRahasia(passwordLama, a.guru.salt, a.guru.passwordHash))) throw new Error('Password lama salah.');
  if (String(passwordBaru || '').length < 6) throw new Error('Password baru minimal 6 karakter.');
  await ubahGuru(a.guru.id, { password: passwordBaru });
  return true;
}

// ---------- Khusus admin ----------
export async function adminSimpanPengaturan({ hargaClue, koinAwal }) {
  await siap();
  wajibAdmin(aksesGuru());
  const harga = (hargaClue || []).map((h) => Math.round(Number(h)));
  if (harga.length !== 3 || harga.some((h) => !Number.isFinite(h) || h < 0 || h > 999)) throw new Error('Harga clue harus angka 0–999.');
  const koin = Math.round(Number(koinAwal));
  if (!Number.isFinite(koin) || koin < 0 || koin > 999) throw new Error('Koin awal harus angka 0–999.');
  tulis(KUNCI.pengaturan, { hargaClue: harga, koinAwal: koin });
  return bacaPengaturan();
}

export async function adminDaftarGuru() {
  await siap();
  wajibAdmin(aksesGuru());
  const kelas = baca(KUNCI.kelas, []);
  return baca(KUNCI.guru, []).map((g) => ({
    ...tanpaRahasia(g),
    kelas: g.kelasIds.map((id) => kelas.find((k) => k.id === id)).filter(Boolean).sort(urutKelas).map((k) => ({ id: k.id, nama: k.nama }))
  })).sort((p, q) => (p.peran === q.peran ? p.nama.localeCompare(q.nama) : p.peran === 'admin' ? -1 : 1));
}

/** Tambah (tanpa id, wajib password) atau ubah guru. */
export async function adminSimpanGuru(data) {
  await siap();
  const a = aksesGuru();
  wajibAdmin(a);
  if (data.id) {
    if (data.id === a.guru.id && data.peran && data.peran !== 'admin') throw new Error('Anda tidak bisa menurunkan peran akun sendiri.');
    const perubahan = {};
    for (const kunci of ['nama', 'username', 'peran', 'kelasIds']) if (kunci in data) perubahan[kunci] = data[kunci];
    return ubahGuru(data.id, perubahan);
  }
  return tambahGuru(data);
}

export async function adminHapusGuru(guruId) {
  await siap();
  const a = aksesGuru();
  wajibAdmin(a);
  if (guruId === a.guru.id) throw new Error('Anda tidak bisa menghapus akun sendiri.');
  return hapusGuru(guruId);
}

/** Password baru acak 8 karakter, dikembalikan sekali untuk dicatat admin. */
export async function adminResetPasswordGuru(guruId) {
  await siap();
  wajibAdmin(aksesGuru());
  const password = acakPassword();
  await ubahGuru(guruId, { password });
  return password;
}


// =====================================================================
// API LEVEL & SOAL (dashboard guru)
// Guru melihat level bawaan + level yang ditujukan ke kelasnya + level buatannya sendiri.
// Guru hanya bisa mengubah level buatannya; level bawaan hanya bisa diubah admin dan tidak
// bisa dihapus (guru menonaktifkannya untuk kelasnya, admin menonaktifkannya untuk semua).
// =====================================================================
const BATAS_TEKS = 5000;

function levelBolehDilihat(a, l) {
  return !!l.bawaan || a.admin || l.pembuat?.id === a.guru.id || (l.kelasIds || []).some((k) => a.kelasIds.has(k));
}

function levelBolehDiubah(a, l) {
  return a.admin || (!l.bawaan && l.pembuat?.id === a.guru.id);
}

function statusLevelUntuk(a, l) {
  if (!l.bawaan) return l.terbit ? 'terbit' : 'draf';
  if (l.terbit === false) return 'nonaktif';
  if (a.admin) return 'terbit';
  const non = (l.kelasNonaktif || []).filter((k) => a.kelasIds.has(k));
  if (!non.length) return 'terbit';
  return non.length >= a.kelasIds.size ? 'nonaktif' : 'sebagian';
}

function ambilLevelBoleh(a, id) {
  const l = baca(KUNCI.level, []).find((x) => x.id === id);
  if (!l || !levelBolehDilihat(a, l)) throw new Error('Level tidak ditemukan.');
  return l;
}

function ringkasLevel(a, l, kelas) {
  const bisaEdit = levelBolehDiubah(a, l);
  return {
    id: l.id,
    zona: l.zona,
    urutan: l.urutan,
    judul: l.judul,
    jenis: l.jenis,
    tingkat: l.tingkat || [3, 4, 5, 6],
    bawaan: !!l.bawaan,
    status: statusLevelUntuk(a, l),
    kelasIds: l.kelasIds ? l.kelasIds.slice() : null,
    kelas: l.kelasIds ? l.kelasIds.map((id) => kelas.find((k) => k.id === id)?.nama).filter(Boolean) : null,
    pembuat: l.bawaan ? 'Bawaan' : (l.pembuat?.nama || '-'),
    bisaEdit,
    bisaPindah: bisaEdit && l.jenis !== 'boss',
    bisaHapus: !l.bawaan && bisaEdit
  };
}

/** Semua level yang boleh dilihat guru, urut per zona lalu urutan main. */
export async function guruDaftarLevel() {
  await siap();
  const a = aksesGuru();
  const kelas = baca(KUNCI.kelas, []);
  const urutZona = (l) => ZONA.findIndex((z) => z.id === l.zona);
  return baca(KUNCI.level, [])
    .filter((l) => levelBolehDilihat(a, l))
    .sort((p, q) => urutZona(p) - urutZona(q) || (p.urutan ?? 0) - (q.urutan ?? 0))
    .map((l) => ringkasLevel(a, l, kelas));
}

/** Data lengkap satu level (untuk edit atau coba main). */
export async function guruGetLevel(id) {
  await siap();
  const a = aksesGuru();
  const l = ambilLevelBoleh(a, id);
  return { ...salin(l), ...ringkasLevel(a, l, baca(KUNCI.kelas, [])), tingkat: l.tingkat || [3, 4, 5, 6] };
}

function periksaDunia(d) {
  if (!d || !Number.isInteger(d.kolom) || !Number.isInteger(d.baris)) throw new Error('Data panggung tidak lengkap.');
  if (d.kolom < 4 || d.kolom > 12 || d.baris < 3 || d.baris > 8) throw new Error('Ukuran panggung tidak valid.');
  const dalam = (o) => o && Number.isInteger(o.x) && Number.isInteger(o.y) && o.x >= 0 && o.y >= 0 && o.x < d.kolom && o.y < d.baris;
  const robot = dalam(d.robot) ? { x: d.robot.x, y: d.robot.y, arah: ['utara', 'timur', 'selatan', 'barat'].includes(d.robot.arah) ? d.robot.arah : 'timur' } : null;
  return {
    kolom: d.kolom,
    baris: d.baris,
    robot,
    tujuan: dalam(d.tujuan) ? { x: d.tujuan.x, y: d.tujuan.y } : null,
    item: (d.item || []).filter(dalam).map((it) => ({ jenis: it.jenis === 'berlian' ? 'berlian' : 'koin', x: it.x, y: it.y, wajib: it.jenis === 'berlian' ? false : it.wajib !== false })),
    rintangan: (d.rintangan || []).filter(dalam).map((r) => ({ jenis: String(r.jenis || 'batu').slice(0, 20), x: r.x, y: r.y })),
    jurang: (d.jurang || []).filter(dalam).map((j) => ({ x: j.x, y: j.y }))
  };
}

function normalTujuan(daftar) {
  return (Array.isArray(daftar) ? daftar : []).map((t) => (t.jenis === 'ambil'
    ? { teks: String(t.teks || '').trim().slice(0, 80) || `Ambil ${Number(t.jumlah) || 0} koin`, jenis: 'ambil', jumlah: Math.max(1, Math.round(Number(t.jumlah) || 1)) }
    : { teks: String(t.teks || '').trim().slice(0, 80) || 'Sampai di bendera', jenis: 'sampai' })).slice(0, 6);
}

function idLevelBaru(zona) {
  const ada = new Set(baca(KUNCI.level, []).map((l) => l.id));
  let id;
  do { id = `${zona}-g${acakHex(3)}`; } while (ada.has(id));
  return id;
}

// Sisipkan level di akhir zona tetapi sebelum boss (boss baru ditaruh paling akhir)
function sisipkanSebelumBoss(levels, level) {
  const lain = levels.filter((l) => l.zona === level.zona && l.id !== level.id);
  const acuan = level.jenis === 'boss' ? lain : lain.filter((l) => l.jenis !== 'boss');
  level.urutan = (acuan.length ? Math.max(...acuan.map((l) => l.urutan ?? 0)) : 0) + 0.5;
}

/**
 * Simpan level (baru jika tanpa id). opsi.terbit: true untuk menerbitkan (wajib lolos validasi),
 * false untuk menyimpan sebagai draf. kelasIds null hanya boleh untuk admin (= semua kelas).
 */
export async function guruSimpanLevel(data, { terbit = false } = {}) {
  await siap();
  const a = aksesGuru();
  const semua = baca(KUNCI.level, []);
  const lama = data.id ? semua.find((l) => l.id === data.id) : null;
  if (data.id && !lama) throw new Error('Level tidak ditemukan.');
  if (lama && !levelBolehDiubah(a, lama)) throw new Error('Anda hanya bisa mengubah level buatan Anda sendiri.');

  if (!ZONA.some((z) => z.id === data.zona)) throw new Error('Pilih zona.');
  if (!['ketik', 'debug', 'boss'].includes(data.jenis)) throw new Error('Pilih jenis level.');
  const judul = String(data.judul || '').trim().replace(/\s+/g, ' ');
  if (judul.length < 3 || judul.length > 60) throw new Error('Judul 3–60 huruf.');

  let kelasIds;
  if (data.kelasIds === null && a.admin) kelasIds = null;
  else {
    kelasIds = [...new Set(Array.isArray(data.kelasIds) ? data.kelasIds : [])];
    const bolehSemua = new Set(a.admin ? baca(KUNCI.kelas, []).map((k) => k.id) : [...a.kelasIds]);
    if (kelasIds.some((k) => !bolehSemua.has(k))) throw new Error('Ada kelas tujuan yang bukan kelas Anda.');
  }
  const tingkat = [...new Set((data.tingkat || []).map(Number))].filter((t) => [3, 4, 5, 6].includes(t)).sort();
  if (!tingkat.length) throw new Error('Pilih minimal satu tingkat kelas sasaran.');

  const zonaLama = lama?.zona;
  const level = {
    ...(lama ? salin(lama) : {}),
    id: lama?.id || idLevelBaru(data.zona),
    zona: data.zona,
    jenis: data.jenis,
    judul,
    instruksi: String(data.instruksi || '').trim().slice(0, 500),
    ringkasan: String(data.instruksi || '').trim().slice(0, 120) || judul,
    tantanganBonus: String(data.tantanganBonus || '').trim().slice(0, 200),
    tingkat,
    kelasIds,
    dunia: periksaDunia(data.dunia),
    perintahTersedia: (data.perintahTersedia || []).filter((x) => SEMUA_PERINTAH.includes(x)),
    kodeAwal: String(data.kodeAwal || '').slice(0, BATAS_TEKS),
    solusi: String(data.solusi || '').slice(0, BATAS_TEKS),
    batasBaris: Math.min(50, Math.max(1, Math.round(Number(data.batasBaris) || 1))),
    clue: [0, 1, 2].map((i) => String(data.clue?.[i] || '').trim().slice(0, 500)),
    tujuanTeks: normalTujuan(data.tujuanTeks),
    terbit: !!terbit,
    bawaan: !!lama?.bawaan,
    pembuat: lama ? (lama.pembuat ?? null) : { id: a.guru.id, nama: a.guru.nama },
    dibuatPada: lama?.dibuatPada || sekarang(),
    diperbarui: sekarang()
  };

  if (terbit) {
    const alasan = alasanBelumSiap(level);
    if (alasan.length) throw new Error(`Belum bisa diterbitkan: ${alasan.join(' ')}`);
  }

  if (lama) {
    if (zonaLama !== level.zona || (lama.jenis === 'boss') !== (level.jenis === 'boss')) sisipkanSebelumBoss(semua, level);
    Object.assign(lama, level);
  } else {
    sisipkanSebelumBoss(semua, level);
    semua.push(level);
  }
  rapikanUrutan(semua, level.zona);
  if (zonaLama && zonaLama !== level.zona) rapikanUrutan(semua, zonaLama);
  tulis(KUNCI.level, semua);
  return guruGetLevel(level.id);
}

/** Salin level menjadi draf baru milik guru ini (disisipkan sebelum boss). */
export async function guruDuplikatLevel(id) {
  await siap();
  const a = aksesGuru();
  const asli = ambilLevelBoleh(a, id);
  const semua = baca(KUNCI.level, []);
  const salinan = {
    ...salin(asli),
    id: idLevelBaru(asli.zona),
    judul: `Salinan ${asli.judul}`.slice(0, 60),
    bawaan: false,
    terbit: false,
    kelasIds: a.admin ? (asli.kelasIds ? asli.kelasIds.slice() : null) : [...a.kelasIds],
    kelasNonaktif: undefined,
    pembuat: { id: a.guru.id, nama: a.guru.nama },
    tingkat: asli.tingkat || [3, 4, 5, 6],
    dibuatPada: sekarang(),
    diperbarui: sekarang()
  };
  delete salinan.kelasNonaktif;
  sisipkanSebelumBoss(semua, salinan);
  semua.push(salinan);
  rapikanUrutan(semua, salinan.zona);
  tulis(KUNCI.level, semua);
  return guruGetLevel(salinan.id);
}

/** Geser level satu langkah (arah -1 naik, +1 turun). Boss tidak bisa digeser dan tidak bisa dilewati. */
export async function guruPindahUrutanLevel(id, arah) {
  await siap();
  const a = aksesGuru();
  const semua = baca(KUNCI.level, []);
  const l = semua.find((x) => x.id === id);
  if (!l || !levelBolehDilihat(a, l)) throw new Error('Level tidak ditemukan.');
  if (!levelBolehDiubah(a, l)) throw new Error('Urutan level ini hanya bisa diubah admin atau pembuatnya.');
  if (l.jenis === 'boss') throw new Error('Level boss selalu berada di urutan terakhir.');
  rapikanUrutan(semua, l.zona);
  const nonBoss = semua.filter((x) => x.zona === l.zona && x.jenis !== 'boss').sort((p, q) => p.urutan - q.urutan);
  const i = nonBoss.indexOf(l);
  const j = i + (arah < 0 ? -1 : 1);
  if (j < 0 || j >= nonBoss.length) throw new Error(arah < 0 ? 'Level sudah paling atas.' : 'Level sudah tepat sebelum boss.');
  [l.urutan, nonBoss[j].urutan] = [nonBoss[j].urutan, l.urutan];
  rapikanUrutan(semua, l.zona);
  tulis(KUNCI.level, semua);
  return true;
}

/** Hapus level buatan guru beserta progres dan draf kodenya. Level bawaan tidak bisa dihapus. */
export async function guruHapusLevel(id) {
  await siap();
  const a = aksesGuru();
  const semua = baca(KUNCI.level, []);
  const l = semua.find((x) => x.id === id);
  if (!l || !levelBolehDilihat(a, l)) throw new Error('Level tidak ditemukan.');
  if (l.bawaan) throw new Error('Level bawaan tidak bisa dihapus. Nonaktifkan saja.');
  if (!levelBolehDiubah(a, l)) throw new Error('Anda hanya bisa menghapus level buatan Anda sendiri.');
  const sisa = semua.filter((x) => x.id !== id);
  rapikanUrutan(sisa, l.zona);
  tulis(KUNCI.level, sisa);
  tulis(KUNCI.progres, baca(KUNCI.progres, []).filter((p) => p.levelId !== id));
  const draf = baca(KUNCI.draf, {});
  for (const k of Object.keys(draf)) if (k.endsWith(`|${id}`)) delete draf[k];
  tulis(KUNCI.draf, draf);
  return true;
}

/**
 * Aktifkan / nonaktifkan level.
 * Bawaan: admin untuk semua kelas; guru hanya untuk kelas yang diampunya.
 * Buatan guru: sama dengan terbit / jadikan draf (terbit wajib lolos validasi).
 */
export async function guruAturAktifLevel(id, aktif) {
  await siap();
  const a = aksesGuru();
  const semua = baca(KUNCI.level, []);
  const l = semua.find((x) => x.id === id);
  if (!l || !levelBolehDilihat(a, l)) throw new Error('Level tidak ditemukan.');
  if (l.bawaan && !a.admin) {
    const non = new Set(l.kelasNonaktif || []);
    for (const k of a.kelasIds) { if (aktif) non.delete(k); else non.add(k); }
    l.kelasNonaktif = [...non];
  } else {
    if (!levelBolehDiubah(a, l)) throw new Error('Anda hanya bisa mengatur level buatan Anda sendiri.');
    if (aktif && !l.bawaan) {
      const alasan = alasanBelumSiap(l);
      if (alasan.length) throw new Error(`Belum bisa diterbitkan: ${alasan.join(' ')}`);
    }
    l.terbit = !!aktif;
  }
  l.diperbarui = sekarang();
  tulis(KUNCI.level, semua);
  return ringkasLevel(a, l, baca(KUNCI.kelas, []));
}


// =====================================================================
// NILAI (dashboard guru)
// Nilai akhir = rata-rata nilai semua level yang terbit untuk kelas itu (belum selesai = 0),
// dibulatkan, minimal 1 (skala 1–100). Guru boleh menimpa dengan alasan wajib.
// =====================================================================
const kunciTimpa = (siswaId, kelasId) => `${siswaId}|${kelasId}`;

/**
 * Matriks nilai satu kelas.
 * Hasil: { kelas, levels: [{ id, zona, zonaNama, warna, urutan, judul, jenis }],
 *          siswa: [{ id, namaLengkap, namaPanggilan, avatar, sel: { [levelId]: {...} }, nilaiOtomatis, nilaiAkhir, timpa }] }
 */
export async function guruMatriksNilai(kelasId) {
  await siap();
  const a = aksesGuru();
  bolehKelas(a, kelasId);
  const kelas = baca(KUNCI.kelas, []).find((k) => k.id === kelasId);
  const urutZona = (l) => ZONA.findIndex((z) => z.id === l.zona);
  const levels = baca(KUNCI.level, [])
    .filter((l) => levelTerlihatUntukKelas(l, kelasId))
    .sort((p, q) => urutZona(p) - urutZona(q) || (p.urutan ?? 0) - (q.urutan ?? 0));
  const progres = baca(KUNCI.progres, []);
  const timpa = baca(KUNCI.nilaiTimpa, {});

  const siswa = baca(KUNCI.siswa, [])
    .filter((s) => s.kelasId === kelasId)
    .sort((p, q) => p.namaLengkap.localeCompare(q.namaLengkap))
    .map((s) => {
      const sel = {};
      let jumlah = 0;
      for (const l of levels) {
        const pr = progres.find((x) => x.siswaId === s.id && x.levelId === l.id);
        const nilai = pr?.selesai ? (pr.nilai || 0) : 0;
        jumlah += nilai;
        sel[l.id] = pr
          ? { dimainkan: true, selesai: !!pr.selesai, bintang: pr.bintang || 0, nilai, percobaan: pr.percobaan || 0, clueDibeli: pr.clueDibeli || 0 }
          : { dimainkan: false, selesai: false, bintang: 0, nilai: 0, percobaan: 0, clueDibeli: 0 };
      }
      const nilaiOtomatis = Math.max(1, levels.length ? Math.round(jumlah / levels.length) : 1);
      const t = timpa[kunciTimpa(s.id, kelasId)] || null;
      return {
        id: s.id,
        namaLengkap: s.namaLengkap,
        namaPanggilan: s.namaPanggilan,
        avatar: s.avatar,
        sel,
        nilaiOtomatis,
        nilaiAkhir: t ? t.nilai : nilaiOtomatis,
        timpa: t ? salin(t) : null
      };
    });

  return {
    kelas: salin(kelas),
    levels: levels.map((l) => {
      const z = ZONA.find((x) => x.id === l.zona);
      return { id: l.id, zona: l.zona, zonaNama: z?.nama || l.zona, warna: z?.warna || '#55A9A0', urutan: l.urutan, judul: l.judul, jenis: l.jenis };
    }),
    siswa
  };
}

/** Timpa nilai akhir seorang siswa (1–100) dengan alasan wajib. */
export async function guruTimpaNilai(siswaId, kelasId, nilai, alasan) {
  await siap();
  const a = aksesGuru();
  bolehKelas(a, kelasId);
  const s = ambilSiswaBoleh(a, siswaId);
  if (s.kelasId !== kelasId) throw new Error('Siswa tidak ada di kelas ini.');
  const n = Math.round(Number(nilai));
  if (!Number.isFinite(n) || n < 1 || n > 100) throw new Error('Nilai harus angka 1 sampai 100.');
  const teks = String(alasan || '').trim();
  if (teks.length < 5) throw new Error('Tulis alasan penimpaan nilai (minimal 5 huruf).');
  const semua = baca(KUNCI.nilaiTimpa, {});
  semua[kunciTimpa(siswaId, kelasId)] = { nilai: n, alasan: teks.slice(0, 300), guruId: a.guru.id, guruNama: a.guru.nama, waktu: sekarang() };
  tulis(KUNCI.nilaiTimpa, semua);
  return salin(semua[kunciTimpa(siswaId, kelasId)]);
}

/** Kembalikan nilai akhir ke nilai otomatis. */
export async function guruHapusTimpaNilai(siswaId, kelasId) {
  await siap();
  const a = aksesGuru();
  bolehKelas(a, kelasId);
  ambilSiswaBoleh(a, siswaId);
  const semua = baca(KUNCI.nilaiTimpa, {});
  delete semua[kunciTimpa(siswaId, kelasId)];
  tulis(KUNCI.nilaiTimpa, semua);
  return true;
}

// =====================================================================
// Profil siswa (memakai sesi siswa yang sedang masuk)
// =====================================================================
export async function ubahAvatarSaya(avatar) {
  await siap();
  const sesi = baca(KUNCI.sesi, null);
  if (!sesi || sesi.jenis !== 'siswa' || Date.now() > sesi.kadaluarsa) throw new Error('Masuk dulu ya.');
  if (!['pria', 'wanita'].includes(avatar)) throw new Error('Pilih salah satu gambar ya.');
  return ubahSiswa(sesi.id, { avatar });
}
