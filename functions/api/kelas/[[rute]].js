// functions/api/kelas/[[rute]].js — kelas
//   GET    /api/kelas/publik            daftar kelas untuk pendaftaran (tanpa kode kelas)
//   POST   /api/kelas/cek-kode          { kelasId, kode } -> { cocok }
//   GET    /api/kelas                   kelas yang diampu guru (+ guru pengampu, jumlah siswa, rata-rata nilai)
//   GET    /api/kelas/kode-acak         { kode } kode acak yang belum dipakai (guru boleh menimpanya)
//   POST   /api/kelas                   tambah kelas (guru otomatis menjadi pengampu)
//   GET    /api/kelas/:id               satu kelas (siswa: hanya kelas yang diikutinya)
//   PUT    /api/kelas/:id               ubah kelas (guruIds hanya untuk admin)
//   PUT    /api/kelas/:id/zona          { zonaIds } pulau yang dipakai kelas ini beserta urutannya
//   GET    /api/kelas/:id/sertifikat    daftar penerima sertifikat Juara di kelas ini (+ isi sertifikat kelas)
//   PUT    /api/kelas/:id/sertifikat    { sekolah, ttdNama, ttdJabatan } isi sertifikat kelas ini
//   POST   /api/kelas/:id/kode-baru     buat kode kelas baru
//   DELETE /api/kelas/:id               hapus kelas kosong (tanpa anggota)

import { buatRouter, bacaJson, GalatApi } from '../../../server/http.js';
import { ambilSesi, aksesGuru, bolehKelas } from '../../../server/sesi.js';
import { semua, satu, jalankan, perintah, semuaKelas, semuaLevel, zonaKelasDariTeks, urutKelas, sertifikatDariTeks, levelBerlaku } from '../../../server/data.js';
import { hitungStatistik, keanggotaanDalamAkses, rataRata, sertifikatJuara } from '../../../server/statistik.js';
import { zonaTerakhir } from '../../../js/game/kemajuan.js';
import { ZONA } from '../../../js/data/zona.js';
import { JENIS_KELAS, TINGKAT_KELAS, TINGKAT_PENGISI_EKSKUL } from '../../../js/data/kelas.js';
import { acakKodeKelas, idBaru } from '../../../server/kripto.js';

function periksaKelas(d) {
  if (!d.nama || d.nama.trim().length < 2) throw new GalatApi(400, 'Nama kelas minimal 2 huruf.');
  if (!JENIS_KELAS.includes(d.jenis)) throw new GalatApi(400, 'Pilih Ekskul atau tingkat kelas 3 sampai 6.');
  if (!TINGKAT_KELAS.includes(Number(d.tingkat))) throw new GalatApi(400, 'Tingkat kelas harus 3 sampai 6.');
  if (!/^[A-Z0-9]{6}$/.test(d.kodeKelas)) throw new GalatApi(400, 'Kode kelas harus 6 huruf atau angka.');
}

async function kodeUnik(db) {
  const dipakai = new Set((await semua(db, 'SELECT kode_kelas FROM kelas')).map((r) => r.kode_kelas));
  let kode;
  do { kode = acakKodeKelas(); } while (dipakai.has(kode));
  return kode;
}

