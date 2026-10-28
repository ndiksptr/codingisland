// functions/api/siswa/[[rute]].js — siswa
// Satu murid boleh anggota banyak kelas (tabel siswa_kelas). Kolom lama siswa.kelas_id tidak dipakai lagi.
// Untuk siswa yang masuk:
//   GET   /api/siswa/saya                 data diri (tanpa hash PIN), kelasId = kelas aktif
//   PATCH /api/siswa/saya/avatar          { avatar }
//   PATCH /api/siswa/saya/bahasa          { bahasa: 'id' | 'en' } bahasa nama perintah koding
//   POST  /api/siswa/saya/zona-terlihat   { zonaIds } pulau yang animasinya sudah dilihat DI KELAS AKTIF
//   POST  /api/siswa/saya/gabung          { kode } ikut kelas lain dengan kode kelas (TANPA koin awal lagi)
// Untuk guru (dibatasi kelas yang diampu; admin semua):
//   GET    /api/siswa?kelasId=            daftar + statistik (kelasId: angka kelas itu saja)
//   POST   /api/siswa                     tambah akun baru (username otomatis, PIN acak dikembalikan sekali)
//   POST   /api/siswa/anggota             { username, kelasId } tambahkan murid yang SUDAH punya akun ke kelas
//   POST   /api/siswa/impor/pratinjau     periksa baris CSV
//   POST   /api/siswa/impor               buat akun dari baris CSV yang valid
//   GET    /api/siswa/:id?kelasId=        detail + progres per level di satu kelas + catatan guru
//   PATCH  /api/siswa/:id                 ubah nama/avatar/username
//   DELETE /api/siswa/:id/kelas/:kelasId  keluarkan dari kelas (akun & kemajuan di kelas lain tetap utuh)
//   POST   /api/siswa/:id/reset-pin       { pin } PIN baru 4 angka dari guru (kosong = acak)
//   PUT    /api/siswa/:id/catatan         { teks }
//   DELETE /api/siswa/:id                 hapus akun permanen

import { buatRouter, bacaJson, kueri, GalatApi } from '../../../server/http.js';
import { wajibSiswa, wajibSiswaDiKelas, aturKelasAktif, aksesGuru, bolehKelas, saringKelas, ambilSiswaBoleh } from '../../../server/sesi.js';
import {
  semua, satu, jalankan, perintah, sekarang, siswaKeObjek, bacaPengaturan, perintahAktivitas, sarankanDariSet, semuaKelas
} from '../../../server/data.js';
import { hitungStatistik, keanggotaanDalamAkses, gabungPerSiswa } from '../../../server/statistik.js';
import { hashRahasia, acakPin, idBaru, iterasiDari } from '../../../server/kripto.js';
import { BATAS, sisaTahanJendela, catatGagalJendela } from '../../../server/batas.js';
import { periksaKolomSiswa } from '../../../js/game/aturan-siswa.js';
import { ZONA } from '../../../js/data/zona.js';
import { BAHASA_KODE, BAHASA_BAWAAN_SISWA } from '../../../js/game/kamus-perintah.js';

const iterasi = iterasiDari;

/** Baris siswa terbaru tetapi dengan kelas aktif sesi ini (siswaKeObjek membaca kelas_aktif & zona_terlihat_kelas). */
async function siswaTerbaru(db, s) {
  const r = await satu(db, 'SELECT * FROM siswa WHERE id = ?', s.id);
  return siswaKeObjek(r && { ...r, kelas_aktif: s.kelas_aktif, zona_terlihat_kelas: s.zona_terlihat_kelas });
}

