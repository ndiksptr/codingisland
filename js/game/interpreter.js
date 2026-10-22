// js/game/interpreter.js — interpreter mini-bahasa Coding Island
// Alur: kode teks -> tokenisasi() -> Parser (AST bernomor baris) -> evaluator -> jejak peristiwa.
// Tidak memakai eval / new Function. Modul ini murni (tanpa DOM), dijalankan di Web Worker.
//
// Contoh bahasa:
//   // komentar
//   buat langkah = 2
//   ulangi 3 {
//     jika ada_rintangan() { belok_kanan() } lainnya { maju(langkah) }
//   }
//   selama bukan sampai_tujuan() { maju() }

export const MAKS_LANGKAH = 1000;
export const PESAN_KELELAHAN = 'Robot kelelahan! Sepertinya perulanganmu tidak pernah berhenti.';

// Perintah gerak: arg = boleh diberi angka di dalam kurung
const PERINTAH = {
  maju: { arg: true },
  belok_kiri: { arg: false },
  belok_kanan: { arg: false },
  ambil: { arg: false },
  lompat: { arg: false }
};
const SYARAT = ['ada_rintangan', 'ada_jurang', 'ada_koin', 'sampai_tujuan'];
const KATA_KUNCI = ['ulangi', 'jika', 'lainnya', 'selama', 'buat', 'bukan'];

/** Semua nama yang bisa dimasukkan ke perintahTersedia sebuah level. */
export const SEMUA_PERINTAH = [...Object.keys(PERINTAH), 'ulangi', 'jika', 'selama', 'buat', ...SYARAT];

const ARAH = ['utara', 'timur', 'selatan', 'barat'];
const GESER = { utara: [0, -1], timur: [1, 0], selatan: [0, 1], barat: [-1, 0] };

/** Galat dari kode siswa (salah tulis) — selalu menyebut nomor baris. */
export class GalatKode extends Error {
  constructor(baris, pesan) {
    super(`Baris ${baris}: ${pesan}`);
    this.baris = baris;
  }
}

// =====================================================================
// Saran ejaan (jarak Levenshtein)
// =====================================================================
export function jarakLevenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  let sebelum = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const kini = [i];
    for (let j = 1; j <= n; j++) {
      const biaya = a[i - 1] === b[j - 1] ? 0 : 1;
      kini[j] = Math.min(sebelum[j] + 1, kini[j - 1] + 1, sebelum[j - 1] + biaya);
    }
    sebelum = kini;
  }
  return sebelum[n];
}

// Bentuk tampilan: perintah & syarat memakai (), kata kunci tidak
const tampil = (nama) => (PERINTAH[nama] || SYARAT.includes(nama) ? `${nama}()` : nama);

function saranEjaan(kata, kandidat = [...Object.keys(PERINTAH), ...SYARAT, ...KATA_KUNCI]) {
  let terbaik = null;
  let jarakTerbaik = Infinity;
  for (const k of kandidat) {
    const j = jarakLevenshtein(kata, k);
    if (j < jarakTerbaik) { jarakTerbaik = j; terbaik = k; }
  }
  const batas = Math.min(3, Math.max(1, Math.floor(kata.length / 3)));
  return jarakTerbaik <= batas ? terbaik : null;
}

// =====================================================================
// 1. Tokenisasi
// =====================================================================
const huruf = (c) => /[a-zA-Z_]/.test(c);
const angka = (c) => c >= '0' && c <= '9';

