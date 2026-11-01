// js/game/blok.js — model blok mode blok + terjemahan blok <-> kode teks (fungsi murni, tanpa DOM)
// Mode blok TIDAK punya mesin eksekusi sendiri: susunan blok diterjemahkan menjadi kode teks dengan format
// yang sama persis dengan mode teks, lalu dijalankan interpreter yang sama (js/game/interpreter.js) di browser
// maupun di server. Arah sebaliknya (teks -> blok) memakai parser interpreter itu juga (urai), jadi aturannya
// tetap satu sumber kebenaran.
//
// Bentuk blok (nama perintah/syarat selalu bahasa Indonesia, seperti data level):
//   { t: 'perintah', nama: 'maju'|'belok_kiri'|'belok_kanan'|'ambil'|'lompat', arg: '' | '3' | 'langkah' }
//   { t: 'ulangi', jumlah: '3', isi: [...] }
//   { t: 'jika', syarat: { nama, bukan }, isi: [...], lainnya: [...] | null }
//   { t: 'selama', syarat: { nama, bukan }, isi: [...] }
//   { t: 'buat', nama: 'langkah', nilai: '3' }        buat langkah = 3
//   { t: 'atur', nama: 'langkah', nilai: 'langkah + 1' }  langkah = langkah + 1
// Nilai angka/variabel disimpan sebagai teks pendek; salah isi dilaporkan interpreter seperti mode teks.

import { urai } from './interpreter.js';
import { NAMA_PERINTAH, NAMA_SYARAT, terjemahkanKode } from './kamus-perintah.js';

export const TIPE_BLOK = ['perintah', 'ulangi', 'jika', 'selama', 'buat', 'atur'];
const MAKS_KEDALAMAN = 8;
const MAKS_BLOK = 300;
const INDENTASI = '  ';

