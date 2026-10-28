// server/data.js — akses D1: kueri ringkas, ubah baris tabel menjadi objek yang sama
// bentuknya dengan hasil yang dipakai halaman (js/store.js), dan aturan bersama.

import { ZONA } from '../js/data/zona.js';
import { CLUE } from '../js/game/skor.js';
import { BAHASA_BAWAAN_SISWA } from '../js/game/kamus-perintah.js';

export const KOIN_AWAL = 20;
export const sekarang = () => new Date().toISOString();

// ---------- Kueri ringkas ----------
export const semua = async (db, sql, ...p) => (await db.prepare(sql).bind(...p).all()).results || [];
export const satu = (db, sql, ...p) => db.prepare(sql).bind(...p).first();
export const jalankan = (db, sql, ...p) => db.prepare(sql).bind(...p).run();
export const perintah = (db, sql, ...p) => db.prepare(sql).bind(...p);
const jsonAman = (teks, bawaan) => { try { return teks == null ? bawaan : JSON.parse(teks); } catch { return bawaan; } };

// ---------- Baris -> objek ----------
/**
 * Baris siswa -> objek. Kolom lama siswa.kelas_id dan siswa.zona_terlihat tidak dibaca lagi:
 * kelasId = kelas aktif sesi ini (kolom hasil JOIN kelas_aktif, bila ada) dan zonaTerlihat milik
 * keanggotaan kelas itu (kolom hasil JOIN zona_terlihat_kelas; null = belum pernah dicatat).
 */
export function siswaKeObjek(r) {
  if (!r) return null;
  return {
    id: r.id,
    namaLengkap: r.nama_lengkap,
    namaPanggilan: r.nama_panggilan,
    jenisKelamin: r.jenis_kelamin,
    avatar: r.avatar,
    kelasId: r.kelas_aktif ?? null,
    username: r.username,
    koin: r.koin,
    berlian: r.berlian,
    zonaTerlihat: jsonAman(r.zona_terlihat_kelas, null),
    bahasa: r.bahasa === 'id' || r.bahasa === 'en' ? r.bahasa : BAHASA_BAWAAN_SISWA, // bahasa nama perintah koding (migrasi 0005)
    dibuatPada: r.dibuat_pada
  };
}

export const guruKeObjek = (r, kelasIds = []) => (r ? { id: r.id, nama: r.nama, username: r.username, peran: r.peran, kelasIds } : null);

export function levelKeObjek(r) {
  return {
    ...jsonAman(r.data, {}),
    id: r.id,
    zona: r.zona,
    urutan: r.urutan,
    jenis: r.jenis,
    judul: r.judul,
    bawaan: !!r.bawaan,
    terbit: !!r.terbit,
    pembuat: r.pembuat_id ? { id: r.pembuat_id, nama: r.pembuat_nama } : (r.pembuat_nama ? { id: null, nama: r.pembuat_nama } : null),
    kelasIds: jsonAman(r.kelas_ids, null),
    dibuatPada: r.dibuat_pada,
    diperbarui: r.diperbarui
  };
}

export function progresKeObjek(r) {
  return {
    siswaId: r.siswa_id,
    kelasId: r.kelas_id,
    levelId: r.level_id,
    selesai: !!r.selesai,
    bintang: r.bintang,
    nilai: r.nilai,
    percobaan: r.percobaan,
    clueDibeli: r.clue_dibeli,
    kodeTerakhir: r.kode_terakhir || '',
    detik: r.detik,
    selesaiPada: r.selesai_pada,
    diperbarui: r.diperbarui
  };
}

// ---------- Muat data ----------
/**
 * Pulau yang dipakai kelas, dalam urutan main (kolom kelas.zona_ids, migrasi 0009).
 * Id yang tidak dikenal dan id kembar dibuang; isi rusak = semua pulau dengan urutan bawaan.
 */
export function zonaKelasDariTeks(teks) {
  const daftar = jsonAman(teks, null);
  if (!Array.isArray(daftar)) return ZONA.map((z) => z.id);
  return [...new Set(daftar)].filter((id) => ZONA.some((z) => z.id === id));
}

/** Baris tabel kelas + guru_kelas -> objek kelas dengan guruIds dan zonaIds. */
export const kelasDariBaris = (kelas, relasi) => kelas.map((k) => ({
  id: k.id, nama: k.nama, tingkat: k.tingkat, kodeKelas: k.kode_kelas, zonaIds: zonaKelasDariTeks(k.zona_ids),
  guruIds: relasi.filter((x) => x.kelas_id === k.id).map((x) => x.guru_id)
}));

export async function semuaKelas(db) {
  const [rk, rr] = await db.batch([
    perintah(db, 'SELECT * FROM kelas ORDER BY tingkat, nama'),
    perintah(db, 'SELECT guru_id, kelas_id FROM guru_kelas')
  ]);
  return kelasDariBaris(rk.results || [], rr.results || []);
}

export async function semuaLevel(db) {
  return (await semua(db, 'SELECT * FROM level')).map(levelKeObjek);
}