export function tokenisasi(kode) {
  const token = [];
  let i = 0;
  let baris = 1;
  const n = kode.length;

  while (i < n) {
    const c = kode[i];
    if (c === '\n') { token.push({ t: 'baris_baru', baris }); baris++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === ' ') { i++; continue; }
    // Komentar sampai akhir baris
    if (c === '/' && kode[i + 1] === '/') { while (i < n && kode[i] !== '\n') i++; continue; }

    if (angka(c)) {
      let j = i;
      while (j < n && angka(kode[j])) j++;
      if ((kode[j] === '.' || kode[j] === ',') && angka(kode[j + 1] || '')) {
        throw new GalatKode(baris, 'robot hanya mengerti bilangan bulat, tanpa koma.');
      }
      token.push({ t: 'angka', v: parseInt(kode.slice(i, j), 10), baris });
      i = j;
      continue;
    }
    if (huruf(c)) {
      let j = i;
      while (j < n && (huruf(kode[j]) || angka(kode[j]))) j++;
      const asli = kode.slice(i, j);
      token.push({ t: 'ident', v: asli.toLowerCase(), asli, baris }); // tidak membedakan huruf besar/kecil
      i = j;
      continue;
    }
    if ('(){}=+-'.includes(c)) { token.push({ t: c, baris }); i++; continue; }
    if (c === ';') throw new GalatKode(baris, 'robot tidak butuh tanda ; di sini. Hapus saja ya.');
    if (c === '"' || c === "'") throw new GalatKode(baris, 'robot belum mengerti tanda kutip.');
    throw new GalatKode(baris, `tanda ${c} tidak dikenal robot.`);
  }
  token.push({ t: 'akhir', baris });
  return token;
}

// =====================================================================
// 2. Parser -> AST
// =====================================================================
// Bentuk AST:
//   { tipe: 'perintah', nama, arg, baris }
//   { tipe: 'ulangi', jumlah, isi, baris }
//   { tipe: 'jika', syarat, isi, lainnya, baris }
//   { tipe: 'selama', syarat, isi, baris }
//   { tipe: 'buat' | 'atur', nama, nilai, baris }
//   syarat: { nama, bukan, baris }
//   ekspresi: { tipe: 'angka', nilai } | { tipe: 'var', nama, baris } | { tipe: 'operasi', op, kiri, kanan }
const SIMBOL = { baris_baru: 'akhir baris', akhir: 'akhir kode' };
const namaToken = (tk) => (tk.t === 'ident' ? tk.asli : tk.t === 'angka' ? String(tk.v) : SIMBOL[tk.t] || tk.t);
const akhirBaris = (tk) => tk.t === 'baris_baru' || tk.t === 'akhir';

class Parser {
  constructor(token, perintahTersedia) {
    this.token = token;
    this.i = 0;
    this.tersedia = perintahTersedia ? new Set(perintahTersedia.map((p) => String(p).toLowerCase())) : null;
  }

  lihat(k = 0) { return this.token[Math.min(this.i + k, this.token.length - 1)]; }
  ambil() { return this.token[this.i++]; }
  lewatiBarisBaru() { while (this.lihat().t === 'baris_baru') this.i++; }

  harap(t, pesan) {
    const tk = this.lihat();
    if (tk.t !== t) throw new GalatKode(tk.baris, pesan);
    return this.ambil();
  }

  cekTersedia(nama, baris) {
    if (this.tersedia && !this.tersedia.has(nama)) {
      throw new GalatKode(baris, `${tampil(nama)} belum bisa dipakai. Perintah ini belum dibuka di pulau ini.`);
    }
  }

  program() {
    return this.daftarPernyataan(null);
  }

  // Daftar pernyataan sampai '}' (jika pembuka ada) atau akhir kode
  daftarPernyataan(pembuka) {
    const isi = [];
    for (;;) {
      this.lewatiBarisBaru();
      const tk = this.lihat();
      if (tk.t === 'akhir') {
        if (pembuka) throw new GalatKode(pembuka.baris, 'kurung kurawal tutup } sepertinya hilang.');
        return isi;
      }
      if (tk.t === '}') {
        if (!pembuka) throw new GalatKode(tk.baris, 'ada kurung kurawal tutup } yang tidak punya pasangan {.');
        this.i++;
        return isi;
      }
      isi.push(this.pernyataan());
      // Satu perintah per baris (kecuali ditutup } di baris yang sama)
      const sesudah = this.lihat();
      if (!akhirBaris(sesudah) && sesudah.t !== '}') {
        throw new GalatKode(sesudah.baris, 'tulis satu perintah di setiap baris ya.');
      }
    }
  }

