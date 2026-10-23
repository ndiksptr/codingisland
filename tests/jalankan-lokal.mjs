// tests/jalankan-lokal.mjs — jalankan SEMUA tes otomatis di komputer sendiri dengan database baru
//   npm run test:lokal
//
// 1. Tes unit (tanpa server).
// 2. Menyalakan wrangler dev sendiri di port 8788 dengan database lokal KOSONG (folder .wrangler/uji-otomatis,
//    terpisah dari database uji lokal Anda), MODE_DEV=1 dan KODE_PASANG dari .dev.vars.
// 3. Tes API lalu end-to-end ke server itu.
// 4. Menyalakan server kedua (port 8789) TANPA MODE_DEV untuk menguji bahwa alat pengembang mati
//    (tests/api/07-umum.test.mjs), seperti di server online.
// Server dimatikan di akhir. Kode keluar 0 bila semua lulus.

import { spawn, spawnSync } from 'node:child_process';
import { rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bacaDevVars } from './helper.mjs';

const AKAR = fileURLToPath(new URL('..', import.meta.url));
const windows = process.platform === 'win32';
const vars = bacaDevVars();
if (!vars.KODE_PASANG) {
  console.error('KODE_PASANG belum ada di .dev.vars (salin dari .dev.vars.example).');
  process.exit(1);
}

function jalankan(perintah, env = {}) {
  console.log(`\n$ ${perintah}`);
  const r = spawnSync(perintah, { cwd: AKAR, stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
  return r.status === 0;
}

async function nyalakanServer(port, nama, isiEnv) {
  const folder = `.wrangler/${nama}`;
  rmSync(`${AKAR}${folder}`, { recursive: true, force: true });
  mkdirSync(`${AKAR}.wrangler`, { recursive: true });
  writeFileSync(`${AKAR}.wrangler/${nama}.env`, isiEnv);
  const proses = spawn(`npx wrangler dev --port ${port} --ip 127.0.0.1 --inspector-port ${port + 1000} --persist-to ${folder} --env-file .wrangler/${nama}.env`,
    { cwd: AKAR, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  await new Promise((siap, gagal) => {
    const batas = setTimeout(() => gagal(new Error(`wrangler dev port ${port} tidak siap dalam 90 detik:\n${log}`)), 90_000);
    const baca = (b) => {
      log += b;
      if (/Ready on/.test(log)) { clearTimeout(batas); siap(); }
    };
    proses.stdout.on('data', baca);
    proses.stderr.on('data', baca);
    proses.on('exit', (k) => gagal(new Error(`wrangler dev berhenti (kode ${k}):\n${log}`)));
  });
  console.log(`Server uji siap di http://127.0.0.1:${port} (database kosong: ${folder})`);
  return proses;
}

function matikan(proses) {
  if (!proses || proses.exitCode !== null) return;
  if (windows) spawnSync('taskkill', ['/pid', String(proses.pid), '/T', '/F'], { stdio: 'ignore' });
  else proses.kill('SIGTERM');
}

const hasil = {};
let s1;
let s2;
try {
  hasil.unit = jalankan('npm run test:unit');

  s1 = await nyalakanServer(8788, 'uji-otomatis', `MODE_DEV = "1"\nKODE_PASANG = "${vars.KODE_PASANG}"\n`);
  const env1 = { BASE_URL: 'http://127.0.0.1:8788' };
  hasil.api = jalankan('npm run test:api', env1);
  hasil.e2e = jalankan('npm run test:e2e', env1);
  matikan(s1);

  s2 = await nyalakanServer(8789, 'uji-tanpa-dev', `KODE_PASANG = "${vars.KODE_PASANG}"\n`);
  hasil.modeDevMati = jalankan('node --test --test-concurrency=1 tests/api/01-pemasangan.test.mjs tests/api/07-umum.test.mjs', { BASE_URL: 'http://127.0.0.1:8789' });
} catch (err) {
  console.error(err.message);
  hasil.server = false;
} finally {
  matikan(s1);
  matikan(s2);
}

console.log('\n=== Ringkasan test:lokal ===');
for (const [nama, ok] of Object.entries(hasil)) console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${nama}`);
process.exit(Object.values(hasil).every(Boolean) ? 0 : 1);
