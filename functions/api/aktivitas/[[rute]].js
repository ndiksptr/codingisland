// functions/api/aktivitas/[[rute]].js — aktivitas & ringkasan dashboard (guru, dibatasi kelas yang diampu)
//   GET /api/aktivitas?kelasId=&siswaId=&jenis=&batas=     log aktivitas
//   GET /api/aktivitas/ringkasan?kelasId=                 data halaman Ringkasan dashboard

import { buatRouter, kueri, GalatApi } from '../../../server/http.js';
import { aksesGuru, saringKelas } from '../../../server/sesi.js';
import { semua, semuaLevel, levelBerlaku } from '../../../server/data.js';
import { hitungStatistik, keanggotaanDalamAkses, gabungPerSiswa, rataRata } from '../../../server/statistik.js';
import { ZONA } from '../../../js/data/zona.js';

const HARI_MS = 864e5;
const BATAS_MAKS = 1000;

export const onRequest = buatRouter([
  ['GET', '', async (ctx) => {
    const a = await aksesGuru(ctx);
    const db = ctx.env.DB;
    const q = kueri(ctx.request);
    const k = saringKelas(a, q.kelasId || null);
    // Aktivitas dicatat per murid (bukan per kelas): satu baris per murid, nama kelasnya digabung
    const stat = await hitungStatistik(db, await keanggotaanDalamAkses(db, a, k));
    const peta = new Map(gabungPerSiswa(stat).map((b) => [b.id, b]));
    if (q.siswaId && !peta.has(q.siswaId)) throw new GalatApi(404, 'Siswa tidak ditemukan di kelas Anda.');
    const batas = Math.min(BATAS_MAKS, Math.max(1, Number(q.batas) || 200));
    const ids = q.siswaId ? [q.siswaId] : [...peta.keys()];
    if (!ids.length) return { total: 0, daftar: [] };

    // Filter di SQL memakai json_each agar jumlah parameter tidak terbatas
    const syarat = `siswa_id IN (SELECT value FROM json_each(?))${q.jenis ? ' AND jenis = ?' : ''}`;
    const param = [JSON.stringify(ids), ...(q.jenis ? [q.jenis] : [])];
    const [{ n: total }] = await semua(db, `SELECT COUNT(*) AS n FROM aktivitas WHERE ${syarat}`, ...param);
    const baris = await semua(db, `SELECT * FROM aktivitas WHERE ${syarat} ORDER BY waktu DESC, id DESC LIMIT ?`, ...param, batas);
    return {
      total,
      daftar: baris.map((r) => ({
        waktu: r.waktu, siswaId: r.siswa_id, jenis: r.jenis, keterangan: r.keterangan,
        namaSiswa: peta.get(r.siswa_id).namaLengkap, kelasNama: peta.get(r.siswa_id).kelasNama
      }))
    };
  }],

  ['GET', 'ringkasan', async (ctx) => {
    const a = await aksesGuru(ctx);
    const db = ctx.env.DB;
    const k = saringKelas(a, kueri(ctx.request).kelasId || null);
    const kelasDipakai = k ? a.kelas.filter((x) => x.id === k) : a.kelas;
    const levels = await semuaLevel(db);
    // Statistik per keanggotaan (murid x kelas): kemajuan tiap kelas terpisah
    const stat = await hitungStatistik(db, await keanggotaanDalamAkses(db, a, k), { levels, kelas: a.kelas });
    const perSiswa = gabungPerSiswa(stat);
    const sekarangMs = Date.now();
    const batas7 = sekarangMs - 7 * HARI_MS;

    const levelTerbit = levels.filter((l) => kelasDipakai.some((kk) => levelBerlaku(l, kk.id, kk.zonaIds))).length;

    // Siswa yang perlu bantuan: macet (>= 5 percobaan tanpa selesai, per kelas) atau tidak aktif 7 hari
    const perluBantuan = [];
    const sudahDiam = new Set(); // "tidak aktif" berlaku per murid, cukup ditulis sekali
    for (const x of stat) {
      const alasan = [];
      let macet = false;
      for (const p of x.progres.filter((pp) => !pp.selesai && (pp.percobaan || 0) >= 5)) {
        alasan.push(`${p.percobaan} kali mencoba "${levels.find((l) => l.id === p.levelId)?.judul || p.levelId}" tetapi belum selesai`);
        macet = true;
      }
      const terakhirMs = x.baris.terakhirAktif ? Date.parse(x.baris.terakhirAktif) : 0;
      const hariDiam = Math.floor((sekarangMs - terakhirMs) / HARI_MS);
      if (terakhirMs < batas7 && !sudahDiam.has(x.siswa.id)) { alasan.push(`Tidak aktif ${hariDiam} hari`); sudahDiam.add(x.siswa.id); }
      if (alasan.length) perluBantuan.push({ ...x.baris, alasan, macet, hariDiam });
    }
    perluBantuan.sort((p, q) => Number(q.macet) - Number(p.macet) || q.hariDiam - p.hariDiam);

    // Pulau yang dipakai minimal satu kelas di cakupan ini; rata-rata dihitung dari kelas yang memakainya
    const progresZona = ZONA.filter((z) => kelasDipakai.some((kk) => kk.zonaIds.includes(z.id))).map((z) => ({
      id: z.id, nama: z.nama, warna: z.warna,
      persen: rataRata(stat.filter((x) => kelasDipakai.find((kk) => kk.id === x.kelasId)?.zonaIds.includes(z.id)).map((x) => {
        const lvZ = x.levels.filter((l) => l.zona === z.id);
        if (!lvZ.length) return 0;
        return (x.progres.filter((p) => p.selesai && lvZ.some((l) => l.id === p.levelId)).length / lvZ.length) * 100;
      }))
    }));

    const peta = new Map(perSiswa.map((b) => [b.id, b]));
    const aktivitas = peta.size
      ? (await semua(db, 'SELECT * FROM aktivitas WHERE siswa_id IN (SELECT value FROM json_each(?)) ORDER BY waktu DESC, id DESC LIMIT 10', JSON.stringify([...peta.keys()])))
        .map((r) => ({ waktu: r.waktu, siswaId: r.siswa_id, jenis: r.jenis, keterangan: r.keterangan, namaSiswa: peta.get(r.siswa_id).namaPanggilan, kelasNama: peta.get(r.siswa_id).kelasNama }))
      : [];

    return {
      statistik: {
        jumlahSiswa: perSiswa.length,
        jumlahKelas: kelasDipakai.length,
        levelTerbit,
        rataNilai: rataRata(stat.filter((x) => x.baris.levelSelesai > 0).map((x) => x.baris.nilai)),
        aktif7: perSiswa.filter((b) => b.terakhirAktif && Date.parse(b.terakhirAktif) >= batas7).length
      },
      perluBantuan,
      progresZona,
      aktivitas
    };
  }]
]);