// Kode kelas unik di seluruh sekolah (pembanding huruf besar, kolom kode_kelas UNIQUE)
async function tolakKodeKembar(db, kode, kecualiId = '') {
  if (await satu(db, 'SELECT id FROM kelas WHERE kode_kelas = ? AND id <> ?', kode, kecualiId)) {
    throw new GalatApi(409, `Kode kelas ${kode} sudah dipakai kelas lain. Ketik kode lain atau tekan Acak.`);
  }
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
    (await semua(ctx.env.DB, `SELECT id, nama, jenis, tingkat FROM kelas ORDER BY ${urutKelas()}`))],

  ['POST', 'cek-kode', async (ctx) => {
    const { kelasId, kode } = await bacaJson(ctx.request);
    const k = await satu(ctx.env.DB, 'SELECT kode_kelas FROM kelas WHERE id = ?', kelasId);
    return { cocok: !!k && k.kode_kelas.toUpperCase() === String(kode || '').trim().toUpperCase() };
  }],

  ['GET', 'kode-acak', async (ctx) => {
    await aksesGuru(ctx);
    return { kode: await kodeUnik(ctx.env.DB) };
  }],

  ['GET', '', async (ctx) => {
    const a = await aksesGuru(ctx);
    const db = ctx.env.DB;
    const guruList = await semua(db, 'SELECT id, nama FROM guru');
    const stat = await hitungStatistik(db, await keanggotaanDalamAkses(db, a), { kelas: a.kelas });
    return a.kelas.map((k) => {
      const st = stat.filter((x) => x.kelasId === k.id);
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
    const jenis = data.jenis === 'ekskul' ? 'ekskul' : 'reguler';
    const d = {
      nama: String(data.nama || '').trim(),
      jenis,
      // Ekskul: tingkat dari form diabaikan; kolomnya (NOT NULL, CHECK 1–6) diisi nilai pengisi yang tidak ditampilkan
      tingkat: jenis === 'ekskul' ? TINGKAT_PENGISI_EKSKUL : Number(data.tingkat),
      kodeKelas: String(data.kodeKelas || (await kodeUnik(db))).trim().toUpperCase()
    };
    periksaKelas(d);
    await tolakKodeKembar(db, d.kodeKelas);
    const id = idBaru('kelas');
    await jalankan(db, 'INSERT INTO kelas (id, nama, jenis, tingkat, kode_kelas) VALUES (?,?,?,?,?)', id, d.nama, d.jenis, d.tingkat, d.kodeKelas);
    // Guru biasa otomatis menjadi pengampu kelas yang dibuatnya; admin memilih sendiri
    await aturGuruKelas(db, id, a.admin ? (data.guruIds || []) : [a.guru.id]);
    return ambilKelas(db, id);
  }],

  ['GET', ':id', async (ctx, { id }) => {
    const db = ctx.env.DB;
    const s = await ambilSesi(ctx);
    if (s?.jenis === 'siswa') {
      const k = await satu(db, `SELECT k.id, k.nama, k.jenis, k.tingkat, k.zona_ids FROM siswa_kelas sk JOIN kelas k ON k.id = sk.kelas_id
        WHERE sk.siswa_id = ? AND sk.kelas_id = ?`, s.pengguna_id, id);
      if (!k) throw new GalatApi(403, 'Kamu hanya bisa melihat kelas yang kamu ikuti.');
      return { id: k.id, nama: k.nama, jenis: k.jenis, tingkat: k.tingkat, zonaIds: zonaKelasDariTeks(k.zona_ids) };
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
    const jenis = 'jenis' in data ? (data.jenis === 'ekskul' ? 'ekskul' : 'reguler') : lama.jenis;
    const baru = {
      nama: 'nama' in data ? String(data.nama).trim() : lama.nama,
      jenis,
      // Ekskul: tingkat dari form diabaikan, nilai lama dibiarkan sebagai pengisi
      tingkat: jenis === 'ekskul'
        ? (TINGKAT_KELAS.includes(lama.tingkat) ? lama.tingkat : TINGKAT_PENGISI_EKSKUL)
        : ('tingkat' in data ? Number(data.tingkat) : lama.tingkat),
      kodeKelas: 'kodeKelas' in data ? String(data.kodeKelas).trim().toUpperCase() : lama.kodeKelas
    };
    periksaKelas(baru);
    await tolakKodeKembar(db, baru.kodeKelas, id);
    await jalankan(db, 'UPDATE kelas SET nama = ?, jenis = ?, tingkat = ?, kode_kelas = ? WHERE id = ?', baru.nama, baru.jenis, baru.tingkat, baru.kodeKelas, id);
    if (a.admin && Array.isArray(data.guruIds)) await aturGuruKelas(db, id, data.guruIds);
    return ambilKelas(db, id);
  }],

  // Pulau milik kelas: hanya pilihan dan urutannya (definisi pulau tetap di js/data/zona.js).
  // Daftar kosong boleh: murid kelas ini melihat "Belum ada pulau yang dibuka".
  ['PUT', ':id/zona', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    bolehKelas(a, id);
    const { zonaIds } = await bacaJson(ctx.request);
    if (!Array.isArray(zonaIds)) throw new GalatApi(400, 'Daftar pulau tidak terbaca. Muat ulang halaman, lalu coba lagi.');
    const bersih = [...new Set(zonaIds)].filter((z) => ZONA.some((x) => x.id === z));
    await jalankan(ctx.env.DB, 'UPDATE kelas SET zona_ids = ? WHERE id = ?', JSON.stringify(bersih), id);
    return ambilKelas(ctx.env.DB, id);
  }],

  // Daftar penerima sertifikat: semua anggota kelas, juara atau belum, dengan aturan juara yang sama
  // dengan halaman juara murid (sertifikatJuara). Guru hanya untuk kelas yang diampu; admin semua.
  ['GET', ':id/sertifikat', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    bolehKelas(a, id);
    const db = ctx.env.DB;
    const kelas = await ambilKelas(db, id);
    const levelsSemua = await semuaLevel(db);
    const stat = await hitungStatistik(db, await keanggotaanDalamAkses(db, a, id), { levels: levelsSemua });
    const levels = levelsSemua.filter((l) => levelBerlaku(l, id, kelas.zonaIds));
    const siswa = stat.map((x) => {
      const data = sertifikatJuara(kelas, x.levels, x.progres, x.siswa.namaLengkap);
      return {
        id: x.siswa.id, namaLengkap: x.siswa.namaLengkap, namaPanggilan: x.siswa.namaPanggilan, avatar: x.siswa.avatar,
        levelSelesai: x.baris.levelSelesai, totalLevel: x.baris.totalLevel, totalBintang: x.baris.totalBintang,
        juara: !!data, sertifikat: data
      };
    }).sort((p, q) => Number(q.juara) - Number(p.juara) || p.namaLengkap.localeCompare(q.namaLengkap));
    return {
      kelas: { id: kelas.id, nama: kelas.nama, jenis: kelas.jenis, tingkat: kelas.tingkat },
      pengaturan: kelas.sertifikat,
      // Pulau yang boss-nya membuka sertifikat (null = kelas belum punya pulau berisi soal)
      pulauTerakhir: zonaTerakhir(kelas.zonaIds, levels)?.nama || null,
      siswa
    };
  }],

  ['PUT', ':id/sertifikat', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    bolehKelas(a, id);
    const isi = sertifikatDariTeks(JSON.stringify(await bacaJson(ctx.request)));
    if (isi.ttdJabatan && !isi.ttdNama) throw new GalatApi(400, 'Isi nama penanda tangan dulu, baru jabatannya.');
    await jalankan(ctx.env.DB, 'UPDATE kelas SET sertifikat = ? WHERE id = ?', JSON.stringify(isi), id);
    return isi;
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
    if (await satu(db, 'SELECT siswa_id FROM siswa_kelas WHERE kelas_id = ? LIMIT 1', id)) {
      throw new GalatApi(400, 'Kelas masih berisi siswa. Keluarkan siswanya dari kelas ini dulu.');
    }
    await jalankan(db, 'DELETE FROM kelas WHERE id = ?', id);
    return { ok: true };
  }]
]);
