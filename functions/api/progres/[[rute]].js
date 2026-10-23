// functions/api/progres/[[rute]].js — progres siswa yang sedang masuk
//   GET  /api/progres                     semua progres saya
//   GET  /api/progres/juara               data sertifikat (null jika boss pulau terakhir belum selesai)
//   GET  /api/progres/:levelId            progres satu level (atau null)
//   POST /api/progres/:levelId/percobaan  { kode, detik } — server MENJALANKAN ULANG kode dengan interpreter
//                                         yang sama, lalu menghitung berhasil, bintang, nilai, koin, berlian
//   POST /api/progres/:levelId/clue       { nomor } — beli clue berurutan; teks clue dikirim setelah dibeli
//   POST /api/progres/:levelId/lama       { detik } — tambah lama bermain
// Alat pengembang (hanya jika env.MODE_DEV = "1"):
//   PUT /api/progres/:levelId, DELETE /api/progres

import { buatRouter, bacaJson, GalatApi } from '../../../server/http.js';
import { wajibSiswa } from '../../../server/sesi.js';
import {
  semua, satu, jalankan, perintah, sekarang, siswaKeObjek, progresKeObjek, levelKeObjek, semuaLevel,
  bacaPengaturan, perintahAktivitas, levelTerlihatUntukKelas, semuaKelas
} from '../../../server/data.js';
import { jalankanKode } from '../../../js/game/interpreter.js';
import { hitungBintang, hitungKoin, NILAI_BINTANG, BERLIAN_BOSS, CLUE } from '../../../js/game/skor.js';
import { ZONA } from '../../../js/data/zona.js';

const MAKS_KODE = 5000;
const MAKS_DETIK = 600;

async function ambilProgres(db, siswaId, levelId) {
  const r = await satu(db, 'SELECT * FROM progres WHERE siswa_id = ? AND level_id = ?', siswaId, levelId);
  return r ? progresKeObjek(r) : null;
}

/** Level yang boleh dimainkan siswa ini. */
async function levelUntukSiswa(db, siswa, levelId) {
  const r = await satu(db, 'SELECT * FROM level WHERE id = ?', levelId);
  const l = r ? levelKeObjek(r) : null;
  if (!l || !levelTerlihatUntukKelas(l, siswa.kelas_id)) throw new GalatApi(404, 'Level tidak ditemukan.');
  return l;
}

const pastikanBarisProgres = (db, siswaId, levelId) =>
  perintah(db, `INSERT INTO progres (siswa_id, level_id, diperbarui) VALUES (?,?,?) ON CONFLICT(siswa_id, level_id) DO NOTHING`, siswaId, levelId, sekarang());

const wajibModeDev = (env) => {
  if (env.MODE_DEV !== '1') throw new GalatApi(403, 'Alat pengembang tidak aktif di server ini.');
};

