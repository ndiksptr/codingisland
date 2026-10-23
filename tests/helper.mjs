// tests/helper.mjs — alat bantu bersama untuk tes API, end-to-end, dan beban
//
// - BASE_URL bawaan http://localhost:8787 (npx wrangler dev). Boleh juga staging.
// - DOMAIN PRODUKSI DITOLAK: tes berhenti bila BASE_URL berisi codingisland.ndiksptr159.workers.dev.
// - Setiap pemanggil siapkanDunia() membuat datanya sendiri (nama/username diberi akhiran acak),
//   jadi tes tidak saling mengganggu dan bisa diulang tanpa mengosongkan database.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const BASE_URL = (process.env.BASE_URL || 'http://localhost:8787').replace(/\/+$/, '');
export const DOMAIN_PRODUKSI = 'codingisland.ndiksptr159.workers.dev';

/** Hentikan proses bila BASE_URL mengarah ke produksi. Dipanggil saat modul dimuat. */
export function tolakProduksi(url = BASE_URL) {
  if (String(url).toLowerCase().includes(DOMAIN_PRODUKSI)) {
    console.error(`\n[TOLAK] Tes tidak boleh berjalan ke domain produksi (${DOMAIN_PRODUKSI}).\n` +
      'Pakai http://localhost:8787 (npx wrangler dev) atau staging.\n');
    process.exit(1);
  }
}
tolakProduksi();

const AKAR = fileURLToPath(new URL('..', import.meta.url));

/** Baca variabel dari .dev.vars (format KUNCI = "nilai"). */
export function bacaDevVars() {
  const berkas = `${AKAR}.dev.vars`;
  if (!existsSync(berkas)) return {};
  const hasil = {};
  for (const baris of readFileSync(berkas, 'utf8').split(/\r?\n/)) {
    const m = baris.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) hasil[m[1]] = m[2];
  }
  return hasil;
}

/** KODE_PASANG: dari variabel lingkungan (staging) atau .dev.vars (lokal). */
export const KODE_PASANG = process.env.KODE_PASANG || bacaDevVars().KODE_PASANG || '';

/** Akun admin uji. Dibuat lewat #/pasang bila database masih kosong. */
export const ADMIN = {
  nama: 'Admin Uji',
  username: process.env.ADMIN_USERNAME || 'admin.uji',
  password: process.env.ADMIN_PASSWORD || 'Admin-Uji-Lokal-123'
};

export const PIN_UJI = '1234';
const tunda = (ms) => new Promise((r) => setTimeout(r, ms));

/** Akhiran acak huruf kecil+angka (diawali huruf) untuk username/nama unik. */
export function akhiran(panjang = 5) {
  const huruf = 'abcdefghjkmnpqrstuvwxyz';
  const isi = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = huruf[Math.floor(Math.random() * huruf.length)];
  while (s.length < panjang) s += isi[Math.floor(Math.random() * isi.length)];
  return s;
}

/** Huruf saja (nama lengkap siswa tidak boleh berisi angka). */
export function hurufAcak(panjang = 5) {
  let s = '';
  while (s.length < panjang) s += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  return s;
}

/** Kode kelas acak 6 karakter. */
export const kodeKelasAcak = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

/** Alamat IP palsu (dihormati wrangler dev lewat CF-Connecting-IP; di staging diabaikan Cloudflare). */
export const ipAcak = () => `10.${1 + Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 255)}.${1 + Math.floor(Math.random() * 250)}`;

/**
 * Klien HTTP dengan penyimpan cookie sesi sendiri.
 * k(path, { metode, data, tipe, mentah }) -> { status, isi, teks, headers }
 */
export function klien({ ip = ipAcak() } = {}) {
  let cookie = '';
  const panggil = async (path, { metode = 'GET', data, tipe = 'application/json', mentah = false } = {}) => {
    const headers = { 'CF-Connecting-IP': ip };
    if (data !== undefined) headers['Content-Type'] = tipe;
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(`${BASE_URL}/api/${path}`, {
      method: metode,
      headers,
      body: data === undefined ? undefined : (typeof data === 'string' ? data : JSON.stringify(data))
    });
    const sc = res.headers.get('set-cookie');
    if (sc) {
      cookie = sc.split(';')[0];
      if (cookie.endsWith('=')) cookie = '';
    }
    const teks = await res.text();
    let isi = null;
    if (!mentah) { try { isi = JSON.parse(teks); } catch { /* bukan JSON */ } }
    return { status: res.status, isi, teks, headers: res.headers };
  };
  panggil.ip = ip;
  panggil.cookie = () => cookie;
  panggil.aturCookie = (c) => { cookie = c; };
  return panggil;
}

