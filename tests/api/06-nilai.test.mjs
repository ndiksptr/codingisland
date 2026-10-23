// tests/api/06-nilai.test.mjs — matriks nilai, Nilai Akhir otomatis, timpa nilai dengan alasan, kolom CSV

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { siapkanDunia } from '../helper.mjs';
import { LEVEL_AWAL } from '../../js/data/levels.js';
import { hitungNilaiAkhir } from '../../js/game/skor.js';
import { csvNilai } from '../../js/guru/csv.js';

let d;
before(async () => {
  d = await siapkanDunia({ jumlahSiswa3: 2, jumlahSiswa5: 0 });
  const s = d.siswa3[0].klien;
  for (const id of ['pantai-1', 'pantai-2']) {
    await s(`progres/${id}/percobaan`, { metode: 'POST', data: { kode: LEVEL_AWAL.find((l) => l.id === id).solusi, detik: 5 } });
  }
});

const matriks = async () => (await d.guruA.klien(`nilai/${d.kelas3.id}`)).isi;
const baris = (m, i) => m.siswa.find((s) => s.id === d.siswa3[i].siswa.id);

test('matriks nilai: semua siswa kelas & level terbit, nilai otomatis sesuai rumus', async () => {
  const m = await matriks();
  assert.equal(m.siswa.length, 2);
  assert.ok(m.levels.length >= 13);
  const s0 = baris(m, 0);
  assert.equal(s0.sel['pantai-1'].nilai, 100);
  assert.equal(s0.sel['pantai-2'].nilai, 100);
  assert.equal(s0.nilaiOtomatis, hitungNilaiAkhir([100, 100], m.levels.length));
  assert.equal(s0.nilaiAkhir, s0.nilaiOtomatis);
  assert.equal(baris(m, 1).nilaiOtomatis, 1, 'belum main = 1');
});

test('timpa nilai: alasan wajib (minimal 5 huruf)', async () => {
  const sid = d.siswa3[0].siswa.id;
  let r = await d.guruA.klien(`nilai/${d.kelas3.id}/${sid}`, { metode: 'PUT', data: { nilai: 88 } });
  assert.equal(r.status, 400);
  r = await d.guruA.klien(`nilai/${d.kelas3.id}/${sid}`, { metode: 'PUT', data: { nilai: 88, alasan: 'ok' } });
  assert.equal(r.status, 400);
});

test('timpa nilai: hanya 1–100', async () => {
  const sid = d.siswa3[0].siswa.id;
  for (const nilai of [0, 101, 'abc']) {
    const r = await d.guruA.klien(`nilai/${d.kelas3.id}/${sid}`, { metode: 'PUT', data: { nilai, alasan: 'Tugas tambahan' } });
    assert.equal(r.status, 400, `nilai ${nilai}`);
  }
});

test('timpa nilai dengan alasan mengubah Nilai Akhir; hapus timpa mengembalikan nilai otomatis', async () => {
  const sid = d.siswa3[0].siswa.id;
  const r = await d.guruA.klien(`nilai/${d.kelas3.id}/${sid}`, { metode: 'PUT', data: { nilai: 88, alasan: 'Tugas proyek tambahan' } });
  assert.equal(r.status, 200);
  let s0 = baris(await matriks(), 0);
  assert.equal(s0.nilaiAkhir, 88);
  assert.equal(s0.timpa.alasan, 'Tugas proyek tambahan');
  assert.equal(s0.timpa.guruNama, d.guruA.nama);
  const h = await d.guruA.klien(`nilai/${d.kelas3.id}/${sid}`, { metode: 'DELETE' });
  assert.equal(h.status, 200);
  s0 = baris(await matriks(), 0);
  assert.equal(s0.timpa, null);
  assert.equal(s0.nilaiAkhir, s0.nilaiOtomatis);
});

test('ekspor CSV nilai berisi kolom yang benar', async () => {
  const sid = d.siswa3[0].siswa.id;
  await d.guruA.klien(`nilai/${d.kelas3.id}/${sid}`, { metode: 'PUT', data: { nilai: 90, alasan: 'Proyek, "mandiri"' } });
  const m = await matriks();
  const [kepala, ...isi] = csvNilai(m).split('\r\n');
  const kolom = kepala.split(',');
  assert.equal(kolom[0], 'Nama lengkap');
  assert.equal(kolom[1], 'Kelas');
  assert.deepEqual(kolom.slice(-3), ['Nilai akhir', 'Ditimpa', 'Alasan']);
  assert.equal(kolom.length, m.levels.length + 5);
  assert.equal(kolom[2], 'P1 Langkah Pertama');
  assert.equal(isi.length, 2, 'satu baris per siswa');
  const b0 = isi.find((b) => b.startsWith(baris(m, 0).namaLengkap));
  assert.ok(b0.includes(',Kelas Uji 3,100,100,'), b0);
  assert.ok(b0.endsWith(',90,Ya,"Proyek, ""mandiri"""'), b0);
});
