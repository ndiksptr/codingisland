// server/siapkan-db.js — isi database D1 otomatis saat masih kosong
// Yang dibuat hanya struktur tabel dan pengaturan bawaan (harga clue, koin awal). Tidak ada soal bawaan:
// sejak migrasi 0008 semua soal dibuat guru.
// Tidak ada akun, kelas, atau siswa bawaan: admin pertama dibuat lewat halaman #/pasang.
// Perintah berasal dari migrations/*.sql (lewat server/skema.js), semuanya aman diulang.

import { SKEMA_BUAT } from './skema.js';

let janjiSiap = null; // cukup diperiksa sekali per instance Worker

/** Buat tabel + pengaturan bawaan jika database belum pernah diisi. */
export function siapkanDb(db) {
  janjiSiap ||= (async () => {
    const ada = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pengaturan'").first();
    if (!ada) await db.batch(SKEMA_BUAT.map((sql) => db.prepare(sql)));
  })().catch((err) => {
    janjiSiap = null; // coba lagi di permintaan berikutnya
    throw err;
  });
  return janjiSiap;
}
