// tests/api/04-level-jalankan.test.mjs — data level untuk siswa, jalankan dinilai server, level terkunci, koin tidak dobel

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { siapkanDunia, daftarSiswa } from '../helper.mjs';
import { LEVEL_AWAL } from '../../js/data/levels.js';

let d;
before(async () => { d = await siapkanDunia({ jumlahSiswa3: 1, jumlahSiswa5: 0 }); });

const solusi = (id) => LEVEL_AWAL.find((l) => l.id === id).solusi;
const jalankan = (s, id, kode, ekstra = {}) => s(`progres/${id}/percobaan`, { metode: 'POST', data: { kode, detik: 10, ...ekstra } });

test('level untuk siswa: 13 level, tanpa solusi, tanpa data guru', async () => {
  const r = await d.siswa3[0].klien('level/terbit');
  assert.equal(r.status, 200);
  assert.equal(r.isi.length, 13);
  for (const l of r.isi) {
    assert.ok(!('solusi' in l), `${l.id} memuat solusi`);
    assert.ok(!('pembuat' in l) && !('kelasNonaktif' in l), `${l.id} memuat data guru`);
  }
  assert.ok(!r.teks.includes(solusi('pantai-2')), 'teks solusi tidak boleh muncul di mana pun');
});

test('level untuk siswa: teks clue yang belum dibeli kosong', async () => {
  const s = (await daftarSiswa(d.kelas3)).klien;
  const r = await s('level/terbit');
  for (const l of r.isi) {
    assert.equal(l.clue.length, 3);
    assert.ok(l.clue.every((c) => c === ''), `${l.id} membocorkan clue`);
  }
  const asli = LEVEL_AWAL.find((l) => l.id === 'pantai-1').clue[0];
  assert.ok(!r.teks.includes(asli));
});

test('jalankan: kode salah tetap 0 bintang walau browser mengirim bintang 3 & nilai 100', async () => {
  const s = (await daftarSiswa(d.kelas3)).klien;
  const r = await jalankan(s, 'pantai-1', 'belok_kiri()', { berhasil: true, bintang: 3, nilai: 100 });
  assert.equal(r.status, 200);
  assert.equal(r.isi.berhasil, false);
  assert.equal(r.isi.bintang, 0);
  assert.equal(r.isi.koinDidapat, 0);
  assert.equal(r.isi.progres.selesai, false);
});

test('jalankan: bintang dihitung server dari batasBaris (kode kepanjangan = 2 bintang, nilai 85)', async () => {
  const s = (await daftarSiswa(d.kelas3)).klien;
  await jalankan(s, 'pantai-1', solusi('pantai-1'));
  const panjang = `${solusi('pantai-2')}\nbelok_kiri()\nbelok_kanan()`;
  const r = await jalankan(s, 'pantai-2', panjang, { bintang: 3, nilai: 100 });
  assert.equal(r.isi.berhasil, true, JSON.stringify(r.isi));
  assert.equal(r.isi.bintang, 2);
  assert.equal(r.isi.nilai, 85);
  assert.equal(r.isi.progres.nilai, 85);
});

test('jalankan: solusi tepat = 3 bintang, nilai 100, koin +25', async () => {
  const s = (await daftarSiswa(d.kelas3)).klien;
  const koin0 = (await s('siswa/saya')).isi.koin;
  const r = await jalankan(s, 'pantai-1', solusi('pantai-1'));
  assert.equal(r.isi.bintang, 3);
  assert.equal(r.isi.nilai, 100);
  assert.equal(r.isi.koinDidapat, 25);
  assert.equal((await s('siswa/saya')).isi.koin, koin0 + 25);
});

test('koin bintang tidak dobel saat level diulang', async () => {
  const s = (await daftarSiswa(d.kelas3)).klien;
  const koin0 = (await s('siswa/saya')).isi.koin;
  await jalankan(s, 'pantai-1', solusi('pantai-1'));
  const ulang1 = await jalankan(s, 'pantai-1', solusi('pantai-1'));
  const ulang2 = await jalankan(s, 'pantai-1', solusi('pantai-1'));
  assert.equal(ulang1.isi.koinDidapat, 0);
  assert.equal(ulang2.isi.koinDidapat, 0);
  assert.equal(ulang1.isi.pertamaKali, false);
  assert.equal((await s('siswa/saya')).isi.koin, koin0 + 25);
  const p = (await s('progres/pantai-1')).isi;
  assert.equal(p.percobaan, 3);
});

test('koin hanya untuk bintang baru: 2 bintang lalu 3 bintang = +20 lalu +5', async () => {
  const s = (await daftarSiswa(d.kelas3)).klien;
  await jalankan(s, 'pantai-1', solusi('pantai-1'));
  const dua = await jalankan(s, 'pantai-2', `${solusi('pantai-2')}\nbelok_kiri()\nbelok_kanan()`);
  const tiga = await jalankan(s, 'pantai-2', solusi('pantai-2'));
  assert.deepEqual([dua.isi.bintang, dua.isi.koinDidapat], [2, 20]);
  assert.deepEqual([tiga.isi.bintang, tiga.isi.koinDidapat], [3, 5]);
});

test('level terkunci tidak bisa dijalankan (pantai-2 sebelum pantai-1 selesai)', async () => {
  const s = (await daftarSiswa(d.kelas3)).klien;
  const r = await jalankan(s, 'pantai-2', solusi('pantai-2'));
  assert.equal(r.status, 403, r.teks);
  assert.equal((await s('progres/pantai-2')).isi, null, 'tidak ada progres tercatat');
  assert.equal((await s('siswa/saya')).isi.koin, 20, 'tidak ada koin');
});

test('pulau terkunci tidak bisa dijalankan (laut-1 sebelum boss Pantai selesai)', async () => {
  const s = (await daftarSiswa(d.kelas3)).klien;
  const r = await jalankan(s, 'laut-1', solusi('laut-1'));
  assert.equal(r.status, 403, r.teks);
});

test('level terbuka setelah level sebelumnya selesai', async () => {
  const s = (await daftarSiswa(d.kelas3)).klien;
  await jalankan(s, 'pantai-1', solusi('pantai-1'));
  const r = await jalankan(s, 'pantai-2', solusi('pantai-2'));
  assert.equal(r.status, 200);
  assert.equal(r.isi.berhasil, true);
});

test('level yang tidak ada atau bukan untuk kelasnya: 404', async () => {
  const r = await jalankan(d.siswa3[0].klien, 'tidak-ada-123', 'maju()');
  assert.equal(r.status, 404);
});

test('kode yang sangat panjang dipotong, tidak membuat server error', async () => {
  const r = await jalankan(d.siswa3[0].klien, 'pantai-1', 'maju()\n'.repeat(5000));
  assert.equal(r.status, 200);
});
