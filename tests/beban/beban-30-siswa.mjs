// tests/beban/beban-30-siswa.mjs — simulasi N siswa bermain bersamaan (bawaan 30, bisa 90)
//
// Setiap siswa: masuk -> memuat sesi & peta (level + progres) -> menjalankan kode 20 kali dengan jeda acak
// 2–8 detik -> membeli satu clue di tengah permainan. Laporan: jumlah permintaan, error per kode status
// (perhatikan 429, 500, 503, dan error batas CPU 1102), serta waktu respons median & p95 per endpoint.
//
// HANYA boleh berjalan ke STAGING:
//   BASE_URL=https://codingisland-staging.<akun>.workers.dev KODE_PASANG=... npm run test:beban -- --siswa 90
// Uji coba skrip di komputer sendiri (angka TIDAK mewakili Cloudflare, tanpa batas CPU):
//   npm run test:beban -- --siswa 30 --izinkan-lokal
// Pilihan: --siswa N  --kali 20  --jeda-min 2  --jeda-maks 8  --izinkan-lokal

import { BASE_URL, klien, masukAdmin, akhiran, hurufAcak, kodeKelasAcak, ipAcak } from '../helper.mjs';
import { LEVEL_AWAL } from '../../js/data/levels.js';

// ---------- Argumen ----------
const arg = (nama, bawaan) => {
  const i = process.argv.indexOf(`--${nama}`);
  return i >= 0 ? Number(process.argv[i + 1]) : bawaan;
};
const N = arg('siswa', 30);
const KALI = arg('kali', 20);
const JEDA_MIN = arg('jeda-min', 2) * 1000;
const JEDA_MAKS = arg('jeda-maks', 8) * 1000;
const izinkanLokal = process.argv.includes('--izinkan-lokal');

// ---------- Penjaga tujuan: staging saja ----------
const host = new URL(BASE_URL).hostname;
const staging = /-staging\./.test(host);
const lokal = ['localhost', '127.0.0.1'].includes(host);
if (!staging && !(lokal && izinkanLokal)) {
  console.error(`[TOLAK] Tes beban hanya boleh ke staging (nama host berisi "-staging."). Tujuan sekarang: ${host}\n` +
    'Contoh: BASE_URL=https://codingisland-staging.<akun>.workers.dev npm run test:beban\n' +
    'Untuk mencoba skrip di komputer sendiri tambahkan --izinkan-lokal.');
  process.exit(1);
}

// ---------- Pencatat ----------
const catatan = []; // { endpoint, status, ms, cpu }
const jeda = (ms) => new Promise((r) => setTimeout(r, ms));
const acak = (a, b) => a + Math.random() * (b - a);
const namaEndpoint = (metode, path) => `${metode} /api/${path.split('?')[0].replace(/\/(pantai|laut|gurun|salju)-[\w-]+/, '/:levelId')}`;

/** Bungkus klien helper: catat waktu, status, dan tanda error batas CPU (1102). */
function klienTercatat(ip) {
  const k = klien({ ip });
  const panggil = async (path, opsi = {}) => {
    const t0 = performance.now();
    let r;
    try {
      r = await k(path, opsi);
    } catch (err) {
      catatan.push({ endpoint: namaEndpoint(opsi.metode || 'GET', path), status: 'jaringan', ms: performance.now() - t0, cpu: false });
      return { status: 0, isi: null, teks: String(err.message) };
    }
    const cpu = /1102|exceeded (CPU|resource)|Worker exceeded/i.test(r.teks || '');
    catatan.push({ endpoint: namaEndpoint(opsi.metode || 'GET', path), status: r.status, ms: performance.now() - t0, cpu });
    return r;
  };
  return panggil;
}

// ---------- Persiapan data (tidak ikut diukur) ----------
console.log(`Tujuan: ${BASE_URL}${lokal ? ' (LOKAL — angka hanya untuk mencoba skrip)' : ''}`);
console.log(`Menyiapkan ${N} siswa uji ...`);
const admin = await masukAdmin();
const kelas = (await admin('kelas', { metode: 'POST', data: { nama: `Kelas Beban ${hurufAcak(4)}`, tingkat: 4, kodeKelas: kodeKelasAcak() } })).isi;
const akun = [];
for (let i = 0; i < N; i++) {
  const r = await admin('siswa', { metode: 'POST', data: { namaLengkap: `Beban ${hurufAcak(6)}`, namaPanggilan: 'Beban', avatar: i % 2 ? 'wanita' : 'pria', kelasId: kelas.id, username: `b${akhiran(9)}` } });
  if (!r.isi?.pin) throw new Error(`Gagal membuat siswa beban: ${r.teks}`);
  akun.push({ username: r.isi.siswa.username, pin: r.isi.pin });
}

