// functions/api/auth/[[rute]].js — akun & sesi
//   GET  /api/auth/sesi                 sesi aktif (siswa/guru) atau null
//   GET  /api/auth/tahan?jenis=         sisa detik tahanan login untuk alamat IP ini
//   POST /api/auth/masuk-siswa          { username, pin }
//   POST /api/auth/masuk-guru           { username, password }
//   POST /api/auth/keluar
//   POST /api/auth/daftar               pendaftaran siswa dengan kode kelas
//   GET  /api/auth/cek-username?u=&kecuali=
//   GET  /api/auth/saran-username?panggilan=
//   GET  /api/auth/akun-demo            hanya jika env.TAMPILKAN_AKUN_DEMO = "1"
//   POST /api/auth/reset-demo           dinonaktifkan di versi server (pakai schema.sql)
//   GET  /api/auth/konteks              konteks dashboard guru
//   PATCH /api/auth/nama, POST /api/auth/password            akun guru sendiri
//   GET/PUT /api/auth/pengaturan        pengaturan permainan (PUT: admin)
//   GET/POST /api/auth/guru, PATCH/DELETE /api/auth/guru/:id, POST /api/auth/guru/:id/reset-password (admin)

import { buatRouter, json, bacaJson, kueri, GalatApi } from '../../../server/http.js';
import { hashRahasia, cocokRahasia, samarkanWaktu, acakPassword, idBaru, ITERASI_BAWAAN } from '../../../server/kripto.js';
import { buatSesi, hapusSesi, sesiUntukKlien, aksesGuru, wajibAdmin } from '../../../server/sesi.js';
import {
  semua, satu, jalankan, perintah, sekarang, siswaKeObjek, guruKeObjek, semuaKelas, bacaPengaturan,
  perintahAktivitas, sarankanUsernameDb
} from '../../../server/data.js';
import { periksaKolomSiswa } from '../../../js/game/aturan-siswa.js';
import { ZONA } from '../../../js/data/zona.js';

// ---------- Batas percobaan login (per username dan per alamat IP) ----------
const BATAS_USERNAME = 5;        // 5 kali salah ...
const LAMA_TAHAN_MS = 60 * 1000; // ... ditahan 1 menit
const BATAS_IP = 50;             // satu sekolah bisa berbagi IP, jadi batas per IP lebih longgar

const iterasi = (env) => Math.min(ITERASI_BAWAAN, Number(env.ITERASI_PBKDF2) || ITERASI_BAWAAN);
const alamatIp = (request) => request.headers.get('CF-Connecting-IP') || 'lokal';

async function sisaTahan(db, kunci) {
  const r = await satu(db, 'SELECT tahan_sampai FROM percobaan_login WHERE kunci = ?', kunci);
  return r ? Math.max(0, Math.ceil((r.tahan_sampai - Date.now()) / 1000)) : 0;
}

async function catatGagal(db, kunci, batas) {
  const r = await satu(db, 'SELECT gagal FROM percobaan_login WHERE kunci = ?', kunci);
  let gagal = (r?.gagal || 0) + 1;
  let tahanSampai = 0;
  if (gagal >= batas) { gagal = 0; tahanSampai = Date.now() + LAMA_TAHAN_MS; }
  await jalankan(db, `INSERT INTO percobaan_login (kunci, gagal, tahan_sampai, diperbarui) VALUES (?,?,?,?)
    ON CONFLICT(kunci) DO UPDATE SET gagal = excluded.gagal, tahan_sampai = excluded.tahan_sampai, diperbarui = excluded.diperbarui`,
  kunci, gagal, tahanSampai, Date.now());
  return { sisa: tahanSampai ? 0 : batas - gagal, tahanDetik: tahanSampai ? LAMA_TAHAN_MS / 1000 : 0 };
}

const hapusGagal = (db, kunci) => jalankan(db, 'DELETE FROM percobaan_login WHERE kunci = ?', kunci);

