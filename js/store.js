// js/store.js — satu-satunya pintu akses data Coding Island (versi server)
// Semua fungsi memanggil API di /api (Cloudflare Worker + database D1).
// Hash PIN/password, sesi (cookie HttpOnly), batas login, dan pemeriksaan kelas
// yang diampu guru semuanya dikerjakan server. Yang tetap di browser hanya
// draf kode dan preferensi tampilan (per perangkat).
//
// Setiap kali data berubah, modul ini mengirim event di window:
//   window.addEventListener('ci:berubah', (e) => e.detail.entitas)  // 'siswa', 'sesi', ...

import { periksaKolomSiswa } from './game/aturan-siswa.js';

export { periksaKolomSiswa };

const AWALAN = 'ci_';
const LAMA_CACHE_SESI_MS = 60 * 1000; // sesi dibaca ulang dari server paling cepat tiap 60 detik
// Data baca siswa (level, progres, kelas, dll.) disimpan sebentar agar pindah halaman tidak menunggu server.
// Semua cache dibuang setiap ada permintaan yang mengubah data (lihat api()).
const LAMA_CACHE_DATA_MS = 60 * 1000;

// =====================================================================
// Helper
// =====================================================================
function beritahu(entitas) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ci:berubah', { detail: { entitas } }));
  }
}

const enc = encodeURIComponent;

