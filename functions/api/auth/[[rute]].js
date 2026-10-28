// functions/api/auth/[[rute]].js — akun & sesi
//   GET  /api/auth/sesi                 { sesi, modeDev } — sesi aktif (siswa/guru) atau null
//   GET  /api/auth/tahan?jenis=         sisa detik tahanan login untuk alamat IP ini
//   POST /api/auth/masuk-siswa          { username, pin }
//   POST /api/auth/masuk-guru           { username, password }
//   POST /api/auth/keluar
//   POST /api/auth/daftar               pendaftaran siswa dengan kode kelas
//   GET  /api/auth/cek-username?u=&kecuali=
//   GET  /api/auth/saran-username?panggilan=
//   GET  /api/auth/pasang               { perluPasang } — true jika belum ada akun guru
//   POST /api/auth/pasang               { kode, nama, username, password, konfirmasi } admin pertama (sekali pakai)
//   GET  /api/auth/konteks              konteks dashboard guru
//   PATCH /api/auth/nama, POST /api/auth/password            akun guru sendiri
//   GET/PUT /api/auth/pengaturan        pengaturan permainan (PUT: admin)
//   GET /api/auth/zona                  status aktif + dampak tiap zona (guru & admin)
//   PUT /api/auth/zona/:id              { aktif } aktifkan/nonaktifkan zona (guru & admin), dicatat di aktivitas
//   GET/POST /api/auth/guru, PATCH/DELETE /api/auth/guru/:id, POST /api/auth/guru/:id/reset-password (admin)
//   POST /api/auth/guru/:id/menyamar    admin masuk sebagai guru itu (sesi baru, admin asli dicatat)
//   POST /api/auth/akhiri-menyamar      kembali ke akun admin asli
// Selama menyamar: ubah nama/password dan kelola akun guru/admin ditolak (tolakSaatMenyamar).

import { buatRouter, json, bacaJson, kueri, GalatApi } from '../../../server/http.js';
import { hashRahasia, cocokRahasia, samarkanWaktu, acakPassword, idBaru, samaKonstan, iterasiDari, perluHashUlang } from '../../../server/kripto.js';
import { buatSesi, hapusSesi, sesiUntukKlien, aksesGuru, wajibAdmin, tolakSaatMenyamar } from '../../../server/sesi.js';
import {
  semua, satu, jalankan, perintah, sekarang, siswaKeObjek, guruKeObjek, semuaKelas, bacaPengaturan,
  perintahAktivitas, sarankanUsernameDb, bacaZonaNonaktif, zonaNonaktifDariBaris
} from '../../../server/data.js';
import { dampakZona } from '../../../server/statistik.js';
import { zonaAktif } from '../../../js/game/kemajuan.js';
import { periksaKolomSiswa } from '../../../js/game/aturan-siswa.js';
import { ZONA } from '../../../js/data/zona.js';
import { BAHASA_BAWAAN_SISWA } from '../../../js/game/kamus-perintah.js';
import { BATAS, sisaTahanLogin, sisaTahanJendela, catatGagalLogin, catatGagalJendela, hapusBatas, bersihkanKedaluwarsa } from '../../../server/batas.js';

// ---------- Batas percobaan login: semua angka ada di BATAS (server/batas.js) ----------
const PESAN_TERPASANG = 'Coding Island sudah terpasang.';
const batasIp = (jenis) => (jenis === 'guru' ? BATAS.ipGuru : BATAS.ipSiswa);

const iterasi = iterasiDari;
const alamatIp = (request) => request.headers.get('CF-Connecting-IP') || 'lokal';

// Kerja tambahan setelah jawaban dikirim (tetap jalan sampai selesai lewat waitUntil)
const nanti = (context, janji) => (context.waitUntil ? context.waitUntil(janji.catch((e) => console.error(e))) : janji);

/**
 * Pemeriksaan login bersama untuk siswa & guru.
 * tabel/kolomHash dipakai untuk hash ulang otomatis bila iterasi PBKDF2 berubah.
 */
