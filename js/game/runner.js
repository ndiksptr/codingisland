// js/game/runner.js — pembungkus Web Worker di thread utama
// Setiap kali dijalankan dibuat worker baru, lalu dihentikan setelah selesai.
// Jika worker tidak menjawab dalam 2 detik, worker dimatikan paksa.

import { hitungJumlahBaris, PESAN_KELELAHAN, MAKS_LANGKAH } from './interpreter.js';

export const BATAS_WAKTU_MS = 2000;

function hasilGagal(kode, pesan, jenis) {
  return {
    berhasil: false,
    alasan: pesan,
    galat: { baris: null, pesan, jenis },
    jejak: [],
    jumlahBaris: hitungJumlahBaris(kode),
    jumlahLangkah: 0,
    posisiAkhir: null,
    itemDiambil: 0
  };
}

/**
 * Jalankan kode siswa di Web Worker.
 * opsi: { perintahTersedia, maksLangkah, batasWaktuMs }
 * Selalu resolve (tidak pernah reject) dengan objek hasil interpreter.
 */
export function jalankanKodeSiswa(kode, dunia, opsi = {}) {
  const teks = String(kode ?? '');
  return new Promise((resolve) => {
    let worker;
    try {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    } catch {
      resolve(hasilGagal(teks, 'Robot belum bisa dijalankan di browser ini. Coba browser lain ya.', 'sistem'));
      return;
    }

    let beres = false;
    const selesai = (hasil) => {
      if (beres) return;
      beres = true;
      clearTimeout(timer);
      worker.terminate();
      resolve(hasil);
    };

    // Pengaman: hentikan worker yang terlalu lama
    const timer = setTimeout(
      () => selesai(hasilGagal(teks, PESAN_KELELAHAN, 'kelelahan')),
      opsi.batasWaktuMs ?? BATAS_WAKTU_MS
    );

    worker.addEventListener('message', (e) => selesai(e.data?.hasil));
    worker.addEventListener('error', (e) => {
      e.preventDefault?.();
      selesai(hasilGagal(teks, 'Robot sedang bermasalah. Coba muat ulang halaman ya.', 'sistem'));
    });

    worker.postMessage({
      kode: teks,
      dunia: JSON.parse(JSON.stringify(dunia)), // pastikan data polos
      opsi: {
        perintahTersedia: opsi.perintahTersedia ?? null,
        maksLangkah: opsi.maksLangkah ?? MAKS_LANGKAH
      }
    });
  });
}
