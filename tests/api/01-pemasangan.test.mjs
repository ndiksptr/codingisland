// tests/api/01-pemasangan.test.mjs — pemasangan pertama (#/pasang) hanya bisa sekali
// Berkas ini berjalan PERTAMA (nama diawali 01). Pada database kosong, ia menguji kode salah lalu memasang
// admin uji. Pada database yang sudah terpasang (tes diulang), kasus "sebelum terpasang" dilewati.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { klien, KODE_PASANG, ADMIN, masukAdmin } from '../helper.mjs';

const k = klien();
const awal = await k('auth/pasang');
const masihKosong = awal.isi?.perluPasang === true;
const lewati = masihKosong ? false : 'database sudah terpasang (jalankan pada database kosong untuk kasus ini)';

test('server menjawab dan melaporkan status pemasangan', () => {
  assert.equal(awal.status, 200);
  assert.equal(typeof awal.isi.perluPasang, 'boolean');
});

test('kode pemasangan salah ditolak', { skip: lewati }, async () => {
  const r = await k('auth/pasang', { metode: 'POST', data: { kode: 'kode-salah', nama: ADMIN.nama, username: ADMIN.username, password: ADMIN.password, konfirmasi: ADMIN.password } });
  assert.equal(r.isi.ok, false);
  assert.equal(r.isi.kolom, 'kode');
  assert.match(r.isi.pesan, /salah/);
  assert.equal((await k('auth/pasang')).isi.perluPasang, true, 'belum terpasang setelah kode salah');
});

test('password kurang dari 8 dan konfirmasi berbeda ditolak', { skip: lewati }, async () => {
  let r = await k('auth/pasang', { metode: 'POST', data: { kode: KODE_PASANG, nama: ADMIN.nama, username: ADMIN.username, password: 'pendek', konfirmasi: 'pendek' } });
  assert.equal(r.isi.kolom, 'password');
  r = await k('auth/pasang', { metode: 'POST', data: { kode: KODE_PASANG, nama: ADMIN.nama, username: ADMIN.username, password: ADMIN.password, konfirmasi: 'beda-beda-123' } });
  assert.equal(r.isi.kolom, 'konfirmasi');
});

test('kode benar memasang admin pertama dan langsung masuk', { skip: lewati }, async () => {
  const r = await k('auth/pasang', { metode: 'POST', data: { kode: KODE_PASANG, nama: ADMIN.nama, username: ADMIN.username, password: ADMIN.password, konfirmasi: ADMIN.password } });
  assert.equal(r.isi.ok, true, r.teks);
  assert.equal(r.isi.guru.peran, 'admin');
  const s = await k('auth/sesi');
  assert.equal(s.isi.sesi.peran, 'admin');
});

test('setelah terpasang: pemasangan kedua ditolak permanen (403)', async () => {
  await masukAdmin(); // memastikan terpasang (untuk database yang belum dipasang tes lain)
  const lain = klien();
  const r = await lain('auth/pasang', { metode: 'POST', data: { kode: KODE_PASANG, nama: 'Penyusup', username: 'penyusup', password: 'penyusup-123', konfirmasi: 'penyusup-123' } });
  assert.equal(r.status, 403);
  assert.equal(r.isi.galat, 'Coding Island sudah terpasang.');
  assert.equal((await lain('auth/pasang')).isi.perluPasang, false);
});
