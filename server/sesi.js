// server/sesi.js — sesi di cookie HttpOnly + Secure + SameSite=Lax, dan pemeriksaan peran
// Token acak dikirim ke browser; di D1 hanya disimpan hash SHA-256-nya.

import { GalatApi } from './http.js';
import { tokenAcak, sha256Hex } from './kripto.js';
import { satu, jalankan, perintah, guruKeObjek, siswaKeObjek, kelasDariBaris } from './data.js';

const NAMA_COOKIE = 'ci_sesi';
const MASA_DETIK = 8 * 60 * 60; // 8 jam

const cookie = (nilai, maxAge) => `${NAMA_COOKIE}=${nilai}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

function bacaCookie(request) {
  const isi = request.headers.get('Cookie') || '';
  const cocok = isi.split(/;\s*/).find((c) => c.startsWith(`${NAMA_COOKIE}=`));
  return cocok ? cocok.slice(NAMA_COOKIE.length + 1) : null;
}

/** Buat sesi baru. Hasil: header Set-Cookie. */
export async function buatSesi(env, jenis, penggunaId) {
  const token = tokenAcak();
  await jalankan(env.DB, 'DELETE FROM sesi WHERE kadaluarsa < ?', Date.now()); // bersihkan sesi kedaluwarsa
  await jalankan(env.DB, 'INSERT INTO sesi (token_hash, jenis, pengguna_id, kadaluarsa) VALUES (?,?,?,?)',
    await sha256Hex(token), jenis, penggunaId, Date.now() + MASA_DETIK * 1000);
  return cookie(token, MASA_DETIK);
}

/** Hapus sesi yang sedang dipakai. Hasil: header Set-Cookie pengosong. */
export async function hapusSesi(context) {
  const token = bacaCookie(context.request);
  if (token) await jalankan(context.env.DB, 'DELETE FROM sesi WHERE token_hash = ?', await sha256Hex(token));
  return cookie('', 0);
}

/** Hash token dari cookie (disimpan per permintaan), atau null. */
async function hashToken(context) {
  context.data = context.data || {};
  if (!('hashToken' in context.data)) {
    const token = bacaCookie(context.request);
    context.data.hashToken = token ? await sha256Hex(token) : null;
  }
  return context.data.hashToken;
}

/** Sesi aktif (disimpan di context.data agar hanya dibaca sekali per permintaan) atau null. */
export async function ambilSesi(context) {
  if (context.data && 'sesi' in context.data) return context.data.sesi;
  const h = await hashToken(context);
  // Sesi kedaluwarsa cukup diabaikan; barisnya dihapus oleh bersihkanKedaluwarsa saat ada login
  const sesi = h ? await satu(context.env.DB, 'SELECT * FROM sesi WHERE token_hash = ? AND kadaluarsa > ?', h, Date.now()) : null;
  context.data.sesi = sesi || null;
  return context.data.sesi;
}

/** Wajib siswa yang sedang masuk. Hasil: baris siswa dari D1 (sesi + siswa dalam satu kueri JOIN). */
export async function wajibSiswa(context) {
  const h = await hashToken(context);
  const siswa = h && await satu(context.env.DB, `SELECT s.* FROM sesi x JOIN siswa s ON s.id = x.pengguna_id
    WHERE x.token_hash = ? AND x.jenis = 'siswa' AND x.kadaluarsa > ?`, h, Date.now());
  if (!siswa) throw new GalatApi(401, 'Masuk dulu ya.');
  return siswa;
}

/**
 * Wajib guru/admin yang sedang masuk.
 * Hasil: { guru (baris), admin, kelas: [objek kelas yang boleh diakses], kelasIds: Set }
 * Admin boleh semua kelas; guru hanya kelas di tabel guru_kelas.
 */
export async function aksesGuru(context) {
  const db = context.env.DB;
  const h = await hashToken(context);
  if (!h) throw new GalatApi(401, 'Sesi guru sudah berakhir. Silakan masuk lagi.');
  // Sesi + guru, semua kelas, dan relasi guru_kelas dalam satu kali bolak-balik ke D1
  const [rg, rk, rr] = await db.batch([
    perintah(db, `SELECT g.*, x.kadaluarsa AS sesi_kadaluarsa FROM sesi x JOIN guru g ON g.id = x.pengguna_id
      WHERE x.token_hash = ? AND x.jenis = 'guru' AND x.kadaluarsa > ?`, h, Date.now()),
    perintah(db, 'SELECT * FROM kelas ORDER BY tingkat, nama'),
    perintah(db, 'SELECT guru_id, kelas_id FROM guru_kelas')
  ]);
  const guru = rg.results?.[0];
  if (!guru) throw new GalatApi(401, 'Sesi guru sudah berakhir. Silakan masuk lagi.');
  const admin = guru.peran === 'admin';
  const semuaK = kelasDariBaris(rk.results || [], rr.results || []);
  const kelas = admin ? semuaK : semuaK.filter((k) => k.guruIds.includes(guru.id));
  const sesi = { jenis: 'guru', pengguna_id: guru.id, kadaluarsa: guru.sesi_kadaluarsa };
  return { guru, admin, kelas, kelasIds: new Set(kelas.map((k) => k.id)), sesi };
}

export function wajibAdmin(a) {
  if (!a.admin) throw new GalatApi(403, 'Fitur ini khusus admin.');
}

export function bolehKelas(a, kelasId) {
  if (!a.kelasIds.has(kelasId)) throw new GalatApi(403, 'Kelas ini bukan kelas yang Anda ampu.');
}

export function saringKelas(a, kelasId) {
  if (!kelasId) return null;
  bolehKelas(a, kelasId);
  return kelasId;
}

/** Ambil siswa yang boleh diakses guru ini (admin: semua). */
export async function ambilSiswaBoleh(context, a, siswaId) {
  const s = await satu(context.env.DB, 'SELECT * FROM siswa WHERE id = ?', siswaId);
  if (!s || !(a.admin || a.kelasIds.has(s.kelas_id))) throw new GalatApi(404, 'Siswa tidak ditemukan di kelas Anda.');
  return s;
}

/** Bentuk hasil sesiAktif() yang dipakai halaman. */
// Dipanggil sangat sering (penjaga rute, header), jadi semua dibaca dalam satu db.batch
export async function sesiUntukKlien(context) {
  const h = await hashToken(context);
  if (!h) return null;
  const db = context.env.DB;
  const kini = Date.now();
  const [rs, rg, rk] = await db.batch([
    perintah(db, `SELECT s.*, x.kadaluarsa AS sesi_kadaluarsa FROM sesi x JOIN siswa s ON s.id = x.pengguna_id
      WHERE x.token_hash = ? AND x.jenis = 'siswa' AND x.kadaluarsa > ?`, h, kini),
    perintah(db, `SELECT g.*, x.kadaluarsa AS sesi_kadaluarsa FROM sesi x JOIN guru g ON g.id = x.pengguna_id
      WHERE x.token_hash = ? AND x.jenis = 'guru' AND x.kadaluarsa > ?`, h, kini),
    perintah(db, `SELECT gk.kelas_id FROM sesi x JOIN guru_kelas gk ON gk.guru_id = x.pengguna_id
      WHERE x.token_hash = ? AND x.jenis = 'guru'`, h)
  ]);
  const siswa = rs.results?.[0];
  if (siswa) return { jenis: 'siswa', peran: 'siswa', kadaluarsa: siswa.sesi_kadaluarsa, pengguna: siswaKeObjek(siswa) };
  const guru = rg.results?.[0];
  if (!guru) return null;
  return { jenis: 'guru', peran: guru.peran, kadaluarsa: guru.sesi_kadaluarsa, pengguna: guruKeObjek(guru, (rk.results || []).map((r) => r.kelas_id)) };
}