  pernyataan() {
    const tk = this.lihat();
    if (tk.t === 'angka') throw new GalatKode(tk.baris, `angka ${tk.v} harus berada di dalam perintah, contoh: maju(${tk.v}).`);
    if (tk.t === '{') throw new GalatKode(tk.baris, 'kurung kurawal { harus ditulis setelah ulangi, jika, atau selama.');
    if (tk.t === ')') throw new GalatKode(tk.baris, 'ada kurung tutup ) yang tidak punya pasangan (.');
    if (tk.t !== 'ident') throw new GalatKode(tk.baris, `tanda ${namaToken(tk)} di awal baris membuat robot bingung.`);

    switch (tk.v) {
      case 'ulangi': return this.ulangi();
      case 'jika': return this.jika();
      case 'selama': return this.selama();
      case 'buat': return this.buat();
      case 'lainnya': throw new GalatKode(tk.baris, 'lainnya harus ditulis tepat setelah blok jika.');
      case 'bukan': throw new GalatKode(tk.baris, 'bukan dipakai di depan syarat, contoh: jika bukan ada_rintangan() {');
      default: break;
    }
    if (PERINTAH[tk.v]) return this.perintah();
    if (SYARAT.includes(tk.v)) {
      throw new GalatKode(tk.baris, `${tk.v}() adalah syarat. Pakai bersama jika atau selama, contoh: jika ${tk.v}() {`);
    }
    if (this.lihat(1).t === '=') return this.atur();
    throw this.galatTakDikenal(tk);
  }

  galatTakDikenal(tk) {
    // "belok kiri" atau "belok-kiri" -> belok_kiri
    const t1 = this.lihat(1);
    const t2 = this.lihat(2);
    let gabung = null;
    if (t1.t === 'ident') gabung = `${tk.v}_${t1.v}`;
    else if ((t1.t === '-') && t2.t === 'ident') gabung = `${tk.v}_${t2.v}`;
    if (gabung && (PERINTAH[gabung] || SYARAT.includes(gabung))) {
      return new GalatKode(tk.baris, `Robot belum kenal ${tk.asli}. Maksudmu ${gabung}()? Pakai garis bawah _ ya.`);
    }
    const saran = saranEjaan(tk.v);
    return new GalatKode(tk.baris, saran
      ? `Robot belum kenal ${tk.asli}. Maksudmu ${tampil(saran)}?`
      : `Robot belum kenal ${tk.asli}.`);
  }

  perintah() {
    const tk = this.ambil();
    this.cekTersedia(tk.v, tk.baris);
    const def = PERINTAH[tk.v];
    const buka = this.lihat();
    if (buka.t !== '(') {
      const contoh = def.arg && buka.t === 'angka' ? `${tk.v}(${buka.v})` : `${tk.v}()`;
      throw new GalatKode(tk.baris, `perintah ${tk.v} perlu tanda kurung, contoh: ${contoh}`);
    }
    this.i++;
    let arg = null;
    const isi = this.lihat();
    if (akhirBaris(isi)) throw new GalatKode(isi.baris, 'kurung tutup ) sepertinya hilang.');
    if (isi.t !== ')') {
      if (!def.arg) throw new GalatKode(isi.baris, `${tk.v}() tidak perlu isi di dalam kurung.`);
      arg = this.ekspresi('(');
    }
    this.harap(')', 'kurung tutup ) sepertinya hilang.');
    return { tipe: 'perintah', nama: tk.v, arg, baris: tk.baris };
  }

  // Blok { ... } — boleh ditulis di baris berikutnya
  blok(kata) {
    let j = this.i;
    while (this.token[j].t === 'baris_baru') j++;
    if (this.token[j].t === '{') this.i = j;
    const tk = this.lihat();
    if (tk.t !== '{') throw new GalatKode(tk.baris, `kurung kurawal buka { sepertinya hilang setelah ${kata}.`);
    this.i++;
    return this.daftarPernyataan(tk);
  }

  ulangi() {
    const tk = this.ambil();
    this.cekTersedia('ulangi', tk.baris);
    const sesudah = this.lihat();
    if (sesudah.t === '{' || akhirBaris(sesudah)) {
      throw new GalatKode(tk.baris, 'tulis berapa kali mengulang, contoh: ulangi 3 {');
    }
    const jumlah = this.ekspresi('ulangi');
    if (this.lihat().t === 'ident' && this.lihat().v === 'kali') this.i++; // "ulangi 3 kali {" juga boleh
    const isi = this.blok('ulangi');
    return { tipe: 'ulangi', jumlah, isi, baris: tk.baris };
  }

