// functions/api/progres/[[rute]].js — progres siswa yang sedang masuk, DI KELAS AKTIFNYA
// Kemajuan terpisah per kelas (kunci progres: siswa_id, kelas_id, level_id): semua rute di bawah memakai
// kelas aktif sesi ini (wajibSiswaDiKelas). Koin dan berlian tetap satu dompet di baris siswa.
//   GET  /api/progres                     semua progres saya di kelas aktif
//   GET  /api/progres/juara               data sertifikat (null jika boss pulau terakhir belum selesai)
//   GET  /api/progres/:levelId            progres satu level (atau null)
//   POST /api/progres/:levelId/percobaan  { kode, detik } — level terkunci ditolak 403; server MENJALANKAN ULANG kode dengan interpreter
//                                         yang sama, lalu menghitung berhasil, bintang, nilai, koin, berlian
//   POST /api/progres/:levelId/clue       { nomor } — beli clue berurutan; teks clue dikirim setelah dibeli
//   POST /api/progres/:levelId/lama       { detik } — tambah lama bermain
// Level dari pulau yang tidak dipakai kelas aktif dianggap tidak ada (404); progres lamanya tetap tersimpan.
// Alat pengembang (hanya jika env.MODE_DEV = "1"):
//   PUT /api/progres/:levelId, DELETE /api/progres

import { buatRouter, bacaJson, GalatApi } from '../../../server/http.js';
import { wajibSiswaDiKelas } from '../../../server/sesi.js';
import {
  semua, satu, jalankan, perintah, sekarang, siswaKeObjek, progresKeObjek, levelKeObjek, semuaLevel,
  bacaPengaturan, bacaZonaKelas, zonaKelasDariTeks, perintahAktivitas, levelBerlaku, kelasDariBaris
} from '../../../server/data.js';
import { jalankanKode } from '../../../js/game/interpreter.js';
import { hitungBintang, hitungKoin, NILAI_BINTANG, BERLIAN_BOSS, CLUE, KOIN_SELESAI_PERTAMA, KOIN_PER_BINTANG_BARU } from '../../../js/game/skor.js';
import { hitungPeta, zonaTerakhir } from '../../../js/game/kemajuan.js';
import { sertifikatJuara } from '../../../server/statistik.js';

const MAKS_KODE = 5000;
const MAKS_DETIK = 600;
const PESAN_TIDAK_ADA = 'Level ini tidak ada. Kembali ke peta dan pilih level lain ya.';

async function ambilProgres(db, siswaId, kelasId, levelId) {
  const r = await satu(db, 'SELECT * FROM progres WHERE siswa_id = ? AND kelas_id = ? AND level_id = ?', siswaId, kelasId, levelId);
  return r ? progresKeObjek(r) : null;
}

/** Level yang boleh dimainkan siswa ini di kelas aktifnya. */
async function levelUntukSiswa(db, siswa, levelId) {
  const [r, zonaIds] = await Promise.all([satu(db, 'SELECT * FROM level WHERE id = ?', levelId), bacaZonaKelas(db, siswa.kelas_aktif)]);
  const l = r ? levelKeObjek(r) : null;
  if (!l || !levelBerlaku(l, siswa.kelas_aktif, zonaIds)) throw new GalatApi(404, PESAN_TIDAK_ADA);
  return l;
}

/**
 * Level + progres siswa (di kelas aktif) dalam satu kali bolak-balik ke D1, sekaligus memeriksa level itu
 * TERBUKA dengan aturan yang sama dengan peta (js/game/kemajuan.js): level/pulau terkunci ditolak 403.
 */
