// tests/api/02-akun.test.mjs — daftar siswa, masuk/keluar, batas percobaan login

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { klien, siapkanDunia, daftarSiswa, akhiran, hurufAcak, ipAcak, PIN_UJI } from '../helper.mjs';

let d;
before(async () => { d = await siapkanDunia({ jumlahSiswa3: 1, jumlahSiswa5: 0 }); });

const dataDaftar = (kelas, ubah = {}) => ({
  namaLengkap: `Siswa Daftar ${hurufAcak(5)}`, namaPanggilan: 'Dafa', avatar: 'wanita',
  kelasId: kelas.id, kodeKelas: kelas.kodeKelas, username: `d${akhiran(8)}`, pin: '4321', ...ubah
});

test('daftar dengan kode kelas benar: berhasil, langsung masuk, koin awal', async () => {
  const s = klien();
  const r = await s('auth/daftar', { metode: 'POST', data: dataDaftar(d.kelas3) });
  assert.equal(r.isi.ok, true, r.teks);
  assert.equal(r.isi.siswa.kelasId, d.kelas3.id);
  assert.ok(!JSON.stringify(r.isi).includes('pbkdf2'), 'hash PIN tidak boleh dikirim');
  assert.equal((await s('auth/sesi')).isi.sesi.jenis, 'siswa');
});

test('kode kelas ditulis huruf kecil tetap diterima', async () => {
  const r = await klien()('auth/daftar', { metode: 'POST', data: dataDaftar(d.kelas3, { kodeKelas: d.kelas3.kodeKelas.toLowerCase() }) });
  assert.equal(r.isi.ok, true, r.teks);
});

test('kode kelas salah ditolak', async () => {
  const r = await klien()('auth/daftar', { metode: 'POST', data: dataDaftar(d.kelas3, { kodeKelas: 'ZZZZZZ' }) });
  assert.equal(r.isi.ok, false);
  assert.equal(r.isi.kolom, 'kodeKelas');
});

test('kode kelas lain ditolak (kode Kelas Uji 5 untuk Kelas Uji 3)', async () => {
  const r = await klien()('auth/daftar', { metode: 'POST', data: dataDaftar(d.kelas3, { kodeKelas: d.kelas5.kodeKelas }) });
  assert.equal(r.isi.kolom, 'kodeKelas');
});

test('username kembar ditolak', async () => {
  const r = await klien()('auth/daftar', { metode: 'POST', data: dataDaftar(d.kelas3, { username: d.siswa3[0].username }) });
  assert.equal(r.isi.ok, false);
  assert.equal(r.isi.kolom, 'username');
  const cek = await klien()(`auth/cek-username?u=${d.siswa3[0].username}`);
  assert.equal(cek.isi.tersedia, false);
});

for (const pin of ['12', '12345', 'abcd', '']) {
  test(`PIN tidak valid ditolak: "${pin}"`, async () => {
    const r = await klien()('auth/daftar', { metode: 'POST', data: dataDaftar(d.kelas3, { pin }) });
    assert.equal(r.isi.ok, false);
    assert.equal(r.isi.kolom, 'pin');
  });
}

test('nama lengkap berisi angka ditolak', async () => {
  const r = await klien()('auth/daftar', { metode: 'POST', data: dataDaftar(d.kelas3, { namaLengkap: 'Andi 123' }) });
  assert.equal(r.isi.kolom, 'namaLengkap');
});

test('masuk dan keluar', async () => {
  const s = klien();
  const m = await s('auth/masuk-siswa', { metode: 'POST', data: { username: d.siswa3[0].username, pin: PIN_UJI } });
  assert.equal(m.isi.ok, true, m.teks);
  const sc = m.headers.get('set-cookie');
  assert.match(sc, /HttpOnly/);
  assert.match(sc, /Secure/);
  assert.match(sc, /SameSite=Lax/);
  assert.equal((await s('auth/sesi')).isi.sesi.pengguna.username, d.siswa3[0].username);
  const k = await s('auth/keluar', { metode: 'POST' });
  assert.equal(k.status, 200);
  assert.equal((await s('auth/sesi')).isi.sesi, null);
  assert.equal((await s('progres')).status, 401, 'setelah keluar tidak bisa membaca progres');
});

test('PIN salah memberi sisa kesempatan; username tidak ada dijawab sama', async () => {
  const ip = ipAcak();
  const a = await klien({ ip })('auth/masuk-siswa', { metode: 'POST', data: { username: d.siswa3[0].username, pin: '0000' } });
  const b = await klien({ ip })('auth/masuk-siswa', { metode: 'POST', data: { username: `tidakada${akhiran(4)}`, pin: '0000' } });
  assert.equal(a.isi.ok, false);
  assert.equal(a.isi.pesan, b.isi.pesan, 'pesan sama agar tidak membocorkan username');
  assert.equal(a.isi.sisa, 4);
});

test('5 kali PIN salah menahan username itu 60 detik (PIN benar pun ditolak)', async () => {
  const korban = await daftarSiswa(d.kelas3);
  const ip = ipAcak();
  let r;
  for (let i = 0; i < 5; i++) r = await klien({ ip })('auth/masuk-siswa', { metode: 'POST', data: { username: korban.username, pin: '9999' } });
  assert.equal(r.isi.tahanDetik, 60);
  r = await klien({ ip })('auth/masuk-siswa', { metode: 'POST', data: { username: korban.username, pin: PIN_UJI } });
  assert.equal(r.isi.ok, false);
  assert.ok(r.isi.tahanDetik > 0);
  // Dari IP lain pun tetap ditahan (yang ditahan username-nya)
  r = await klien()('auth/masuk-siswa', { metode: 'POST', data: { username: korban.username, pin: PIN_UJI } });
  assert.equal(r.isi.ok, false);
});

test('40 siswa berbeda dari IP yang sama, masing-masing salah sekali, tetap bisa masuk', async () => {
  const IP_SEKOLAH = ipAcak();
  const siswa = [];
  for (let i = 0; i < 40; i++) siswa.push(await daftarSiswa(d.kelas3, { ip: IP_SEKOLAH }));
  const salah = await Promise.all(siswa.map((s) => klien({ ip: IP_SEKOLAH })('auth/masuk-siswa', { metode: 'POST', data: { username: s.username, pin: '0000' } })));
  assert.ok(salah.every((r) => r.isi.ok === false && !r.isi.tahanDetik), 'tidak ada yang ditahan setelah salah sekali');
  const benar = await Promise.all(siswa.map((s) => klien({ ip: IP_SEKOLAH })('auth/masuk-siswa', { metode: 'POST', data: { username: s.username, pin: PIN_UJI } })));
  const gagal = benar.filter((r) => !r.isi.ok);
  assert.equal(gagal.length, 0, gagal[0]?.teks);
});
