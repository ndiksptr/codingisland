// functions/api/level/[[rute]].js — level & soal
// Untuk siswa:
//   GET /api/level/terbit?zona=        level terbit untuk kelas siswa. Solusi tidak dikirim, dan clue
//                                      hanya yang sudah dibeli (agar tidak bisa diintip tanpa membayar).
//                                      Level dari zona yang dinonaktifkan guru tidak dikirim sama sekali.
//   GET /api/level/harga-clue          harga Clue 1–3
// Alat pengembang (guru, atau siswa jika env.MODE_DEV = "1"):
//   GET /api/level/semua, GET /api/level/:id
// Untuk guru (level bawaan + level kelasnya + level buatannya):
//   GET  /api/level/guru               daftar ringkas
//   GET  /api/level/guru/:id           data lengkap (edit / coba main)
//   POST /api/level/guru               { level, terbit }  buat
//   PUT  /api/level/guru/:id           { level, terbit }  ubah
//   POST /api/level/guru/:id/duplikat | /urutan { arah } | /aktif { aktif }
//   DELETE /api/level/guru/:id

import { buatRouter, bacaJson, kueri, GalatApi } from '../../../server/http.js';
import { ambilSesi, wajibSiswa, aksesGuru } from '../../../server/sesi.js';
import {
  semua, satu, perintah, sekarang, semuaKelas, semuaLevel, bacaPengaturan, bacaZonaNonaktif, perintahSimpanLevel,
  levelBerlaku, rapikanUrutan, levelKeObjek
} from '../../../server/data.js';
import { tokenAcak } from '../../../server/kripto.js';
import { alasanBelumSiap } from '../../../js/game/validasi-level.js';
import { SEMUA_PERINTAH } from '../../../js/game/interpreter.js';
import { ZONA } from '../../../js/data/zona.js';

const BATAS_TEKS = 5000;
const urutZona = (l) => ZONA.findIndex((z) => z.id === l.zona);
const urutkan = (levels) => levels.sort((p, q) => urutZona(p) - urutZona(q) || (p.urutan ?? 0) - (q.urutan ?? 0));

// ---------- Hak akses level untuk guru ----------
const levelBolehDilihat = (a, l) => !!l.bawaan || a.admin || l.pembuat?.id === a.guru.id || (l.kelasIds || []).some((k) => a.kelasIds.has(k));
const levelBolehDiubah = (a, l) => a.admin || (!l.bawaan && l.pembuat?.id === a.guru.id);

function statusLevelUntuk(a, l) {
  if (!l.bawaan) return l.terbit ? 'terbit' : 'draf';
  if (l.terbit === false) return 'nonaktif';
  if (a.admin) return 'terbit';
  const non = (l.kelasNonaktif || []).filter((k) => a.kelasIds.has(k));
  if (!non.length) return 'terbit';
  return non.length >= a.kelasIds.size ? 'nonaktif' : 'sebagian';
}