/** Susun query string dari objek (nilai kosong dilewati). */
function qs(obj = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

// Pesan untuk jaringan putus/lambat, server sibuk (503), dan batas CPU Cloudflare (error 1102)
const PESAN_LAMBAT = 'Internet sedang lambat, coba lagi ya.';
// Status yang biasanya sementara: gerbang Cloudflare/server sibuk
const STATUS_SEMENTARA = new Set([502, 503, 504, 520, 521, 522, 523, 524]);
const JEDA_COBA_ULANG_MS = 800;

/**
 * Panggil API. Hasil: data JSON. Galat dari server dilempar sebagai Error dengan pesan ramah.
 * cara: { metode, data }
 * Permintaan GET dicoba ulang SEKALI bila gagal karena jaringan atau server sibuk.
 * Permintaan yang mengubah data tidak diulang otomatis (agar tidak terkirim dua kali).
 */
async function api(path, { metode = 'GET', data, simpanCache = false } = {}) {
  const bolehUlang = metode === 'GET';
  for (let ke = 1; ; ke++) {
    let res;
    try {
      res = await fetch(`/api/${path}`, {
        method: metode,
        credentials: 'same-origin',
        headers: data !== undefined ? { 'Content-Type': 'application/json' } : {},
        body: data !== undefined ? JSON.stringify(data) : undefined
      });
    } catch {
      if (bolehUlang && ke === 1) { await jeda(JEDA_COBA_ULANG_MS); continue; }
      throw galatLambat();
    }
    if (STATUS_SEMENTARA.has(res.status)) {
      if (bolehUlang && ke === 1) { await jeda(JEDA_COBA_ULANG_MS); continue; }
      throw galatLambat();
    }
    let isi = null;
    try { isi = await res.json(); } catch { /* respons bukan JSON (mis. halaman galat Cloudflare) */ }
    if (!res.ok) {
      if (res.status === 401) lupakanSesi();
      throw isi?.galat ? new Error(isi.galat) : galatLambat();
    }
    // Data berubah: sesi (koin, nama) & data baca tersimpan diambil ulang dari server
    if (metode !== 'GET' && !simpanCache) lupakanSesi();
    return isi;
  }
}

const jeda = (ms) => new Promise((r) => setTimeout(r, ms));

// Galat jaringan ditandai agar router & penangkap galat menampilkan pesan ini, bukan pesan umum
function galatLambat() {
  const err = new Error(PESAN_LAMBAT);
  err.jaringan = true;
  return err;
}

// Penyimpanan lokal (hanya draf kode & preferensi)
function bacaLokal(kunci, bawaan) {
  try {
    const mentah = localStorage.getItem(AWALAN + kunci);
    return mentah === null ? bawaan : JSON.parse(mentah);
  } catch {
    return bawaan;
  }
}

function tulisLokal(kunci, nilai) {
  try { localStorage.setItem(AWALAN + kunci, JSON.stringify(nilai)); } catch { /* penyimpanan diblokir: abaikan */ }
}

// =====================================================================
// Sesi (cache singkat agar penjaga rute & header tidak memanggil server terus)
// =====================================================================
let cacheSesi = null; // { waktu, janji } — janji berisi respons /api/auth/sesi: { sesi, modeDev }

function lupakanSesi() {
  cacheSesi = null;
  cacheBaca.clear();
}

// ---------- Cache data baca (60 detik, dibuang saat ada perubahan) ----------
const cacheBaca = new Map(); // path -> { waktu, janji }

/** GET dengan cache singkat. Hasil berupa salinan, jadi halaman bebas mengubahnya. */
async function bacaTersimpan(path) {
  let c = cacheBaca.get(path);
  if (!c || Date.now() - c.waktu >= LAMA_CACHE_DATA_MS) {
    const janji = api(path);
    c = { waktu: Date.now(), janji };
    cacheBaca.set(path, c);
    janji.catch(() => { if (cacheBaca.get(path) === c) cacheBaca.delete(path); }); // galat tidak disimpan
  }
  return structuredClone(await c.janji);
}

/**
 * Sesi yang sedang aktif, atau null.
 * Hasil: { jenis: 'siswa'|'guru', peran: 'siswa'|'guru'|'admin', kadaluarsa, pengguna }
 */
export async function sesiAktif() {
  return structuredClone((await infoSesi()).sesi || null);
}

/** true bila server berjalan dalam mode pengembang (MODE_DEV=1, hanya uji lokal). */
export async function modeDevAktif() {
  return (await infoSesi()).modeDev === true;
}

async function infoSesi() {
  if (cacheSesi && Date.now() - cacheSesi.waktu < LAMA_CACHE_SESI_MS) return cacheSesi.janji;
  const janji = api('auth/sesi');
  cacheSesi = { waktu: Date.now(), janji };
  try {
    return await janji;
  } catch (err) {
    cacheSesi = null;
    throw err;
  }
}

export async function keluar() {
  try { await api('auth/keluar', { metode: 'POST' }); } finally {
    lupakanSesi();
    beritahu('sesi');
  }
}

// =====================================================================
// Pemasangan pertama (selama belum ada akun guru)
// =====================================================================
/** Hasil: { perluPasang } — true jika belum ada satu pun akun guru/admin. */
export async function statusPasang() {
  return api('auth/pasang');
}

/**
 * Buat admin pertama. data: { kode, nama, username, password, konfirmasi }
 * Hasil: { ok: true, guru } (langsung masuk) atau { ok: false, kolom, pesan, tahanDetik }
 */
export async function pasangAdmin(data) {
  const hasil = await api('auth/pasang', { metode: 'POST', data });
  if (hasil.ok) beritahu('sesi');
  return hasil;
}

/** Berapa detik lagi percobaan masuk ditahan (0 berarti boleh mencoba). */
export async function statusTahan(jenis) {
  try {
    return (await api(`auth/tahan${qs({ jenis })}`)).detik || 0;
  } catch {
    return 0;
  }
}

// =====================================================================
// Pendaftaran & masuk
// =====================================================================
/** Kelas untuk dropdown pendaftaran (tanpa kode kelas). */
export async function daftarKelasPublik() {
  return bacaTersimpan('kelas/publik');
}

export async function cekKodeKelas(kelasId, kode) {
  return (await api('kelas/cek-kode', { metode: 'POST', data: { kelasId, kode } })).cocok;
}

/** Cek username siswa. Hasil: { tersedia, pesan } */
export async function cekUsernameSiswa(username, kecualiId = null) {
  const u = String(username || '').trim().toLowerCase();
  const pesan = periksaKolomSiswa('username', u);
  if (pesan) return { tersedia: false, pesan };
  return api(`auth/cek-username${qs({ u, kecuali: kecualiId })}`);
}

export async function sarankanUsername(namaPanggilan) {
  return (await api(`auth/saran-username${qs({ panggilan: namaPanggilan })}`)).username;
}

/** Hasil: { ok: true, siswa } atau { ok: false, kolom, pesan } */
export async function daftarSiswa(data) {
  const hasil = await api('auth/daftar', { metode: 'POST', data });
  if (hasil.ok) beritahu('sesi');
  return hasil;
}

/** Hasil: { ok: true, siswa } atau { ok: false, pesan, sisa, tahanDetik } */
export async function masukSiswa(username, pin) {
  const hasil = await api('auth/masuk-siswa', { metode: 'POST', data: { username, pin } });
  if (hasil.ok) beritahu('sesi');
  return hasil;
}

/** Hasil: { ok: true, guru } atau { ok: false, pesan, sisa, tahanDetik } */
export async function masukGuru(username, password) {
  const hasil = await api('auth/masuk-guru', { metode: 'POST', data: { username, password } });
  if (hasil.ok) beritahu('sesi');
  return hasil;
}

// =====================================================================
// Data dasar
// =====================================================================
async function tambahGuru(data) {
  return api('auth/guru', { metode: 'POST', data });
}

async function ubahGuru(id, perubahan) {
  return api(`auth/guru/${enc(id)}`, { metode: 'PATCH', data: perubahan });
}

export async function getKelas(id) {
  if (!id) return null;
  return bacaTersimpan(`kelas/${enc(id)}`);
}


/** Siswa yang sedang masuk membaca datanya sendiri; guru membaca siswa di kelasnya. */
export async function getSiswa(id) {
  const sesi = await sesiAktif();
  if (sesi?.jenis === 'siswa') return sesi.pengguna.id === id ? bacaTersimpan('siswa/saya') : null;
  return (await guruDetailSiswa(id)).siswa;
}

/** Simpan daftar zona yang animasi "pulau baru"-nya sudah pernah dilihat siswa. */
export async function aturZonaTerlihat(_id, zonaIds) {
  const siswa = await api('siswa/saya/zona-terlihat', { metode: 'POST', data: { zonaIds } });
  beritahu('siswa');
  return siswa;
}


// =====================================================================
// Level
// =====================================================================
// Clue level yang sudah dimuat untuk siswa. Halaman bermain memegang array yang sama,
// jadi setelah clue dibeli teksnya cukup diisi ke array ini.
const clueTerbit = new Map();

/** Semua level (guru, atau siswa saat alat pengembang server aktif). */
export async function daftarLevel({ zona } = {}) {
  return api(`level/semua${qs({ zona })}`);
}

export async function getLevel(id) {
  return api(`level/${enc(id)}`);
}


/**
 * Level terbit untuk kelas siswa yang sedang masuk (server memakai kelas dari sesi).
 * Solusi tidak dikirim; teks clue hanya ada untuk clue yang sudah dibeli.
 */
export async function daftarLevelTerbit({ zona } = {}) {
  const levels = await bacaTersimpan(`level/terbit${qs({ zona })}`);
  for (const l of levels) clueTerbit.set(l.id, l.clue);
  return levels;
}

export async function getHargaClue() {
  return bacaTersimpan('level/harga-clue');
}

/** Id zona yang sedang dinonaktifkan guru (tidak tampil di peta murid). */
export async function getZonaNonaktif() {
  return (await bacaTersimpan('auth/pengaturan')).zonaNonaktif || [];
}

// =====================================================================
// Progres (selalu milik siswa yang sedang masuk)
// =====================================================================
export async function getSemuaProgres({ levelId } = {}) {
  const semua = await bacaTersimpan('progres');
  return levelId ? semua.filter((p) => p.levelId === levelId) : semua;
}

// Diambil dari daftar progres yang sudah tersimpan (tanpa permintaan tambahan ke server)
export async function getProgres(_siswaId, levelId) {
  return (await bacaTersimpan('progres')).find((p) => p.levelId === levelId) || null;
}

/** Alat pengembang (MODE_DEV=1 di server). */
export async function simpanProgres(_siswaId, levelId, perubahan = {}) {
  const hasil = await api(`progres/${enc(levelId)}`, { metode: 'PUT', data: perubahan });
  beritahu('progres');
  return hasil;
}

/** Alat pengembang (MODE_DEV=1 di server). Tanpa levelId: hapus semua progres. */
export async function hapusProgres(_siswaId, levelId = null) {
  if (levelId) await api(`progres/${enc(levelId)}`, { metode: 'PUT', data: { selesai: false, bintang: 0, nilai: 0, percobaan: 0 } });
  else await api('progres', { metode: 'DELETE' });
  beritahu('progres');
  return true;
}

/**
 * Catat satu kali menekan Jalankan. Server menjalankan ulang kode siswa dan menghitung
 * bintang, nilai, koin, dan berlian sendiri (hasil dari browser tidak dipercaya).
 * Hasil: { progres, koinDidapat, berlianDidapat, pertamaKali, bintangLama, juara, siswa }
 */
export async function catatPercobaan(_siswaId, levelId, hasil) {
  const r = await api(`progres/${enc(levelId)}/percobaan`, { metode: 'POST', data: { kode: String(hasil.kode ?? ''), detik: hasil.detik || 0 } });
  beritahu('progres');
  if (r.siswa) beritahu('siswa');
  return r;
}

/**
 * Beli clue. Hasil: { ok: true, clueDibeli, siswa, dibayar } atau { ok: false, alasan, kurang, pesan }
 */
export async function beliClue(_siswaId, levelId, nomor) {
  const r = await api(`progres/${enc(levelId)}/clue`, { metode: 'POST', data: { nomor } });
  if (r.ok) {
    const arr = clueTerbit.get(levelId);
    if (arr && Array.isArray(r.clue)) r.clue.forEach((teks, i) => { arr[i] = teks; });
    if (r.dibayar) beritahu('siswa');
  }
  const { clue, ...hasil } = r;
  return hasil;
}

/** Data sertifikat juara, atau null jika boss zona terakhir belum selesai. */
export async function getRingkasanJuara() {
  return bacaTersimpan('progres/juara');
}

// Lama bermain tidak tampil di peta, jadi cache tidak perlu dibuang
export async function tambahLamaBermain(_siswaId, levelId, detik) {
  const d = Math.max(0, Math.round(Number(detik) || 0));
  if (!d) return null;
  return api(`progres/${enc(levelId)}/lama`, { metode: 'POST', data: { detik: d }, simpanCache: true });
}

// =====================================================================
// Draf kode & preferensi (tetap di perangkat ini)
// =====================================================================
export async function getDrafKode(siswaId, levelId) {
  return bacaLokal('draf', {})[`${siswaId}|${levelId}`] ?? null;
}

export async function simpanDrafKode(siswaId, levelId, kode) {
  const semua = bacaLokal('draf', {});
  semua[`${siswaId}|${levelId}`] = String(kode ?? '').slice(0, 20000);
  tulisLokal('draf', semua);
  return true;
}

export async function getPreferensi() {
  return bacaLokal('preferensi', {});
}

export async function simpanPreferensi(perubahan) {
  const pref = { ...bacaLokal('preferensi', {}), ...perubahan };
  tulisLokal('preferensi', pref);
  return pref;
}


// =====================================================================
// API DASHBOARD GURU (server memeriksa peran & kelas yang diampu)
// =====================================================================
export async function guruKonteks() {
  return bacaTersimpan('auth/konteks');
}

export async function guruRingkasan({ kelasId } = {}) {
  return api(`aktivitas/ringkasan${qs({ kelasId })}`);
}

// ---------- Kelas ----------
export async function guruDaftarKelas() {
  return api('kelas');
}

export async function guruSimpanKelas(data) {
  const { id, ...isi } = data;
  return id
    ? api(`kelas/${enc(id)}`, { metode: 'PUT', data: isi })
    : api('kelas', { metode: 'POST', data: isi });
}

export async function guruKodeKelasBaru(kelasId) {
  return (await api(`kelas/${enc(kelasId)}/kode-baru`, { metode: 'POST' })).kode;
}

export async function guruHapusKelas(kelasId) {
  await api(`kelas/${enc(kelasId)}`, { metode: 'DELETE' });
  return true;
}

// ---------- Siswa ----------
export async function guruDaftarSiswa({ kelasId } = {}) {
  return api(`siswa${qs({ kelasId })}`);
}

export async function guruDetailSiswa(siswaId) {
  return api(`siswa/${enc(siswaId)}`);
}

export async function guruSimpanCatatan(siswaId, teks) {
  return api(`siswa/${enc(siswaId)}/catatan`, { metode: 'PUT', data: { teks } });
}

/** Hasil: { siswa, pin } (PIN hanya dikembalikan sekali untuk dicatat guru) */
export async function guruTambahSiswa(data) {
  return api('siswa', { metode: 'POST', data });
}

export async function guruUbahSiswa(siswaId, perubahan) {
  return api(`siswa/${enc(siswaId)}`, { metode: 'PATCH', data: perubahan });
}

export async function guruPindahKelas(siswaId, kelasId) {
  return guruUbahSiswa(siswaId, { kelasId });
}

/** Tetapkan PIN murid. pin kosong = PIN acak dari server. Hasil: PIN yang berlaku (tampilkan sekali). */
export async function guruResetPin(siswaId, pin = '') {
  return (await api(`siswa/${enc(siswaId)}/reset-pin`, { metode: 'POST', data: { pin } })).pin;
}

export async function guruHapusSiswa(siswaId) {
  await api(`siswa/${enc(siswaId)}`, { metode: 'DELETE' });
  return true;
}

export async function guruPratinjauImpor(baris) {
  return api('siswa/impor/pratinjau', { metode: 'POST', data: { baris } });
}

// Setiap PIN di-hash di server (butuh waktu CPU), jadi impor dikirim per potongan kecil
// agar tiap permintaan tetap di bawah batas CPU Workers gratis.
const UKURAN_POTONGAN_IMPOR = 4;

export async function guruImporSiswa(baris) {
  const hasil = [];
  for (let i = 0; i < baris.length; i += UKURAN_POTONGAN_IMPOR) {
    const potongan = baris.slice(i, i + UKURAN_POTONGAN_IMPOR);
    try {
      hasil.push(...await api('siswa/impor', { metode: 'POST', data: { baris: potongan, nomorAwal: i + 1 } }));
    } catch (err) {
      // Berhenti, tetapi tetap tampilkan PIN akun yang sudah terbuat. Baris sisanya ditandai gagal.
      baris.slice(i).forEach((_, j) => hasil.push({
        nomor: i + j + 1, ok: false, data: { namaLengkap: String(baris[i + j]?.namaLengkap || '') },
        pesan: `${err.message} Cek menu Siswa: jika akunnya sudah ada, reset PIN-nya.`
      }));
      break;
    }
  }
  return hasil;
}

// ---------- Aktivitas ----------
export async function guruAktivitas({ kelasId, siswaId, jenis, batas = 200 } = {}) {
  return api(`aktivitas${qs({ kelasId, siswaId, jenis, batas })}`);
}

// ---------- Akun sendiri ----------
export async function guruUbahNama(nama) {
  await api('auth/nama', { metode: 'PATCH', data: { nama } });
  beritahu('sesi');
  return (await sesiAktif())?.pengguna || null;
}

export async function guruUbahPassword(passwordLama, passwordBaru) {
  await api('auth/password', { metode: 'POST', data: { lama: passwordLama, baru: passwordBaru } });
  return true;
}

// ---------- Khusus admin ----------
export async function adminSimpanPengaturan({ hargaClue, koinAwal }) {
  return api('auth/pengaturan', { metode: 'PUT', data: { hargaClue, koinAwal } });
}

// ---------- Zona aktif/nonaktif (guru & admin) ----------
/** Tiap zona: { id, nama, konsep, warna, aktif, jumlahLevel, nilaiTurun, totalMurid } (selalu data terbaru). */
export async function guruDaftarZona() {
  return api('auth/zona');
}

export async function guruAturZona(zonaId, aktif) {
  return api(`auth/zona/${enc(zonaId)}`, { metode: 'PUT', data: { aktif } });
}

export async function adminDaftarGuru() {
  return api('auth/guru');
}

export async function adminSimpanGuru(data) {
  const { id, ...isi } = data;
  return id ? ubahGuru(id, isi) : tambahGuru(isi);
}

export async function adminHapusGuru(guruId) {
  await api(`auth/guru/${enc(guruId)}`, { metode: 'DELETE' });
  return true;
}

export async function adminResetPasswordGuru(guruId) {
  return (await api(`auth/guru/${enc(guruId)}/reset-password`, { metode: 'POST' })).password;
}

// ---------- Admin masuk sebagai guru (menyamar) ----------
/** Admin masuk ke akun guru tanpa login ulang. Sesi admin diganti sesi guru itu. */
export async function adminMasukSebagaiGuru(guruId) {
  try { await api(`auth/guru/${enc(guruId)}/menyamar`, { metode: 'POST' }); } finally {
    lupakanSesi();
    beritahu('sesi');
  }
  return true;
}

/** Kembali dari akun guru ke akun admin asli. */
export async function kembaliKeAkunAdmin() {
  try { await api('auth/akhiri-menyamar', { metode: 'POST' }); } finally {
    lupakanSesi();
    beritahu('sesi');
  }
  return true;
}

// ---------- Level & soal ----------
export async function guruDaftarLevel() {
  return api('level/guru');
}

export async function guruGetLevel(id) {
  return api(`level/guru/${enc(id)}`);
}

export async function guruSimpanLevel(data, { terbit = false } = {}) {
  return data.id
    ? api(`level/guru/${enc(data.id)}`, { metode: 'PUT', data: { level: data, terbit } })
    : api('level/guru', { metode: 'POST', data: { level: data, terbit } });
}

export async function guruDuplikatLevel(id) {
  return api(`level/guru/${enc(id)}/duplikat`, { metode: 'POST' });
}

export async function guruPindahUrutanLevel(id, arah) {
  await api(`level/guru/${enc(id)}/urutan`, { metode: 'POST', data: { arah } });
  return true;
}

export async function guruHapusLevel(id) {
  await api(`level/guru/${enc(id)}`, { metode: 'DELETE' });
  return true;
}

export async function guruAturAktifLevel(id, aktif) {
  return api(`level/guru/${enc(id)}/aktif`, { metode: 'POST', data: { aktif } });
}

// ---------- Nilai ----------
export async function guruMatriksNilai(kelasId) {
  return api(`nilai/${enc(kelasId)}`);
}

export async function guruTimpaNilai(siswaId, kelasId, nilai, alasan) {
  return api(`nilai/${enc(kelasId)}/${enc(siswaId)}`, { metode: 'PUT', data: { nilai, alasan } });
}

export async function guruHapusTimpaNilai(siswaId, kelasId) {
  await api(`nilai/${enc(kelasId)}/${enc(siswaId)}`, { metode: 'DELETE' });
  return true;
}

// =====================================================================
// Profil siswa
// =====================================================================
export async function ubahAvatarSaya(avatar) {
  const siswa = await api('siswa/saya/avatar', { metode: 'PATCH', data: { avatar } });
  beritahu('siswa');
  return siswa;
}
