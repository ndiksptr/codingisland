// tests/unit/interpreter.test.mjs — semua kasus uji interpreter yang sudah ada (js/game/uji-interpreter-kasus.js)
// Kasus yang butuh Web Worker (batas waktu 2 detik) diuji di browser: tests/e2e/interpreter-worker.spec.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KASUS_UJI } from '../../js/game/uji-interpreter-kasus.js';
import { duniaDariTeks } from '../../js/game/dunia.js';
import { jalankanKode, MAKS_LANGKAH } from '../../js/game/interpreter.js';

for (const kasus of KASUS_UJI) {
  test(`interpreter: ${kasus.nama}`, { skip: kasus.perluWorker ? 'butuh Web Worker (diuji di e2e)' : false }, () => {
    const hasil = jalankanKode(kasus.kode, duniaDariTeks(kasus.peta), kasus.opsi || {});
    const c = kasus.cek(hasil);
    assert.equal(c, true, String(c));
  });
}

test('interpreter: perulangan tak berujung berhenti di batas 1000 langkah', () => {
  assert.equal(MAKS_LANGKAH, 1000);
  const hasil = jalankanKode('selama bukan sampai_tujuan() {\n  belok_kanan()\n}', duniaDariTeks(['>...F']));
  assert.equal(hasil.berhasil, false);
  assert.ok(hasil.jejak.length <= MAKS_LANGKAH + 1, `jejak ${hasil.jejak.length} langkah`);
});
