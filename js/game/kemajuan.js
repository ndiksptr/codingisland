// js/game/kemajuan.js — aturan buka-kunci pulau dan level (fungsi murni, tanpa akses data)
// Urutan pulau = daftar milik kelas aktif (kelas.zonaIds), BUKAN urutan tetap ZONA.
// Pulau yang tidak dicentang guru tidak ada di daftar itu, dan pulau yang dicentang tetapi belum berisi
// satu soal pun dilewati begitu saja (disembunyikan otomatis), jadi keduanya tidak pernah menghalangi
// pulau sesudahnya. Pulau pertama yang bisa dimainkan selalu terbuka; pulau berikutnya terbuka setelah
// boss pulau sebelumnya selesai (cukup salah satu boss, agar boss tambahan buatan guru tidak mengunci
// pulau yang sudah terbuka). Level terbuka jika level sebelumnya (dalam pulau yang sama) selesai.
// Jika boss pulau sudah selesai, semua level di pulau itu terbuka — termasuk level baru yang disisipkan guru.

import { cariZona } from '../data/zona.js';

/** Definisi pulau (js/data/zona.js) menurut daftar id milik kelas, dalam urutan kelas itu. */
export const zonaDariIds = (zonaIds = []) => zonaIds.map(cariZona).filter(Boolean);

/** Pulau yang bisa dimainkan: dipakai kelas DAN berisi minimal satu level dari `levels`. */
export const zonaDimainkan = (zonaIds = [], levels = []) => zonaDariIds(zonaIds).filter((z) => levels.some((l) => l.zona === z.id));

/** Pulau terakhir yang bisa dimainkan: boss-nya menjadikan murid Juara Coding Island. */
export const zonaTerakhir = (zonaIds = [], levels = []) => {
  const daftar = zonaDimainkan(zonaIds, levels);
  return daftar[daftar.length - 1] || null;
};

/**
 * Hitung status seluruh peta untuk satu kelas.
 * levels : level yang berlaku untuk kelas itu (sudah disaring server)
 * progres: progres murid DI KELAS ITU
 * zonaIds: pulau milik kelas, urutan main
 * Hasil  : array per pulau yang bisa dimainkan { zona, terbuka, lulus, tuntas, levels[], selesai, total, bintang, bintangMaks, syarat }
 *          zona.nomor = posisi pulau di daftar kelas (pulau kosong tidak dihitung)
 *          tiap level mendapat { nomor, status: 'terkunci'|'terbuka'|'selesai', bintang, nilai }
 */
export function hitungPeta(levels, progres, zonaIds = []) {
  const petaProgres = new Map(progres.map((p) => [p.levelId, p]));
  let bossSebelumSelesai = true;
  let zonaSebelum = null;

  return zonaDimainkan(zonaIds, levels).map((zonaAsli, i) => {
    const zona = { ...zonaAsli, nomor: i + 1 };
    const terbuka = bossSebelumSelesai; // pulau pertama di daftar kelas: belum ada pulau sebelumnya
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
    // Lulus jika salah satu boss selesai; tanpa boss, lulus jika semua level selesai
    const lulus = terbuka && (boss.length ? boss.some((l) => l.status === 'selesai') : jumlahSelesai === daftar.length);

    const hasil = {
      zona,
      terbuka,
      lulus,
      tuntas: terbuka && jumlahSelesai === daftar.length,
      levels: daftar,
      selesai: jumlahSelesai,
      total: daftar.length,
      bintang: daftar.reduce((n, l) => n + (l.status === 'selesai' ? l.bintang : 0), 0),
      bintangMaks: daftar.length * 3,
      // Pulau sebelumnya menurut daftar kelas ini
      syarat: zonaSebelum ? `Selesaikan boss ${zonaSebelum.nama} dulu` : ''
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