  syarat(kata) {
    let tk = this.lihat();
    let bukan = false;
    if (tk.t === 'ident' && tk.v === 'bukan') { this.i++; bukan = true; tk = this.lihat(); }
    if (tk.t !== 'ident') throw new GalatKode(tk.baris, `${kata} perlu syarat, contoh: ${kata} ada_rintangan() {`);
    if (!SYARAT.includes(tk.v)) {
      if (PERINTAH[tk.v]) throw new GalatKode(tk.baris, `${tk.v}() adalah perintah, bukan syarat. Coba ada_rintangan().`);
      const saran = saranEjaan(tk.v, SYARAT);
      throw new GalatKode(tk.baris, saran
        ? `Robot belum kenal syarat ${tk.asli}. Maksudmu ${saran}()?`
        : `Robot belum kenal syarat ${tk.asli}. Contoh syarat: ada_rintangan()`);
    }
    this.i++;
    this.cekTersedia(tk.v, tk.baris);
    if (this.lihat().t !== '(') throw new GalatKode(tk.baris, `syarat ${tk.v} perlu tanda kurung: ${tk.v}()`);
    this.i++;
    const isi = this.lihat();
    if (isi.t !== ')') {
      if (akhirBaris(isi) || isi.t === '{') throw new GalatKode(isi.baris, 'kurung tutup ) sepertinya hilang.');
      throw new GalatKode(isi.baris, `${tk.v}() tidak perlu isi di dalam kurung.`);
    }
    this.i++;
    return { nama: tk.v, bukan, baris: tk.baris };
  }

  jika() {
    const tk = this.ambil();
    this.cekTersedia('jika', tk.baris);
    const syarat = this.syarat('jika');
    const isi = this.blok('jika');
    let lainnya = null;
    // "lainnya" boleh di baris yang sama dengan } atau di baris berikutnya
    let j = this.i;
    while (this.token[j].t === 'baris_baru') j++;
    if (this.token[j].t === 'ident' && this.token[j].v === 'lainnya') {
      this.i = j + 1;
      lainnya = this.blok('lainnya');
    }
    return { tipe: 'jika', syarat, isi, lainnya, baris: tk.baris };
  }

  selama() {
    const tk = this.ambil();
    this.cekTersedia('selama', tk.baris);
    const syarat = this.syarat('selama');
    const isi = this.blok('selama');
    return { tipe: 'selama', syarat, isi, baris: tk.baris };
  }

  cekNamaVariabel(tk) {
    if (PERINTAH[tk.v] || SYARAT.includes(tk.v) || KATA_KUNCI.includes(tk.v)) {
      throw new GalatKode(tk.baris, `${tk.asli} sudah dipakai robot. Pilih nama lain, misalnya langkah.`);
    }
  }

  buat() {
    const tk = this.ambil();
    this.cekTersedia('buat', tk.baris);
    const nama = this.lihat();
    if (nama.t !== 'ident') throw new GalatKode(tk.baris, 'tulis nama variabel setelah buat, contoh: buat langkah = 3');
    this.cekNamaVariabel(nama);
    this.i++;
    this.harap('=', `tanda = sepertinya hilang, contoh: buat ${nama.asli} = 3`);
    const nilai = this.ekspresi('=');
    return { tipe: 'buat', nama: nama.v, nilai, baris: tk.baris };
  }

  atur() {
    const nama = this.ambil();
    this.cekTersedia('buat', nama.baris);
    this.cekNamaVariabel(nama);
    this.ambil(); // '='
    const nilai = this.ekspresi('=');
    return { tipe: 'atur', nama: nama.v, nilai, baris: nama.baris };
  }

  // ekspresi := suku (('+' | '-') suku)*
  ekspresi(setelah) {
    let kiri = this.suku(setelah);
    while (this.lihat().t === '+' || this.lihat().t === '-') {
      const op = this.ambil().t;
      const kanan = this.suku(op);
      kiri = { tipe: 'operasi', op, kiri, kanan };
    }
    return kiri;
  }

