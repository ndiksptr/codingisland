// functions/api/nilai/[[rute]].js — nilai siswa (guru, dibatasi kelas yang diampu)
//   GET    /api/nilai/:kelasId              matriks siswa x level terbit + nilai akhir
//   PUT    /api/nilai/:kelasId/:siswaId     { nilai, alasan } timpa nilai akhir (1–100, alasan wajib)
//   DELETE /api/nilai/:kelasId/:siswaId     kembalikan ke nilai otomatis
// Nilai akhir = hitungNilaiAkhir (js/game/skor.js): rata-rata nilai semua level terbit untuk kelas itu
// (belum selesai = 0), dibulatkan, 1–100. Level dari pulau yang tidak dipakai kelas itu tidak ikut dihitung
// (tidak menjadi kolom, tidak masuk pembagi). Murid = anggota kelas (siswa_kelas), dan progres yang dihitung
// hanya progres DI KELAS ITU. Nilai yang ditimpa guru (nilai_timpa) tetap menang.

import { buatRouter, bacaJson, GalatApi } from '../../../server/http.js';
import { aksesGuru, bolehKelas, ambilSiswaBoleh } from '../../../server/sesi.js';
import { semua, perintah, perintahAktivitas, sekarang, semuaLevel, semuaKelas, levelBerlaku } from '../../../server/data.js';
import { ZONA } from '../../../js/data/zona.js';
import { hitungNilaiAkhir } from '../../../js/game/skor.js';

export const onRequest = buatRouter([
  ['GET', ':kelasId', async (ctx, { kelasId }) => {
    const a = await aksesGuru(ctx);
    bolehKelas(a, kelasId);
    const db = ctx.env.DB;
    const [levelsSemua, kelasSemua, siswaBaris, progres, timpaBaris] = await Promise.all([
      semuaLevel(db),
      semuaKelas(db),
      semua(db, 'SELECT s.* FROM siswa_kelas sk JOIN siswa s ON s.id = sk.siswa_id WHERE sk.kelas_id = ? ORDER BY s.nama_lengkap', kelasId),
      semua(db, 'SELECT * FROM progres WHERE kelas_id = ?', kelasId),
      semua(db, 'SELECT * FROM nilai_timpa WHERE kelas_id = ?', kelasId)
    ]);
    const kelas = kelasSemua.find((k) => k.id === kelasId);
    const zonaIds = kelas?.zonaIds || [];
    // Urutan kolom mengikuti urutan pulau kelas ini; pulau yang tidak dipakai tidak masuk senarai maupun pembagi
    const urutZona = (l) => zonaIds.indexOf(l.zona);
    const levels = levelsSemua.filter((l) => levelBerlaku(l, kelasId, zonaIds))
      .sort((p, q) => urutZona(p) - urutZona(q) || (p.urutan ?? 0) - (q.urutan ?? 0));
    const kunciProgres = new Map(progres.map((p) => [`${p.siswa_id}|${p.level_id}`, p]));
    const timpa = new Map(timpaBaris.map((t) => [t.siswa_id, t]));

    return {
      kelas,
      levels: levels.map((l) => {
        const z = ZONA.find((x) => x.id === l.zona);
        return { id: l.id, zona: l.zona, zonaNama: z?.nama || l.zona, warna: z?.warna || '#55A9A0', urutan: l.urutan, judul: l.judul, jenis: l.jenis };
      }),
      siswa: siswaBaris.map((s) => {
        const sel = {};
        for (const l of levels) {
          const p = kunciProgres.get(`${s.id}|${l.id}`);
          const nilai = p?.selesai ? (p.nilai || 0) : 0;
          sel[l.id] = p
            ? { dimainkan: true, selesai: !!p.selesai, bintang: p.bintang || 0, nilai, percobaan: p.percobaan || 0, clueDibeli: p.clue_dibeli || 0 }
            : { dimainkan: false, selesai: false, bintang: 0, nilai: 0, percobaan: 0, clueDibeli: 0 };
        }
        const nilaiOtomatis = hitungNilaiAkhir(levels.map((l) => sel[l.id].nilai), levels.length);
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
    if (!s.kelasAnggota.includes(kelasId)) throw new GalatApi(400, 'Siswa ini tidak terdaftar di kelas ini. Muat ulang halaman nilai.');
    const { nilai, alasan } = await bacaJson(ctx.request);
    const n = Math.round(Number(nilai));
    if (!Number.isFinite(n) || n < 1 || n > 100) throw new GalatApi(400, 'Nilai harus angka 1 sampai 100.');
    const teks = String(alasan || '').trim();
    if (teks.length < 5) throw new GalatApi(400, 'Tulis alasan penimpaan nilai (minimal 5 huruf).');
    const waktu = sekarang();
    const db = ctx.env.DB;
    // Pengubah nilai = a.pelaku (admin asli bila sedang menyamar sebagai guru)
    await db.batch([
      perintah(db, `INSERT INTO nilai_timpa (siswa_id, kelas_id, nilai, alasan, guru_id, guru_nama, waktu) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(siswa_id, kelas_id) DO UPDATE SET nilai = excluded.nilai, alasan = excluded.alasan, guru_id = excluded.guru_id,
        guru_nama = excluded.guru_nama, waktu = excluded.waktu`, siswaId, kelasId, n, teks.slice(0, 300), a.pelaku.id, a.pelaku.nama, waktu),
      perintahAktivitas(db, siswaId, 'nilai', `Nilai akhir ditimpa menjadi ${n} oleh ${a.pelaku.nama}`)
    ]);
    return { nilai: n, alasan: teks.slice(0, 300), guruId: a.pelaku.id, guruNama: a.pelaku.nama, waktu };
  }],

  ['DELETE', ':kelasId/:siswaId', async (ctx, { kelasId, siswaId }) => {
    const a = await aksesGuru(ctx);
    bolehKelas(a, kelasId);
    await ambilSiswaBoleh(ctx, a, siswaId);
    const db = ctx.env.DB;
    await db.batch([
      perintah(db, 'DELETE FROM nilai_timpa WHERE siswa_id = ? AND kelas_id = ?', siswaId, kelasId),
      // Dicatat hanya bila memang ada nilai timpa yang dihapus
      perintah(db, `INSERT INTO aktivitas (waktu, siswa_id, jenis, keterangan) SELECT ?, ?, 'nilai', ? WHERE changes() = 1`,
        sekarang(), siswaId, `Nilai akhir dikembalikan ke nilai otomatis oleh ${a.pelaku.nama}`)
    ]);
    return { ok: true };
  }]
]);
