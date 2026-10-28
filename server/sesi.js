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

/**
 * Buat sesi baru (berlaku 8 jam). Hasil: header Set-Cookie.
 * adminAsliId diisi hanya untuk sesi penyamaran: admin yang masuk sebagai guru.
 * kelasAktifId: kelas yang langsung dipakai murid (murid dengan satu kelas, atau murid yang baru mendaftar).
 */
export async function buatSesi(env, jenis, penggunaId, adminAsliId = null, kelasAktifId = null) {
  const token = tokenAcak();
  await jalankan(env.DB, 'DELETE FROM sesi WHERE kadaluarsa < ?', Date.now()); // bersihkan sesi kedaluwarsa
  await jalankan(env.DB, 'INSERT INTO sesi (token_hash, jenis, pengguna_id, kadaluarsa, admin_asli_id, kelas_aktif_id) VALUES (?,?,?,?,?,?)',
    await sha256Hex(token), jenis, penggunaId, Date.now() + MASA_DETIK * 1000, adminAsliId, kelasAktifId);
  return cookie(token, MASA_DETIK);
}

/** Ganti kelas aktif sesi murid yang sedang dipakai (pemeriksaan keanggotaan oleh pemanggil). */
export async function aturKelasAktif(context, kelasId) {
  await jalankan(context.env.DB, "UPDATE sesi SET kelas_aktif_id = ? WHERE token_hash = ? AND jenis = 'siswa'", kelasId, await hashToken(context));
  if (context.data) delete context.data.sesi;
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

// Siswa sesi ini + kelas aktifnya, dalam satu kueri. Kelas aktif = kelas yang dipilih di sesi ini selama
// murid masih anggotanya; bila belum memilih tetapi murid hanya anggota SATU kelas, kelas itu yang dipakai.
const SQL_SISWA_SESI = `SELECT s.*, x.kadaluarsa AS sesi_kadaluarsa, sk.kelas_id AS sk_kelas, sk.zona_terlihat AS sk_zona,
    (SELECT COUNT(*) FROM siswa_kelas a WHERE a.siswa_id = s.id) AS jumlah_kelas,
    (SELECT a.kelas_id FROM siswa_kelas a WHERE a.siswa_id = s.id ORDER BY a.bergabung_pada LIMIT 1) AS kelas_pertama,
    (SELECT a.zona_terlihat FROM siswa_kelas a WHERE a.siswa_id = s.id ORDER BY a.bergabung_pada LIMIT 1) AS zona_pertama
  FROM sesi x JOIN siswa s ON s.id = x.pengguna_id
  LEFT JOIN siswa_kelas sk ON sk.siswa_id = s.id AND sk.kelas_id = x.kelas_aktif_id
  WHERE x.token_hash = ? AND x.jenis = 'siswa' AND x.kadaluarsa > ?`;

/** Tambahkan kolom kelas_aktif & zona_terlihat_kelas (dibaca siswaKeObjek) ke baris hasil SQL_SISWA_SESI. */
function lengkapiKelasAktif(r) {
  if (!r) return r;
  const tunggal = !r.sk_kelas && r.jumlah_kelas === 1;
  r.kelas_aktif = r.sk_kelas || (tunggal ? r.kelas_pertama : null);
  r.zona_terlihat_kelas = r.sk_kelas ? r.sk_zona : tunggal ? r.zona_pertama : null;
  return r;
}

/**
 * Wajib siswa yang sedang masuk. Hasil: baris siswa dari D1 (sesi + siswa dalam satu kueri JOIN),
 * ditambah kelas_aktif (null bila murid belum memilih kelas atau belum punya kelas).
 */
export async function wajibSiswa(context) {
  const h = await hashToken(context);
  const siswa = h && lengkapiKelasAktif(await satu(context.env.DB, SQL_SISWA_SESI, h, Date.now()));
  if (!siswa) throw new GalatApi(401, 'Masuk dulu ya.');
  return siswa;
}

/** Wajib siswa yang sudah punya kelas aktif (semua soal, peta, dan progres mengikuti kelas ini). */
export async function wajibSiswaDiKelas(context) {
  const siswa = await wajibSiswa(context);
  if (!siswa.kelas_aktif) {
    throw new GalatApi(409, siswa.jumlah_kelas ? 'Pilih dulu kamu mau main sebagai kelas apa ya.' : 'Masukkan kode kelas dari gurumu dulu ya.');
  }
  return siswa;
}

/**
 * Wajib guru/admin yang sedang masuk.
 * Hasil: { guru (baris), admin, kelas: [objek kelas yang boleh diakses], kelasIds: Set, sesi, menyamar, pelaku }
 * Admin boleh semua kelas; guru hanya kelas di tabel guru_kelas.
 * Saat admin menyamar, hak aksesnya persis guru itu (guru = guru yang disamari), tetapi
 *   menyamar = { adminId, adminNama } dan pelaku = admin aslinya, untuk dicatat sebagai pengubah data.
 */
export async function aksesGuru(context) {
  const db = context.env.DB;
  const h = await hashToken(context);
  if (!h) throw new GalatApi(401, 'Sesi guru sudah berakhir. Silakan masuk lagi.');
  // Sesi + guru (+ admin asli bila menyamar), semua kelas, dan relasi guru_kelas dalam satu kali bolak-balik ke D1
  const [rg, rk, rr] = await db.batch([
    perintah(db, `SELECT g.*, x.kadaluarsa AS sesi_kadaluarsa, x.admin_asli_id, aa.nama AS admin_asli_nama
      FROM sesi x JOIN guru g ON g.id = x.pengguna_id LEFT JOIN guru aa ON aa.id = x.admin_asli_id
      WHERE x.token_hash = ? AND x.jenis = 'guru' AND x.kadaluarsa > ?`, h, Date.now()),
    perintah(db, 'SELECT * FROM kelas ORDER BY tingkat, nama'),
    perintah(db, 'SELECT guru_id, kelas_id FROM guru_kelas')
  ]);
  const guru = rg.results?.[0];
  if (!guru) throw new GalatApi(401, 'Sesi guru sudah berakhir. Silakan masuk lagi.');
  const admin = guru.peran === 'admin';
  const semuaK = kelasDariBaris(rk.results || [], rr.results || []);
  const kelas = admin ? semuaK : semuaK.filter((k) => k.guruIds.includes(guru.id));
  const sesi = { jenis: 'guru', pengguna_id: guru.id, kadaluarsa: guru.sesi_kadaluarsa, admin_asli_id: guru.admin_asli_id || null };
  const menyamar = guru.admin_asli_id ? { adminId: guru.admin_asli_id, adminNama: guru.admin_asli_nama || 'Admin' } : null;
  // Nama yang ditulis ke aktivitas, nilai, dan catatan: admin asli bila sedang menyamar
  const pelaku = menyamar
    ? { id: menyamar.adminId, nama: `${menyamar.adminNama} (admin, sebagai ${guru.nama})` }
    : { id: guru.id, nama: guru.nama };
  return { guru, admin, kelas, kelasIds: new Set(kelas.map((k) => k.id)), sesi, menyamar, pelaku };
}

export function wajibAdmin(a) {
  if (!a.admin) throw new GalatApi(403, 'Fitur ini khusus admin.');
}

/** Tolak tindakan yang tidak boleh dilakukan selama admin masuk sebagai guru lain. */
export function tolakSaatMenyamar(a, tindakan) {
  if (a.menyamar) throw new GalatApi(403, `Tidak bisa ${tindakan} saat masuk sebagai guru lain. Kembali ke akun admin dulu.`);
}

export function bolehKelas(a, kelasId) {
  if (!a.kelasIds.has(kelasId)) throw new GalatApi(403, 'Kelas ini bukan kelas yang Anda ampu.');
}

export function saringKelas(a, kelasId) {
  if (!kelasId) return null;
  bolehKelas(a, kelasId);
  return kelasId;
}

/**
 * Ambil siswa yang boleh diakses guru ini: anggota salah satu kelas yang diampunya (admin: semua).
 * Hasil: baris siswa + kelasAnggota (id semua kelas yang diikuti murid itu).
 */
export async function ambilSiswaBoleh(context, a, siswaId) {
  const db = context.env.DB;
  const [rs, rk] = await db.batch([
    perintah(db, 'SELECT * FROM siswa WHERE id = ?', siswaId),
    perintah(db, 'SELECT kelas_id FROM siswa_kelas WHERE siswa_id = ? ORDER BY bergabung_pada', siswaId)
  ]);
  const s = rs.results?.[0];
  const kelasAnggota = (rk.results || []).map((r) => r.kelas_id);
  if (!s || !(a.admin || kelasAnggota.some((k) => a.kelasIds.has(k)))) throw new GalatApi(404, 'Siswa tidak ditemukan di kelas Anda.');
  return { ...s, kelasAnggota };
}

/** Bentuk hasil sesiAktif() yang dipakai halaman. */
// Dipanggil sangat sering (penjaga rute, header), jadi semua dibaca dalam satu db.batch
export async function sesiUntukKlien(context) {
  const h = await hashToken(context);
  if (!h) return null;
  const db = context.env.DB;
  const kini = Date.now();
  const [rs, rg, rk, rsk] = await db.batch([
    perintah(db, SQL_SISWA_SESI, h, kini),
    perintah(db, `SELECT g.*, x.kadaluarsa AS sesi_kadaluarsa, x.admin_asli_id, aa.nama AS admin_asli_nama
      FROM sesi x JOIN guru g ON g.id = x.pengguna_id LEFT JOIN guru aa ON aa.id = x.admin_asli_id
      WHERE x.token_hash = ? AND x.jenis = 'guru' AND x.kadaluarsa > ?`, h, kini),
    perintah(db, `SELECT gk.kelas_id FROM sesi x JOIN guru_kelas gk ON gk.guru_id = x.pengguna_id
      WHERE x.token_hash = ? AND x.jenis = 'guru'`, h),
    // Semua kelas murid ini (untuk layar pilih kelas dan menu kelas di header)
    perintah(db, `SELECT k.id, k.nama FROM sesi x JOIN siswa_kelas sk ON sk.siswa_id = x.pengguna_id JOIN kelas k ON k.id = sk.kelas_id
      WHERE x.token_hash = ? AND x.jenis = 'siswa' ORDER BY sk.bergabung_pada`, h)
  ]);
  const siswa = lengkapiKelasAktif(rs.results?.[0]);
  if (siswa) {
    // pengguna.kelasId = kelas aktif (null = harus memilih kelas / memasukkan kode kelas dulu)
    const pengguna = { ...siswaKeObjek(siswa), kelas: (rsk.results || []).map((k) => ({ id: k.id, nama: k.nama })) };
    return { jenis: 'siswa', peran: 'siswa', kadaluarsa: siswa.sesi_kadaluarsa, pengguna, menyamar: null };
  }
  const guru = rg.results?.[0];
  if (!guru) return null;
  // menyamar: berisi nama admin asli bila admin sedang masuk sebagai guru ini; null bila tidak
  const menyamar = guru.admin_asli_id ? { adminNama: guru.admin_asli_nama || 'Admin' } : null;
  return {
    jenis: 'guru', peran: guru.peran, kadaluarsa: guru.sesi_kadaluarsa,
    pengguna: guruKeObjek(guru, (rk.results || []).map((r) => r.kelas_id)), menyamar
  };
}
