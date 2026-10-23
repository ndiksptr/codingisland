// functions/api/kelas/[[rute]].js — kelas
//   GET    /api/kelas/publik            daftar kelas untuk pendaftaran (tanpa kode kelas)
//   POST   /api/kelas/cek-kode          { kelasId, kode } -> { cocok }
//   GET    /api/kelas                   kelas yang diampu guru (+ guru pengampu, jumlah siswa, rata-rata nilai)
//   POST   /api/kelas                   tambah kelas (guru otomatis menjadi pengampu)
//   GET    /api/kelas/:id               satu kelas (siswa: hanya kelasnya sendiri)
//   PUT    /api/kelas/:id               ubah kelas (guruIds hanya untuk admin)
//   POST   /api/kelas/:id/kode-baru     buat kode kelas baru
//   DELETE /api/kelas/:id               hapus kelas kosong

import { buatRouter, bacaJson, GalatApi } from '../../../server/http.js';
import { ambilSesi, aksesGuru, bolehKelas } from '../../../server/sesi.js';
import { semua, satu, jalankan, perintah, semuaKelas } from '../../../server/data.js';
import { hitungStatistik, siswaDalamAkses, rataRata } from '../../../server/statistik.js';
import { acakKodeKelas, idBaru } from '../../../server/kripto.js';

function periksaKelas(d) {
  if (!d.nama || d.nama.trim().length < 2) throw new GalatApi(400, 'Nama kelas belum diisi.');
  if (![3, 4, 5, 6].includes(Number(d.tingkat))) throw new GalatApi(400, 'Tingkat kelas harus 3 sampai 6.');
  if (!/^[A-Z0-9]{6}$/.test(d.kodeKelas)) throw new GalatApi(400, 'Kode kelas harus 6 huruf atau angka.');
}

async function kodeUnik(db) {
  const dipakai = new Set((await semua(db, 'SELECT kode_kelas FROM kelas')).map((r) => r.kode_kelas));
  let kode;
  do { kode = acakKodeKelas(); } while (dipakai.has(kode));
  return kode;
}

async function aturGuruKelas(db, kelasId, guruIds) {
  const guruAda = new Set((await semua(db, 'SELECT id FROM guru')).map((g) => g.id));
  const stmts = [perintah(db, 'DELETE FROM guru_kelas WHERE kelas_id = ?', kelasId)];
  for (const g of new Set(guruIds || [])) if (guruAda.has(g)) stmts.push(perintah(db, 'INSERT INTO guru_kelas (guru_id, kelas_id) VALUES (?,?)', g, kelasId));
  await db.batch(stmts);
}

const ambilKelas = async (db, id) => (await semuaKelas(db)).find((k) => k.id === id) || null;

export const onRequest = buatRouter([
  ['GET', 'publik', async (ctx) =>
    (await semua(ctx.env.DB, 'SELECT id, nama, tingkat FROM kelas ORDER BY tingkat, nama'))],

  ['POST', 'cek-kode', async (ctx) => {
    const { kelasId, kode } = await bacaJson(ctx.request);
    const k = await satu(ctx.env.DB, 'SELECT kode_kelas FROM kelas WHERE id = ?', kelasId);
    return { cocok: !!k && k.kode_kelas.toUpperCase() === String(kode || '').trim().toUpperCase() };
  }],

  ['GET', '', async (ctx) => {
    const a = await aksesGuru(ctx);
    const db = ctx.env.DB;
    const guruList = await semua(db, 'SELECT id, nama FROM guru');
    const stat = await hitungStatistik(db, await siswaDalamAkses(db, a), { kelas: a.kelas });
    return a.kelas.map((k) => {
      const st = stat.filter((x) => x.siswa.kelasId === k.id);
      return {
        ...k,
        guru: k.guruIds.map((id) => guruList.find((g) => g.id === id)).filter(Boolean),
        jumlahSiswa: st.length,
        rataNilai: rataRata(st.filter((x) => x.baris.levelSelesai > 0).map((x) => x.baris.nilai))
      };
    });
  }],

  ['POST', '', async (ctx) => {
    const a = await aksesGuru(ctx);
    const db = ctx.env.DB;
    const data = await bacaJson(ctx.request);
    const d = {
      nama: String(data.nama || '').trim(),
      tingkat: Number(data.tingkat),
      kodeKelas: String(data.kodeKelas || (await kodeUnik(db))).trim().toUpperCase()
    };
    periksaKelas(d);
    if (await satu(db, 'SELECT id FROM kelas WHERE kode_kelas = ?', d.kodeKelas)) throw new GalatApi(409, 'Kode kelas sudah dipakai kelas lain.');
    const id = idBaru('kelas');
    await jalankan(db, 'INSERT INTO kelas (id, nama, tingkat, kode_kelas) VALUES (?,?,?,?)', id, d.nama, d.tingkat, d.kodeKelas);
    // Guru biasa otomatis menjadi pengampu kelas yang dibuatnya; admin memilih sendiri
    await aturGuruKelas(db, id, a.admin ? (data.guruIds || []) : [a.guru.id]);
    return ambilKelas(db, id);
  }],

  ['GET', ':id', async (ctx, { id }) => {
    const db = ctx.env.DB;
    const s = await ambilSesi(ctx);
    if (s?.jenis === 'siswa') {
      const siswa = await satu(db, 'SELECT kelas_id FROM siswa WHERE id = ?', s.pengguna_id);
      if (siswa?.kelas_id !== id) throw new GalatApi(403, 'Kamu hanya bisa melihat kelasmu sendiri.');
      const k = await satu(db, 'SELECT id, nama, tingkat FROM kelas WHERE id = ?', id);
      return k || null;
    }
    const a = await aksesGuru(ctx);
    bolehKelas(a, id);
    return ambilKelas(db, id);
  }],

  ['PUT', ':id', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    bolehKelas(a, id);
    const db = ctx.env.DB;
    const lama = await ambilKelas(db, id);
    const data = await bacaJson(ctx.request);
    const baru = {
      nama: 'nama' in data ? String(data.nama).trim() : lama.nama,
      tingkat: 'tingkat' in data ? Number(data.tingkat) : lama.tingkat,
      kodeKelas: 'kodeKelas' in data ? String(data.kodeKelas).trim().toUpperCase() : lama.kodeKelas
    };
    periksaKelas(baru);
    if (await satu(db, 'SELECT id FROM kelas WHERE kode_kelas = ? AND id <> ?', baru.kodeKelas, id)) throw new GalatApi(409, 'Kode kelas sudah dipakai kelas lain.');
    await jalankan(db, 'UPDATE kelas SET nama = ?, tingkat = ?, kode_kelas = ? WHERE id = ?', baru.nama, baru.tingkat, baru.kodeKelas, id);
    if (a.admin && Array.isArray(data.guruIds)) await aturGuruKelas(db, id, data.guruIds);
    return ambilKelas(db, id);
  }],

  ['POST', ':id/kode-baru', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    bolehKelas(a, id);
    const kode = await kodeUnik(ctx.env.DB);
    await jalankan(ctx.env.DB, 'UPDATE kelas SET kode_kelas = ? WHERE id = ?', kode, id);
    return { kode };
  }],

  ['DELETE', ':id', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    bolehKelas(a, id);
    const db = ctx.env.DB;
    if (await satu(db, 'SELECT id FROM siswa WHERE kelas_id = ? LIMIT 1', id)) {
      throw new GalatApi(400, 'Kelas masih berisi siswa. Pindahkan atau hapus siswanya dulu.');
    }
    await jalankan(db, 'DELETE FROM kelas WHERE id = ?', id);
    return { ok: true };
  }]
]);
