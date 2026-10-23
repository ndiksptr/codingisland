// server/statistik.js — statistik per siswa untuk dashboard guru
// Nilai siswa = rata-rata nilai level yang sudah selesai.
// Terakhir aktif = waktu terbaru dari aktivitas, progres, atau tanggal daftar.

import { semua, semuaKelas, semuaLevel, siswaKeObjek, progresKeObjek, levelTerlihatUntukKelas } from './data.js';

export const rataRata = (angka) => (angka.length ? Math.round(angka.reduce((n, x) => n + x, 0) / angka.length) : 0);

/** Siswa yang boleh dilihat guru (admin juga melihat siswa tanpa kelas). Hasil: baris D1. */
export async function siswaDalamAkses(db, a, kelasId = null) {
  const baris = await semua(db, 'SELECT * FROM siswa');
  return baris.filter((s) => (kelasId ? s.kelas_id === kelasId : (a.admin || a.kelasIds.has(s.kelas_id))));
}

/**
 * Hasil per siswa: { siswa (objek), levels, progres, baris (ringkasan untuk tabel) }
 * Data dimuat sekali lalu diolah di memori (cukup untuk skala satu sekolah).
 */
export async function hitungStatistik(db, daftarSiswa, cache = {}) {
  if (!daftarSiswa.length) return [];
  const [levels, kelas, progresSemua, terakhirAktivitas] = await Promise.all([
    cache.levels || semuaLevel(db),
    cache.kelas || semuaKelas(db),
    semua(db, 'SELECT * FROM progres'),
    semua(db, 'SELECT siswa_id, MAX(waktu) AS waktu FROM aktivitas GROUP BY siswa_id')
  ]);
  const terakhir = new Map(terakhirAktivitas.map((r) => [r.siswa_id, r.waktu]));
  const progresPerSiswa = new Map();
  for (const r of progresSemua) {
    if (!progresPerSiswa.has(r.siswa_id)) progresPerSiswa.set(r.siswa_id, []);
    progresPerSiswa.get(r.siswa_id).push(progresKeObjek(r));
  }

  return daftarSiswa.map((baris) => {
    const s = siswaKeObjek(baris);
    const lv = levels.filter((l) => levelTerlihatUntukKelas(l, s.kelasId));
    const ids = new Set(lv.map((l) => l.id));
    const pr = (progresPerSiswa.get(s.id) || []).filter((p) => ids.has(p.levelId));
    const selesai = pr.filter((p) => p.selesai);
    const waktu = [terakhir.get(s.id), s.dibuatPada, ...pr.map((p) => p.diperbarui)].filter(Boolean).sort();
    return {
      siswa: s,
      levels: lv,
      progres: pr,
      baris: {
        id: s.id,
        namaLengkap: s.namaLengkap,
        namaPanggilan: s.namaPanggilan,
        avatar: s.avatar,
        jenisKelamin: s.jenisKelamin,
        kelasId: s.kelasId,
        kelasNama: kelas.find((k) => k.id === s.kelasId)?.nama || 'Tanpa kelas',
        username: s.username,
        koin: s.koin || 0,
        berlian: s.berlian || 0,
        levelSelesai: selesai.length,
        totalLevel: lv.length,
        totalBintang: selesai.reduce((n, p) => n + (p.bintang || 0), 0),
        nilai: selesai.length ? Math.round(selesai.reduce((n, p) => n + (p.nilai || 0), 0) / selesai.length) : 0,
        terakhirAktif: waktu[waktu.length - 1] || null,
        dibuatPada: s.dibuatPada
      }
    };
  });
}
