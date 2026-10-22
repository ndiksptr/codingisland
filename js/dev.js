// js/dev.js — alat bantu pengembang lewat console browser
// Contoh: ciDev.selesaikanLevel('pantai-1', 3)  |  ciDev.resetProgres()
// Hanya aktif di localhost / 127.0.0.1 agar siswa tidak bisa curang di situs asli.

import { sesiAktif, getLevel, getProgres, simpanProgres, hapusProgres, aturZonaTerlihat } from './store.js';
import { muatUlang } from './router.js';
import { ZONA } from './data/zona.js';

const NILAI_BINTANG = { 1: 60, 2: 80, 3: 100 };

async function siswaAktif() {
  const sesi = await sesiAktif();
  if (sesi?.jenis !== 'siswa') throw new Error('Masuk sebagai siswa dulu, lalu coba lagi.');
  return sesi.pengguna;
}

// Jalankan perintah dan tampilkan pesan yang mudah dibaca
async function jalankan(perintah) {
  try {
    const hasil = await perintah();
    muatUlang();
    return hasil;
  } catch (err) {
    console.warn(`[ciDev] ${err.message}`);
    return false;
  }
}

export function pasangCiDev() {
  const lokal = ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);
  if (!lokal) return;

  window.ciDev = {
    /** Tandai level selesai untuk siswa yang sedang masuk. bintang: 1–3 */
    selesaikanLevel(id, bintang = 3) {
      return jalankan(async () => {
        const siswa = await siswaAktif();
        if (!(await getLevel(id))) throw new Error(`Level "${id}" tidak ada.`);
        const b = Math.min(3, Math.max(1, Math.round(Number(bintang) || 3)));
        const lama = await getProgres(siswa.id, id);
        await simpanProgres(siswa.id, id, {
          selesai: true,
          bintang: b,
          nilai: NILAI_BINTANG[b],
          percobaan: (lama?.percobaan || 0) + 1
        });
        console.info(`[ciDev] ${id} selesai dengan ${b} bintang.`);
        return true;
      });
    },

    /** Hapus semua progres siswa yang sedang masuk (koin tidak berubah). */
    resetProgres() {
      return jalankan(async () => {
        const siswa = await siswaAktif();
        await hapusProgres(siswa.id);
        await aturZonaTerlihat(siswa.id, [ZONA[0].id]);
        console.info('[ciDev] Progres dihapus. Semua pulau kecuali Pantai terkunci lagi.');
        return true;
      });
    },

    bantuan() {
      console.info([
        'ciDev.selesaikanLevel(id, bintang)  contoh: ciDev.selesaikanLevel("pantai-4", 3)',
        'ciDev.resetProgres()                hapus progres siswa yang sedang masuk'
      ].join('\n'));
    }
  };
  console.info('[ciDev] Alat pengembang siap. Ketik ciDev.bantuan() untuk melihat perintah.');
}
