// functions/api/nilai/[[rute]].js — nilai siswa (guru, dibatasi kelas yang diampu)
//   GET    /api/nilai/:kelasId              matriks siswa x level terbit + nilai akhir
//   PUT    /api/nilai/:kelasId/:siswaId     { nilai, alasan } timpa nilai akhir (1–100, alasan wajib)
//   DELETE /api/nilai/:kelasId/:siswaId     kembalikan ke nilai otomatis
// Nilai akhir = rata-rata nilai semua level terbit untuk kelas itu (belum selesai = 0), dibulatkan, minimal 1.

import { buatRouter, bacaJson, GalatApi } from '../../../server/http.js';
import { aksesGuru, bolehKelas, ambilSiswaBoleh } from '../../../server/sesi.js';
import { semua, jalankan, sekarang, semuaLevel, semuaKelas, levelTerlihatUntukKelas } from '../../../server/data.js';
import { ZONA } from '../../../js/data/zona.js';

export const onRequest = buatRouter([
  ['GET', ':kelasId', async (ctx, { kelasId }) => {
    const a = await aksesGuru(ctx);
    bolehKelas(a, kelasId);
    const db = ctx.env.DB;
    const urutZona = (l) => ZONA.findIndex((z) => z.id === l.zona);
    const [levelsSemua, kelasSemua, siswaBaris, progres, timpaBaris] = await Promise.all([
      semuaLevel(db),
      semuaKelas(db),
      semua(db, 'SELECT * FROM siswa WHERE kelas_id = ? ORDER BY nama_lengkap', kelasId),
      semua(db, 'SELECT p.* FROM progres p JOIN siswa s ON s.id = p.siswa_id WHERE s.kelas_id = ?', kelasId),
      semua(db, 'SELECT * FROM nilai_timpa WHERE kelas_id = ?', kelasId)
    ]);
    const levels = levelsSemua.filter((l) => levelTerlihatUntukKelas(l, kelasId))
      .sort((p, q) => urutZona(p) - urutZona(q) || (p.urutan ?? 0) - (q.urutan ?? 0));
    const kunciProgres = new Map(progres.map((p) => [`${p.siswa_id}|${p.level_id}`, p]));
    const timpa = new Map(timpaBaris.map((t) => [t.siswa_id, t]));

    return {
      kelas: kelasSemua.find((k) => k.id === kelasId),
      levels: levels.map((l) => {
        const z = ZONA.find((x) => x.id === l.zona);
        return { id: l.id, zona: l.zona, zonaNama: z?.nama || l.zona, warna: z?.warna || '#55A9A0', urutan: l.urutan, judul: l.judul, jenis: l.jenis };
      }),
      siswa: siswaBaris.map((s) => {
        const sel = {};
        let jumlah = 0;
        for (const l of levels) {
          const p = kunciProgres.get(`${s.id}|${l.id}`);
          const nilai = p?.selesai ? (p.nilai || 0) : 0;
          jumlah += nilai;
          sel[l.id] = p
            ? { dimainkan: true, selesai: !!p.selesai, bintang: p.bintang || 0, nilai, percobaan: p.percobaan || 0, clueDibeli: p.clue_dibeli || 0 }
            : { dimainkan: false, selesai: false, bintang: 0, nilai: 0, percobaan: 0, clueDibeli: 0 };
        }
        const nilaiOtomatis = Math.max(1, levels.length ? Math.round(jumlah / levels.length) : 1);
        const t = timpa.get(s.id);
        return {
          id: s.id,
          namaLengkap: s.nama_lengkap,
          namaPanggilan: s.nama_panggilan,
          avatar: s.avatar,
          sel,
          nilaiOtomatis,
          nilaiAkhir: t ? t.nilai : nilaiOtomatis,
          timpa: t ? { nilai: t.nilai, alasan: t.alasan, guruId: t.guru_id, guruNama: t.guru_nama, waktu: t.waktu } : null
        };
      })
    };
  }],

  ['PUT', ':kelasId/:siswaId', async (ctx, { kelasId, siswaId }) => {
    const a = await aksesGuru(ctx);
    bolehKelas(a, kelasId);
    const s = await ambilSiswaBoleh(ctx, a, siswaId);
    if (s.kelas_id !== kelasId) throw new GalatApi(400, 'Siswa tidak ada di kelas ini.');
    const { nilai, alasan } = await bacaJson(ctx.request);
    const n = Math.round(Number(nilai));
    if (!Number.isFinite(n) || n < 1 || n > 100) throw new GalatApi(400, 'Nilai harus angka 1 sampai 100.');
    const teks = String(alasan || '').trim();
    if (teks.length < 5) throw new GalatApi(400, 'Tulis alasan penimpaan nilai (minimal 5 huruf).');
    const waktu = sekarang();
    await jalankan(ctx.env.DB, `INSERT INTO nilai_timpa (siswa_id, kelas_id, nilai, alasan, guru_id, guru_nama, waktu) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(siswa_id, kelas_id) DO UPDATE SET nilai = excluded.nilai, alasan = excluded.alasan, guru_id = excluded.guru_id,
      guru_nama = excluded.guru_nama, waktu = excluded.waktu`, siswaId, kelasId, n, teks.slice(0, 300), a.guru.id, a.guru.nama, waktu);
    return { nilai: n, alasan: teks.slice(0, 300), guruId: a.guru.id, guruNama: a.guru.nama, waktu };
  }],

  ['DELETE', ':kelasId/:siswaId', async (ctx, { kelasId, siswaId }) => {
    const a = await aksesGuru(ctx);
    bolehKelas(a, kelasId);
    await ambilSiswaBoleh(ctx, a, siswaId);
    await jalankan(ctx.env.DB, 'DELETE FROM nilai_timpa WHERE siswa_id = ? AND kelas_id = ?', siswaId, kelasId);
    return { ok: true };
  }]
]);