/** Pemeriksaan login bersama untuk siswa & guru. */
async function prosesMasuk(context, jenis, username, rahasia, ambilAkun, kolomHash, pesanSalah) {
  const db = context.env.DB;
  const u = String(username || '').trim().toLowerCase();
  const kunciU = `${jenis}:u:${u}`;
  const kunciIp = `${jenis}:ip:${alamatIp(context.request)}`;
  const tahan = Math.max(await sisaTahan(db, kunciU), await sisaTahan(db, kunciIp));
  if (tahan) return { hasil: { ok: false, pesan: 'Terlalu banyak percobaan. Istirahat sebentar dulu ya.', sisa: 0, tahanDetik: tahan } };

  const akun = u ? await ambilAkun(u) : null;
  const benar = akun ? await cocokRahasia(rahasia, akun[kolomHash]) : await samarkanWaktu(rahasia);
  if (!benar) {
    const hasilU = await catatGagal(db, kunciU, BATAS_USERNAME);
    const hasilIp = await catatGagal(db, kunciIp, BATAS_IP);
    return { hasil: { ok: false, pesan: pesanSalah, sisa: hasilU.sisa, tahanDetik: Math.max(hasilU.tahanDetik, hasilIp.tahanDetik) } };
  }
  await hapusGagal(db, kunciU);
  return { akun };
}

// ---------- Validasi akun guru ----------
function periksaGuru(d) {
  if (!d.nama || d.nama.trim().length < 2) throw new GalatApi(400, 'Nama guru minimal 2 huruf.');
  if (!/^[a-z][a-z0-9._]{2,23}$/.test(d.username || '')) throw new GalatApi(400, 'Username guru 3–24 huruf kecil, angka, titik, atau garis bawah.');
  if (!['admin', 'guru'].includes(d.peran)) throw new GalatApi(400, 'Peran harus admin atau guru.');
}

async function jumlahAdmin(db) {
  return (await satu(db, "SELECT COUNT(*) AS n FROM guru WHERE peran = 'admin'")).n;
}

async function aturKelasGuru(db, guruId, kelasIds) {
  const kelasAda = new Set((await semua(db, 'SELECT id FROM kelas')).map((k) => k.id));
  const stmts = [perintah(db, 'DELETE FROM guru_kelas WHERE guru_id = ?', guruId)];
  for (const k of new Set(kelasIds || [])) if (kelasAda.has(k)) stmts.push(perintah(db, 'INSERT INTO guru_kelas (guru_id, kelas_id) VALUES (?,?)', guruId, k));
  await db.batch(stmts);
}

async function daftarGuruAdmin(db) {
  const [guru, relasi, kelas] = await Promise.all([
    semua(db, 'SELECT * FROM guru'), semua(db, 'SELECT * FROM guru_kelas'), semuaKelas(db)
  ]);
  return guru.map((g) => {
    const ids = relasi.filter((r) => r.guru_id === g.id).map((r) => r.kelas_id);
    return {
      ...guruKeObjek(g, ids),
      kelas: kelas.filter((k) => ids.includes(k.id)).map((k) => ({ id: k.id, nama: k.nama }))
    };
  }).sort((p, q) => (p.peran === q.peran ? p.nama.localeCompare(q.nama) : p.peran === 'admin' ? -1 : 1));
}

