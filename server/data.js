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
export function siswaKeObjek(r) {
  if (!r) return null;
  return {
    id: r.id,
    namaLengkap: r.nama_lengkap,
    namaPanggilan: r.nama_panggilan,
    jenisKelamin: r.jenis_kelamin,
    avatar: r.avatar,
    kelasId: r.kelas_id,
    username: r.username,
    koin: r.koin,
    berlian: r.berlian,
    zonaTerlihat: jsonAman(r.zona_terlihat, [ZONA[0].id]),
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
    kelasNonaktif: jsonAman(r.kelas_nonaktif, []),
    dibuatPada: r.dibuat_pada,
    diperbarui: r.diperbarui
  };
}

export function progresKeObjek(r) {
  return {
    siswaId: r.siswa_id,
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
/** Baris tabel kelas + guru_kelas -> objek kelas dengan guruIds. */
export const kelasDariBaris = (kelas, relasi) => kelas.map((k) => ({
  id: k.id, nama: k.nama, tingkat: k.tingkat, kodeKelas: k.kode_kelas,
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
  const { id, zona, urutan, jenis, judul, bawaan, terbit, pembuat, kelasIds, kelasNonaktif, dibuatPada, diperbarui, ...isi } = l;
  delete isi.nomor; delete isi.status; delete isi.bintang; delete isi.nilai; // jaga-jaga field tampilan
  return perintah(db, `
    INSERT INTO level (id, zona, urutan, jenis, judul, bawaan, terbit, pembuat_id, pembuat_nama, kelas_ids, kelas_nonaktif, data, dibuat_pada, diperbarui)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET zona=excluded.zona, urutan=excluded.urutan, jenis=excluded.jenis, judul=excluded.judul,
      bawaan=excluded.bawaan, terbit=excluded.terbit, pembuat_id=excluded.pembuat_id, pembuat_nama=excluded.pembuat_nama,
      kelas_ids=excluded.kelas_ids, kelas_nonaktif=excluded.kelas_nonaktif, data=excluded.data, diperbarui=excluded.diperbarui`,
  id, zona, urutan ?? 0, jenis, judul, bawaan ? 1 : 0, terbit ? 1 : 0, pembuat?.id || null, pembuat?.nama || null,
  kelasIds ? JSON.stringify(kelasIds) : null, JSON.stringify(kelasNonaktif || []), JSON.stringify(isi),
  dibuatPada || sekarang(), diperbarui || sekarang());
}

// Zona nonaktif: kunci pengaturan zona_nonaktif berisi JSON array id zona, mis. ["salju"].
// Baris belum ada atau isinya rusak = semua zona aktif. Id yang tidak dikenal diabaikan.
const saringZonaNonaktif = (nilai) => (Array.isArray(nilai) ? ZONA.map((z) => z.id).filter((id) => nilai.includes(id)) : []);

export async function bacaPengaturan(db) {
  const baris = await semua(db, 'SELECT kunci, nilai FROM pengaturan');
  const peta = Object.fromEntries(baris.map((b) => [b.kunci, jsonAman(b.nilai, null)]));
  const harga = Array.isArray(peta.harga_clue) && peta.harga_clue.length === 3 ? peta.harga_clue : CLUE.map((c) => c.harga);
  return {
    hargaClue: harga,
    koinAwal: Number.isInteger(peta.koin_awal) ? peta.koin_awal : KOIN_AWAL,
    zonaNonaktif: saringZonaNonaktif(peta.zona_nonaktif)
  };
}

/** Id zona nonaktif dari baris pengaturan zona_nonaktif (boleh null/undefined bila baris belum ada). */
export const zonaNonaktifDariBaris = (baris) => saringZonaNonaktif(jsonAman(baris?.nilai, null));

/** Daftar id zona yang sedang dinonaktifkan. */
export async function bacaZonaNonaktif(db) {
  return zonaNonaktifDariBaris(await satu(db, "SELECT nilai FROM pengaturan WHERE kunci = 'zona_nonaktif'"));
}

export const perintahAktivitas = (db, siswaId, jenis, keterangan) =>
  perintah(db, 'INSERT INTO aktivitas (waktu, siswa_id, jenis, keterangan) VALUES (?,?,?,?)', sekarang(), siswaId, jenis, keterangan);

// ---------- Aturan bersama ----------
/** Level terlihat oleh siswa di kelas ini? (terbit, kelas tujuan cocok, tidak dinonaktifkan untuk kelas itu) */
export function levelTerlihatUntukKelas(l, kelasId) {
  return l.terbit !== false && (!l.kelasIds || l.kelasIds.includes(kelasId)) && !(l.kelasNonaktif || []).includes(kelasId);
}

/**
 * Level berlaku untuk kelas ini: terlihat (aturan di atas) DAN zonanya tidak dinonaktifkan.
 * Dipakai peta murid, level yang boleh dimainkan, nilai akhir, dan statistik dashboard,
 * supaya keempatnya selalu memakai daftar level yang sama.
 */
export function levelBerlaku(l, kelasId, zonaNonaktif = []) {
  return levelTerlihatUntukKelas(l, kelasId) && !zonaNonaktif.includes(l.zona);
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