async function levelDanProgres(db, siswa, levelId) {
  const [rl, rp, rk] = await db.batch([
    perintah(db, 'SELECT * FROM level'),
    perintah(db, 'SELECT * FROM progres WHERE siswa_id = ? AND kelas_id = ?', siswa.id, siswa.kelas_aktif),
    perintah(db, 'SELECT zona_ids FROM kelas WHERE id = ?', siswa.kelas_aktif)
  ]);
  const zonaIds = rk.results?.[0] ? zonaKelasDariTeks(rk.results[0].zona_ids) : [];
  const berlaku = (rl.results || []).map(levelKeObjek).filter((x) => levelBerlaku(x, siswa.kelas_aktif, zonaIds));
  const l = berlaku.find((x) => x.id === levelId);
  if (!l) throw new GalatApi(404, PESAN_TIDAK_ADA);
  const semuaProgres = (rp.results || []).map(progresKeObjek);
  const sz = hitungPeta(berlaku, semuaProgres, zonaIds).find((z) => z.zona.id === l.zona);
  const status = sz?.levels.find((x) => x.id === levelId)?.status;
  if (!sz?.terbuka) throw new GalatApi(403, `Pulau ini masih terkunci. ${sz?.syarat || 'Selesaikan pulau sebelumnya dulu'} ya.`);
  if (status === 'terkunci') throw new GalatApi(403, 'Level ini masih terkunci. Selesaikan level sebelumnya dulu ya.');
  return { level: l, levels: berlaku, zonaIds, progres: semuaProgres.find((p) => p.levelId === levelId) || null };
}

const pastikanBarisProgres = (db, siswaId, kelasId, levelId) =>
  perintah(db, `INSERT INTO progres (siswa_id, kelas_id, level_id, diperbarui) VALUES (?,?,?,?)
    ON CONFLICT(siswa_id, kelas_id, level_id) DO NOTHING`, siswaId, kelasId, levelId, sekarang());

const wajibModeDev = (env) => {
  if (env.MODE_DEV !== '1') throw new GalatApi(403, 'Alat pengembang tidak aktif di server ini.');
};

