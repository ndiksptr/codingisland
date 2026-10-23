// functions/api/siswa/[[rute]].js — siswa
// Untuk siswa yang masuk:
//   GET   /api/siswa/saya                 data diri (tanpa hash PIN)
//   PATCH /api/siswa/saya/avatar          { avatar }
//   POST  /api/siswa/saya/zona-terlihat   { zonaIds }
// Untuk guru (dibatasi kelas yang diampu; admin semua):
//   GET    /api/siswa?kelasId=            daftar + statistik
//   POST   /api/siswa                     tambah (username otomatis, PIN acak dikembalikan sekali)
//   POST   /api/siswa/impor/pratinjau     periksa baris CSV
//   POST   /api/siswa/impor               buat akun dari baris CSV yang valid
//   GET    /api/siswa/:id                 detail + progres per level + catatan guru
//   PATCH  /api/siswa/:id                 ubah nama/avatar/username/kelas
//   POST   /api/siswa/:id/reset-pin       PIN baru acak
//   PUT    /api/siswa/:id/catatan         { teks }
//   DELETE /api/siswa/:id

import { buatRouter, bacaJson, kueri, GalatApi } from '../../../server/http.js';
import { wajibSiswa, aksesGuru, bolehKelas, saringKelas, ambilSiswaBoleh } from '../../../server/sesi.js';
import {
  semua, satu, jalankan, perintah, sekarang, siswaKeObjek, bacaPengaturan, perintahAktivitas, sarankanUsernameDb
} from '../../../server/data.js';
import { hitungStatistik, siswaDalamAkses } from '../../../server/statistik.js';
import { hashRahasia, acakPin, idBaru, ITERASI_BAWAAN } from '../../../server/kripto.js';
import { periksaKolomSiswa } from '../../../js/game/aturan-siswa.js';
import { ZONA } from '../../../js/data/zona.js';

const iterasi = (env) => Math.min(ITERASI_BAWAAN, Number(env.ITERASI_PBKDF2) || ITERASI_BAWAAN);

