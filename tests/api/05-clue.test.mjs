// tests/api/05-clue.test.mjs — beli clue: berurutan, teks dikirim setelah dibeli, paralel tidak memotong dua kali, koin tidak minus
// Berkas ini mengubah pengaturan "koin awal" sementara (dikembalikan di akhir), jadi tes API dijalankan berurutan.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { siapkanDunia, daftarSiswa, aturPengaturan } from '../helper.mjs';
import { LEVEL_AWAL } from '../../js/data/levels.js';

let d;
let pengaturanLama;
before(async () => { d = await siapkanDunia({ jumlahSiswa3: 0, jumlahSiswa5: 0 }); });
after(async () => { if (pengaturanLama) await aturPengaturan(d.admin, pengaturanLama); });

const beli = (s, id, nomor) => s(`progres/${id}/clue`, { metode: 'POST', data: { nomor } });
const koin = async (s) => (await s('siswa/saya')).isi.koin;

test('clue harus dibeli berurutan; teks hanya dikirim setelah dibeli', async () => {
  const s = (await daftarSiswa(d.kelas3)).klien;
  const r2 = await beli(s, 'pantai-1', 2);
  assert.equal(r2.isi.ok, false);
  assert.equal(r2.isi.alasan, 'urutan');
  const r1 = await beli(s, 'pantai-1', 1);
  assert.equal(r1.isi.ok, true);
  assert.equal(r1.isi.dibayar, 5);
  assert.equal(r1.isi.clue[0], LEVEL_AWAL.find((l) => l.id === 'pantai-1').clue[0]);
  assert.equal(r1.isi.clue.length, 1, 'clue 2 & 3 belum dikirim');
  const lv = (await s('level/terbit')).isi.find((l) => l.id === 'pantai-1');
  assert.ok(lv.clue[0].length > 0 && lv.clue[1] === '' && lv.clue[2] === '');
});

test('membeli clue yang sudah dibeli tidak memotong koin lagi', async () => {
  const s = (await daftarSiswa(d.kelas3)).klien;
  await beli(s, 'pantai-1', 1);
  const k = await koin(s);
  const lagi = await beli(s, 'pantai-1', 1);
  assert.equal(lagi.isi.ok, true);
  assert.equal(lagi.isi.dibayar, 0);
  assert.equal(await koin(s), k);
});

test('10 permintaan beli clue paralel hanya memotong koin sekali', async () => {
  const s = (await daftarSiswa(d.kelas3)).klien;
  const k0 = await koin(s);
  const hasil = await Promise.all(Array.from({ length: 10 }, () => beli(s, 'pantai-1', 1)));
  assert.ok(hasil.every((r) => r.status === 200 && r.isi.ok === true), JSON.stringify(hasil.map((r) => r.isi)));
  assert.equal(hasil.filter((r) => r.isi.dibayar > 0).length, 1, 'hanya satu permintaan yang membayar');
  assert.equal(await koin(s), k0 - 5);
  const p = (await s('progres/pantai-1')).isi;
  assert.equal(p.clueDibeli, 1);
});

test('koin tidak pernah minus: koin 7, beli paralel clue 1 (5) lalu clue 2 (10)', async () => {
  pengaturanLama = await aturPengaturan(d.admin, { koinAwal: 7 });
  const s = (await daftarSiswa(d.kelas3)).klien;
  assert.equal(await koin(s), 7);
  const satu = await Promise.all(Array.from({ length: 10 }, () => beli(s, 'pantai-1', 1)));
  assert.equal(satu.filter((r) => r.isi.dibayar > 0).length, 1);
  assert.equal(await koin(s), 2);
  const dua = await Promise.all(Array.from({ length: 10 }, () => beli(s, 'pantai-1', 2)));
  assert.ok(dua.every((r) => r.isi.ok === false && r.isi.alasan === 'koin'), JSON.stringify(dua.map((r) => r.isi)));
  assert.equal(await koin(s), 2, 'koin tidak berubah dan tidak minus');
  await aturPengaturan(d.admin, pengaturanLama);
  pengaturanLama = null;
});

test('clue mengurangi bintang maksimal: Clue 2 lalu solusi = 2 bintang', async () => {
  const s = (await daftarSiswa(d.kelas3)).klien;
  await beli(s, 'pantai-1', 1);
  await beli(s, 'pantai-1', 2);
  const r = await s('progres/pantai-1/percobaan', { metode: 'POST', data: { kode: LEVEL_AWAL.find((l) => l.id === 'pantai-1').solusi, detik: 5 } });
  assert.equal(r.isi.bintang, 2);
  assert.equal(r.isi.nilai, 85);
});

test('clue di level terkunci ditolak dan koin tidak terpotong', async () => {
  const s = (await daftarSiswa(d.kelas3)).klien;
  const k0 = await koin(s);
  const r = await beli(s, 'pantai-2', 1);
  assert.equal(r.status, 403, r.teks);
  assert.equal(await koin(s), k0);
});