// Isi kotak angka/variabel: hanya huruf, angka, _, spasi, + - ( ). Tanda lain (mis. { } atau baris baru) dibuang
// supaya satu blok selalu menjadi satu baris kode yang sah bentuknya.
export const bersihkanNilai = (v) => String(v ?? '').replace(/[^A-Za-z0-9_ +\-()]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
const bersihkanNama = (v) => String(v ?? '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 24);

/** Blok baru dengan isian bawaan (dipakai palet editor blok). jenis: nama perintah, 'ulangi', 'jika', 'jika_lainnya', 'selama', 'buat', 'atur'. */
export function blokBaru(jenis, syaratBawaan = 'ada_rintangan') {
  if (NAMA_PERINTAH.includes(jenis)) return { t: 'perintah', nama: jenis, arg: '' };
  switch (jenis) {
    case 'ulangi': return { t: 'ulangi', jumlah: '2', isi: [] };
    case 'jika': return { t: 'jika', syarat: { nama: syaratBawaan, bukan: false }, isi: [], lainnya: null };
    case 'jika_lainnya': return { t: 'jika', syarat: { nama: syaratBawaan, bukan: false }, isi: [], lainnya: [] };
    case 'selama': return { t: 'selama', syarat: { nama: syaratBawaan === 'ada_rintangan' ? 'sampai_tujuan' : syaratBawaan, bukan: true }, isi: [] };
    case 'buat': return { t: 'buat', nama: 'langkah', nilai: '2' };
    case 'atur': return { t: 'atur', nama: 'langkah', nilai: 'langkah + 1' };
    default: return null;
  }
}

/**
 * Rapikan susunan blok dari sumber luar (form guru, database): tipe/nama yang tidak dikenal dibuang,
 * isian dibersihkan, kedalaman dan jumlah blok dibatasi. Hasil: array blok (boleh kosong), atau null bila bukan array.
 */
export function normalkanBlok(daftar) {
  if (!Array.isArray(daftar)) return null;
  let jumlah = 0;
  const syarat = (s) => ({ nama: NAMA_SYARAT.includes(s?.nama) ? s.nama : 'ada_rintangan', bukan: !!s?.bukan });
  const rapikan = (d, kedalaman) => (Array.isArray(d) && kedalaman <= MAKS_KEDALAMAN ? d.map((n) => satu(n, kedalaman)).filter(Boolean) : []);
  function satu(n, kedalaman) {
    if (!n || typeof n !== 'object' || ++jumlah > MAKS_BLOK) return null;
    switch (n.t) {
      case 'perintah':
        if (!NAMA_PERINTAH.includes(n.nama)) return null;
        return { t: 'perintah', nama: n.nama, arg: n.nama === 'maju' ? bersihkanNilai(n.arg) : '' };
      case 'ulangi': return { t: 'ulangi', jumlah: bersihkanNilai(n.jumlah), isi: rapikan(n.isi, kedalaman + 1) };
      case 'jika': return {
        t: 'jika', syarat: syarat(n.syarat), isi: rapikan(n.isi, kedalaman + 1),
        lainnya: Array.isArray(n.lainnya) ? rapikan(n.lainnya, kedalaman + 1) : null
      };
      case 'selama': return { t: 'selama', syarat: syarat(n.syarat), isi: rapikan(n.isi, kedalaman + 1) };
      case 'buat':
      case 'atur': return { t: n.t, nama: bersihkanNama(n.nama), nilai: bersihkanNilai(n.nilai) };
      default: return null;
    }
  }
  return rapikan(daftar, 0);
}

// =====================================================================
// Blok -> kode teks
// =====================================================================
/**
 * Terjemahkan susunan blok menjadi kode teks, format sama dengan mode teks:
 *   maju(3)            ulangi 3 {          jika bukan ada_jurang() {      buat langkah = 2
 *                        maju()              maju()                       langkah = langkah + 1
 *                      }                   } lainnya {
 *                                            lompat()
 *                                          }
 * bahasa: 'id' | 'en' — nama perintah mengikuti bahasa murid (interpreter menerima keduanya).
 * Hasil: { kode, baris } — baris[i] = blok untuk baris kode ke-(i+1) (untuk menyorot blok yang sedang jalan / salah).
 */
export function blokKeTeks(daftar, bahasa = 'id') {
  const keluaran = [];
  const baris = [];
  const tulis = (teks, blok, tingkat) => { keluaran.push(INDENTASI.repeat(tingkat) + teks); baris.push(blok); };
  const syarat = (s) => `${s.bukan ? 'bukan ' : ''}${s.nama}()`;

  function daftarKe(d, tingkat) {
    for (const n of d || []) {
      switch (n.t) {
        case 'perintah':
          tulis(`${n.nama}(${n.nama === 'maju' ? bersihkanNilai(n.arg) : ''})`, n, tingkat);
          break;
        case 'ulangi':
          tulis(`ulangi ${bersihkanNilai(n.jumlah)} {`, n, tingkat);
          daftarKe(n.isi, tingkat + 1);
          tulis('}', null, tingkat);
          break;
        case 'jika':
          tulis(`jika ${syarat(n.syarat)} {`, n, tingkat);
          daftarKe(n.isi, tingkat + 1);
          if (Array.isArray(n.lainnya)) {
            tulis('} lainnya {', n, tingkat);
            daftarKe(n.lainnya, tingkat + 1);
          }
          tulis('}', null, tingkat);
          break;
        case 'selama':
          tulis(`selama ${syarat(n.syarat)} {`, n, tingkat);
          daftarKe(n.isi, tingkat + 1);
          tulis('}', null, tingkat);
          break;
        case 'buat':
          tulis(`buat ${bersihkanNama(n.nama)} = ${bersihkanNilai(n.nilai)}`, n, tingkat);
          break;
        case 'atur':
          tulis(`${bersihkanNama(n.nama)} = ${bersihkanNilai(n.nilai)}`, n, tingkat);
          break;
        default:
          break;
      }
    }
  }
  daftarKe(daftar, 0);
  return { kode: terjemahkanKode(keluaran.join('\n'), bahasa), baris };
}

// =====================================================================
// Kode teks -> blok
// =====================================================================
// Ekspresi AST -> teks; sisi kanan yang berupa operasi diberi kurung agar urutan hitungnya tetap sama
function ekspresiKeTeks(e) {
  if (!e) return '';
  if (e.tipe === 'angka') return String(e.nilai);
  if (e.tipe === 'var') return e.nama;
  if (e.tipe === 'operasi') {
    const kanan = e.kanan?.tipe === 'operasi' ? `(${ekspresiKeTeks(e.kanan)})` : ekspresiKeTeks(e.kanan);
    return `${ekspresiKeTeks(e.kiri)} ${e.op} ${kanan}`;
  }
  return '';
}

function astKeBlok(daftar) {
  return daftar.map((n) => {
    switch (n.tipe) {
      case 'perintah': return { t: 'perintah', nama: n.nama, arg: n.arg ? ekspresiKeTeks(n.arg) : '' };
      case 'ulangi': return { t: 'ulangi', jumlah: ekspresiKeTeks(n.jumlah), isi: astKeBlok(n.isi) };
      case 'jika': return {
        t: 'jika', syarat: { nama: n.syarat.nama, bukan: !!n.syarat.bukan }, isi: astKeBlok(n.isi),
        lainnya: n.lainnya ? astKeBlok(n.lainnya) : null
      };
      case 'selama': return { t: 'selama', syarat: { nama: n.syarat.nama, bukan: !!n.syarat.bukan }, isi: astKeBlok(n.isi) };
      case 'buat': return { t: 'buat', nama: n.nama, nilai: ekspresiKeTeks(n.nilai) };
      case 'atur': return { t: 'atur', nama: n.nama, nilai: ekspresiKeTeks(n.nilai) };
      default: return null;
    }
  }).filter(Boolean);
}

/**
 * Terjemahkan kode teks (Indonesia/Inggris/campuran) menjadi susunan blok, memakai parser interpreter.
 * Komentar // tidak ikut (blok tidak punya komentar). Kode kosong = susunan kosong.
 * Hasil: { blok, galat } — blok null dan galat berisi pesan bila kode teks salah tulis.
 */
export function teksKeBlok(kode) {
  try {
    return { blok: astKeBlok(urai(String(kode ?? ''))), galat: null };
  } catch (err) {
    return { blok: null, galat: err.message };
  }
}

/**
 * Apakah kode ini berbentuk hasil terjemahan editor blok? Dipakai server sebelum memberi bintang mode blok,
 * supaya kode ketikan bebas tidak bisa diaku-aku sebagai susunan blok. Spasi dan huruf besar/kecil diabaikan;
 * bahasa Indonesia maupun Inggris diterima.
 */
export function kodeBentukBlok(kode) {
  const { blok } = teksKeBlok(kode);
  if (!blok) return false;
  const rapat = (t) => String(t).replace(/\s+/g, '').toLowerCase();
  return ['id', 'en'].some((b) => rapat(blokKeTeks(blok, b).kode) === rapat(kode));
}

/** Dua susunan blok sama isinya? (dipakai editor guru: apakah versi blok masih hasil terjemahan otomatis) */
export const blokSama = (a, b) => JSON.stringify(normalkanBlok(a)) === JSON.stringify(normalkanBlok(b));
