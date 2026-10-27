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
//   POST   /api/siswa/:id/reset-pin       { pin } PIN baru 4 angka dari guru (kosong = acak)
//   PUT    /api/siswa/:id/catatan         { teks }
//   DELETE /api/siswa/:id

import { buatRouter, bacaJson, kueri, GalatApi } from '../../../server/http.js';
import { wajibSiswa, aksesGuru, bolehKelas, saringKelas, ambilSiswaBoleh } from '../../../server/sesi.js';
import {
  semua, satu, jalankan, perintah, sekarang, siswaKeObjek, bacaPengaturan, perintahAktivitas, sarankanDariSet
} from '../../../server/data.js';
import { hitungStatistik, siswaDalamAkses } from '../../../server/statistik.js';
import { hashRahasia, acakPin, idBaru, iterasiDari } from '../../../server/kripto.js';
import { periksaKolomSiswa } from '../../../js/game/aturan-siswa.js';
import { ZONA } from '../../../js/data/zona.js';

const iterasi = iterasiDari;

// ---------- Tambah siswa oleh guru (juga dipakai impor) ----------
/** Data pendukung yang dibaca SEKALI per permintaan: username terpakai & koin awal. */
async function siapTambahSiswa(db) {
  const [baris, { koinAwal }] = await Promise.all([semua(db, 'SELECT username FROM siswa'), bacaPengaturan(db)]);
  return { dipakai: new Set(baris.map((r) => r.username)), koinAwal };
}

/**
 * Siapkan satu siswa baru tanpa kueri: validasi, username, PIN acak, dan perintah INSERT.
 * Hasil: { id, username, pin, perintah: [...] } — dijalankan pemanggil dalam satu db.batch.
 */
async function siswaBaru(ctx, a, data, siap) {
  const db = ctx.env.DB;
  bolehKelas(a, data.kelasId);
  const d = {
    namaLengkap: String(data.namaLengkap || '').trim().replace(/\s+/g, ' '),
    namaPanggilan: String(data.namaPanggilan || '').trim(),
    avatar: data.avatar || (data.jenisKelamin === 'P' ? 'wanita' : 'pria'),
    kelasId: data.kelasId,
    username: String(data.username || '').trim().toLowerCase() || sarankanDariSet(siap.dipakai, data.namaPanggilan)
  };
  for (const kolom of ['namaLengkap', 'namaPanggilan', 'avatar', 'kelasId', 'username']) {
    const pesan = periksaKolomSiswa(kolom, d[kolom]);
    if (pesan) throw new GalatApi(400, pesan);
  }
  if (siap.dipakai.has(d.username)) throw new GalatApi(409, 'Username ini sudah dipakai. Coba yang lain ya.');
  siap.dipakai.add(d.username); // baris impor berikutnya tidak memakai username yang sama
  const pin = acakPin();
  const id = idBaru('siswa');
  return {
    id, username: d.username, pin,
    perintah: [
      perintah(db, `INSERT INTO siswa (id, nama_lengkap, nama_panggilan, jenis_kelamin, avatar, kelas_id, username, pin_hash, koin, berlian, zona_terlihat, dibuat_pada)
        VALUES (?,?,?,?,?,?,?,?,?,0,?,?)`, id, d.namaLengkap, d.namaPanggilan, d.avatar === 'pria' ? 'L' : 'P', d.avatar, d.kelasId,
      d.username, await hashRahasia(pin, iterasi(ctx.env)), siap.koinAwal, JSON.stringify([ZONA[0].id]), sekarang()),
      perintahAktivitas(db, id, 'daftar', `Didaftarkan oleh ${a.pelaku.nama}`)
    ]
  };
}