export const onRequest = buatRouter([
  ['GET', '', async (ctx) => {
    const s = await wajibSiswaDiKelas(ctx);
    return (await semua(ctx.env.DB, 'SELECT * FROM progres WHERE siswa_id = ? AND kelas_id = ?', s.id, s.kelas_aktif)).map(progresKeObjek);
  }],

  // Juara = boss pulau terakhir di daftar kelas aktif selesai. Bintang dihitung dari soal kelas itu saja.
  // Aturannya di sertifikatJuara (server/statistik.js), sama dengan halaman Sertifikat guru.
  ['GET', 'juara', async (ctx) => {
    const s = await wajibSiswaDiKelas(ctx);
    const db = ctx.env.DB;
    const [barisKelas, semuaL, progresBaris] = await Promise.all([
      satu(db, 'SELECT * FROM kelas WHERE id = ?', s.kelas_aktif),
      semuaLevel(db),
      semua(db, 'SELECT * FROM progres WHERE siswa_id = ? AND kelas_id = ?', s.id, s.kelas_aktif)
    ]);
    if (!barisKelas) return null;
    const kelas = kelasDariBaris([barisKelas], [])[0];
    const levels = semuaL.filter((l) => levelBerlaku(l, kelas.id, kelas.zonaIds));
    return sertifikatJuara(kelas, levels, progresBaris.map(progresKeObjek), s.nama_lengkap);
  }],

  ['DELETE', '', async (ctx) => {
    wajibModeDev(ctx.env);
    const s = await wajibSiswaDiKelas(ctx);
    await jalankan(ctx.env.DB, 'DELETE FROM progres WHERE siswa_id = ? AND kelas_id = ?', s.id, s.kelas_aktif);
    return { ok: true };
  }],

  ['GET', ':levelId', async (ctx, { levelId }) => {
    const s = await wajibSiswaDiKelas(ctx);
    return ambilProgres(ctx.env.DB, s.id, s.kelas_aktif, levelId);
  }],

  ['PUT', ':levelId', async (ctx, { levelId }) => {
    wajibModeDev(ctx.env);
    const s = await wajibSiswaDiKelas(ctx);
    const db = ctx.env.DB;
    await levelUntukSiswa(db, s, levelId);
    const p = await bacaJson(ctx.request);
    await db.batch([
      pastikanBarisProgres(db, s.id, s.kelas_aktif, levelId),
      perintah(db, `UPDATE progres SET selesai = ?, bintang = ?, nilai = ?, percobaan = ?, diperbarui = ?,
        selesai_pada = COALESCE(selesai_pada, CASE WHEN ? = 1 THEN ? END) WHERE siswa_id = ? AND kelas_id = ? AND level_id = ?`,
      p.selesai ? 1 : 0, Math.min(3, Math.max(0, Math.round(p.bintang || 0))), Math.min(100, Math.max(0, Math.round(p.nilai || 0))),
      Math.max(0, Math.round(p.percobaan || 0)), sekarang(), p.selesai ? 1 : 0, sekarang(), s.id, s.kelas_aktif, levelId)
    ]);
    return ambilProgres(db, s.id, s.kelas_aktif, levelId);
  }],

  // ================= Jalankan (dihitung ulang di server) =================
  // Hadiah (koin, berlian, piala, juara) dihitung DI DALAM satu db.batch (satu transaksi D1) dari isi
  // baris progres saat itu, bukan dari data yang dibaca sebelumnya. Jadi dua permintaan yang sama
  // bersamaan tidak memberi koin dobel: yang kedua sudah melihat level selesai beserta bintangnya.
  // Baris progres yang dibaca dan ditulis adalah milik kelas aktif (siswa_id, kelas_id, level_id), dan
  // dompet koin/berlian tetap satu di baris siswa — tidak ada pengecekan silang antar kelas.
  ['POST', ':levelId/percobaan', async (ctx, { levelId }) => {
    const siswa = await wajibSiswaDiKelas(ctx);
    const db = ctx.env.DB;
    const { level, levels, zonaIds, progres: awal } = await levelDanProgres(db, siswa, levelId);
    const body = await bacaJson(ctx.request);
    const kode = String(body.kode ?? '').slice(0, MAKS_KODE);
    const detik = Math.min(MAKS_DETIK, Math.max(0, Math.round(Number(body.detik) || 0)));

    // Jalankan ulang kode siswa (interpreter dibatasi 1000 langkah): hasil dari browser tidak dipercaya.
    // Interpreter yang sama dengan browser: perintah bahasa Indonesia, Inggris, atau campuran sama-sama
    // diterima, jadi bintang & nilainya sama persis. Kode disimpan apa adanya (tidak diterjemahkan).
    const hasil = jalankanKode(kode, level.dunia, { perintahTersedia: level.perintahTersedia, bahasa: siswa.bahasa });
    const bintang = hitungBintang({ berhasil: hasil.berhasil, clueDibeli: awal?.clueDibeli || 0, jumlahBaris: hasil.jumlahBaris, batasBaris: level.batasBaris });
    const nilai = NILAI_BINTANG[bintang];
    const ok = hasil.berhasil ? 1 : 0;
    const boss = level.jenis === 'boss' ? 1 : 0;
    const bossAkhir = boss && level.zona === zonaTerakhir(zonaIds, levels)?.id ? 1 : 0;
    const waktu = sekarang();
    const dari = 'FROM progres WHERE siswa_id = ? AND kelas_id = ? AND level_id = ?';
    const kunci = [siswa.id, siswa.kelas_aktif, levelId];

    const hasilBatch = await db.batch([
      pastikanBarisProgres(db, siswa.id, siswa.kelas_aktif, levelId),
      // [1] keadaan progres sebelum percobaan ini, dibaca di dalam transaksi yang sama
      perintah(db, `SELECT selesai, bintang ${dari}`, ...kunci),
      // [2] koin & berlian bertambah atomik; besarnya dihitung dari keadaan progres saat ini
      perintah(db, `UPDATE siswa SET
          koin = koin + COALESCE((SELECT CASE WHEN ? = 1 THEN (CASE WHEN selesai = 0 THEN ? ELSE 0 END) + ? * MAX(0, ? - bintang) ELSE 0 END ${dari}), 0),
          berlian = berlian + COALESCE((SELECT CASE WHEN ? = 1 AND ? = 1 AND selesai = 0 THEN ? ELSE 0 END ${dari}), 0)
        WHERE id = ?`,
      ok, KOIN_SELESAI_PERTAMA, KOIN_PER_BINTANG_BARU, bintang, ...kunci, ok, boss, BERLIAN_BOSS, ...kunci, siswa.id),
      // [3][4] piala & juara hanya dicatat saat boss pertama kali selesai
      perintah(db, `INSERT INTO aktivitas (waktu, siswa_id, jenis, keterangan)
        SELECT ?, ?, 'piala', ? WHERE ? = 1 AND ? = 1 AND (SELECT selesai ${dari}) = 0`,
      waktu, siswa.id, `Mengalahkan ${level.judul} dan mendapat piala`, ok, boss, ...kunci),
      perintah(db, `INSERT INTO aktivitas (waktu, siswa_id, jenis, keterangan)
        SELECT ?, ?, 'juara', 'Menjadi Juara Coding Island' WHERE ? = 1 AND ? = 1 AND (SELECT selesai ${dari}) = 0`,
      waktu, siswa.id, ok, bossAkhir, ...kunci),
      // [5] aktivitas percobaan ini
      perintahAktivitas(db, siswa.id, ok ? 'selesai' : 'coba', ok
        ? `Menyelesaikan level ${level.judul} dengan ${bintang} bintang`
        : `Mencoba level ${level.judul} (belum berhasil)`),
      // [6] progres: bintang & nilai terbaik dengan MAX, percobaan & detik bertambah atomik
      perintah(db, `UPDATE progres SET
          percobaan = percobaan + 1,
          kode_terakhir = ?,
          detik = detik + ?,
          selesai = MAX(selesai, ?),
          bintang = MAX(bintang, ?),
          nilai = MAX(nilai, ?),
          selesai_pada = COALESCE(selesai_pada, CASE WHEN ? = 1 THEN ? END),
          diperbarui = ?
        WHERE siswa_id = ? AND kelas_id = ? AND level_id = ?`,
      kode, detik, ok, bintang, ok ? nilai : 0, ok, waktu, waktu, ...kunci),
      // [7][8] keadaan akhir untuk dikirim ke browser
      perintah(db, `SELECT * ${dari}`, ...kunci),
      perintah(db, 'SELECT * FROM siswa WHERE id = ?', siswa.id)
    ]);

    // Angka yang dilaporkan memakai keadaan "sebelum" yang sama dengan yang dipakai SQL di atas
    const sebelum = hasilBatch[1].results?.[0] || { selesai: 0, bintang: 0 };
    const pertamaKali = !!ok && !sebelum.selesai;
    const koinDidapat = ok ? hitungKoin({ pertamaKali, bintangLama: sebelum.bintang || 0, bintangBaru: bintang }) : 0;
    const berlianDidapat = pertamaKali && boss ? BERLIAN_BOSS : 0;
    return {
      berhasil: hasil.berhasil,
      bintang,
      nilai,
      progres: progresKeObjek(hasilBatch[7].results[0]),
      koinDidapat,
      berlianDidapat,
      pertamaKali,
      bintangLama: sebelum.bintang || 0,
      juara: pertamaKali && !!bossAkhir,
      siswa: koinDidapat || berlianDidapat ? siswaKeObjek(hasilBatch[8].results[0]) : null
    };
  }],

  // ================= Toko clue =================
  // Koin dipotong dengan UPDATE ... WHERE koin >= harga (cek jumlah baris berubah), lalu clue "diklaim"
  // dengan UPDATE ... WHERE clue_dibeli = nomor - 1. Jika klaim kalah dari permintaan lain yang sama
  // (klik ganda), koin dikembalikan, jadi koin tidak pernah terpotong dua kali.
  ['POST', ':levelId/clue', async (ctx, { levelId }) => {
    const siswa = await wajibSiswaDiKelas(ctx);
    const db = ctx.env.DB;
    const { level, progres } = await levelDanProgres(db, siswa, levelId);
    const nomor = Number((await bacaJson(ctx.request)).nomor);
    if (!CLUE.some((c) => c.nomor === nomor)) return { ok: false, alasan: 'urutan', pesan: 'Clue itu tidak ada. Pilih Clue 1, 2, atau 3 ya.' };
    const sudah = progres?.clueDibeli || 0;
    const teks = (sampai) => (level.clue || []).slice(0, sampai);
    const PESAN_KURANG = 'Koinmu belum cukup. Selesaikan atau ulangi level lain untuk mengumpulkan koin.';

    if (nomor <= sudah) return { ok: true, clueDibeli: sudah, siswa: siswaKeObjek(siswa), dibayar: 0, clue: teks(sudah) };
    if (nomor !== sudah + 1) return { ok: false, alasan: 'urutan', pesan: `Beli Clue ${sudah + 1} dulu ya.` };
    const harga = (await bacaPengaturan(db)).hargaClue[nomor - 1];

    // 1) Potong koin hanya jika masih cukup
    const potong = await jalankan(db, 'UPDATE siswa SET koin = koin - ? WHERE id = ? AND koin >= ?', harga, siswa.id, harga);
    if (!potong.meta?.changes) {
      const kini = await satu(db, 'SELECT koin FROM siswa WHERE id = ?', siswa.id);
      return { ok: false, alasan: 'koin', kurang: Math.max(1, harga - (kini?.koin || 0)), pesan: PESAN_KURANG };
    }
    // 2) Klaim clue + catat aktivitas dalam satu batch; aktivitas hanya ditulis bila klaim berhasil (changes() = 1)
    const waktu = sekarang();
    const [, klaim] = await db.batch([
      pastikanBarisProgres(db, siswa.id, siswa.kelas_aktif, levelId),
      perintah(db, 'UPDATE progres SET clue_dibeli = ?, diperbarui = ? WHERE siswa_id = ? AND kelas_id = ? AND level_id = ? AND clue_dibeli = ?',
        nomor, waktu, siswa.id, siswa.kelas_aktif, levelId, nomor - 1),
      perintah(db, `INSERT INTO aktivitas (waktu, siswa_id, jenis, keterangan) SELECT ?, ?, 'clue', ? WHERE changes() = 1`,
        waktu, siswa.id, `Membeli Clue ${nomor} di level ${level.judul}`)
    ]);
    if (!klaim.meta?.changes) {
      // 3) Kalah cepat dari permintaan lain: kembalikan koin, laporkan keadaan terbaru
      const [, rs, rp] = await db.batch([
        perintah(db, 'UPDATE siswa SET koin = koin + ? WHERE id = ?', harga, siswa.id),
        perintah(db, 'SELECT * FROM siswa WHERE id = ?', siswa.id),
        perintah(db, 'SELECT clue_dibeli FROM progres WHERE siswa_id = ? AND kelas_id = ? AND level_id = ?', siswa.id, siswa.kelas_aktif, levelId)
      ]);
      const kini = rp.results?.[0]?.clue_dibeli || 0;
      return kini >= nomor
        ? { ok: true, clueDibeli: kini, siswa: siswaKeObjek(rs.results[0]), dibayar: 0, clue: teks(kini) }
        : { ok: false, alasan: 'urutan', pesan: `Beli Clue ${kini + 1} dulu ya.` };
    }
    return {
      ok: true,
      clueDibeli: nomor,
      siswa: siswaKeObjek(await satu(db, 'SELECT * FROM siswa WHERE id = ?', siswa.id)),
      dibayar: harga,
      clue: teks(nomor)
    };
  }],

  ['POST', ':levelId/lama', async (ctx, { levelId }) => {
    const siswa = await wajibSiswaDiKelas(ctx);
    const db = ctx.env.DB;
    await levelUntukSiswa(db, siswa, levelId);
    const detik = Math.min(MAKS_DETIK, Math.max(0, Math.round(Number((await bacaJson(ctx.request)).detik) || 0)));
    if (!detik) return null;
    await db.batch([
      pastikanBarisProgres(db, siswa.id, siswa.kelas_aktif, levelId),
      perintah(db, 'UPDATE progres SET detik = detik + ?, diperbarui = ? WHERE siswa_id = ? AND kelas_id = ? AND level_id = ?',
        detik, sekarang(), siswa.id, siswa.kelas_aktif, levelId)
    ]);
    return ambilProgres(db, siswa.id, siswa.kelas_aktif, levelId);
  }]
]);