/** Perintah tambah keanggotaan (aman diulang: keanggotaan yang sudah ada tidak berubah). */
const perintahGabung = (db, siswaId, kelasId) =>
  perintah(db, 'INSERT INTO siswa_kelas (siswa_id, kelas_id, bergabung_pada) VALUES (?,?,?) ON CONFLICT(siswa_id, kelas_id) DO NOTHING',
    siswaId, kelasId, sekarang());

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
  if (siap.dipakai.has(d.username)) throw new GalatApi(409, 'Username ini sudah dipakai siswa lain. Pilih username lain.');
  siap.dipakai.add(d.username); // baris impor berikutnya tidak memakai username yang sama
  const pin = acakPin();
  const id = idBaru('siswa');
  return {
    id, username: d.username, pin,
    perintah: [
      // Koin awal hanya di sini (baris murid pertama kali dibuat); kelas lewat siswa_kelas
      perintah(db, `INSERT INTO siswa (id, nama_lengkap, nama_panggilan, jenis_kelamin, avatar, username, pin_hash, koin, berlian, dibuat_pada, bahasa)
        VALUES (?,?,?,?,?,?,?,?,0,?,?)`, id, d.namaLengkap, d.namaPanggilan, d.avatar === 'pria' ? 'L' : 'P', d.avatar,
      d.username, await hashRahasia(pin, iterasi(ctx.env)), siap.koinAwal, sekarang(), BAHASA_BAWAAN_SISWA),
      perintahGabung(db, id, d.kelasId),
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
    return siswaTerbaru(ctx.env.DB, s);
  }],

  // Hanya nama perintah koding yang berganti; kode yang sudah tersimpan tidak diterjemahkan
  ['PATCH', 'saya/bahasa', async (ctx) => {
    const s = await wajibSiswa(ctx);
    const { bahasa } = await bacaJson(ctx.request);
    if (!BAHASA_KODE.includes(bahasa)) throw new GalatApi(400, 'Pilih bahasa Indonesia atau Inggris ya.');
    await jalankan(ctx.env.DB, 'UPDATE siswa SET bahasa = ? WHERE id = ?', bahasa, s.id);
    return siswaTerbaru(ctx.env.DB, s);
  }],

  // Catatan pulau yang sudah terlihat menempel di keanggotaan kelas aktif, jadi animasi pulau baru
  // muncul lagi saat pulau terbuka di kelas lain
  ['POST', 'saya/zona-terlihat', async (ctx) => {
    const s = await wajibSiswaDiKelas(ctx);
    const { zonaIds } = await bacaJson(ctx.request);
    const bersih = JSON.stringify([...new Set(zonaIds || [])].filter((z) => ZONA.some((x) => x.id === z)));
    await jalankan(ctx.env.DB, 'UPDATE siswa_kelas SET zona_terlihat = ? WHERE siswa_id = ? AND kelas_id = ?', bersih, s.id, s.kelas_aktif);
    return siswaTerbaru(ctx.env.DB, { ...s, zona_terlihat_kelas: bersih });
  }],

  // Ikut kelas lain dengan kode kelas. SENGAJA tidak menyentuh koin: koin awal hanya diberikan sekali
  // saat baris murid pertama kali dibuat (pendaftaran / dibuatkan guru), bukan saat bergabung ke kelas.
  // Kode salah dihitung per murid (BATAS.gabung) supaya kode kelas tidak bisa ditebak-tebak.
  ['POST', 'saya/gabung', async (ctx) => {
    const s = await wajibSiswa(ctx);
    const db = ctx.env.DB;
    const kunci = `gabung:s:${s.id}`;
    const tahan = await sisaTahanJendela(db, kunci, BATAS.gabung);
    if (tahan) return { ok: false, pesan: `Terlalu banyak kode yang salah. Coba lagi dalam ${Math.ceil(tahan / 60)} menit ya.` };
    const kode = String((await bacaJson(ctx.request)).kode || '').trim().toUpperCase();
    const salah = periksaKolomSiswa('kodeKelas', kode);
    if (salah) return { ok: false, pesan: salah };
    const kelas = await satu(db, 'SELECT id, nama FROM kelas WHERE kode_kelas = ?', kode);
    if (!kelas) {
      await catatGagalJendela(db, kunci, BATAS.gabung);
      return { ok: false, pesan: 'Kode kelas belum cocok. Tanya gurumu ya.' };
    }
    if (await satu(db, 'SELECT 1 AS ada FROM siswa_kelas WHERE siswa_id = ? AND kelas_id = ?', s.id, kelas.id)) {
      return { ok: false, pesan: `Kamu sudah ikut ${kelas.nama}.` };
    }
    await db.batch([
      perintahGabung(db, s.id, kelas.id),
      perintahAktivitas(db, s.id, 'kelas', `Bergabung ke ${kelas.nama} dengan kode kelas`)
    ]);
    // Kelas yang sedang dimainkan tetap dipakai; murid yang belum punya kelas langsung main di kelas baru
    await aturKelasAktif(ctx, s.kelas_aktif || kelas.id);
    return { ok: true, kelas: { id: kelas.id, nama: kelas.nama } };
  }],

  // ================= Guru =================
  // Tanpa filter kelas: satu baris per murid (angka semua kelas yang Anda ampu digabung).
  // Dengan filter kelas: angka kelas itu saja, sama dengan halaman Nilai kelas itu.
  ['GET', '', async (ctx) => {
    const a = await aksesGuru(ctx);
    const k = saringKelas(a, kueri(ctx.request).kelasId || null);
    return gabungPerSiswa(await hitungStatistik(ctx.env.DB, await keanggotaanDalamAkses(ctx.env.DB, a, k)));
  }],

  ['POST', '', async (ctx) => tambahSiswaOlehGuru(ctx, await aksesGuru(ctx), await bacaJson(ctx.request))],

  // Tambahkan murid yang SUDAH punya akun ke kelas yang diampu (mis. anggota ekskul dari kelas lain).
  // Akun, koin, dan kemajuan di kelas lain tidak berubah; tidak ada koin awal lagi.
  ['POST', 'anggota', async (ctx) => {
    const a = await aksesGuru(ctx);
    const db = ctx.env.DB;
    const { username, kelasId } = await bacaJson(ctx.request);
    bolehKelas(a, kelasId);
    const u = String(username || '').trim().toLowerCase();
    if (!u) throw new GalatApi(400, 'Ketik username siswa yang ingin ditambahkan.');
    const s = await satu(db, 'SELECT * FROM siswa WHERE username = ?', u);
    if (!s) throw new GalatApi(404, `Siswa dengan username ${u} tidak ditemukan. Periksa ejaannya, atau buat akun baru lewat Tambah Siswa.`);
    const kelas = a.kelas.find((k) => k.id === kelasId);
    if (await satu(db, 'SELECT 1 AS ada FROM siswa_kelas WHERE siswa_id = ? AND kelas_id = ?', s.id, kelasId)) {
      throw new GalatApi(409, `${s.nama_lengkap} sudah menjadi anggota ${kelas.nama}.`);
    }
    await db.batch([
      perintahGabung(db, s.id, kelasId),
      perintahAktivitas(db, s.id, 'kelas', `Ditambahkan ke ${kelas.nama} oleh ${a.pelaku.nama}`)
    ]);
    return { siswa: { id: s.id, namaLengkap: s.nama_lengkap, namaPanggilan: s.nama_panggilan }, kelas: { id: kelas.id, nama: kelas.nama } };
  }],

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
        return hasil.map((h) => (h.pin ? { ...h, ok: false, pesan: 'Baris ini belum tersimpan karena ada gangguan. Impor ulang baris ini.', username: undefined, pin: undefined } : h));
      }
    }
    return hasil;
  }],

  // Kemajuan terpisah per kelas: detail menampilkan SATU kelas (kelasId, atau kelas pertama yang Anda ampu)
  ['GET', ':id', async (ctx, { id }) => {
    const a = await aksesGuru(ctx);
    const db = ctx.env.DB;
    const baris = await ambilSiswaBoleh(ctx, a, id);
    const kelasSemua = await semuaKelas(db);
    const kelasBoleh = baris.kelasAnggota.filter((k) => a.admin || a.kelasIds.has(k));
    const diminta = kueri(ctx.request).kelasId;
    const kelasId = kelasBoleh.includes(diminta) ? diminta : (kelasBoleh[0] || null);
    const [x] = await hitungStatistik(db, [{ baris, kelasId }], { kelas: kelasSemua });
    const peta = new Map(x.progres.map((p) => [p.levelId, p]));
    const zonaIds = kelasSemua.find((k) => k.id === kelasId)?.zonaIds || [];
    const urutZona = (l) => zonaIds.indexOf(l.zona);
    const levels = x.levels.slice().sort((p, q) => urutZona(p) - urutZona(q) || (p.urutan ?? 0) - (q.urutan ?? 0));
    const catatan = await satu(db, 'SELECT * FROM catatan_guru WHERE siswa_id = ?', id);
    return {
      siswa: x.baris,
      // Kelas murid ini yang boleh Anda lihat, untuk pilihan kelas di halaman detail
      kelasBoleh: kelasBoleh.map((k) => kelasSemua.find((y) => y.id === k)).filter(Boolean).map((k) => ({ id: k.id, nama: k.nama })),
      kelasId,
      zona: zonaIds.map((zid) => ZONA.find((z) => z.id === zid)).filter(Boolean).map((z) => {
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
      username: 'username' in data ? String(data.username).trim().toLowerCase() : lama.username
    };
    for (const kolom of ['namaLengkap', 'namaPanggilan', 'avatar', 'username']) {
      const pesan = periksaKolomSiswa(kolom, baru[kolom]);
      if (pesan) throw new GalatApi(400, pesan);
    }
    if (await satu(db, 'SELECT id FROM siswa WHERE username = ? AND id <> ?', baru.username, id)) throw new GalatApi(409, 'Username ini sudah dipakai siswa lain. Pilih username lain.');
    await jalankan(db, 'UPDATE siswa SET nama_lengkap = ?, nama_panggilan = ?, avatar = ?, jenis_kelamin = ?, username = ? WHERE id = ?',
      baru.namaLengkap, baru.namaPanggilan, baru.avatar, baru.avatar === 'pria' ? 'L' : 'P', baru.username, id);
    return siswaKeObjek(await satu(db, 'SELECT * FROM siswa WHERE id = ?', id));
  }],

  // KELUARKAN dari satu kelas (bukan hapus akun): hanya baris keanggotaan yang dihapus.
  // Akun, koin, berlian, keanggotaan, dan kemajuan di kelas lain tetap utuh. Kemajuan di kelas ini juga
  // tidak dihapus (tidak dihitung lagi), jadi muncul kembali bila murid ditambahkan lagi ke kelas ini.
  ['DELETE', ':id/kelas/:kelasId', async (ctx, { id, kelasId }) => {
    const a = await aksesGuru(ctx);
    bolehKelas(a, kelasId);
    const s = await ambilSiswaBoleh(ctx, a, id);
    if (!s.kelasAnggota.includes(kelasId)) throw new GalatApi(404, 'Siswa ini sudah tidak terdaftar di kelas itu. Muat ulang halaman.');
    const kelas = a.kelas.find((k) => k.id === kelasId);
    const db = ctx.env.DB;
    await db.batch([
      perintah(db, 'DELETE FROM siswa_kelas WHERE siswa_id = ? AND kelas_id = ?', id, kelasId),
      // Sesi murid yang sedang main di kelas ini kembali memilih kelas (atau diminta kode kelas)
      perintah(db, "UPDATE sesi SET kelas_aktif_id = NULL WHERE jenis = 'siswa' AND pengguna_id = ? AND kelas_aktif_id = ?", id, kelasId),
      perintahAktivitas(db, id, 'kelas', `Dikeluarkan dari ${kelas.nama} oleh ${a.pelaku.nama}`)
    ]);
    return { ok: true };
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
    // keanggotaan, progres semua kelas, aktivitas, catatan, dan nilai_timpa ikut terhapus lewat ON DELETE CASCADE
    await db.batch([
      perintah(db, "DELETE FROM sesi WHERE jenis = 'siswa' AND pengguna_id = ?", id),
      perintah(db, 'DELETE FROM siswa WHERE id = ?', id)
    ]);
    return { ok: true };
  }]
]);
