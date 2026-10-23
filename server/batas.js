// server/batas.js — batas percobaan login & pemasangan (tabel percobaan_login)
// SEMUA angka batas ada di objek BATAS di bawah ini.
//
// Dua jenis baris:
//   'siswa:u:<username>', 'guru:u:<username>'      per username: gagal beruntun -> ditahan sebentar.
//                                                   gagal = jumlah salah beruntun, tahan_sampai = akhir masa tahan.
//   'siswa:ip:<ip>', 'guru:ip:<ip>', 'pasang:ip:<ip>'  per IP berjendela: gagal = jumlah salah di jendela ini,
//                                                   tahan_sampai = akhir jendela. Satu sekolah berbagi satu IP,
//                                                   jadi batas siswa per IP dibuat longgar.

import { satu, semua, jalankan, perintah } from './data.js';

const MENIT = 60 * 1000;

export const BATAS = {
  username: { gagal: 5, tahanMs: 1 * MENIT },      // 5 kali salah -> username itu ditahan 1 menit
  ipSiswa: { gagal: 300, jendelaMs: 15 * MENIT },  // satu kelas/sekolah di balik satu IP Wi-Fi
  ipGuru: { gagal: 30, jendelaMs: 15 * MENIT },
  ipPasang: { gagal: 30, jendelaMs: 15 * MENIT },
  simpanBarisMs: 15 * MENIT                         // baris tanpa tahanan yang lebih tua dari ini dibersihkan
};

/** Sisa detik dari sebuah baris (0 = boleh mencoba). */
function sisaDetik(r, batasGagal) {
  if (!r || r.tahan_sampai <= Date.now()) return 0;
  if (batasGagal != null && r.gagal < batasGagal) return 0; // jendela IP belum penuh
  return Math.ceil((r.tahan_sampai - Date.now()) / 1000);
}

/**
 * Status tahanan login (satu kueri untuk username + IP).
 * Hasil: sisa detik terbesar (0 = boleh mencoba).
 */
export async function sisaTahanLogin(db, kunciU, kunciIp, batasIp) {
  const baris = await semua(db, 'SELECT kunci, gagal, tahan_sampai FROM percobaan_login WHERE kunci IN (?, ?)', kunciU, kunciIp);
  const r = (k) => baris.find((x) => x.kunci === k);
  return Math.max(sisaDetik(r(kunciU)), sisaDetik(r(kunciIp), batasIp.gagal));
}

/** Sisa detik tahanan per IP berjendela. */
export async function sisaTahanJendela(db, kunci, batasIp) {
  return sisaDetik(await satu(db, 'SELECT gagal, tahan_sampai FROM percobaan_login WHERE kunci = ?', kunci), batasIp.gagal);
}

// Perintah atomik: tambah satu gagal per IP; jendela baru dimulai bila jendela lama sudah lewat
function perintahGagalJendela(db, kunci, jendelaMs, kini) {
  return perintah(db, `INSERT INTO percobaan_login (kunci, gagal, tahan_sampai, diperbarui) VALUES (?, 1, ?, ?)
    ON CONFLICT(kunci) DO UPDATE SET
      gagal = CASE WHEN tahan_sampai <= excluded.diperbarui THEN 1 ELSE gagal + 1 END,
      tahan_sampai = CASE WHEN tahan_sampai <= excluded.diperbarui THEN excluded.tahan_sampai ELSE tahan_sampai END,
      diperbarui = excluded.diperbarui`, kunci, kini + jendelaMs, kini);
}

// Perintah atomik: tambah satu gagal per username; saat mencapai batas, hitungan kembali 0 dan ditahan
function perintahGagalUsername(db, kunci, kini) {
  const { gagal, tahanMs } = BATAS.username;
  return perintah(db, `INSERT INTO percobaan_login (kunci, gagal, tahan_sampai, diperbarui) VALUES (?, 1, 0, ?)
    ON CONFLICT(kunci) DO UPDATE SET
      tahan_sampai = CASE WHEN gagal + 1 >= ? THEN excluded.diperbarui + ? ELSE tahan_sampai END,
      gagal = CASE WHEN gagal + 1 >= ? THEN 0 ELSE gagal + 1 END,
      diperbarui = excluded.diperbarui`, kunci, kini, gagal, tahanMs, gagal);
}

/**
 * Catat login gagal untuk username + IP dalam satu db.batch.
 * Hasil: { sisa, tahanDetik } — sisa kesempatan untuk username ini.
 */
export async function catatGagalLogin(db, kunciU, kunciIp, batasIp) {
  const kini = Date.now();
  const hasil = await db.batch([
    perintahGagalUsername(db, kunciU, kini),
    perintahGagalJendela(db, kunciIp, batasIp.jendelaMs, kini),
    perintah(db, 'SELECT kunci, gagal, tahan_sampai FROM percobaan_login WHERE kunci IN (?, ?)', kunciU, kunciIp)
  ]);
  const baris = hasil[2].results || [];
  const rU = baris.find((x) => x.kunci === kunciU);
  const rIp = baris.find((x) => x.kunci === kunciIp);
  const tahanDetik = Math.max(sisaDetik(rU), sisaDetik(rIp, batasIp.gagal));
  return { sisa: tahanDetik ? 0 : BATAS.username.gagal - (rU?.gagal || 0), tahanDetik };
}

/** Catat satu kegagalan per IP berjendela (dipakai #/pasang). Hasil: sisa kesempatan. */
export async function catatGagalJendela(db, kunci, batasIp) {
  const [, hasil] = await db.batch([
    perintahGagalJendela(db, kunci, batasIp.jendelaMs, Date.now()),
    perintah(db, 'SELECT gagal FROM percobaan_login WHERE kunci = ?', kunci)
  ]);
  return Math.max(0, batasIp.gagal - (hasil.results?.[0]?.gagal || 0));
}

export const hapusBatas = (db, kunci) => jalankan(db, 'DELETE FROM percobaan_login WHERE kunci = ?', kunci);

/**
 * Bersihkan baris batas yang sudah tidak berlaku dan sesi kedaluwarsa.
 * Dipanggil saat ada login, lewat waitUntil agar tidak memperlambat jawaban.
 */
export function bersihkanKedaluwarsa(db) {
  const kini = Date.now();
  return db.batch([
    perintah(db, 'DELETE FROM percobaan_login WHERE tahan_sampai < ? AND diperbarui < ?', kini, kini - BATAS.simpanBarisMs),
    perintah(db, 'DELETE FROM sesi WHERE kadaluarsa < ?', kini)
  ]);
}