/** Pastikan Coding Island terpasang dengan admin uji, lalu kembalikan klien admin yang sudah masuk. */
export async function masukAdmin() {
  const a = klien();
  const st = await a('auth/pasang');
  if (st.status !== 200) throw new Error(`Server tidak menjawab di ${BASE_URL} (status ${st.status}). Jalankan npx wrangler dev dulu.`);
  if (st.isi.perluPasang) {
    if (!KODE_PASANG) throw new Error('KODE_PASANG tidak ditemukan. Isi di .dev.vars atau variabel lingkungan KODE_PASANG.');
    const r = await a('auth/pasang', { metode: 'POST', data: { kode: KODE_PASANG, nama: ADMIN.nama, username: ADMIN.username, password: ADMIN.password, konfirmasi: ADMIN.password } });
    if (!r.isi?.ok) {
      // Mungkin tes lain baru saja memasang; coba masuk saja
      if (r.status !== 403) throw new Error(`Pemasangan gagal: ${r.teks}`);
    } else {
      return a;
    }
  }
  const m = await a('auth/masuk-guru', { metode: 'POST', data: { username: ADMIN.username, password: ADMIN.password } });
  if (!m.isi?.ok) {
    throw new Error(`Tidak bisa masuk sebagai ${ADMIN.username}: ${m.teks}\n` +
      'Database sudah terpasang dengan admin lain. Kosongkan database lokal (hapus folder .wrangler) atau atur ADMIN_USERNAME/ADMIN_PASSWORD.');
  }
  return a;
}

/** Masuk sebagai guru. */
export async function masukGuru(username, password, opsi = {}) {
  const g = klien(opsi);
  const r = await g('auth/masuk-guru', { metode: 'POST', data: { username, password } });
  if (!r.isi?.ok) throw new Error(`Guru ${username} gagal masuk: ${r.teks}`);
  return g;
}

/** Daftarkan siswa lewat form pendaftaran (API), sudah langsung masuk. Hasil: { klien, siswa, username, pin } */
export async function daftarSiswa(kelas, { nama, panggilan = 'Uji', pin = PIN_UJI, username, ip } = {}) {
  const s = klien({ ip });
  const u = username || `s${akhiran(8)}`;
  const r = await s('auth/daftar', {
    metode: 'POST',
    data: { namaLengkap: nama || `Siswa Uji ${hurufAcak(6)}`, namaPanggilan: panggilan, avatar: 'pria', kelasId: kelas.id, kodeKelas: kelas.kodeKelas, username: u, pin }
  });
  if (!r.isi?.ok) throw new Error(`Daftar siswa gagal: ${r.teks}`);
  return { klien: s, siswa: r.isi.siswa, username: u, pin };
}

/**
 * Siapkan "dunia" uji lengkap:
 *   admin, guru A (mengampu Kelas Uji 3), guru B (mengampu Kelas Uji 5),
 *   kelas3, kelas5, siswa3 (2 siswa Kelas Uji 3), siswa5 (2 siswa Kelas Uji 5) — semuanya sudah masuk.
 */
export async function siapkanDunia({ jumlahSiswa3 = 2, jumlahSiswa5 = 2 } = {}) {
  const admin = await masukAdmin();
  const sfx = akhiran(5);
  const kelas3 = (await admin('kelas', { metode: 'POST', data: { nama: 'Kelas Uji 3', tingkat: 3, kodeKelas: kodeKelasAcak() } })).isi;
  const kelas5 = (await admin('kelas', { metode: 'POST', data: { nama: 'Kelas Uji 5', tingkat: 5, kodeKelas: kodeKelasAcak() } })).isi;
  if (!kelas3?.id || !kelas5?.id) throw new Error('Gagal membuat kelas uji');

  const guruA = { nama: `Guru A ${hurufAcak(4)}`, username: `guru.a.${sfx}`, password: 'Guru-A-Uji-123' };
  const guruB = { nama: `Guru B ${hurufAcak(4)}`, username: `guru.b.${sfx}`, password: 'Guru-B-Uji-123' };
  for (const [g, k] of [[guruA, kelas3], [guruB, kelas5]]) {
    const r = await admin('auth/guru', { metode: 'POST', data: { ...g, peran: 'guru', kelasIds: [k.id] } });
    if (!r.isi?.id) throw new Error(`Gagal membuat guru: ${r.teks}`);
    g.id = r.isi.id;
  }

  const siswa3 = [];
  for (let i = 0; i < jumlahSiswa3; i++) siswa3.push(await daftarSiswa(kelas3));
  const siswa5 = [];
  for (let i = 0; i < jumlahSiswa5; i++) siswa5.push(await daftarSiswa(kelas5));

  return {
    admin,
    guruA: { ...guruA, klien: await masukGuru(guruA.username, guruA.password) },
    guruB: { ...guruB, klien: await masukGuru(guruB.username, guruB.password) },
    kelas3, kelas5, siswa3, siswa5, akhiran: sfx
  };
}

/** Ubah pengaturan permainan (admin) dan kembalikan pengaturan lama. */
export async function aturPengaturan(admin, perubahan) {
  const lama = (await admin('auth/pengaturan')).isi;
  const r = await admin('auth/pengaturan', { metode: 'PUT', data: { ...lama, ...perubahan } });
  if (r.status !== 200) throw new Error(`Gagal mengubah pengaturan: ${r.teks}`);
  return lama;
}

export { tunda };