  suku(setelah) {
    const tk = this.lihat();
    if (tk.t === 'angka') { this.i++; return { tipe: 'angka', nilai: tk.v }; }
    if (tk.t === '-') {
      this.i++;
      return { tipe: 'operasi', op: '-', kiri: { tipe: 'angka', nilai: 0 }, kanan: this.suku('-') };
    }
    if (tk.t === '(') {
      this.i++;
      const e = this.ekspresi('(');
      this.harap(')', 'kurung tutup ) sepertinya hilang.');
      return e;
    }
    if (tk.t === 'ident') {
      if (PERINTAH[tk.v] || SYARAT.includes(tk.v) || KATA_KUNCI.includes(tk.v)) {
        throw new GalatKode(tk.baris, `${tk.asli} tidak bisa dipakai sebagai angka.`);
      }
      this.i++;
      return { tipe: 'var', nama: tk.v, baris: tk.baris };
    }
    throw new GalatKode(tk.baris, setelah
      ? `setelah ${setelah} harus ada angka atau variabel.`
      : 'di sini harus ada angka atau variabel.');
  }
}

/** Ubah kode menjadi AST. Melempar GalatKode jika ada salah tulis. */
export function urai(kode, perintahTersedia = null) {
  return new Parser(tokenisasi(kode), perintahTersedia).program();
}

/** Jumlah baris berisi perintah (tanpa baris kosong, komentar, atau baris yang hanya berisi }). */
export function hitungJumlahBaris(kode) {
  return String(kode).split('\n').filter((baris) => {
    const isi = baris.replace(/\/\/.*$/, '').trim();
    return isi !== '' && !/^[}\s]+$/.test(isi);
  }).length;
}

// =====================================================================
// 3. Evaluator
// =====================================================================
/** Robot berhenti (tabrak, jatuh, keluar, kelelahan, atau galat saat berjalan). */
class Henti {
  constructor(pesan, baris, jenis) {
    this.pesan = pesan;
    this.baris = baris;
    this.jenis = jenis;
  }
}

function siapkanDunia(d) {
  if (!d || !Number.isInteger(d.kolom) || !Number.isInteger(d.baris) || !d.robot) {
    throw new Error('Data dunia level tidak lengkap.');
  }
  return {
    kolom: d.kolom,
    baris: d.baris,
    robot: { x: d.robot.x, y: d.robot.y, arah: ARAH.includes(d.robot.arah) ? d.robot.arah : 'timur' },
    tujuan: d.tujuan ? { x: d.tujuan.x, y: d.tujuan.y } : null,
    item: (d.item || []).map((it) => ({ jenis: it.jenis || 'koin', x: it.x, y: it.y, wajib: it.wajib !== false, diambil: false })),
    rintangan: (d.rintangan || []).map((r) => ({ jenis: r.jenis || 'batu', x: r.x, y: r.y })),
    jurang: (d.jurang || []).map((j) => ({ x: j.x, y: j.y }))
  };
}

