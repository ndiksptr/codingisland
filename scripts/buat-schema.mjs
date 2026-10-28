// scripts/buat-schema.mjs — membuat server/skema.js dari migrations/*.sql
// Jalankan dari folder proyek:  node scripts/buat-schema.mjs
//
// Hasil: server/skema.js berisi gabungan semua migrasi, dipakai worker.js mengisi database yang
// masih kosong. Yang TIDAK ikut:
//   - perintah pembersihan data (DELETE), karena hanya berlaku untuk database lama;
//   - 13 soal bawaan di migrasi 0001 (INSERT ... INTO level), karena sejak migrasi 0008 semua soal
//     dibuat guru dan database baru dimulai tanpa satu soal pun.
// migrations/0001_struktur_awal.sql tidak lagi ditulis oleh skrip ini (migrasi lama tidak boleh diubah).
// Tidak ada akun, kelas, atau siswa bawaan — admin pertama dibuat lewat #/pasang.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const akar = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

// ---------- Gabungkan semua migrasi ----------
const daftarMigrasi = readdirSync(akar('migrations')).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
const lewati = (p) => /^DELETE\b/i.test(p) || /^INSERT\s+OR\s+IGNORE\s+INTO\s+level\b/i.test(p);
const perintah = [];
for (const f of daftarMigrasi) {
  const isi = readFileSync(akar(`migrations/${f}`), 'utf8')
    .split('\n').filter((b) => !b.trim().startsWith('--')).join('\n');
  for (const p of isi.split(/;\s*(?:\n|$)/).map((x) => x.trim()).filter(Boolean)) {
    if (!lewati(p)) perintah.push(p);
  }
}

writeFileSync(akar('server/skema.js'), `// server/skema.js — DIBUAT OTOMATIS oleh scripts/buat-schema.mjs. Jangan diedit manual.
// Perintah SQL gabungan migrations/*.sql (tanpa pembersihan data dan tanpa soal bawaan), dipakai
// worker.js untuk mengisi database yang masih kosong: struktur tabel dan pengaturan bawaan.
// Migrasi: ${daftarMigrasi.join(', ')}

export const SKEMA_BUAT = ${JSON.stringify(perintah, null, 2)};
`);

console.log(`server/skema.js dibuat dari ${daftarMigrasi.length} migrasi (${perintah.length} perintah).`);
