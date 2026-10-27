// js/game/kemajuan.js — aturan buka-kunci zona dan level (fungsi murni, tanpa akses data)
// Zona pertama selalu terbuka (kecuali dinonaktifkan). Zona berikutnya terbuka setelah boss zona sebelumnya selesai
// (cukup salah satu boss, agar boss tambahan buatan guru tidak mengunci pulau yang sudah terbuka).
// Level terbuka jika level sebelumnya (dalam zona yang sama) selesai. Jika boss zona sudah
// selesai, semua level di zona itu terbuka — termasuk level baru yang disisipkan guru.
// Zona yang dinonaktifkan guru tetap dihitung pada urutannya, tetapi tidak pernah terbuka dan tidak
// pernah lulus (juga bila ia zona pertama). Akibatnya zona sesudahnya ikut terkunci sampai zona itu
// dinyalakan lagi. Menyembunyikannya dari murid adalah tugas js/pages/peta.js, bukan fungsi ini.

import { ZONA } from '../data/zona.js';

/** Zona yang aktif (urutan tetap seperti ZONA). */
export const zonaAktif = (zonaNonaktif = []) => ZONA.filter((z) => !zonaNonaktif.includes(z.id));

/** Zona aktif terakhir: boss-nya menjadikan murid Juara Coding Island. */
export const zonaTerakhir = (zonaNonaktif = []) => {
  const aktif = zonaAktif(zonaNonaktif);
  return aktif[aktif.length - 1] || null;
};

/**
 * Zona yang masih mungkin terbuka bagi murid: zona aktif sebelum zona nonaktif pertama.
 * Kosong = tidak ada satu pun pulau yang bisa dimainkan.
 */
export function zonaTerjangkau(zonaNonaktif = []) {
  const i = ZONA.findIndex((z) => zonaNonaktif.includes(z.id));
  return i < 0 ? [...ZONA] : ZONA.slice(0, i);
}

const PESAN_DITUTUP_GURU = 'Pulau ini belum dibuka gurumu';

/**
 * Hitung status seluruh peta.
 * levels : daftar level yang terbit untuk siswa
 * progres: daftar progres siswa
 * zonaNonaktif: id zona yang dinonaktifkan guru (tetap ada di hasil dengan aktif = false)
 * Hasil  : array per zona { zona, aktif, ditutupGuru, terbuka, lulus, tuntas, levels[], selesai, total, bintang, bintangMaks, syarat }
 *          ditutupGuru = zona ini atau zona sebelumnya nonaktif, jadi murid tidak bisa membukanya sendiri
 *          tiap level mendapat { nomor, status: 'terkunci'|'terbuka'|'selesai', bintang, nilai }
 *          zona.nomor = nomor pulau di antara zona aktif (null untuk zona nonaktif)
 */
export function hitungPeta(levels, progres, zonaNonaktif = []) {
  const petaProgres = new Map(progres.map((p) => [p.levelId, p]));
  let bossSebelumSelesai = true;
  let zonaSebelum = null;
  let ditutupGuru = false;
  let nomorPulau = 0;

  return ZONA.map((zonaAsli, i) => {
    const aktif = !zonaNonaktif.includes(zonaAsli.id);
    if (!aktif) ditutupGuru = true;
    const zona = { ...zonaAsli, nomor: aktif ? ++nomorPulau : null };
    const terbuka = aktif && (i === 0 || bossSebelumSelesai);
    const urut = levels.filter((l) => l.zona === zona.id).sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0));
    const bossLulus = urut.some((l) => l.jenis === 'boss' && petaProgres.get(l.id)?.selesai);

    let sebelumnyaSelesai = true;
    const daftar = urut.map((l, j) => {
      const p = petaProgres.get(l.id);
      const selesai = !!p?.selesai;
      let status = 'terkunci';
      if (terbuka) status = selesai ? 'selesai' : (sebelumnyaSelesai || bossLulus) ? 'terbuka' : 'terkunci';
      sebelumnyaSelesai = selesai;
      return { ...l, nomor: j + 1, status, bintang: p?.bintang || 0, nilai: p?.nilai || 0 };
    });

    const jumlahSelesai = daftar.filter((l) => l.status === 'selesai').length;
    const boss = daftar.filter((l) => l.jenis === 'boss');
    // Lulus jika salah satu boss selesai; tanpa boss, lulus jika semua level selesai.
    // Zona nonaktif tidak pernah terbuka, jadi tidak pernah lulus: zona sesudahnya ikut terkunci.
    const lulus = terbuka && daftar.length > 0 &&
      (boss.length ? boss.some((l) => l.status === 'selesai') : jumlahSelesai === daftar.length);

    const hasil = {
      zona,
      aktif,
      ditutupGuru,
      terbuka,
      lulus,
      tuntas: terbuka && daftar.length > 0 && jumlahSelesai === daftar.length,
      levels: daftar,
      selesai: jumlahSelesai,
      total: daftar.length,
      bintang: daftar.reduce((n, l) => n + (l.status === 'selesai' ? l.bintang : 0), 0),
      bintangMaks: daftar.length * 3,
      // Zona nonaktif tidak terlihat murid, jadi jangan menyuruh murid menyelesaikan boss-nya
      syarat: ditutupGuru ? PESAN_DITUTUP_GURU : zonaSebelum ? `Selesaikan boss ${zonaSebelum.nama} dulu` : ''
    };

    bossSebelumSelesai = lulus;
    zonaSebelum = zona;
    return hasil;
  });
}

/** Level tempat Robot Tutor berdiri: level terbuka terakhir, atau level terakhir jika semua selesai. */
export function levelAktif(statusZona) {
  const terbuka = statusZona.levels.filter((l) => l.status === 'terbuka');
  if (terbuka.length) return terbuka[terbuka.length - 1];
  return statusZona.levels[statusZona.levels.length - 1] || null;
}