async function prosesMasuk(context, jenis, username, rahasia, ambilAkun, tabel, kolomHash, pesanSalah) {
  const db = context.env.DB;
  const u = String(username || '').trim().toLowerCase();
  const kunciU = `${jenis}:u:${u}`;
  const kunciIp = `${jenis}:ip:${alamatIp(context.request)}`;
  // Bersihkan baris batas & sesi kedaluwarsa secara oportunistis (tidak menunda jawaban)
  nanti(context, bersihkanKedaluwarsa(db));

  const tahan = await sisaTahanLogin(db, kunciU, kunciIp, batasIp(jenis));
  if (tahan) return { hasil: { ok: false, pesan: 'Terlalu banyak percobaan. Istirahat sebentar dulu ya.', sisa: 0, tahanDetik: tahan } };

  const iter = iterasi(context.env);
  const akun = u ? await ambilAkun(u) : null;
  const benar = akun ? await cocokRahasia(rahasia, akun[kolomHash]) : await samarkanWaktu(rahasia, iter);
  if (!benar) {
    const { sisa, tahanDetik } = await catatGagalLogin(db, kunciU, kunciIp, batasIp(jenis));
    return { hasil: { ok: false, pesan: pesanSalah, sisa, tahanDetik } };
  }
  nanti(context, hapusBatas(db, kunciU));
  // Hash lama (iterasi berbeda) diganti dengan iterasi sekarang; hanya jika hash belum diubah orang lain
  if (perluHashUlang(akun[kolomHash], iter)) {
    nanti(context, (async () => jalankan(db, `UPDATE ${tabel} SET ${kolomHash} = ? WHERE id = ? AND ${kolomHash} = ?`,
      await hashRahasia(rahasia, iter), akun.id, akun[kolomHash]))());
  }
  return { akun };
}

// ---------- Validasi akun guru ----------
function periksaGuru(d) {
  if (!d.nama || d.nama.trim().length < 2) throw new GalatApi(400, 'Nama guru minimal 2 huruf.');
  if (!/^[a-z][a-z0-9._]{2,23}$/.test(d.username || '')) throw new GalatApi(400, 'Username guru 3–24 huruf kecil, angka, titik, atau garis bawah.');
  if (!['admin', 'guru'].includes(d.peran)) throw new GalatApi(400, 'Peran harus admin atau guru.');
}

/** Kelola akun guru/admin: wajib admin yang masuk dengan akunnya sendiri (bukan sedang menyamar). */
function wajibAdminAsli(a) {
  tolakSaatMenyamar(a, 'mengelola akun guru atau admin');
  wajibAdmin(a);
}