// ---------- Tambah siswa oleh guru (juga dipakai impor) ----------
async function tambahSiswaOlehGuru(ctx, a, data) {
  const db = ctx.env.DB;
  bolehKelas(a, data.kelasId);
  const d = {
    namaLengkap: String(data.namaLengkap || '').trim().replace(/\s+/g, ' '),
    namaPanggilan: String(data.namaPanggilan || '').trim(),
    avatar: data.avatar || (data.jenisKelamin === 'P' ? 'wanita' : 'pria'),
    kelasId: data.kelasId,
    username: String(data.username || '').trim().toLowerCase() || await sarankanUsernameDb(db, data.namaPanggilan)
  };
  for (const kolom of ['namaLengkap', 'namaPanggilan', 'avatar', 'kelasId', 'username']) {
    const pesan = periksaKolomSiswa(kolom, d[kolom]);
    if (pesan) throw new GalatApi(400, pesan);
  }
  if (await satu(db, 'SELECT id FROM siswa WHERE username = ?', d.username)) throw new GalatApi(409, 'Username ini sudah dipakai. Coba yang lain ya.');
  const pin = acakPin();
  const id = idBaru('siswa');
  const { koinAwal } = await bacaPengaturan(db);
  await db.batch([
    perintah(db, `INSERT INTO siswa (id, nama_lengkap, nama_panggilan, jenis_kelamin, avatar, kelas_id, username, pin_hash, koin, berlian, zona_terlihat, dibuat_pada)
      VALUES (?,?,?,?,?,?,?,?,?,0,?,?)`, id, d.namaLengkap, d.namaPanggilan, d.avatar === 'pria' ? 'L' : 'P', d.avatar, d.kelasId,
    d.username, await hashRahasia(pin, iterasi(ctx.env)), koinAwal, JSON.stringify([ZONA[0].id]), sekarang()),
    perintahAktivitas(db, id, 'daftar', `Didaftarkan oleh ${a.guru.nama}`)
  ]);
  return { siswa: siswaKeObjek(await satu(db, 'SELECT * FROM siswa WHERE id = ?', id)), pin };
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
const BATAS_IMPOR = 200;

export const onRequest = buatRouter([
  // ================= Siswa yang masuk =================
  ['GET', 'saya', async (ctx) => siswaKeObjek(await wajibSiswa(ctx))],

  ['PATCH', 'saya/avatar', async (ctx) => {
    const s = await wajibSiswa(ctx);
    const { avatar } = await bacaJson(ctx.request);
    if (!['pria', 'wanita'].includes(avatar)) throw new GalatApi(400, 'Pilih salah satu gambar ya.');
    await jalankan(ctx.env.DB, 'UPDATE siswa SET avatar = ?, jenis_kelamin = ? WHERE id = ?', avatar, avatar === 'pria' ? 'L' : 'P', s.id);
    return siswaKeObjek(await satu(ctx.env.DB, 'SELECT * FROM siswa WHERE id = ?', s.id));
  }],

  ['POST', 'saya/zona-terlihat', async (ctx) => {
    const s = await wajibSiswa(ctx);
    const { zonaIds } = await bacaJson(ctx.request);
    const bersih = [...new Set(zonaIds || [])].filter((z) => ZONA.some((x) => x.id === z));
    await jalankan(ctx.env.DB, 'UPDATE siswa SET zona_terlihat = ? WHERE id = ?', JSON.stringify(bersih), s.id);
    return siswaKeObjek(await satu(ctx.env.DB, 'SELECT * FROM siswa WHERE id = ?', s.id));
  }],

  // ================= Guru =================
  ['GET', '', async (ctx) => {
    const a = await aksesGuru(ctx);
    const k = saringKelas(a, kueri(ctx.request).kelasId || null);
    return (await hitungStatistik(ctx.env.DB, await siswaDalamAkses(ctx.env.DB, a, k))).map((x) => x.baris);
  }],

  ['POST', '', async (ctx) => tambahSiswaOlehGuru(ctx, await aksesGuru(ctx), await bacaJson(ctx.request))],

  ['POST', 'impor/pratinjau', async (ctx) => {
    const a = await aksesGuru(ctx);
    const { baris } = await bacaJson(ctx.request);
    return (baris || []).slice(0, BATAS_IMPOR).map((b, i) => periksaBarisImpor(a, b, i + 1));
  }],

  ['POST', 'impor', async (ctx) => {
    const a = await aksesGuru(ctx);
    const { baris } = await bacaJson(ctx.request);
    const hasil = [];
    for (const [i, b] of (baris || []).slice(0, BATAS_IMPOR).entries()) {
      const cek = periksaBarisImpor(a, b, i + 1);
      if (!cek.ok) { hasil.push(cek); continue; }
      try {
        const { siswa, pin } = await tambahSiswaOlehGuru(ctx, a, {
          namaLengkap: cek.data.namaLengkap, namaPanggilan: cek.data.namaPanggilan,
          avatar: cek.data.jenisKelamin === 'P' ? 'wanita' : 'pria', kelasId: cek.data.kelasId
        });
        hasil.push({ ...cek, username: siswa.username, pin });
      } catch (err) {
        hasil.push({ ...cek, ok: false, pesan: err.message });
      }
    }
    return hasil;
  }],

  ['GET', ':id', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    const db = ctx.env.DB;
    const baris = await ambilSiswaBoleh(ctx, a, id);
    const [x] = await hitungStatistik(db, [baris]);
    const peta = new Map(x.progres.map((p) => [p.levelId, p]));
    const urutZona = (l) => ZONA.findIndex((z) => z.id === l.zona);
    const levels = x.levels.slice().sort((p, q) => urutZona(p) - urutZona(q) || (p.urutan ?? 0) - (q.urutan ?? 0));
    const catatan = await satu(db, 'SELECT * FROM catatan_guru WHERE siswa_id = ?', id);
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
          clueDibeli: p?.clueDibeli || 0, detik: p?.detik || 0, diperbarui: p?.diperbarui || null, kodeTerakhir: p?.kodeTerakhir || ''
        };
      }),
      catatan: catatan ? { teks: catatan.teks, diperbarui: catatan.diperbarui, guruId: catatan.guru_id, guruNama: catatan.guru_nama } : null
    };
  }],

  ['PATCH', ':id', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    const db = ctx.env.DB;
    const lama = await ambilSiswaBoleh(ctx, a, id);
    const data = await bacaJson(ctx.request);
    const baru = {
      namaLengkap: 'namaLengkap' in data ? String(data.namaLengkap).trim().replace(/\s+/g, ' ') : lama.nama_lengkap,
      namaPanggilan: 'namaPanggilan' in data ? String(data.namaPanggilan).trim() : lama.nama_panggilan,
      avatar: 'avatar' in data ? data.avatar : lama.avatar,
      username: 'username' in data ? String(data.username).trim().toLowerCase() : lama.username,
      kelasId: 'kelasId' in data ? data.kelasId : lama.kelas_id
    };
    for (const kolom of ['namaLengkap', 'namaPanggilan', 'avatar', 'username', 'kelasId']) {
      const pesan = periksaKolomSiswa(kolom, baru[kolom]);
      if (pesan) throw new GalatApi(400, pesan);
    }
    if ('kelasId' in data) bolehKelas(a, baru.kelasId);
    if (await satu(db, 'SELECT id FROM siswa WHERE username = ? AND id <> ?', baru.username, id)) throw new GalatApi(409, 'Username ini sudah dipakai. Coba yang lain ya.');
    await jalankan(db, 'UPDATE siswa SET nama_lengkap = ?, nama_panggilan = ?, avatar = ?, jenis_kelamin = ?, username = ?, kelas_id = ? WHERE id = ?',
      baru.namaLengkap, baru.namaPanggilan, baru.avatar, baru.avatar === 'pria' ? 'L' : 'P', baru.username, baru.kelasId, id);
    return siswaKeObjek(await satu(db, 'SELECT * FROM siswa WHERE id = ?', id));
  }],

  ['POST', ':id/reset-pin', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    await ambilSiswaBoleh(ctx, a, id);
    const pin = acakPin();
    const db = ctx.env.DB;
    await db.batch([
      perintah(db, 'UPDATE siswa SET pin_hash = ? WHERE id = ?', await hashRahasia(pin, iterasi(ctx.env)), id),
      perintah(db, "DELETE FROM sesi WHERE jenis = 'siswa' AND pengguna_id = ?", id)
    ]);
    return { pin };
  }],

  ['PUT', ':id/catatan', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    await ambilSiswaBoleh(ctx, a, id);
    const teks = String((await bacaJson(ctx.request)).teks || '').slice(0, 4000);
    const waktu = sekarang();
    await jalankan(ctx.env.DB, `INSERT INTO catatan_guru (siswa_id, teks, guru_id, guru_nama, diperbarui) VALUES (?,?,?,?,?)
      ON CONFLICT(siswa_id) DO UPDATE SET teks = excluded.teks, guru_id = excluded.guru_id, guru_nama = excluded.guru_nama, diperbarui = excluded.diperbarui`,
    id, teks, a.guru.id, a.guru.nama, waktu);
    return { teks, diperbarui: waktu, guruId: a.guru.id, guruNama: a.guru.nama };
  }],

  ['DELETE', ':id', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    await ambilSiswaBoleh(ctx, a, id);
    const db = ctx.env.DB;
    // progres, aktivitas, catatan, dan nilai_timpa ikut terhapus lewat ON DELETE CASCADE
    await db.batch([
      perintah(db, "DELETE FROM sesi WHERE jenis = 'siswa' AND pengguna_id = ?", id),
      perintah(db, 'DELETE FROM siswa WHERE id = ?', id)
    ]);
    return { ok: true };
  }]
]);