async function tambahSiswaOlehGuru(ctx, a, data) {
  const db = ctx.env.DB;
  const baru = await siswaBaru(ctx, a, data, await siapTambahSiswa(db));
  const hasil = await db.batch([...baru.perintah, perintah(db, 'SELECT * FROM siswa WHERE id = ?', baru.id)]);
  return { siswa: siswaKeObjek(hasil[hasil.length - 1].results[0]), pin: baru.pin };
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
const BATAS_IMPOR = 200;            // pratinjau (tanpa hash)
const BATAS_IMPOR_PER_KIRIM = 10;   // impor sungguhan per permintaan (setiap PIN di-hash)

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

  // Setiap PIN di-hash (±1,5 ms CPU), jadi satu permintaan dibatasi BATAS_IMPOR_PER_KIRIM baris;
  // js/store.js mengirim CSV dalam potongan kecil. Semua akun satu potongan disimpan dalam satu db.batch.
  ['POST', 'impor', async (ctx) => {
    const a = await aksesGuru(ctx);
    const db = ctx.env.DB;
    const { baris, nomorAwal = 1 } = await bacaJson(ctx.request);
    if ((baris || []).length > BATAS_IMPOR_PER_KIRIM) throw new GalatApi(400, `Kirim paling banyak ${BATAS_IMPOR_PER_KIRIM} baris sekali impor.`);
    const siap = await siapTambahSiswa(db);
    const hasil = [];
    const semuaPerintah = [];
    for (const [i, b] of (baris || []).entries()) {
      const cek = periksaBarisImpor(a, b, Number(nomorAwal) + i);
      if (!cek.ok) { hasil.push(cek); continue; }
      try {
        const baru = await siswaBaru(ctx, a, {
          namaLengkap: cek.data.namaLengkap, namaPanggilan: cek.data.namaPanggilan,
          avatar: cek.data.jenisKelamin === 'P' ? 'wanita' : 'pria', kelasId: cek.data.kelasId
        }, siap);
        semuaPerintah.push(...baru.perintah);
        hasil.push({ ...cek, username: baru.username, pin: baru.pin });
      } catch (err) {
        hasil.push({ ...cek, ok: false, pesan: err.message });
      }
    }
    if (semuaPerintah.length) {
      try {
        await db.batch(semuaPerintah);
      } catch (err) {
        console.error(err);
        // Satu transaksi: jika gagal (mis. username baru saja dipakai orang lain), tidak ada akun yang terbuat
        return hasil.map((h) => (h.pin ? { ...h, ok: false, pesan: 'Gagal menyimpan. Coba impor baris ini lagi.', username: undefined, pin: undefined } : h));
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

  // Guru/admin menetapkan PIN murid. { pin } kosong atau tidak dikirim = PIN acak dari sistem.
  // PIN wajib tepat 4 angka; tidak ada aturan lain (1111 atau 1234 boleh).
  ['POST', ':id/reset-pin', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    await ambilSiswaBoleh(ctx, a, id);
    const ada = Number(ctx.request.headers.get('Content-Length') || 0) > 0;
    const masukan = ada ? (await bacaJson(ctx.request)).pin : undefined;
    const pin = masukan == null || masukan === '' ? acakPin() : String(masukan);
    // Diperiksa apa adanya (tanpa dipotong spasi): yang di-hash harus persis 4 angka yang diketik murid
    if (!/^[0-9]{4}$/.test(pin)) throw new GalatApi(400, 'PIN harus tepat 4 angka (0–9), tanpa huruf atau spasi.');
    const db = ctx.env.DB;
    await db.batch([
      // Hanya hash yang disimpan, dengan iterasi ITERASI_PBKDF2 dari environment
      perintah(db, 'UPDATE siswa SET pin_hash = ? WHERE id = ?', await hashRahasia(pin, iterasi(ctx.env)), id),
      // Semua sesi murid ini dihentikan, jadi yang masuk dengan PIN lama ikut keluar
      perintah(db, "DELETE FROM sesi WHERE jenis = 'siswa' AND pengguna_id = ?", id),
      // Catatan aktivitas tanpa angka PIN; saat menyamar yang tercatat admin aslinya
      perintahAktivitas(db, id, 'pin', `PIN diganti oleh ${a.menyamar ? '' : a.admin ? 'admin ' : 'guru '}${a.pelaku.nama}`)
    ]);
    return { pin }; // dikirim sekali untuk dicatat guru; tidak disimpan sebagai teks di mana pun
  }],

  ['PUT', ':id/catatan', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    await ambilSiswaBoleh(ctx, a, id);
    const teks = String((await bacaJson(ctx.request)).teks || '').slice(0, 4000);
    const waktu = sekarang();
    await jalankan(ctx.env.DB, `INSERT INTO catatan_guru (siswa_id, teks, guru_id, guru_nama, diperbarui) VALUES (?,?,?,?,?)
      ON CONFLICT(siswa_id) DO UPDATE SET teks = excluded.teks, guru_id = excluded.guru_id, guru_nama = excluded.guru_nama, diperbarui = excluded.diperbarui`,
    id, teks, a.pelaku.id, a.pelaku.nama, waktu);
    return { teks, diperbarui: waktu, guruId: a.pelaku.id, guruNama: a.pelaku.nama };
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
