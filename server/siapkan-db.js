// server/siapkan-db.js — isi database D1 otomatis saat masih kosong, dan reset data demo
// Dengan begitu setelah deploy aplikasi langsung bisa dipakai tanpa menjalankan schema.sql manual.

import { SKEMA_BUAT, SKEMA_HAPUS } from './skema.js';

let janjiSiap = null; // cukup diperiksa sekali per instance Worker

/** Buat tabel + data contoh jika database belum pernah diisi. */
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

/** Hapus semua tabel lalu isi ulang data contoh (satu transaksi). */
export async function resetDb(db) {
  await db.batch([...SKEMA_HAPUS, ...SKEMA_BUAT].map((sql) => db.prepare(sql)));
}
