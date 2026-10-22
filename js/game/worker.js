// js/game/worker.js — Web Worker tempat kode siswa dijalankan
// Terpisah dari halaman, jadi perulangan tanpa akhir tidak membekukan layar.
// Pesan masuk : { kode, dunia, opsi }   Pesan keluar: { hasil }

import { jalankanKode } from './interpreter.js';

self.addEventListener('message', (e) => {
  const { kode, dunia, opsi } = e.data || {};
  let hasil;
  try {
    hasil = jalankanKode(String(kode ?? ''), dunia, opsi || {});
  } catch (err) {
    // Kesalahan sistem (bukan kesalahan siswa)
    hasil = {
      berhasil: false,
      alasan: 'Robot sedang bermasalah. Coba lagi ya.',
      galat: { baris: null, pesan: String(err?.message || err), jenis: 'sistem' },
      jejak: [],
      jumlahBaris: 0,
      jumlahLangkah: 0,
      posisiAkhir: null,
      itemDiambil: 0
    };
  }
  self.postMessage({ hasil });
});
