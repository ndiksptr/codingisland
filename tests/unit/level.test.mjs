// tests/unit/level.test.mjs — 13 level bawaan: solusi berhasil, kode awal debug gagal, siap terbit

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_AWAL } from '../../js/data/levels.js';
import { jalankanKode } from '../../js/game/interpreter.js';
import { alasanBelumSiap } from '../../js/game/validasi-level.js';

test('ada 13 level bawaan, masing-masing pulau punya satu boss', () => {
  assert.equal(LEVEL_AWAL.length, 13);
  for (const zona of ['pantai', 'laut', 'gurun', 'salju']) {
    assert.equal(LEVEL_AWAL.filter((l) => l.zona === zona && l.jenis === 'boss').length, 1, `boss ${zona}`);
  }
});

for (const l of LEVEL_AWAL) {
  const opsi = { perintahTersedia: l.perintahTersedia };

  test(`${l.id}: solusi berhasil dan tidak melebihi batasBaris`, () => {
    const h = jalankanKode(l.solusi, l.dunia, opsi);
    assert.equal(h.berhasil, true, h.alasan);
    if (l.batasBaris) assert.ok(h.jumlahBaris <= l.batasBaris, `${h.jumlahBaris} > ${l.batasBaris}`);
  });

  if (l.jenis === 'debug') {
    test(`${l.id}: kode awal level debug gagal (salah logika, bukan salah tulis)`, () => {
      const h = jalankanKode(l.kodeAwal, l.dunia, opsi);
      assert.equal(h.berhasil, false, 'kode awal debug harusnya gagal');
      assert.notEqual(h.galat?.jenis, 'sintaks', h.alasan);
    });
  }

  test(`${l.id}: lolos pemeriksaan siap terbit`, () => {
    assert.deepEqual(alasanBelumSiap({ ...l, kelasIds: null }), []);
  });
}
