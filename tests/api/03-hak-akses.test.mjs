// tests/api/03-hak-akses.test.mjs — matriks hak akses setiap endpoint
// Peran: tanpa sesi, siswa (Kelas Uji 3), guru A (Kelas Uji 3), guru B (Kelas Uji 5), admin.
// Sasaran: siswa & kelas milik Kelas Uji 5 (diampu guru B). null = tidak diuji untuk peran itu
// (mis. aksi yang menghapus data milik pemilik sah).

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { klien, siapkanDunia } from '../helper.mjs';

let d;
let peran;
before(async () => {
  d = await siapkanDunia({ jumlahSiswa3: 1, jumlahSiswa5: 2 });
  peran = { anon: klien(), siswa: d.siswa3[0].klien, guruA: d.guruA.klien, guruB: d.guruB.klien, admin: d.admin };
});

const s5 = () => d.siswa5[0].siswa.id;
const k5 = () => d.kelas5.id;
const DITOLAK_TANPA_SESI = 401;

// [nama, metode, path(), data(), harapan { anon, siswa, guruA, guruB, admin }]
const MATRIKS = [
  // ---------- Endpoint guru: membaca ----------
  ['konteks dashboard', 'GET', () => 'auth/konteks', null, { anon: 401, siswa: 401, guruA: 200, guruB: 200, admin: 200 }],
  ['ringkasan Kelas Uji 5', 'GET', () => `aktivitas/ringkasan?kelasId=${k5()}`, null, { anon: 401, siswa: 401, guruA: 403, guruB: 200, admin: 200 }],
  ['daftar siswa Kelas Uji 5', 'GET', () => `siswa?kelasId=${k5()}`, null, { anon: 401, siswa: 401, guruA: 403, guruB: 200, admin: 200 }],
  ['detail siswa Kelas Uji 5', 'GET', () => `siswa/${s5()}`, null, { anon: 401, siswa: 401, guruA: 404, guruB: 200, admin: 200 }],
  ['aktivitas Kelas Uji 5', 'GET', () => `aktivitas?kelasId=${k5()}`, null, { anon: 401, siswa: 401, guruA: 403, guruB: 200, admin: 200 }],
  ['aktivitas siswa Kelas Uji 5', 'GET', () => `aktivitas?siswaId=${s5()}`, null, { anon: 401, siswa: 401, guruA: 404, guruB: 200, admin: 200 }],
  ['nilai Kelas Uji 5', 'GET', () => `nilai/${k5()}`, null, { anon: 401, siswa: 401, guruA: 403, guruB: 200, admin: 200 }],
  ['data Kelas Uji 5', 'GET', () => `kelas/${k5()}`, null, { anon: 401, siswa: 403, guruA: 403, guruB: 200, admin: 200 }],
  ['daftar level guru', 'GET', () => 'level/guru', null, { anon: 401, siswa: 401, guruA: 200, guruB: 200, admin: 200 }],
  ['daftar akun guru (admin)', 'GET', () => 'auth/guru', null, { anon: 401, siswa: 401, guruA: 403, guruB: 403, admin: 200 }],
  // ---------- Endpoint guru: mengubah ----------
  ['ubah siswa Kelas Uji 5', 'PATCH', () => `siswa/${s5()}`, () => ({ namaPanggilan: 'Ubah' }), { anon: 401, siswa: 401, guruA: 404, guruB: 200, admin: 200 }],
  ['reset PIN siswa Kelas Uji 5', 'POST', () => `siswa/${d.siswa5[1].siswa.id}/reset-pin`, null, { anon: 401, siswa: 401, guruA: 404, guruB: 200, admin: 200 }],
  ['catatan siswa Kelas Uji 5', 'PUT', () => `siswa/${s5()}/catatan`, () => ({ teks: 'catatan uji' }), { anon: 401, siswa: 401, guruA: 404, guruB: 200, admin: 200 }],
  ['pindahkan siswa Kelas Uji 5 ke Kelas Uji 3', 'PATCH', () => `siswa/${s5()}`, () => ({ kelasId: d.kelas3.id }), { anon: 401, siswa: 401, guruA: 404, guruB: 403, admin: null }],
  ['timpa nilai siswa Kelas Uji 5', 'PUT', () => `nilai/${k5()}/${s5()}`, () => ({ nilai: 90, alasan: 'uji hak akses' }), { anon: 401, siswa: 401, guruA: 403, guruB: 200, admin: 200 }],
  ['ubah Kelas Uji 5', 'PUT', () => `kelas/${k5()}`, () => ({ nama: 'Kelas Uji 5', tingkat: 5 }), { anon: 401, siswa: 401, guruA: 403, guruB: 200, admin: 200 }],
  ['kode baru Kelas Uji 5', 'POST', () => `kelas/${k5()}/kode-baru`, null, { anon: 401, siswa: 401, guruA: 403, guruB: 200, admin: 200 }],
  ['tambah siswa ke Kelas Uji 5', 'POST', () => 'siswa', () => ({ namaLengkap: 'Siswa Selundup', namaPanggilan: 'Selundup', avatar: 'pria', kelasId: k5() }), { anon: 401, siswa: 401, guruA: 403, guruB: 200, admin: 200 }],
  ['hapus siswa Kelas Uji 5', 'DELETE', () => `siswa/${s5()}`, null, { anon: 401, siswa: 401, guruA: 404, guruB: null, admin: null }],
  ['hapus Kelas Uji 5', 'DELETE', () => `kelas/${k5()}`, null, { anon: 401, siswa: 401, guruA: 403, guruB: null, admin: null }],
  ['ubah pengaturan permainan (admin)', 'PUT', () => 'auth/pengaturan', () => ({ hargaClue: [5, 10, 20], koinAwal: 20 }), { anon: 401, siswa: 401, guruA: 403, guruB: 403, admin: 200 }],
  ['buat akun guru (admin)', 'POST', () => 'auth/guru', () => ({ nama: 'Guru Selundup', username: `selundup.${d.akhiran}`, password: 'selundup-123', peran: 'admin', kelasIds: [] }), { anon: 401, siswa: 401, guruA: 403, guruB: 403, admin: null }],
  // ---------- Endpoint siswa ----------
  ['data diri siswa', 'GET', () => 'siswa/saya', null, { anon: 401, siswa: 200, guruA: 401, guruB: 401, admin: 401 }],
  ['progres siswa', 'GET', () => 'progres', null, { anon: 401, siswa: 200, guruA: 401, guruB: 401, admin: 401 }],
  ['level terbit untuk siswa', 'GET', () => 'level/terbit', null, { anon: 401, siswa: 200, guruA: 401, guruB: 401, admin: 401 }],
  ['jalankan kode', 'POST', () => 'progres/pantai-1/percobaan', () => ({ kode: 'maju()', detik: 1 }), { anon: 401, siswa: 200, guruA: 401, guruB: 401, admin: 401 }]
];