// ---------- Skenario satu siswa ----------
const BENAR = LEVEL_AWAL.find((l) => l.id === 'pantai-1').solusi;
const SALAH = ['belok_kiri()', 'maju(1)', 'maju(\nbelok_kanan()', 'ulangi 2 {\n  maju()\n}'];
const IP_SEKOLAH = ipAcak(); // seluruh kelas di balik satu IP Wi-Fi (dihormati wrangler dev; di staging diganti Cloudflare)

async function siswaBermain({ username, pin }) {
  const k = klienTercatat(IP_SEKOLAH);
  await jeda(acak(0, 3000)); // datang tidak serempak persis
  const m = await k('auth/masuk-siswa', { metode: 'POST', data: { username, pin } });
  if (!m.isi?.ok) return;
  await k('auth/sesi');
  await Promise.all([k('level/terbit'), k('progres')]);
  await k('progres/pantai-1');
  const kapanClue = Math.floor(Math.random() * KALI);
  for (let i = 0; i < KALI; i++) {
    await jeda(acak(JEDA_MIN, JEDA_MAKS));
    const kode = Math.random() < 0.5 ? BENAR : SALAH[Math.floor(Math.random() * SALAH.length)];
    await k('progres/pantai-1/percobaan', { metode: 'POST', data: { kode, detik: Math.round(acak(5, 60)) } });
    if (i === kapanClue) await k('progres/pantai-1/clue', { metode: 'POST', data: { nomor: 1 } });
  }
  await k('auth/sesi');
}

// ---------- Jalankan ----------
console.log(`Mulai: ${N} siswa x ${KALI} kali jalankan, jeda ${JEDA_MIN / 1000}–${JEDA_MAKS / 1000} detik ...`);
const mulai = Date.now();
await Promise.all(akun.map(siswaBermain));
const durasi = (Date.now() - mulai) / 1000;

// ---------- Laporan ----------
const persentil = (arr, p) => {
  if (!arr.length) return 0;
  const urut = [...arr].sort((a, b) => a - b);
  return urut[Math.min(urut.length - 1, Math.ceil((p / 100) * urut.length) - 1)];
};
const perStatus = {};
for (const c of catatan) perStatus[c.status] = (perStatus[c.status] || 0) + 1;
const cpu = catatan.filter((c) => c.cpu).length;
const gagal = catatan.filter((c) => c.status === 'jaringan' || c.status >= 400).length;

console.log(`\n=== Hasil tes beban (${N} siswa, ${durasi.toFixed(0)} detik) ===`);
console.log(`Permintaan: ${catatan.length} (${(catatan.length / durasi).toFixed(1)}/detik)`);
console.log(`Status: ${Object.entries(perStatus).map(([s, n]) => `${s}=${n}`).join('  ')}`);
console.log(`Perhatikan -> 429: ${perStatus[429] || 0}  500: ${perStatus[500] || 0}  503: ${perStatus[503] || 0}  batas CPU 1102: ${cpu}  jaringan: ${perStatus.jaringan || 0}`);
console.log(`Gagal total: ${gagal} (${((gagal / catatan.length) * 100).toFixed(2)}%)\n`);
const endpoint = [...new Set(catatan.map((c) => c.endpoint))].sort();
console.log('Endpoint'.padEnd(42) + 'jumlah'.padStart(8) + 'median'.padStart(10) + 'p95'.padStart(10) + 'maks'.padStart(10));
for (const e of endpoint) {
  const ms = catatan.filter((c) => c.endpoint === e).map((c) => c.ms);
  console.log(e.padEnd(42) + String(ms.length).padStart(8) + `${persentil(ms, 50).toFixed(0)}ms`.padStart(10) +
    `${persentil(ms, 95).toFixed(0)}ms`.padStart(10) + `${Math.max(...ms).toFixed(0)}ms`.padStart(10));
}
process.exit(gagal ? 1 : 0);
