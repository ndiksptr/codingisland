// server/sesi.js — sesi di cookie HttpOnly + Secure + SameSite=Lax, dan pemeriksaan peran
// Token acak dikirim ke browser; di D1 hanya disimpan hash SHA-256-nya.

import { GalatApi } from './http.js';
import { tokenAcak, sha256Hex } from './kripto.js';
import { satu, semua, jalankan, guruKeObjek, siswaKeObjek, semuaKelas } from './data.js';

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

/** Sesi aktif (disimpan di context.data agar hanya dibaca sekali per permintaan) atau null. */
export async function ambilSesi(context) {
  if (context.data && 'sesi' in context.data) return context.data.sesi;
  let sesi = null;
  const token = bacaCookie(context.request);
  if (token) {
    const row = await satu(context.env.DB, 'SELECT * FROM sesi WHERE token_hash = ?', await sha256Hex(token));
    if (row && row.kadaluarsa > Date.now()) sesi = row;
    else if (row) await jalankan(context.env.DB, 'DELETE FROM sesi WHERE token_hash = ?', row.token_hash);
  }
  context.data = context.data || {};
  context.data.sesi = sesi;
  return sesi;
}

/** Wajib siswa yang sedang masuk. Hasil: baris siswa dari D1. */
export async function wajibSiswa(context) {
  const s = await ambilSesi(context);
  if (!s || s.jenis !== 'siswa') throw new GalatApi(401, 'Masuk dulu ya.');
  const siswa = await satu(context.env.DB, 'SELECT * FROM siswa WHERE id = ?', s.pengguna_id);
  if (!siswa) throw new GalatApi(401, 'Akun tidak ditemukan. Masuk lagi ya.');
  return siswa;
}

/**
 * Wajib guru/admin yang sedang masuk.
 * Hasil: { guru (baris), admin, kelas: [objek kelas yang boleh diakses], kelasIds: Set }
 * Admin boleh semua kelas; guru hanya kelas di tabel guru_kelas.
 */
export async function aksesGuru(context) {
  const s = await ambilSesi(context);
  if (!s || s.jenis !== 'guru') throw new GalatApi(401, 'Sesi guru sudah berakhir. Silakan masuk lagi.');
  const guru = await satu(context.env.DB, 'SELECT * FROM guru WHERE id = ?', s.pengguna_id);
  if (!guru) throw new GalatApi(401, 'Akun guru tidak ditemukan.');
  const admin = guru.peran === 'admin';
  const semuaK = await semuaKelas(context.env.DB);
  const kelas = admin ? semuaK : semuaK.filter((k) => k.guruIds.includes(guru.id));
  return { guru, admin, kelas, kelasIds: new Set(kelas.map((k) => k.id)), sesi: s };
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

/** Bentuk hasil sesiAktif() yang sama dengan versi demo. */
export async function sesiUntukKlien(context) {
  const s = await ambilSesi(context);
  if (!s) return null;
  const db = context.env.DB;
  if (s.jenis === 'siswa') {
    const siswa = await satu(db, 'SELECT * FROM siswa WHERE id = ?', s.pengguna_id);
    return siswa ? { jenis: 'siswa', peran: 'siswa', kadaluarsa: s.kadaluarsa, pengguna: siswaKeObjek(siswa) } : null;
  }
  const guru = await satu(db, 'SELECT * FROM guru WHERE id = ?', s.pengguna_id);
  if (!guru) return null;
  const kelasIds = (await semua(db, 'SELECT kelas_id FROM guru_kelas WHERE guru_id = ?', guru.id)).map((r) => r.kelas_id);
  return { jenis: 'guru', peran: guru.peran, kadaluarsa: s.kadaluarsa, pengguna: guruKeObjek(guru, kelasIds) };
}