const URUTAN = ['anon', 'siswa', 'guruA', 'guruB', 'admin'];

for (const [nama, metode, path, data, harapan] of MATRIKS) {
  test(`hak akses: ${nama}`, async () => {
    for (const p of URUTAN) {
      if (harapan[p] == null) continue;
      const r = await peran[p](path(), { metode, data: data ? data() : undefined });
      assert.equal(r.status, harapan[p], `${p} ${metode} ${path()} -> ${r.status} ${r.teks.slice(0, 120)}`);
    }
  });
}

test('guru A tidak bisa mereset PIN siswa Kelas Uji 5: PIN lama tetap bisa dipakai', async () => {
  const korban = d.siswa5[0];
  const r = await d.guruA.klien(`siswa/${korban.siswa.id}/reset-pin`, { metode: 'POST' });
  assert.equal(r.status, 404);
  assert.equal(r.isi.pin, undefined);
  const m = await klien()('auth/masuk-siswa', { metode: 'POST', data: { username: korban.username, pin: korban.pin } });
  assert.equal(m.isi.ok, true, 'PIN lama masih berlaku');
});

test('guru A tidak bisa membaca data siswa Kelas Uji 5 lewat daftar semua siswanya', async () => {
  const r = await d.guruA.klien('siswa');
  assert.equal(r.status, 200);
  assert.ok(r.isi.every((s) => s.kelasId === d.kelas3.id), 'hanya siswa Kelas Uji 3');
  assert.ok(!r.isi.some((s) => s.id === s5()));
});

test('guru tidak bisa memasang dirinya ke kelas lain lewat ubah kelas', async () => {
  const r = await d.guruA.klien(`kelas/${d.kelas3.id}`, { metode: 'PUT', data: { nama: 'Kelas Uji 3', tingkat: 3, guruIds: [d.guruA.id, d.guruB.id] } });
  assert.equal(r.status, 200);
  const kelas = (await d.admin('kelas')).isi.find((k) => k.id === d.kelas3.id);
  assert.deepEqual(kelas.guruIds, [d.guruA.id], 'guruIds hanya boleh diubah admin');
});