export const onRequest = buatRouter([
  ['GET', '', async (ctx) => {
    const s = await wajibSiswa(ctx);
    return (await semua(ctx.env.DB, 'SELECT * FROM progres WHERE siswa_id = ?', s.id)).map(progresKeObjek);
  }],

  ['GET', 'juara', async (ctx) => {
    const s = await wajibSiswa(ctx);
    const db = ctx.env.DB;
    const zonaAkhir = ZONA[ZONA.length - 1].id;
    const levels = (await semuaLevel(db)).filter((l) => levelTerlihatUntukKelas(l, s.kelas_id));
    const progres = (await semua(db, 'SELECT * FROM progres WHERE siswa_id = ?', s.id)).map(progresKeObjek);
    const bossAkhir = progres.find((p) => p.selesai && levels.some((l) => l.id === p.levelId && l.zona === zonaAkhir && l.jenis === 'boss'));
    if (!bossAkhir) return null;
    const ids = new Set(levels.map((l) => l.id));
    const kelas = (await semuaKelas(db)).find((k) => k.id === s.kelas_id);
    return {
      namaLengkap: s.nama_lengkap,
      kelas: kelas?.nama || '-',
      totalBintang: progres.filter((p) => p.selesai && ids.has(p.levelId)).reduce((n, p) => n + (p.bintang || 0), 0),
      maksBintang: levels.length * 3,
      tanggal: bossAkhir.selesaiPada || bossAkhir.diperbarui
    };
  }],

  ['DELETE', '', async (ctx) => {
    wajibModeDev(ctx.env);
    const s = await wajibSiswa(ctx);
    await jalankan(ctx.env.DB, 'DELETE FROM progres WHERE siswa_id = ?', s.id);
    return { ok: true };
  }],

  ['GET', ':levelId', async (ctx, { levelId }) => {
    const s = await wajibSiswa(ctx);
    return ambilProgres(ctx.env.DB, s.id, levelId);
  }],

  ['PUT', ':levelId', async (ctx, { levelId }) => {
    wajibModeDev(ctx.env);
    const s = await wajibSiswa(ctx);
    const db = ctx.env.DB;
    await levelUntukSiswa(db, s, levelId);
    const p = await bacaJson(ctx.request);
    await db.batch([
      pastikanBarisProgres(db, s.id, levelId),
      perintah(db, `UPDATE progres SET selesai = ?, bintang = ?, nilai = ?, percobaan = ?, diperbarui = ?,
        selesai_pada = COALESCE(selesai_pada, CASE WHEN ? = 1 THEN ? END) WHERE siswa_id = ? AND level_id = ?`,
      p.selesai ? 1 : 0, Math.min(3, Math.max(0, Math.round(p.bintang || 0))), Math.min(100, Math.max(0, Math.round(p.nilai || 0))),
      Math.max(0, Math.round(p.percobaan || 0)), sekarang(), p.selesai ? 1 : 0, sekarang(), s.id, levelId)
    ]);
    return ambilProgres(db, s.id, levelId);
  }],

  // ================= Jalankan (dihitung ulang di server) =================
  ['POST', ':levelId/percobaan', async (ctx, { levelId }) => {
    const siswa = await wajibSiswa(ctx);
    const db = ctx.env.DB;
    const level = await levelUntukSiswa(db, siswa, levelId);
    const body = await bacaJson(ctx.request);
    const kode = String(body.kode ?? '').slice(0, MAKS_KODE);
    const detik = Math.min(MAKS_DETIK, Math.max(0, Math.round(Number(body.detik) || 0)));

    // Jalankan ulang kode siswa: hasil dari browser tidak dipercaya
    const hasil = jalankanKode(kode, level.dunia, { perintahTersedia: level.perintahTersedia });
    const lama = (await ambilProgres(db, siswa.id, levelId)) || { selesai: false, bintang: 0, nilai: 0, clueDibeli: 0 };
    const bintang = hitungBintang({ berhasil: hasil.berhasil, clueDibeli: lama.clueDibeli || 0, jumlahBaris: hasil.jumlahBaris, batasBaris: level.batasBaris });
    const nilai = NILAI_BINTANG[bintang];
    const bintangLama = lama.bintang || 0;
    const pertamaKali = hasil.berhasil && !lama.selesai;

    let koinDidapat = 0;
    let berlianDidapat = 0;
    if (hasil.berhasil) {
      koinDidapat = hitungKoin({ pertamaKali, bintangLama, bintangBaru: bintang });
      if (pertamaKali && level.jenis === 'boss') berlianDidapat = BERLIAN_BOSS;
    }
    const juara = pertamaKali && level.jenis === 'boss' && level.zona === ZONA[ZONA.length - 1].id;
    const waktu = sekarang();

    const stmts = [
      pastikanBarisProgres(db, siswa.id, levelId),
      perintah(db, `UPDATE progres SET
          percobaan = percobaan + 1,
          kode_terakhir = ?,
          detik = detik + ?,
          selesai = MAX(selesai, ?),
          bintang = MAX(bintang, ?),
          nilai = MAX(nilai, ?),
          selesai_pada = COALESCE(selesai_pada, CASE WHEN ? = 1 THEN ? END),
          diperbarui = ?
        WHERE siswa_id = ? AND level_id = ?`,
      kode, detik, hasil.berhasil ? 1 : 0, bintang, hasil.berhasil ? nilai : 0, hasil.berhasil ? 1 : 0, waktu, waktu, siswa.id, levelId),
      perintahAktivitas(db, siswa.id, hasil.berhasil ? 'selesai' : 'coba', hasil.berhasil
        ? `Menyelesaikan level ${level.judul} dengan ${bintang} bintang`
        : `Mencoba level ${level.judul} (belum berhasil)`)
    ];
    if (koinDidapat || berlianDidapat) stmts.push(perintah(db, 'UPDATE siswa SET koin = koin + ?, berlian = berlian + ? WHERE id = ?', koinDidapat, berlianDidapat, siswa.id));
    if (berlianDidapat) stmts.push(perintahAktivitas(db, siswa.id, 'piala', `Mengalahkan ${level.judul} dan mendapat piala`));
    if (juara) stmts.push(perintahAktivitas(db, siswa.id, 'juara', 'Menjadi Juara Coding Island'));
    await db.batch(stmts);

    return {
      berhasil: hasil.berhasil,
      bintang,
      nilai,
      progres: await ambilProgres(db, siswa.id, levelId),
      koinDidapat,
      berlianDidapat,
      pertamaKali,
      bintangLama,
      juara,
      siswa: koinDidapat || berlianDidapat ? siswaKeObjek(await satu(db, 'SELECT * FROM siswa WHERE id = ?', siswa.id)) : null
    };
  }],

  // ================= Toko clue =================
  ['POST', ':levelId/clue', async (ctx, { levelId }) => {
    const siswa = await wajibSiswa(ctx);
    const db = ctx.env.DB;
    const level = await levelUntukSiswa(db, siswa, levelId);
    const nomor = Number((await bacaJson(ctx.request)).nomor);
    if (!CLUE.some((c) => c.nomor === nomor)) return { ok: false, alasan: 'urutan', pesan: 'Clue tidak ada.' };
    const sudah = (await ambilProgres(db, siswa.id, levelId))?.clueDibeli || 0;
    const teks = (sampai) => (level.clue || []).slice(0, sampai);

    if (nomor <= sudah) return { ok: true, clueDibeli: sudah, siswa: siswaKeObjek(siswa), dibayar: 0, clue: teks(sudah) };
    if (nomor !== sudah + 1) return { ok: false, alasan: 'urutan', pesan: `Beli Clue ${sudah + 1} dulu ya.` };
    const harga = (await bacaPengaturan(db)).hargaClue[nomor - 1];
    if ((siswa.koin || 0) < harga) {
      return { ok: false, alasan: 'koin', kurang: harga - (siswa.koin || 0), pesan: 'Koinmu belum cukup. Selesaikan atau ulangi level lain untuk mengumpulkan koin.' };
    }
    // Kurangi koin hanya jika masih cukup (aman dari klik ganda)
    const potong = await jalankan(db, 'UPDATE siswa SET koin = koin - ? WHERE id = ? AND koin >= ?', harga, siswa.id, harga);
    if (!potong.meta?.changes) return { ok: false, alasan: 'koin', pesan: 'Koinmu belum cukup. Selesaikan atau ulangi level lain untuk mengumpulkan koin.' };
    await db.batch([
      pastikanBarisProgres(db, siswa.id, levelId),
      perintah(db, 'UPDATE progres SET clue_dibeli = MAX(clue_dibeli, ?), diperbarui = ? WHERE siswa_id = ? AND level_id = ?', nomor, sekarang(), siswa.id, levelId),
      perintahAktivitas(db, siswa.id, 'clue', `Membeli Clue ${nomor} di level ${level.judul}`)
    ]);
    return {
      ok: true,
      clueDibeli: nomor,
      siswa: siswaKeObjek(await satu(db, 'SELECT * FROM siswa WHERE id = ?', siswa.id)),
      dibayar: harga,
      clue: teks(nomor)
    };
  }],

  ['POST', ':levelId/lama', async (ctx, { levelId }) => {
    const siswa = await wajibSiswa(ctx);
    const db = ctx.env.DB;
    await levelUntukSiswa(db, siswa, levelId);
    const detik = Math.min(MAKS_DETIK, Math.max(0, Math.round(Number((await bacaJson(ctx.request)).detik) || 0)));
    if (!detik) return null;
    await db.batch([
      pastikanBarisProgres(db, siswa.id, levelId),
      perintah(db, 'UPDATE progres SET detik = detik + ?, diperbarui = ? WHERE siswa_id = ? AND level_id = ?', detik, sekarang(), siswa.id, levelId)
    ]);
    return ambilProgres(db, siswa.id, levelId);
  }]
]);