function ringkasLevel(a, l, kelas) {
  const bisaEdit = levelBolehDiubah(a, l);
  return {
    id: l.id, zona: l.zona, urutan: l.urutan, judul: l.judul, jenis: l.jenis,
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

async function ambilLevelBoleh(ctx, a, id) {
  const r = await satu(ctx.env.DB, 'SELECT * FROM level WHERE id = ?', id);
  const l = r ? levelKeObjek(r) : null;
  if (!l || !levelBolehDilihat(a, l)) throw new GalatApi(404, 'Level tidak ditemukan.');
  return l;
}

async function levelLengkapUntukGuru(ctx, a, id) {
  const l = await ambilLevelBoleh(ctx, a, id);
  return { ...l, ...ringkasLevel(a, l, await semuaKelas(ctx.env.DB)), tingkat: l.tingkat || [3, 4, 5, 6] };
}

/** Simpan level yang berubah urutannya + level utama dalam satu batch. */
async function simpanBanyak(db, levels) {
  if (levels.length) await db.batch(levels.map((l) => perintahSimpanLevel(db, l)));
}

// Sisipkan level di akhir zona tetapi sebelum boss (boss baru ditaruh paling akhir)
function sisipkanSebelumBoss(levels, level) {
  const lain = levels.filter((l) => l.zona === level.zona && l.id !== level.id);
  const acuan = level.jenis === 'boss' ? lain : lain.filter((l) => l.jenis !== 'boss');
  level.urutan = (acuan.length ? Math.max(...acuan.map((l) => l.urutan ?? 0)) : 0) + 0.5;
}

async function idLevelBaru(db, zona) {
  const ada = new Set((await semua(db, 'SELECT id FROM level')).map((r) => r.id));
  let id;
  do { id = `${zona}-g${tokenAcak(3)}`; } while (ada.has(id));
  return id;
}

function periksaDunia(d) {
  if (!d || !Number.isInteger(d.kolom) || !Number.isInteger(d.baris)) throw new GalatApi(400, 'Data panggung tidak lengkap.');
  if (d.kolom < 4 || d.kolom > 12 || d.baris < 3 || d.baris > 8) throw new GalatApi(400, 'Ukuran panggung tidak valid.');
  const dalam = (o) => o && Number.isInteger(o.x) && Number.isInteger(o.y) && o.x >= 0 && o.y >= 0 && o.x < d.kolom && o.y < d.baris;
  return {
    kolom: d.kolom,
    baris: d.baris,
    robot: dalam(d.robot) ? { x: d.robot.x, y: d.robot.y, arah: ['utara', 'timur', 'selatan', 'barat'].includes(d.robot.arah) ? d.robot.arah : 'timur' } : null,
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

/** Buat atau ubah level dari data form editor guru. */
async function simpanLevelGuru(ctx, idLama, data, terbit) {
  const a = await aksesGuru(ctx);
  const db = ctx.env.DB;
  const semuaL = await semuaLevel(db);
  const lama = idLama ? semuaL.find((l) => l.id === idLama) : null;
  if (idLama && (!lama || !levelBolehDilihat(a, lama))) throw new GalatApi(404, 'Level tidak ditemukan.');
  if (lama && !levelBolehDiubah(a, lama)) throw new GalatApi(403, 'Anda hanya bisa mengubah level buatan Anda sendiri.');

  if (!ZONA.some((z) => z.id === data.zona)) throw new GalatApi(400, 'Pilih zona.');
  if (!['ketik', 'debug', 'boss'].includes(data.jenis)) throw new GalatApi(400, 'Pilih jenis level.');
  const judul = String(data.judul || '').trim().replace(/\s+/g, ' ');
  if (judul.length < 3 || judul.length > 60) throw new GalatApi(400, 'Judul 3–60 huruf.');

  let kelasIds;
  if (data.kelasIds === null && a.admin) kelasIds = null;
  else {
    kelasIds = [...new Set(Array.isArray(data.kelasIds) ? data.kelasIds : [])];
    const boleh = new Set(a.admin ? (await semuaKelas(db)).map((k) => k.id) : [...a.kelasIds]);
    if (kelasIds.some((k) => !boleh.has(k))) throw new GalatApi(403, 'Ada kelas tujuan yang bukan kelas Anda.');
  }
  const tingkat = [...new Set((data.tingkat || []).map(Number))].filter((t) => [3, 4, 5, 6].includes(t)).sort();
  if (!tingkat.length) throw new GalatApi(400, 'Pilih minimal satu tingkat kelas sasaran.');

  const zonaLama = lama?.zona;
  const level = {
    ...(lama || {}),
    id: lama?.id || await idLevelBaru(db, data.zona),
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
    if (alasan.length) throw new GalatApi(400, `Belum bisa diterbitkan: ${alasan.join(' ')}`);
  }

  const daftar = semuaL.filter((l) => l.id !== level.id);
  if (!lama || zonaLama !== level.zona || (lama.jenis === 'boss') !== (level.jenis === 'boss')) sisipkanSebelumBoss(daftar, level);
  daftar.push(level);
  const berubah = new Set([level, ...rapikanUrutan(daftar, level.zona), ...(zonaLama && zonaLama !== level.zona ? rapikanUrutan(daftar, zonaLama) : [])]);
  await simpanBanyak(db, [...berubah]);
  return levelLengkapUntukGuru(ctx, a, level.id);
}

/** Siswa hanya boleh memakai alat pengembang jika MODE_DEV aktif. */
async function wajibGuruAtauDev(ctx) {
  const s = await ambilSesi(ctx);
  if (s?.jenis === 'guru') return aksesGuru(ctx);
  if (ctx.env.MODE_DEV === '1' && s?.jenis === 'siswa') return null;
  throw new GalatApi(403, 'Fitur ini hanya untuk guru.');
}

export const onRequest = buatRouter([
  // ================= Siswa =================
  ['GET', 'terbit', async (ctx) => {
    const siswa = await wajibSiswa(ctx);
    const db = ctx.env.DB;
    const { zona } = kueri(ctx.request);
    const [progres, levels, zonaNonaktif] = await Promise.all([
      semua(db, 'SELECT level_id, clue_dibeli FROM progres WHERE siswa_id = ?', siswa.id), semuaLevel(db), bacaZonaNonaktif(db)
    ]);
    const clueDibeli = new Map(progres.map((p) => [p.level_id, p.clue_dibeli || 0]));
    return urutkan(levels.filter((l) => levelBerlaku(l, siswa.kelas_id, zonaNonaktif) && (!zona || l.zona === zona)))
      .map(({ solusi, clue, pembuat, kelasNonaktif, ...l }) => ({
        ...l,
        // Clue yang belum dibeli dikosongkan; teksnya dikirim saat dibeli
        clue: [0, 1, 2].map((i) => (i < (clueDibeli.get(l.id) || 0) ? (clue?.[i] || '') : ''))
      }));
  }],

  ['GET', 'harga-clue', async (ctx) => (await bacaPengaturan(ctx.env.DB)).hargaClue],

  // ================= Alat pengembang =================
  ['GET', 'semua', async (ctx) => {
    await wajibGuruAtauDev(ctx);
    const { zona } = kueri(ctx.request);
    return urutkan((await semuaLevel(ctx.env.DB)).filter((l) => !zona || l.zona === zona));
  }],

  // ================= Guru =================
  ['GET', 'guru', async (ctx) => {
    const a = await aksesGuru(ctx);
    const kelas = await semuaKelas(ctx.env.DB);
    return urutkan((await semuaLevel(ctx.env.DB)).filter((l) => levelBolehDilihat(a, l))).map((l) => ringkasLevel(a, l, kelas));
  }],

  ['POST', 'guru', async (ctx) => {
    const { level, terbit } = await bacaJson(ctx.request);
    return simpanLevelGuru(ctx, null, level || {}, !!terbit);
  }],

  ['GET', 'guru/:id', async (ctx, { id }) => levelLengkapUntukGuru(ctx, await aksesGuru(ctx), id)],

  ['PUT', 'guru/:id', async (ctx, { id }) => {
    const { level, terbit } = await bacaJson(ctx.request);
    return simpanLevelGuru(ctx, id, level || {}, !!terbit);
  }],

  ['POST', 'guru/:id/duplikat', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    const db = ctx.env.DB;
    const asli = await ambilLevelBoleh(ctx, a, id);
    const semuaL = await semuaLevel(db);
    const salinan = {
      ...asli,
      id: await idLevelBaru(db, asli.zona),
      judul: `Salinan ${asli.judul}`.slice(0, 60),
      bawaan: false,
      terbit: false,
      kelasIds: a.admin ? (asli.kelasIds ? asli.kelasIds.slice() : null) : [...a.kelasIds],
      kelasNonaktif: [],
      pembuat: { id: a.guru.id, nama: a.guru.nama },
      tingkat: asli.tingkat || [3, 4, 5, 6],
      dibuatPada: sekarang(),
      diperbarui: sekarang()
    };
    sisipkanSebelumBoss(semuaL, salinan);
    semuaL.push(salinan);
    await simpanBanyak(db, [...new Set([salinan, ...rapikanUrutan(semuaL, salinan.zona)])]);
    return levelLengkapUntukGuru(ctx, a, salinan.id);
  }],

  ['POST', 'guru/:id/urutan', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    const db = ctx.env.DB;
    const { arah } = await bacaJson(ctx.request);
    const semuaL = await semuaLevel(db);
    const l = semuaL.find((x) => x.id === id);
    if (!l || !levelBolehDilihat(a, l)) throw new GalatApi(404, 'Level tidak ditemukan.');
    if (!levelBolehDiubah(a, l)) throw new GalatApi(403, 'Urutan level ini hanya bisa diubah admin atau pembuatnya.');
    if (l.jenis === 'boss') throw new GalatApi(400, 'Level boss selalu berada di urutan terakhir.');
    const berubah = new Set(rapikanUrutan(semuaL, l.zona));
    const nonBoss = semuaL.filter((x) => x.zona === l.zona && x.jenis !== 'boss').sort((p, q) => p.urutan - q.urutan);
    const i = nonBoss.indexOf(l);
    const j = i + (Number(arah) < 0 ? -1 : 1);
    if (j < 0 || j >= nonBoss.length) throw new GalatApi(400, Number(arah) < 0 ? 'Level sudah paling atas.' : 'Level sudah tepat sebelum boss.');
    [l.urutan, nonBoss[j].urutan] = [nonBoss[j].urutan, l.urutan];
    berubah.add(l).add(nonBoss[j]);
    rapikanUrutan(semuaL, l.zona).forEach((x) => berubah.add(x));
    await simpanBanyak(db, [...berubah]);
    return { ok: true };
  }],

  ['POST', 'guru/:id/aktif', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    const { aktif } = await bacaJson(ctx.request);
    const l = await ambilLevelBoleh(ctx, a, id);
    if (l.bawaan && !a.admin) {
      // Guru: nonaktif hanya untuk kelas yang diampunya
      const non = new Set(l.kelasNonaktif || []);
      for (const k of a.kelasIds) { if (aktif) non.delete(k); else non.add(k); }
      l.kelasNonaktif = [...non];
    } else {
      if (!levelBolehDiubah(a, l)) throw new GalatApi(403, 'Anda hanya bisa mengatur level buatan Anda sendiri.');
      if (aktif && !l.bawaan) {
        const alasan = alasanBelumSiap(l);
        if (alasan.length) throw new GalatApi(400, `Belum bisa diterbitkan: ${alasan.join(' ')}`);
      }
      l.terbit = !!aktif;
    }
    l.diperbarui = sekarang();
    await simpanBanyak(ctx.env.DB, [l]);
    return ringkasLevel(a, l, await semuaKelas(ctx.env.DB));
  }],

  ['DELETE', 'guru/:id', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    const db = ctx.env.DB;
    const semuaL = await semuaLevel(db);
    const l = semuaL.find((x) => x.id === id);
    if (!l || !levelBolehDilihat(a, l)) throw new GalatApi(404, 'Level tidak ditemukan.');
    if (l.bawaan) throw new GalatApi(400, 'Level bawaan tidak bisa dihapus. Nonaktifkan saja.');
    if (!levelBolehDiubah(a, l)) throw new GalatApi(403, 'Anda hanya bisa menghapus level buatan Anda sendiri.');
    const sisa = semuaL.filter((x) => x.id !== id);
    const berubah = rapikanUrutan(sisa, l.zona);
    // progres level ini ikut terhapus lewat ON DELETE CASCADE
    await db.batch([perintah(db, 'DELETE FROM level WHERE id = ?', id), ...berubah.map((x) => perintahSimpanLevel(db, x))]);
    return { ok: true };
  }],

  // Diletakkan terakhir agar tidak menelan rute statis di atas
  ['GET', ':id', async (ctx, { id }) => {
    const a = await wajibGuruAtauDev(ctx);
    const r = await satu(ctx.env.DB, 'SELECT * FROM level WHERE id = ?', id);
    if (!r) return null;
    const l = levelKeObjek(r);
    if (a && !levelBolehDilihat(a, l)) throw new GalatApi(404, 'Level tidak ditemukan.');
    return l;
  }]
]);