function evaluasi(ast, duniaAwal, maksLangkah) {
  const dunia = siapkanDunia(duniaAwal);
  const robot = dunia.robot;
  const jejak = [];
  const variabel = new Map();
  const tumpukanUlang = []; // baris perulangan yang sedang berjalan
  let jumlahLangkah = 0;
  let barisTerakhir = 1;

  const hitung = (baris) => {
    jumlahLangkah++;
    if (jumlahLangkah > maksLangkah) {
      const b = tumpukanUlang.length ? tumpukanUlang[tumpukanUlang.length - 1] : baris;
      throw new Henti(`Baris ${b}: ${PESAN_KELELAHAN}`, b, 'kelelahan');
    }
  };

  const petak = (x, y) => ({
    luar: x < 0 || y < 0 || x >= dunia.kolom || y >= dunia.baris,
    rintangan: dunia.rintangan.find((r) => r.x === x && r.y === y) || null,
    jurang: dunia.jurang.some((j) => j.x === x && j.y === y)
  });
  const depan = (jarak = 1) => {
    const [dx, dy] = GESER[robot.arah];
    return { x: robot.x + dx * jarak, y: robot.y + dy * jarak };
  };
  const itemDiSini = () => dunia.item.find((it) => !it.diambil && it.x === robot.x && it.y === robot.y) || null;

  const catat = (jenis, baris, tambahan = {}) => {
    jejak.push({ jenis, baris, x: robot.x, y: robot.y, arah: robot.arah, item: null, ...tambahan });
  };

  // Periksa petak tujuan gerak; berhenti jika keluar/tabrak/jatuh
  function pindahKe(tujuan, baris, jenisGerak) {
    const p = petak(tujuan.x, tujuan.y);
    if (p.luar) {
      catat('keluar', baris, { x: tujuan.x, y: tujuan.y });
      throw new Henti(`Baris ${baris}: Robot keluar dari peta!`, baris, 'keluar');
    }
    if (p.rintangan) {
      catat('tabrak', baris, { rintangan: p.rintangan.jenis });
      throw new Henti(`Baris ${baris}: Robot menabrak ${p.rintangan.jenis}!`, baris, 'tabrak');
    }
    robot.x = tujuan.x;
    robot.y = tujuan.y;
    if (p.jurang) {
      catat('jatuh', baris);
      throw new Henti(`Baris ${baris}: Robot jatuh ke jurang! Pakai lompat() untuk melewatinya.`, baris, 'jatuh');
    }
    catat(jenisGerak, baris);
  }

  function nilai(e) {
    if (e.tipe === 'angka') return e.nilai;
    if (e.tipe === 'var') {
      if (!variabel.has(e.nama)) {
        throw new Henti(`Baris ${e.baris}: variabel ${e.nama} belum dibuat. Tulis dulu: buat ${e.nama} = 0`, e.baris, 'galat');
      }
      return variabel.get(e.nama);
    }
    const a = nilai(e.kiri);
    const b = nilai(e.kanan);
    return e.op === '+' ? a + b : a - b;
  }

  function cekSyarat(s) {
    let hasil;
    switch (s.nama) {
      case 'ada_rintangan': {
        const d = depan();
        const p = petak(d.x, d.y);
        hasil = p.luar || !!p.rintangan;
        break;
      }
      case 'ada_jurang': {
        const d = depan();
        hasil = petak(d.x, d.y).jurang;
        break;
      }
      case 'ada_koin': hasil = !!itemDiSini(); break;
      case 'sampai_tujuan': hasil = !!dunia.tujuan && robot.x === dunia.tujuan.x && robot.y === dunia.tujuan.y; break;
      default: hasil = false;
    }
    return s.bukan ? !hasil : hasil;
  }

  function jalankanDaftar(isi) {
    for (const st of isi) jalankan(st);
  }

  function jalankan(st) {
    barisTerakhir = st.baris;
    hitung(st.baris);
    switch (st.tipe) {
      case 'perintah': return jalankanPerintah(st);
      case 'ulangi': {
        const n = nilai(st.jumlah);
        if (n < 0) throw new Henti(`Baris ${st.baris}: jumlah ulangi tidak boleh kurang dari 0.`, st.baris, 'galat');
        tumpukanUlang.push(st.baris);
        for (let k = 0; k < n; k++) {
          hitung(st.baris);
          jalankanDaftar(st.isi);
        }
        tumpukanUlang.pop();
        return undefined;
      }
      case 'jika':
        if (cekSyarat(st.syarat)) jalankanDaftar(st.isi);
        else if (st.lainnya) jalankanDaftar(st.lainnya);
        return undefined;
      case 'selama':
        tumpukanUlang.push(st.baris);
        while (cekSyarat(st.syarat)) {
          hitung(st.baris);
          jalankanDaftar(st.isi);
        }
        tumpukanUlang.pop();
        return undefined;
      case 'buat':
        variabel.set(st.nama, nilai(st.nilai));
        return undefined;
      case 'atur':
        if (!variabel.has(st.nama)) {
          throw new Henti(`Baris ${st.baris}: variabel ${st.nama} belum dibuat. Tulis dulu: buat ${st.nama} = 0`, st.baris, 'galat');
        }
        variabel.set(st.nama, nilai(st.nilai));
        return undefined;
      default:
        return undefined;
    }
  }

  function jalankanPerintah(st) {
    const b = st.baris;
    switch (st.nama) {
      case 'maju': {
        const n = st.arg ? nilai(st.arg) : 1;
        if (n < 0) throw new Henti(`Baris ${b}: angka di maju() tidak boleh kurang dari 0.`, b, 'galat');
        for (let k = 0; k < n; k++) {
          if (k > 0) hitung(b);
          pindahKe(depan(), b, 'gerak');
        }
        return;
      }
      case 'belok_kiri':
      case 'belok_kanan': {
        const geser = st.nama === 'belok_kiri' ? 3 : 1;
        robot.arah = ARAH[(ARAH.indexOf(robot.arah) + geser) % 4];
        catat('belok', b);
        return;
      }
      case 'ambil': {
        const it = itemDiSini();
        if (it) it.diambil = true;
        catat('ambil', b, { item: it ? { jenis: it.jenis, x: it.x, y: it.y, wajib: it.wajib } : null });
        return;
      }
      case 'lompat': {
        // Melompati tepat satu petak; petak yang dilompati tidak boleh berisi rintangan
        const tengah = depan(1);
        const pt = petak(tengah.x, tengah.y);
        if (pt.luar) {
          catat('keluar', b, { x: tengah.x, y: tengah.y });
          throw new Henti(`Baris ${b}: Robot keluar dari peta!`, b, 'keluar');
        }
        if (pt.rintangan) {
          catat('tabrak', b, { rintangan: pt.rintangan.jenis });
          throw new Henti(`Baris ${b}: Robot tidak bisa melompati ${pt.rintangan.jenis}!`, b, 'tabrak');
        }
        pindahKe(depan(2), b, 'lompat');
        return;
      }
      default:
        return;
    }
  }

  // ---------- Jalankan program ----------
  let berhasil = false;
  let alasan = '';
  let galat = null;
  try {
    jalankanDaftar(ast);
    const diTujuan = !!dunia.tujuan && robot.x === dunia.tujuan.x && robot.y === dunia.tujuan.y;
    const sisaWajib = dunia.item.filter((it) => it.wajib && !it.diambil).length;
    if (diTujuan && sisaWajib === 0) {
      berhasil = true;
      alasan = 'Hore! Robot sampai di tujuan.';
      catat('selesai', barisTerakhir);
    } else if (!diTujuan) {
      alasan = `Baris ${barisTerakhir}: kodenya sudah habis, tapi robot belum sampai di bendera.`;
      galat = { baris: barisTerakhir, pesan: alasan, jenis: 'belum_sampai' };
    } else {
      alasan = `Baris ${barisTerakhir}: robot sampai di bendera, tapi masih ada ${sisaWajib} barang yang belum diambil.`;
      galat = { baris: barisTerakhir, pesan: alasan, jenis: 'item_tertinggal' };
    }
  } catch (err) {
    if (!(err instanceof Henti)) throw err;
    alasan = err.pesan;
    galat = { baris: err.baris, pesan: err.pesan, jenis: err.jenis };
  }

  return {
    berhasil,
    alasan,
    galat,
    jejak,
    jumlahLangkah,
    posisiAkhir: { x: robot.x, y: robot.y, arah: robot.arah },
    itemDiambil: dunia.item.filter((it) => it.diambil).length
  };
}

/**
 * Jalankan kode siswa di atas dunia level.
 * opsi: { perintahTersedia: string[] | null, maksLangkah: number }
 * Hasil: { berhasil, alasan, galat, jejak, jumlahBaris, jumlahLangkah, posisiAkhir, itemDiambil }
 *   jumlahLangkah = banyaknya langkah eksekusi (perintah, putaran, dan gerak) yang dijalankan.
 */
export function jalankanKode(kode, dunia, opsi = {}) {
  const teks = String(kode ?? '');
  const jumlahBaris = hitungJumlahBaris(teks);
  let ast;
  try {
    ast = urai(teks, opsi.perintahTersedia || null);
  } catch (err) {
    if (!(err instanceof GalatKode)) throw err;
    return {
      berhasil: false,
      alasan: err.message,
      galat: { baris: err.baris, pesan: err.message, jenis: 'sintaks' },
      jejak: [],
      jumlahBaris,
      jumlahLangkah: 0,
      posisiAkhir: dunia?.robot ? { ...dunia.robot } : null,
      itemDiambil: 0
    };
  }
  const maks = opsi.maksLangkah ?? MAKS_LANGKAH;
  return { ...evaluasi(ast, dunia, maks), jumlahBaris };
}