/** Simpan objek level (insert atau update) — kolom penting terpisah, sisanya di kolom JSON data. */
export function perintahSimpanLevel(db, l) {
  const { id, zona, urutan, jenis, judul, bawaan, terbit, pembuat, kelasIds, dibuatPada, diperbarui, ...isi } = l;
  delete isi.nomor; delete isi.status; delete isi.bintang; delete isi.nilai; // jaga-jaga field tampilan
  delete isi.kelasNonaktif; // fitur lama (kolom kelas_nonaktif dihapus di migrasi 0008)
  return perintah(db, `
    INSERT INTO level (id, zona, urutan, jenis, judul, bawaan, terbit, pembuat_id, pembuat_nama, kelas_ids, data, dibuat_pada, diperbarui)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET zona=excluded.zona, urutan=excluded.urutan, jenis=excluded.jenis, judul=excluded.judul,
      bawaan=excluded.bawaan, terbit=excluded.terbit, pembuat_id=excluded.pembuat_id, pembuat_nama=excluded.pembuat_nama,
      kelas_ids=excluded.kelas_ids, data=excluded.data, diperbarui=excluded.diperbarui`,
  id, zona, urutan ?? 0, jenis, judul, bawaan ? 1 : 0, terbit ? 1 : 0, pembuat?.id || null, pembuat?.nama || null,
  kelasIds ? JSON.stringify(kelasIds) : null, JSON.stringify(isi),
  dibuatPada || sekarang(), diperbarui || sekarang());
}

export async function bacaPengaturan(db) {
  const baris = await semua(db, 'SELECT kunci, nilai FROM pengaturan');
  const peta = Object.fromEntries(baris.map((b) => [b.kunci, jsonAman(b.nilai, null)]));
  const harga = Array.isArray(peta.harga_clue) && peta.harga_clue.length === 3 ? peta.harga_clue : CLUE.map((c) => c.harga);
  return {
    hargaClue: harga,
    koinAwal: Number.isInteger(peta.koin_awal) ? peta.koin_awal : KOIN_AWAL
  };
}

/** Pulau (urutan main) kelas ini; kelas tidak ada = daftar kosong. */
export async function bacaZonaKelas(db, kelasId) {
  const k = kelasId ? await satu(db, 'SELECT zona_ids FROM kelas WHERE id = ?', kelasId) : null;
  return k ? zonaKelasDariTeks(k.zona_ids) : [];
}

/** Keanggotaan kelas semua murid (urut waktu bergabung). Hasil: Map siswaId -> [kelasId]. */
export async function petaKelasSiswa(db) {
  const peta = new Map();
  for (const r of await semua(db, 'SELECT siswa_id, kelas_id FROM siswa_kelas ORDER BY bergabung_pada')) {
    if (!peta.has(r.siswa_id)) peta.set(r.siswa_id, []);
    peta.get(r.siswa_id).push(r.kelas_id);
  }
  return peta;
}

export const perintahAktivitas = (db, siswaId, jenis, keterangan) =>
  perintah(db, 'INSERT INTO aktivitas (waktu, siswa_id, jenis, keterangan) VALUES (?,?,?,?)', sekarang(), siswaId, jenis, keterangan);

// ---------- Aturan bersama ----------
/** Level terlihat oleh siswa di kelas ini? (terbit dan kelas ini dicentang; kelasIds null = semua kelas) */
export function levelTerlihatUntukKelas(l, kelasId) {
  return l.terbit !== false && (!l.kelasIds || l.kelasIds.includes(kelasId));
}

/**
 * Level berlaku untuk kelas ini: terlihat (aturan di atas) DAN pulaunya dipakai kelas itu (zonaIds kelas).
 * Dipakai peta murid, level yang boleh dimainkan, nilai akhir, dan statistik dashboard,
 * supaya keempatnya selalu memakai daftar level yang sama.
 */
export function levelBerlaku(l, kelasId, zonaIds = []) {
  return levelTerlihatUntukKelas(l, kelasId) && zonaIds.includes(l.zona);
}

/** Urutkan ulang level satu zona menjadi 1..n dengan boss selalu di akhir. Mengembalikan level yang berubah. */
export function rapikanUrutan(levels, zona) {
  const z = levels.filter((l) => l.zona === zona).sort((p, q) => (p.urutan ?? 0) - (q.urutan ?? 0));
  const berubah = [];
  [...z.filter((l) => l.jenis !== 'boss'), ...z.filter((l) => l.jenis === 'boss')].forEach((l, i) => {
    if (l.urutan !== i + 1) { l.urutan = i + 1; berubah.push(l); }
  });
  return berubah;
}

const dasarUsername = (namaPanggilan) => {
  const d = String(namaPanggilan || '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').slice(0, 12) || 'robot';
  return d.length < 2 ? `${d}${d}` : d;
};

/** Saran username dari himpunan username yang sudah dipakai (tanpa kueri; dipakai impor massal). */
export function sarankanDariSet(dipakai, namaPanggilan) {
  const dasar = dasarUsername(namaPanggilan);
  for (let i = 0; i < 50; i++) {
    const angka = i < 30 ? 10 + Math.floor(Math.random() * 90) : 100 + Math.floor(Math.random() * 900);
    if (!dipakai.has(`${dasar}${angka}`)) return `${dasar}${angka}`;
  }
  return `${dasar}${Date.now() % 10000}`;
}

/** Saran username: nama panggilan + angka, belum dipakai. */
export async function sarankanUsernameDb(db, namaPanggilan) {
  const dasar = dasarUsername(namaPanggilan);
  const dipakai = new Set((await semua(db, 'SELECT username FROM siswa WHERE username LIKE ?', `${dasar}%`)).map((r) => r.username));
  return sarankanDariSet(dipakai, namaPanggilan);
}

