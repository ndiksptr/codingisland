// js/game/kamus-perintah.js — padanan nama perintah koding Indonesia <-> Inggris (satu-satunya daftar kata)
// Interpreter menerima kedua bahasa (dinormalkan ke bentuk Indonesia setelah tokenisasi).
// Data level (kodeAwal, clue, perintahTersedia) selalu disimpan dalam bahasa Indonesia, lalu
// diterjemahkan hanya saat ditampilkan ke murid yang memilih bahasa Inggris.
// Tampilan, menu, dan teks petunjuk tetap bahasa Indonesia; yang berganti hanya nama perintah.

export const BAHASA_KODE = ['id', 'en'];

// Bahasa perintah bawaan untuk MURID (baru maupun lama, lihat migrasi 0006). Murid bisa menggantinya di Profil.
// Alat guru (editor level, coba main, validasi) tetap bahasa Indonesia.
export const BAHASA_BAWAAN_SISWA = 'en';

// jenis: 'perintah' (pakai kurung, bisa diberi angka), 'syarat' (pakai kurung), 'kunci' (tanpa kurung)
const DAFTAR = [
  ['maju', 'forward', 'perintah'],
  ['belok_kiri', 'turn_left', 'perintah'],
  ['belok_kanan', 'turn_right', 'perintah'],
  ['ambil', 'pick_up', 'perintah'],
  ['lompat', 'jump', 'perintah'],
  ['ada_rintangan', 'has_obstacle', 'syarat'],
  ['ada_jurang', 'has_hole', 'syarat'],
  ['ada_koin', 'has_coin', 'syarat'],
  ['sampai_tujuan', 'at_goal', 'syarat'],
  ['ulangi', 'repeat', 'kunci'],
  ['jika', 'if', 'kunci'],
  ['lainnya', 'else', 'kunci'],
  ['selama', 'while', 'kunci'],
  ['buat', 'let', 'kunci'],
  ['bukan', 'not', 'kunci'],
  ['kali', 'times', 'kunci']
];

const KE_INGGRIS = new Map(DAFTAR.map(([id, en]) => [id, en]));
const KE_INDONESIA = new Map(DAFTAR.map(([id, en]) => [en, id]));
const kataJenis = (jenis) => DAFTAR.filter((d) => d[2] === jenis).map((d) => d[0]);

/** Nama Indonesia per jenis (dipakai interpreter dan editor). */
export const NAMA_PERINTAH = kataJenis('perintah');
export const NAMA_SYARAT = kataJenis('syarat');
export const NAMA_KUNCI = kataJenis('kunci');

export const bahasaSah = (b) => (BAHASA_KODE.includes(b) ? b : 'id');

/** Kata (huruf kecil) dalam bahasa apa pun -> bentuk Indonesia. Kata lain dikembalikan apa adanya. */
export const keIndonesia = (kata) => KE_INDONESIA.get(kata) || kata;

/** Nama Indonesia -> nama dalam bahasa pilihan murid. */
export const namaDalam = (kata, bahasa = 'id') => (bahasa === 'en' ? KE_INGGRIS.get(kata) || kata : kata);

/** Semua bentuk sebuah kata Indonesia (Indonesia dulu, lalu Inggris). */
export const semuaBentuk = (kata) => [kata, KE_INGGRIS.get(kata)].filter(Boolean);

/** Himpunan nama yang dikenali dalam bahasa ini (untuk pewarnaan editor). 'en' juga mengenali Indonesia. */
export function kataDikenal(jenisDaftar, bahasa = 'id') {
  const hasil = new Set(jenisDaftar);
  if (bahasa === 'en') jenisDaftar.forEach((k) => hasil.add(KE_INGGRIS.get(k)));
  return hasil;
}

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/y;

/**
 * Terjemahkan KODE (kerangka awal) dari Indonesia ke bahasa murid.
 * Semua kata kunci di bagian kode ditukar. Isi tanda kutip tidak disentuh, dan komentar // hanya
 * diterjemahkan bagian yang jelas berupa kode (lihat terjemahkanTeks), supaya kalimatnya tetap utuh.
 */
export function terjemahkanKode(kode, bahasa = 'id') {
  const teks = String(kode ?? '');
  if (bahasa !== 'en') return teks;
  let hasil = '';
  let i = 0;
  while (i < teks.length) {
    const c = teks[i];
    if (c === '/' && teks[i + 1] === '/') {
      const akhir = teks.indexOf('\n', i);
      const j = akhir < 0 ? teks.length : akhir;
      hasil += terjemahkanTeks(teks.slice(i, j), bahasa);
      i = j;
    } else if (c === '"' || c === "'") {
      const tutup = teks.indexOf(c, i + 1);
      const j = tutup < 0 ? teks.length : tutup + 1;
      hasil += teks.slice(i, j);
      i = j;
    } else if (/[A-Za-z_]/.test(c)) {
      IDENT.lastIndex = i;
      const kata = IDENT.exec(teks)[0];
      hasil += KE_INGGRIS.get(kata.toLowerCase()) || kata;
      i += kata.length;
    } else {
      hasil += c;
      i++;
    }
  }
  return hasil;
}

/**
 * Terjemahkan TEKS campuran (clue, instruksi, komentar) dari Indonesia ke bahasa murid.
 * Hanya bagian yang jelas berupa kode yang ditukar, kata biasa di kalimat tetap:
 *   maju(2), ada_jurang()        -> nama diikuti kurung
 *   ulangi 3 {, ulangi 3 kali {  -> ulangi + jumlah + {
 *   jika/selama [bukan] syarat(  -> diikuti syarat berkurung
 *   lainnya {, buat x =
 * Jadi "Ulangi 4 kali." atau "Jika ada jurang di depan" tidak berubah.
 */
export function terjemahkanTeks(teks, bahasa = 'id') {
  const s = String(teks ?? '');
  if (bahasa !== 'en') return s;
  const en = (k) => KE_INGGRIS.get(k);
  return s
    .replace(/\b(ulangi)(\s+[A-Za-z0-9_]+)(\s+kali)?(\s*\{)/g, (_, k, n, kali, b) => `${en(k)}${n}${kali ? kali.replace('kali', en('kali')) : ''}${b}`)
    .replace(/\b(jika|selama|bukan)(?=\s+(?:bukan\s+)?[a-z_]+\()/g, (k) => en(k))
    .replace(/\blainnya(?=\s*\{)/g, en('lainnya'))
    .replace(/\bbuat(?=\s+[A-Za-z_][A-Za-z0-9_]*\s*=)/g, en('buat'))
    .replace(/\b([a-z_]+)(?=\()/g, (k) => en(k) || k);
}