export const onRequest = buatRouter([
  // ================= Sesi & masuk =================
  ['GET', 'sesi', async (ctx) => ({ sesi: await sesiUntukKlien(ctx) })],

  ['GET', 'tahan', async (ctx) => {
    const jenis = kueri(ctx.request).jenis === 'guru' ? 'guru' : 'siswa';
    return { detik: await sisaTahan(ctx.env.DB, `${jenis}:ip:${alamatIp(ctx.request)}`) };
  }],

  ['POST', 'masuk-siswa', async (ctx) => {
    const { username, pin } = await bacaJson(ctx.request);
    const { hasil, akun } = await prosesMasuk(ctx, 'siswa', username, String(pin || ''),
      (u) => satu(ctx.env.DB, 'SELECT * FROM siswa WHERE username = ?', u), 'pin_hash', 'Username atau PIN belum cocok.');
    if (hasil) return hasil;
    const setCookie = await buatSesi(ctx.env, 'siswa', akun.id);
    await perintahAktivitas(ctx.env.DB, akun.id, 'masuk', 'Masuk ke Coding Island').run();
    return json({ ok: true, siswa: siswaKeObjek(akun) }, 200, { 'Set-Cookie': setCookie });
  }],

  ['POST', 'masuk-guru', async (ctx) => {
    const { username, password } = await bacaJson(ctx.request);
    const { hasil, akun } = await prosesMasuk(ctx, 'guru', username, String(password || ''),
      (u) => satu(ctx.env.DB, 'SELECT * FROM guru WHERE username = ?', u), 'password_hash', 'Username atau password salah.');
    if (hasil) return hasil;
    const setCookie = await buatSesi(ctx.env, 'guru', akun.id);
    const kelasIds = (await semua(ctx.env.DB, 'SELECT kelas_id FROM guru_kelas WHERE guru_id = ?', akun.id)).map((r) => r.kelas_id);
    return json({ ok: true, guru: guruKeObjek(akun, kelasIds) }, 200, { 'Set-Cookie': setCookie });
  }],

  ['POST', 'keluar', async (ctx) => json({ ok: true }, 200, { 'Set-Cookie': await hapusSesi(ctx) })],

  // ================= Pendaftaran siswa =================
  ['POST', 'daftar', async (ctx) => {
    const db = ctx.env.DB;
    const data = await bacaJson(ctx.request);
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
    const kelas = await satu(db, 'SELECT * FROM kelas WHERE id = ?', d.kelasId);
    if (!kelas || kelas.kode_kelas.toUpperCase() !== d.kodeKelas.toUpperCase()) {
      return { ok: false, kolom: 'kodeKelas', pesan: 'Kode kelas belum cocok. Tanya gurumu ya.' };
    }
    if (await satu(db, 'SELECT id FROM siswa WHERE username = ?', d.username)) {
      return { ok: false, kolom: 'username', pesan: 'Username ini sudah dipakai. Coba yang lain ya.' };
    }
    const { koinAwal } = await bacaPengaturan(db);
    const id = idBaru('siswa');
    await db.batch([
      perintah(db, `INSERT INTO siswa (id, nama_lengkap, nama_panggilan, jenis_kelamin, avatar, kelas_id, username, pin_hash, koin, berlian, zona_terlihat, dibuat_pada)
        VALUES (?,?,?,?,?,?,?,?,?,0,?,?)`, id, d.namaLengkap, d.namaPanggilan, d.avatar === 'pria' ? 'L' : 'P', d.avatar, d.kelasId,
      d.username, await hashRahasia(d.pin, iterasi(ctx.env)), koinAwal, JSON.stringify([ZONA[0].id]), sekarang()),
      perintahAktivitas(db, id, 'daftar', 'Mendaftar di Coding Island')
    ]);
    const setCookie = await buatSesi(ctx.env, 'siswa', id);
    return json({ ok: true, siswa: siswaKeObjek(await satu(db, 'SELECT * FROM siswa WHERE id = ?', id)) }, 200, { 'Set-Cookie': setCookie });
  }],

  ['GET', 'cek-username', async (ctx) => {
    const { u = '', kecuali = '' } = kueri(ctx.request);
    const username = String(u).trim().toLowerCase();
    const pesan = periksaKolomSiswa('username', username);
    if (pesan) return { tersedia: false, pesan };
    const ada = await satu(ctx.env.DB, 'SELECT id FROM siswa WHERE username = ? AND id <> ?', username, kecuali);
    return ada ? { tersedia: false, pesan: 'Username ini sudah dipakai. Coba yang lain ya.' } : { tersedia: true, pesan: 'Username bisa dipakai!' };
  }],

  ['GET', 'saran-username', async (ctx) => ({ username: await sarankanUsernameDb(ctx.env.DB, kueri(ctx.request).panggilan) })],

  // ================= Demo =================
  ['GET', 'akun-demo', async (ctx) => {
    if (ctx.env.TAMPILKAN_AKUN_DEMO !== '1') return { guru: [], siswa: [] };
    const db = ctx.env.DB;
    const kelas = await semuaKelas(db);
    const siswa = await semua(db, "SELECT nama_panggilan, username, kelas_id, id FROM siswa WHERE id GLOB 'siswa_[0-9][a-z]_*' ORDER BY id");
    const guruDemo = [
      { nama: 'Admin Sekolah', username: 'admin', password: 'admin123', peran: 'admin' },
      { nama: 'Bu Sari', username: 'bu.sari', password: 'guru123', peran: 'guru' },
      { nama: 'Pak Budi', username: 'pak.budi', password: 'guru123', peran: 'guru' }
    ];
    const adaGuru = new Set((await semua(db, 'SELECT username FROM guru')).map((g) => g.username));
    return {
      guru: guruDemo.filter((g) => adaGuru.has(g.username)),
      siswa: siswa.map((s) => ({ namaPanggilan: s.nama_panggilan, username: s.username, pin: '1234', kelas: kelas.find((k) => k.id === s.kelas_id)?.nama || '-' }))
    };
  }],

  ['POST', 'reset-demo', async () => {
    throw new GalatApi(403, 'Di versi server, reset data dilakukan admin lewat perintah wrangler d1 execute dengan schema.sql (lihat README).');
  }],

  // ================= Dashboard guru: konteks & akun sendiri =================
  ['GET', 'konteks', async (ctx) => {
    const a = await aksesGuru(ctx);
    return {
      guru: guruKeObjek(a.guru, [...a.kelasIds].filter((id) => a.kelas.find((k) => k.id === id && k.guruIds.includes(a.guru.id)))),
      admin: a.admin,
      kelas: a.kelas,
      pengaturan: await bacaPengaturan(ctx.env.DB)
    };
  }],

  ['PATCH', 'nama', async (ctx) => {
    const a = await aksesGuru(ctx);
    const nama = String((await bacaJson(ctx.request)).nama || '').trim();
    if (nama.length < 2) throw new GalatApi(400, 'Nama guru minimal 2 huruf.');
    await jalankan(ctx.env.DB, 'UPDATE guru SET nama = ? WHERE id = ?', nama.slice(0, 40), a.guru.id);
    return { ok: true };
  }],

  ['POST', 'password', async (ctx) => {
    const a = await aksesGuru(ctx);
    const { lama, baru } = await bacaJson(ctx.request);
    if (!(await cocokRahasia(String(lama || ''), a.guru.password_hash))) throw new GalatApi(400, 'Password lama salah.');
    if (String(baru || '').length < 6) throw new GalatApi(400, 'Password baru minimal 6 karakter.');
    await jalankan(ctx.env.DB, 'UPDATE guru SET password_hash = ? WHERE id = ?', await hashRahasia(String(baru), iterasi(ctx.env)), a.guru.id);
    return { ok: true };
  }],

  // ================= Pengaturan permainan =================
  ['GET', 'pengaturan', async (ctx) => bacaPengaturan(ctx.env.DB)],

  ['PUT', 'pengaturan', async (ctx) => {
    wajibAdmin(await aksesGuru(ctx));
    const { hargaClue, koinAwal } = await bacaJson(ctx.request);
    const harga = (hargaClue || []).map((h) => Math.round(Number(h)));
    if (harga.length !== 3 || harga.some((h) => !Number.isFinite(h) || h < 0 || h > 999)) throw new GalatApi(400, 'Harga clue harus angka 0–999.');
    const koin = Math.round(Number(koinAwal));
    if (!Number.isFinite(koin) || koin < 0 || koin > 999) throw new GalatApi(400, 'Koin awal harus angka 0–999.');
    const db = ctx.env.DB;
    const simpan = (k, v) => perintah(db, 'INSERT INTO pengaturan (kunci, nilai) VALUES (?,?) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai', k, JSON.stringify(v));
    await db.batch([simpan('harga_clue', harga), simpan('koin_awal', koin)]);
    return bacaPengaturan(db);
  }],

  // ================= Kelola guru (admin) =================
  ['GET', 'guru', async (ctx) => {
    wajibAdmin(await aksesGuru(ctx));
    return daftarGuruAdmin(ctx.env.DB);
  }],

  ['POST', 'guru', async (ctx) => {
    wajibAdmin(await aksesGuru(ctx));
    const db = ctx.env.DB;
    const data = await bacaJson(ctx.request);
    const d = { nama: String(data.nama || '').trim(), username: String(data.username || '').trim().toLowerCase(), peran: data.peran || 'guru' };
    periksaGuru(d);
    if (!data.password || String(data.password).length < 6) throw new GalatApi(400, 'Password minimal 6 karakter.');
    if (await satu(db, 'SELECT id FROM guru WHERE username = ?', d.username)) throw new GalatApi(409, 'Username guru sudah dipakai.');
    const id = idBaru('guru');
    await jalankan(db, 'INSERT INTO guru (id, nama, username, password_hash, peran, dibuat_pada) VALUES (?,?,?,?,?,?)',
      id, d.nama, d.username, await hashRahasia(String(data.password), iterasi(ctx.env)), d.peran, sekarang());
    await aturKelasGuru(db, id, data.kelasIds);
    return (await daftarGuruAdmin(db)).find((g) => g.id === id);
  }],

  ['PATCH', 'guru/:id', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    wajibAdmin(a);
    const db = ctx.env.DB;
    const lama = await satu(db, 'SELECT * FROM guru WHERE id = ?', id);
    if (!lama) throw new GalatApi(404, 'Guru tidak ditemukan.');
    const data = await bacaJson(ctx.request);
    const baru = {
      nama: 'nama' in data ? String(data.nama).trim() : lama.nama,
      username: 'username' in data ? String(data.username).trim().toLowerCase() : lama.username,
      peran: 'peran' in data ? data.peran : lama.peran
    };
    periksaGuru(baru);
    if (id === a.guru.id && baru.peran !== 'admin') throw new GalatApi(400, 'Anda tidak bisa menurunkan peran akun sendiri.');
    if (lama.peran === 'admin' && baru.peran !== 'admin' && (await jumlahAdmin(db)) <= 1) throw new GalatApi(400, 'Harus ada minimal satu admin.');
    if (await satu(db, 'SELECT id FROM guru WHERE username = ? AND id <> ?', baru.username, id)) throw new GalatApi(409, 'Username guru sudah dipakai.');
    await jalankan(db, 'UPDATE guru SET nama = ?, username = ?, peran = ? WHERE id = ?', baru.nama, baru.username, baru.peran, id);
    if ('kelasIds' in data) await aturKelasGuru(db, id, data.kelasIds);
    return (await daftarGuruAdmin(db)).find((g) => g.id === id);
  }],

  ['DELETE', 'guru/:id', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    wajibAdmin(a);
    if (id === a.guru.id) throw new GalatApi(400, 'Anda tidak bisa menghapus akun sendiri.');
    const db = ctx.env.DB;
    const g = await satu(db, 'SELECT peran FROM guru WHERE id = ?', id);
    if (!g) return { ok: true };
    if (g.peran === 'admin' && (await jumlahAdmin(db)) <= 1) throw new GalatApi(400, 'Admin terakhir tidak bisa dihapus.');
    await db.batch([
      perintah(db, "DELETE FROM sesi WHERE jenis = 'guru' AND pengguna_id = ?", id),
      perintah(db, 'DELETE FROM guru WHERE id = ?', id)
    ]);
    return { ok: true };
  }],

  ['POST', 'guru/:id/reset-password', async (ctx, { id }) => {
    wajibAdmin(await aksesGuru(ctx));
    const db = ctx.env.DB;
    if (!(await satu(db, 'SELECT id FROM guru WHERE id = ?', id))) throw new GalatApi(404, 'Guru tidak ditemukan.');
    const password = acakPassword();
    await db.batch([
      perintah(db, 'UPDATE guru SET password_hash = ? WHERE id = ?', await hashRahasia(password, iterasi(ctx.env)), id),
      perintah(db, "DELETE FROM sesi WHERE jenis = 'guru' AND pengguna_id = ?", id)
    ]);
    return { password };
  }]
]);