async function jumlahGuru(db) {
  return (await satu(db, 'SELECT COUNT(*) AS n FROM guru')).n;
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
  // modeDev memberi tahu browser apakah alat pengembang boleh dimuat (MODE_DEV=1 hanya di .dev.vars)
  ['GET', 'sesi', async (ctx) => ({ sesi: await sesiUntukKlien(ctx), modeDev: ctx.env.MODE_DEV === '1' })],

  ['GET', 'tahan', async (ctx) => {
    const jenis = kueri(ctx.request).jenis === 'guru' ? 'guru' : 'siswa';
    return { detik: await sisaTahanJendela(ctx.env.DB, `${jenis}:ip:${alamatIp(ctx.request)}`, batasIp(jenis)) };
  }],

  ['POST', 'masuk-siswa', async (ctx) => {
    const { username, pin } = await bacaJson(ctx.request);
    const { hasil, akun } = await prosesMasuk(ctx, 'siswa', username, String(pin || ''),
      (u) => satu(ctx.env.DB, 'SELECT * FROM siswa WHERE username = ?', u), 'siswa', 'pin_hash', 'Username atau PIN belum cocok.');
    if (hasil) return hasil;
    const setCookie = await buatSesi(ctx.env, 'siswa', akun.id);
    await perintahAktivitas(ctx.env.DB, akun.id, 'masuk', 'Masuk ke Coding Island').run();
    return json({ ok: true, siswa: siswaKeObjek(akun) }, 200, { 'Set-Cookie': setCookie });
  }],

  ['POST', 'masuk-guru', async (ctx) => {
    const { username, password } = await bacaJson(ctx.request);
    const { hasil, akun } = await prosesMasuk(ctx, 'guru', username, String(password || ''),
      (u) => satu(ctx.env.DB, 'SELECT * FROM guru WHERE username = ?', u), 'guru', 'password_hash', 'Username atau password salah.');
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
      perintah(db, `INSERT INTO siswa (id, nama_lengkap, nama_panggilan, jenis_kelamin, avatar, kelas_id, username, pin_hash, koin, berlian, zona_terlihat, dibuat_pada, bahasa)
        VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?)`, id, d.namaLengkap, d.namaPanggilan, d.avatar === 'pria' ? 'L' : 'P', d.avatar, d.kelasId,
      d.username, await hashRahasia(d.pin, iterasi(ctx.env)), koinAwal, JSON.stringify([ZONA[0].id]), sekarang(), BAHASA_BAWAAN_SISWA),
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

  // ================= Pemasangan pertama (sekali pakai) =================
  ['GET', 'pasang', async (ctx) => ({ perluPasang: (await jumlahGuru(ctx.env.DB)) === 0 })],

  ['POST', 'pasang', async (ctx) => {
    const db = ctx.env.DB;
    if (await jumlahGuru(db)) throw new GalatApi(403, PESAN_TERPASANG);
    if (!ctx.env.KODE_PASANG) throw new GalatApi(500, 'Kode pemasangan belum diatur di server. Jalankan: npx wrangler secret put KODE_PASANG');

    const kunci = `pasang:ip:${alamatIp(ctx.request)}`;
    const tahan = await sisaTahanJendela(db, kunci, BATAS.ipPasang);
    if (tahan) return { ok: false, kolom: 'kode', pesan: `Terlalu banyak kode salah. Coba lagi dalam ${Math.ceil(tahan / 60)} menit.`, tahanDetik: tahan };

    const data = await bacaJson(ctx.request);
    const d = {
      nama: String(data.nama || '').trim().replace(/\s+/g, ' '),
      username: String(data.username || '').trim().toLowerCase(),
      password: String(data.password || ''),
      konfirmasi: String(data.konfirmasi || '')
    };
    if (d.nama.length < 2 || d.nama.length > 40) return { ok: false, kolom: 'nama', pesan: 'Nama admin 2–40 huruf.' };
    if (!/^[a-z][a-z0-9._]{2,23}$/.test(d.username)) return { ok: false, kolom: 'username', pesan: 'Username 3–24 huruf kecil, angka, titik, atau garis bawah, diawali huruf.' };
    if (d.password.length < 8 || d.password.length > 64) return { ok: false, kolom: 'password', pesan: 'Password minimal 8 karakter.' };
    if (d.konfirmasi !== d.password) return { ok: false, kolom: 'konfirmasi', pesan: 'Konfirmasi password belum sama.' };

    // Kode dicocokkan dengan waktu konstan; setiap kode salah dihitung per IP
    if (!(await samaKonstan(String(data.kode || '').trim(), ctx.env.KODE_PASANG))) {
      const sisa = await catatGagalJendela(db, kunci, BATAS.ipPasang);
      return sisa
        ? { ok: false, kolom: 'kode', pesan: `Kode pemasangan salah. Sisa ${sisa} kesempatan.` }
        : { ok: false, kolom: 'kode', pesan: 'Kode pemasangan salah. Coba lagi dalam 15 menit.', tahanDetik: await sisaTahanJendela(db, kunci, BATAS.ipPasang) };
    }

    // Hanya berhasil jika tabel guru masih kosong (aman bila dua orang memasang bersamaan)
    const id = idBaru('guru');
    const hasil = await jalankan(db, `INSERT INTO guru (id, nama, username, password_hash, peran, dibuat_pada)
      SELECT ?, ?, ?, ?, 'admin', ? WHERE NOT EXISTS (SELECT 1 FROM guru)`,
    id, d.nama, d.username, await hashRahasia(d.password, iterasi(ctx.env)), sekarang());
    if (!hasil.meta?.changes) throw new GalatApi(403, PESAN_TERPASANG);
    await hapusBatas(db, kunci);

    const setCookie = await buatSesi(ctx.env, 'guru', id);
    return json({ ok: true, guru: guruKeObjek(await satu(db, 'SELECT * FROM guru WHERE id = ?', id), []) }, 200, { 'Set-Cookie': setCookie });
  }],

  // ================= Dashboard guru: konteks & akun sendiri =================
  ['GET', 'konteks', async (ctx) => {
    const a = await aksesGuru(ctx);
    return {
      guru: guruKeObjek(a.guru, [...a.kelasIds].filter((id) => a.kelas.find((k) => k.id === id && k.guruIds.includes(a.guru.id)))),
      admin: a.admin,
      // menyamar: { adminNama } bila admin sedang masuk sebagai guru ini; null bila tidak
      menyamar: a.menyamar ? { adminNama: a.menyamar.adminNama } : null,
      kelas: a.kelas,
      pengaturan: await bacaPengaturan(ctx.env.DB)
    };
  }],

  ['PATCH', 'nama', async (ctx) => {
    const a = await aksesGuru(ctx);
    tolakSaatMenyamar(a, 'mengubah nama akun');
    const nama = String((await bacaJson(ctx.request)).nama || '').trim();
    if (nama.length < 2) throw new GalatApi(400, 'Nama tampilan minimal 2 huruf.');
    await jalankan(ctx.env.DB, 'UPDATE guru SET nama = ? WHERE id = ?', nama.slice(0, 40), a.guru.id);
    return { ok: true };
  }],

  ['POST', 'password', async (ctx) => {
    const a = await aksesGuru(ctx);
    tolakSaatMenyamar(a, 'mengganti password');
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

  // ================= Zona aktif/nonaktif (guru & admin; sakelarnya di halaman Level & Soal) =================
  // Disimpan di pengaturan.zona_nonaktif (JSON array id zona). Progres, bintang, koin, dan berlian
  // murid di zona itu TIDAK dihapus; zona yang diaktifkan lagi kembali seperti semula.
  // Zona nonaktif juga mengunci zona sesudahnya (js/game/kemajuan.js). GET menyertakan dampakZona untuk konfirmasi.
  ['GET', 'zona', async (ctx) => {
    await aksesGuru(ctx);
    const db = ctx.env.DB;
    const [zonaNonaktif, dampak] = await Promise.all([bacaZonaNonaktif(db), dampakZona(db)]);
    return ZONA.map((z) => ({
      id: z.id, nama: z.nama, konsep: z.konsep, warna: z.warna,
      aktif: !zonaNonaktif.includes(z.id),
      ...dampak.find((d) => d.id === z.id)
    }));
  }],

  ['PUT', 'zona/:id', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    const zona = ZONA.find((z) => z.id === id);
    if (!zona) throw new GalatApi(404, 'Pulau tidak ditemukan. Muat ulang halaman, lalu coba lagi.');
    const { aktif } = await bacaJson(ctx.request);
    if (typeof aktif !== 'boolean') throw new GalatApi(400, 'Pilih aktif atau nonaktif.');
    const db = ctx.env.DB;
    const baris = await satu(db, "SELECT nilai FROM pengaturan WHERE kunci = 'zona_nonaktif'");
    const lama = zonaNonaktifDariBaris(baris);
    const baru = ZONA.map((z) => z.id).filter((x) => (x === id ? !aktif : lama.includes(x)));
    if (!zonaAktif(baru).length) throw new GalatApi(400, 'Minimal satu pulau harus tetap aktif. Nyalakan pulau lain dulu sebelum mematikan pulau ini.');
    if (baru.length === lama.length && baru.every((x) => lama.includes(x))) return { zonaNonaktif: lama };

    // Simpan hanya jika belum diubah orang lain sejak dibaca; aktivitas ditulis hanya bila tersimpan.
    // Satu baris aktivitas per murid (tabel aktivitas per murid), karena zona berlaku untuk semua kelas.
    const [simpan] = await db.batch([
      baris
        ? perintah(db, "UPDATE pengaturan SET nilai = ? WHERE kunci = 'zona_nonaktif' AND nilai = ?", JSON.stringify(baru), baris.nilai)
        : perintah(db, "INSERT INTO pengaturan (kunci, nilai) VALUES ('zona_nonaktif', ?) ON CONFLICT(kunci) DO NOTHING", JSON.stringify(baru)),
      perintah(db, "INSERT INTO aktivitas (waktu, siswa_id, jenis, keterangan) SELECT ?, id, 'zona', ? FROM siswa WHERE changes() = 1",
        sekarang(), `Zona ${zona.nama} ${aktif ? 'diaktifkan' : 'dinonaktifkan'} oleh ${a.pelaku.nama}`)
    ]);
    if (!simpan.meta?.changes) throw new GalatApi(409, 'Pengaturan pulau baru saja diubah oleh guru lain. Muat ulang halaman, lalu coba lagi.');
    return { zonaNonaktif: baru };
  }],

  // ================= Kelola guru (admin) =================
  ['GET', 'guru', async (ctx) => {
    wajibAdminAsli(await aksesGuru(ctx));
    return daftarGuruAdmin(ctx.env.DB);
  }],

  ['POST', 'guru', async (ctx) => {
    wajibAdminAsli(await aksesGuru(ctx));
    const db = ctx.env.DB;
    const data = await bacaJson(ctx.request);
    const d = { nama: String(data.nama || '').trim(), username: String(data.username || '').trim().toLowerCase(), peran: data.peran || 'guru' };
    periksaGuru(d);
    if (!data.password || String(data.password).length < 6) throw new GalatApi(400, 'Password minimal 6 karakter.');
    if (await satu(db, 'SELECT id FROM guru WHERE username = ?', d.username)) throw new GalatApi(409, 'Username ini sudah dipakai akun guru lain. Pilih username lain.');
    const id = idBaru('guru');
    await jalankan(db, 'INSERT INTO guru (id, nama, username, password_hash, peran, dibuat_pada) VALUES (?,?,?,?,?,?)',
      id, d.nama, d.username, await hashRahasia(String(data.password), iterasi(ctx.env)), d.peran, sekarang());
    await aturKelasGuru(db, id, data.kelasIds);
    return (await daftarGuruAdmin(db)).find((g) => g.id === id);
  }],

  ['PATCH', 'guru/:id', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    wajibAdminAsli(a);
    const db = ctx.env.DB;
    const lama = await satu(db, 'SELECT * FROM guru WHERE id = ?', id);
    if (!lama) throw new GalatApi(404, 'Akun guru ini tidak ditemukan, mungkin sudah dihapus. Muat ulang halaman.');
    const data = await bacaJson(ctx.request);
    const baru = {
      nama: 'nama' in data ? String(data.nama).trim() : lama.nama,
      username: 'username' in data ? String(data.username).trim().toLowerCase() : lama.username,
      peran: 'peran' in data ? data.peran : lama.peran
    };
    periksaGuru(baru);
    if (id === a.guru.id && baru.peran !== 'admin') throw new GalatApi(400, 'Anda tidak bisa menurunkan peran akun sendiri.');
    if (lama.peran === 'admin' && baru.peran !== 'admin' && (await jumlahAdmin(db)) <= 1) throw new GalatApi(400, 'Harus ada minimal satu admin.');
    if (await satu(db, 'SELECT id FROM guru WHERE username = ? AND id <> ?', baru.username, id)) throw new GalatApi(409, 'Username ini sudah dipakai akun guru lain. Pilih username lain.');
    await jalankan(db, 'UPDATE guru SET nama = ?, username = ?, peran = ? WHERE id = ?', baru.nama, baru.username, baru.peran, id);
    // Peran berubah: akhiri penyamaran yang dibuka oleh atau ke akun ini
    if (lama.peran !== baru.peran) await jalankan(db, 'DELETE FROM sesi WHERE admin_asli_id = ? OR (pengguna_id = ? AND admin_asli_id IS NOT NULL)', id, id);
    if ('kelasIds' in data) await aturKelasGuru(db, id, data.kelasIds);
    return (await daftarGuruAdmin(db)).find((g) => g.id === id);
  }],

  ['DELETE', 'guru/:id', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    wajibAdminAsli(a);
    if (id === a.guru.id) throw new GalatApi(400, 'Anda tidak bisa menghapus akun sendiri.');
    const db = ctx.env.DB;
    const g = await satu(db, 'SELECT peran FROM guru WHERE id = ?', id);
    if (!g) return { ok: true };
    if (g.peran === 'admin' && (await jumlahAdmin(db)) <= 1) throw new GalatApi(400, 'Admin terakhir tidak bisa dihapus.');
    await db.batch([
      perintah(db, "DELETE FROM sesi WHERE (jenis = 'guru' AND pengguna_id = ?) OR admin_asli_id = ?", id, id),
      perintah(db, 'DELETE FROM guru WHERE id = ?', id)
    ]);
    return { ok: true };
  }],

  ['POST', 'guru/:id/reset-password', async (ctx, { id }) => {
    wajibAdminAsli(await aksesGuru(ctx));
    const db = ctx.env.DB;
    if (!(await satu(db, 'SELECT id FROM guru WHERE id = ?', id))) throw new GalatApi(404, 'Akun guru ini tidak ditemukan, mungkin sudah dihapus. Muat ulang halaman.');
    const password = acakPassword();
    await db.batch([
      perintah(db, 'UPDATE guru SET password_hash = ? WHERE id = ?', await hashRahasia(password, iterasi(ctx.env)), id),
      perintah(db, "DELETE FROM sesi WHERE (jenis = 'guru' AND pengguna_id = ?) OR admin_asli_id = ?", id, id)
    ]);
    return { password };
  }],

  // ================= Admin masuk sebagai guru (menyamar) =================
  ['POST', 'guru/:id/menyamar', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    tolakSaatMenyamar(a, 'masuk sebagai guru lain lagi');
    wajibAdmin(a);
    if (id === a.guru.id) throw new GalatApi(400, 'Anda sudah berada di akun sendiri.');
    const db = ctx.env.DB;
    const g = await satu(db, 'SELECT id, peran FROM guru WHERE id = ?', id);
    if (!g) throw new GalatApi(404, 'Akun guru ini tidak ditemukan, mungkin sudah dihapus. Muat ulang halaman.');
    if (g.peran !== 'guru') throw new GalatApi(403, 'Hanya bisa masuk sebagai akun guru, bukan admin.');
    // Sesi admin ditutup; sesi guru baru menyimpan id admin agar bisa kembali
    await hapusSesi(ctx);
    const setCookie = await buatSesi(ctx.env, 'guru', g.id, a.guru.id);
    return json({ ok: true }, 200, { 'Set-Cookie': setCookie });
  }],

  ['POST', 'akhiri-menyamar', async (ctx) => {
    const a = await aksesGuru(ctx);
    if (!a.menyamar) throw new GalatApi(400, 'Anda tidak sedang masuk sebagai guru lain.');
    const db = ctx.env.DB;
    const adm = await satu(db, 'SELECT id, peran FROM guru WHERE id = ?', a.menyamar.adminId);
    if (!adm || adm.peran !== 'admin') {
      // Akun admin asli sudah tidak ada atau bukan admin lagi: cukup keluar
      return json({ galat: 'Akun admin asli tidak ditemukan. Silakan masuk lagi.' }, 403, { 'Set-Cookie': await hapusSesi(ctx) });
    }
    const setCookie = await buatSesi(ctx.env, 'guru', adm.id);
    await hapusSesi(ctx); // sesi penyamaran dihapus
    return json({ ok: true }, 200, { 'Set-Cookie': setCookie });
  }]
]);
