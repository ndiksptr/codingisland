// tests/api/07-umum.test.mjs — 415 tanpa JSON, mode pengembang, berkas server tersembunyi, penjaga domain produksi

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BASE_URL, klien, siapkanDunia } from '../helper.mjs';

let d;
before(async () => { d = await siapkanDunia({ jumlahSiswa3: 1, jumlahSiswa5: 0 }); });

test('POST tanpa Content-Type JSON ditolak 415', async () => {
  for (const tipe of ['application/x-www-form-urlencoded', 'text/plain', 'multipart/form-data; boundary=x']) {
    const r = await klien()('auth/masuk-siswa', { metode: 'POST', data: 'username=a&pin=1234', tipe });
    assert.equal(r.status, 415, tipe);
  }
  const g = await d.guruA.klien(`nilai/${d.kelas3.id}/${d.siswa3[0].siswa.id}`, { metode: 'PUT', data: 'nilai=100', tipe: 'text/plain' });
  assert.equal(g.status, 415);
});

test('JSON rusak dijawab 400, bukan 500', async () => {
  const r = await klien()('auth/masuk-siswa', { metode: 'POST', data: '{rusak', tipe: 'application/json' });
  assert.equal(r.status, 400);
});

test('alamat API yang tidak ada: 404 JSON', async () => {
  const r = await klien()('tidak-ada/sama-sekali');
  assert.equal(r.status, 404);
  assert.ok(r.isi?.galat);
});

// Mode pengembang: sesi melaporkan modeDev; endpoint pengubah progres hanya aktif bila MODE_DEV = "1".
// Untuk menguji sisi "mati" secara lokal, jalankan server tanpa MODE_DEV (npm run test:lokal, lihat README bagian 8).
const modeDev = (await klien()('auth/sesi')).isi?.modeDev === true;

test('mode dev MATI: endpoint pengubah progres & level lengkap ditolak 403', { skip: modeDev ? 'server ini MODE_DEV=1' : false }, async () => {
  const s = d.siswa3[0].klien;
  assert.equal((await s('auth/sesi')).isi.modeDev, false);
  assert.equal((await s('progres/pantai-1', { metode: 'PUT', data: { selesai: true, bintang: 3, nilai: 100 } })).status, 403);
  assert.equal((await s('progres', { metode: 'DELETE' })).status, 403);
  assert.equal((await s('level/semua')).status, 403);
  assert.equal((await s('level/pantai-1')).status, 403, 'siswa tidak boleh membaca level lengkap (berisi solusi)');
});

test('mode dev HIDUP (hanya uji lokal): endpoint pengembang bekerja', { skip: modeDev ? false : 'server ini MODE_DEV bukan "1"' }, async () => {
  const s = d.siswa3[0].klien;
  assert.equal((await s('progres/pantai-1', { metode: 'PUT', data: { selesai: true, bintang: 3, nilai: 100 } })).status, 200);
});

test('berkas khusus server tidak bisa diunduh', async () => {
  for (const p of ['/worker.js', '/wrangler.toml', '/schema.sql', '/server/kripto.js', '/functions/api/auth/[[rute]].js',
    '/migrations/0001_struktur_awal.sql', '/package.json', '/.dev.vars', '/tests/helper.mjs', '/README.md']) {
    const r = await fetch(BASE_URL + p);
    assert.equal(r.status, 404, p);
  }
});

// Regresi bug: pola "worker.js" di .assetsignore pernah ikut membuang js/game/worker.js
test('semua berkas JS, CSS, dan font aplikasi tersedia (termasuk js/game/worker.js)', async () => {
  const akar = fileURLToPath(new URL('../../', import.meta.url));
  const daftar = [];
  const telusuri = (dir) => {
    for (const e of readdirSync(akar + dir, { withFileTypes: true })) {
      if (e.isDirectory()) telusuri(`${dir}/${e.name}`);
      else if (/\.(js|css|woff2)$/.test(e.name)) daftar.push(`${dir}/${e.name}`);
    }
  };
  ['js', 'css', 'fonts'].forEach(telusuri);
  assert.ok(daftar.includes('js/game/worker.js'));
  const gagal = [];
  for (const p of daftar) {
    const r = await fetch(`${BASE_URL}/${p}`);
    if (r.status !== 200) gagal.push(`${p} -> ${r.status}`);
  }
  assert.deepEqual(gagal, []);
});

test('header cache: JS/CSS no-cache, gambar & font 7 hari', async () => {
  assert.equal((await fetch(`${BASE_URL}/js/store.js`)).headers.get('cache-control'), 'no-cache');
  assert.equal((await fetch(`${BASE_URL}/css/app.css`)).headers.get('cache-control'), 'no-cache');
  assert.match((await fetch(`${BASE_URL}/image/favicon-32.png`)).headers.get('cache-control'), /max-age=604800/);
  assert.match((await fetch(`${BASE_URL}/fonts/nunito-latin-wght-normal.woff2`)).headers.get('cache-control'), /max-age=604800/);
});

test('helper menolak BASE_URL produksi dan berhenti sebelum mengirim permintaan', () => {
  const helper = fileURLToPath(new URL('../helper.mjs', import.meta.url));
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify('file:///' + helper.replace(/\\/g, '/'))}); console.log('LOLOS');`], {
    env: { ...process.env, BASE_URL: 'https://codingisland.ndiksptr159.workers.dev' }, encoding: 'utf8'
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /TOLAK/);
  assert.ok(!r.stdout.includes('LOLOS'));
});
