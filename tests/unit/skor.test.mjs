// tests/unit/skor.test.mjs — bintang (clue & batasBaris), nilai 70/85/100, koin, Nilai Akhir 1–100, CSV nilai

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hitungBintang, bintangMaksimal, hitungKoin, hitungNilaiAkhir, NILAI_BINTANG } from '../../js/game/skor.js';
import { buatCSV, csvNilai, labelLevelNilai } from '../../js/guru/csv.js';

test('bintang: gagal = 0', () => {
  assert.equal(hitungBintang({ berhasil: false, clueDibeli: 0, jumlahBaris: 1, batasBaris: 5 }), 0);
});

test('bintang: tanpa clue & dalam batasBaris = 3', () => {
  assert.equal(hitungBintang({ berhasil: true, clueDibeli: 0, jumlahBaris: 5, batasBaris: 5 }), 3);
});

test('bintang: Clue 1 masih boleh 3', () => {
  assert.equal(hitungBintang({ berhasil: true, clueDibeli: 1, jumlahBaris: 3, batasBaris: 5 }), 3);
});

test('bintang: Clue 2 paling banyak 2', () => {
  assert.equal(hitungBintang({ berhasil: true, clueDibeli: 2, jumlahBaris: 3, batasBaris: 5 }), 2);
  assert.equal(bintangMaksimal(2), 2);
});

test('bintang: Clue 3 paling banyak 1 walau kodenya pendek', () => {
  assert.equal(hitungBintang({ berhasil: true, clueDibeli: 3, jumlahBaris: 1, batasBaris: 5 }), 1);
  assert.equal(bintangMaksimal(3), 1);
});

test('bintang: melebihi batasBaris kehilangan satu bintang', () => {
  assert.equal(hitungBintang({ berhasil: true, clueDibeli: 0, jumlahBaris: 6, batasBaris: 5 }), 2);
  assert.equal(hitungBintang({ berhasil: true, clueDibeli: 2, jumlahBaris: 6, batasBaris: 5 }), 1);
});

test('bintang: tanpa batasBaris dihitung dalam batas', () => {
  assert.equal(hitungBintang({ berhasil: true, clueDibeli: 0, jumlahBaris: 99, batasBaris: null }), 3);
});

test('nilai level: 1 bintang 70, 2 bintang 85, 3 bintang 100', () => {
  assert.deepEqual([NILAI_BINTANG[1], NILAI_BINTANG[2], NILAI_BINTANG[3]], [70, 85, 100]);
  assert.equal(NILAI_BINTANG[0], 0);
});

test('koin: selesai pertama +10, tiap bintang baru +5, mengulang tanpa bintang baru 0', () => {
  assert.equal(hitungKoin({ pertamaKali: true, bintangLama: 0, bintangBaru: 3 }), 25);
  assert.equal(hitungKoin({ pertamaKali: false, bintangLama: 2, bintangBaru: 3 }), 5);
  assert.equal(hitungKoin({ pertamaKali: false, bintangLama: 3, bintangBaru: 3 }), 0);
  assert.equal(hitungKoin({ pertamaKali: false, bintangLama: 3, bintangBaru: 1 }), 0);
});

test('Nilai Akhir: rata-rata semua level terbit, belum selesai dihitung 0', () => {
  // 13 level, 2 selesai (100 + 85) -> 185/13 = 14,2 -> 14
  assert.equal(hitungNilaiAkhir([100, 85], 13), 14);
  assert.equal(hitungNilaiAkhir(Array(13).fill(100), 13), 100);
  assert.equal(hitungNilaiAkhir([70, 85], 2), 78); // 77,5 dibulatkan ke atas
});

test('Nilai Akhir: minimal 1, maksimal 100', () => {
  assert.equal(hitungNilaiAkhir([], 13), 1);
  assert.equal(hitungNilaiAkhir([0, 0], 13), 1);
  assert.equal(hitungNilaiAkhir([], 0), 1);
  assert.equal(hitungNilaiAkhir([100, 100, 100], 2), 100);
});

test('CSV: nilai berisi koma atau kutip diberi tanda kutip', () => {
  const t = buatCSV(['a', 'b'], [{ a: 'x, y', b: 'kata "kutip"' }]);
  assert.equal(t, 'a,b\r\n"x, y","kata ""kutip"""');
});

test('CSV nilai: kolom Nama lengkap, Kelas, satu kolom per level, Nilai akhir, Ditimpa, Alasan', () => {
  const data = {
    kelas: { nama: 'Kelas Uji 3' },
    levels: [{ id: 'pantai-1', zona: 'pantai', judul: 'Langkah Pertama' }, { id: 'laut-1', zona: 'laut', judul: 'Berenang Jauh' }],
    siswa: [{
      namaLengkap: 'Andi Uji', nilaiAkhir: 88, timpa: { alasan: 'Tugas tambahan' },
      sel: { 'pantai-1': { nilai: 100 }, 'laut-1': { nilai: 0 } }
    }]
  };
  assert.deepEqual(labelLevelNilai(data.levels), ['P1', 'L1']);
  const [kepala, baris] = csvNilai(data).split('\r\n');
  assert.equal(kepala, 'Nama lengkap,Kelas,P1 Langkah Pertama,L1 Berenang Jauh,Nilai akhir,Ditimpa,Alasan');
  assert.equal(baris, 'Andi Uji,Kelas Uji 3,100,0,88,Ya,Tugas tambahan');
});
