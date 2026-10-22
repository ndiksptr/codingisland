// js/game/kemajuan.js — aturan buka-kunci zona dan level (fungsi murni, tanpa akses data)
// Zona pertama selalu terbuka. Zona berikutnya terbuka setelah semua level boss
// zona sebelumnya selesai. Level terbuka jika level sebelumnya (dalam zona yang sama) selesai.

import { ZONA } from '../data/zona.js';

/**
 * Hitung status seluruh peta.
 * levels : daftar level yang terbit untuk siswa
 * progres: daftar progres siswa
 * Hasil  : array per zona { zona, terbuka, tuntas, levels[], selesai, total, bintang, bintangMaks, syarat }
 *          tiap level mendapat { nomor, status: 'terkunci'|'terbuka'|'selesai', bintang, nilai }
 */
export function hitungPeta(levels, progres) {
  const petaProgres = new Map(progres.map((p) => [p.levelId, p]));
  let bossSebelumSelesai = true;
  let zonaSebelum = null;

  return ZONA.map((zona, i) => {
    const terbuka = i === 0 || bossSebelumSelesai;
    const urut = levels.filter((l) => l.zona === zona.id).sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0));

    let sebelumnyaSelesai = true;
    const daftar = urut.map((l, j) => {
      const p = petaProgres.get(l.id);
      const selesai = !!p?.selesai;
      let status = 'terkunci';
      if (terbuka) status = selesai ? 'selesai' : sebelumnyaSelesai ? 'terbuka' : 'terkunci';
      sebelumnyaSelesai = selesai;
      return { ...l, nomor: j + 1, status, bintang: p?.bintang || 0, nilai: p?.nilai || 0 };
    });

    const jumlahSelesai = daftar.filter((l) => l.status === 'selesai').length;
    const boss = daftar.filter((l) => l.jenis === 'boss');
    // Tanpa level boss, zona dianggap lulus jika semua levelnya selesai
    const lulus = terbuka && daftar.length > 0 &&
      (boss.length ? boss.every((l) => l.status === 'selesai') : jumlahSelesai === daftar.length);

    const hasil = {
      zona,
      terbuka,
      lulus,
      tuntas: terbuka && daftar.length > 0 && jumlahSelesai === daftar.length,
      levels: daftar,
      selesai: jumlahSelesai,
      total: daftar.length,
      bintang: daftar.reduce((n, l) => n + (l.status === 'selesai' ? l.bintang : 0), 0),
      bintangMaks: daftar.length * 3,
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
