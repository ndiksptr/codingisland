// server/statistik.js — statistik per murid untuk dashboard guru
// Satu murid boleh anggota banyak kelas, dan kemajuannya terpisah per kelas. Jadi statistik dihitung
// per KEANGGOTAAN (murid x kelas): soal, pulau, dan progres yang dipakai hanya milik kelas itu,
// sama seperti halaman Nilai. Koin dan berlian tetap satu dompet per murid.
// Nilai murid = rata-rata nilai level yang sudah selesai.
// Terakhir aktif = waktu terbaru dari aktivitas murid, progres di kelas itu, atau tanggal daftar.

import { semua, semuaKelas, semuaLevel, siswaKeObjek, progresKeObjek, levelBerlaku, petaKelasSiswa } from './data.js';

export const rataRata = (angka) => (angka.length ? Math.round(angka.reduce((n, x) => n + x, 0) / angka.length) : 0);

/**
 * Semua kelas yang diikuti satu murid, KHUSUS UNTUK TAMPILAN: tanpa saringan hak akses dan tanpa filter
 * kelas, jadi guru ekskul tetap melihat bahwa muridnya juga anggota kelas reguler (tetapi tidak bisa
 * mengelolanya). kelasLengkap: SEMUA kelas sekolah, sudah urut (ekskul dulu, lalu reguler menurut tingkat).
 * anggota: hasil petaKelasSiswa. Hasil: [{ id, nama, jenis }] — kosong bila murid belum punya kelas.
 */
export function kelasDiikuti(kelasLengkap, anggota, siswaId) {
  const ids = new Set(anggota.get(siswaId) || []);
  return kelasLengkap.filter((k) => ids.has(k.id)).map((k) => ({ id: k.id, nama: k.nama, jenis: k.jenis }));
}

/**
 * Keanggotaan yang boleh dilihat guru. Hasil: [{ baris (baris siswa D1), kelasId }].
 * kelasId diisi: hanya kelas itu. Tanpa kelasId: semua kelas yang diampu (admin: semua kelas,
 * ditambah murid yang belum punya kelas dengan kelasId null).
 */
export async function keanggotaanDalamAkses(db, a, kelasId = null) {
  const [baris, anggota] = await Promise.all([semua(db, 'SELECT * FROM siswa'), petaKelasSiswa(db)]);
  const hasil = [];
  for (const s of baris) {
    const kelasIds = anggota.get(s.id) || [];
    for (const k of kelasIds) {
      if (kelasId ? k === kelasId : (a.admin || a.kelasIds.has(k))) hasil.push({ baris: s, kelasId: k });
    }
    if (!kelasId && a.admin && !kelasIds.length) hasil.push({ baris: s, kelasId: null });
  }
  return hasil;
}

/**
 * Hasil per keanggotaan: { siswa (objek), kelasId, levels, progres, baris (ringkasan untuk tabel) }
 * Data dimuat sekali lalu diolah di memori (cukup untuk skala satu sekolah).
 */
export async function hitungStatistik(db, keanggotaan, cache = {}) {
  if (!keanggotaan.length) return [];
  // cache.kelas boleh berisi kelas yang diampu saja; daftar kelas tampilan (semuaKelas) selalu dari daftar lengkap
  const muatKelasLengkap = semuaKelas(db);
  const [levels, kelas, kelasLengkap, progresSemua, terakhirAktivitas, anggota] = await Promise.all([
    cache.levels || semuaLevel(db),
    cache.kelas || muatKelasLengkap,
    muatKelasLengkap,
    semua(db, 'SELECT * FROM progres'),
    // Ganti PIN, nilai, kelas, dan zona dilakukan guru, bukan murid, jadi tidak dihitung sebagai "terakhir aktif"
    semua(db, "SELECT siswa_id, MAX(waktu) AS waktu FROM aktivitas WHERE jenis NOT IN ('pin', 'nilai', 'zona', 'kelas') GROUP BY siswa_id"),
    petaKelasSiswa(db)
  ]);
  const terakhir = new Map(terakhirAktivitas.map((r) => [r.siswa_id, r.waktu]));
  const progresPer = new Map(); // "siswaId|kelasId" -> [progres]
  for (const r of progresSemua) {
    const kunci = `${r.siswa_id}|${r.kelas_id}`;
    if (!progresPer.has(kunci)) progresPer.set(kunci, []);
    progresPer.get(kunci).push(progresKeObjek(r));
  }
  const kelasDari = (id) => kelas.find((k) => k.id === id) || null;

  return keanggotaan.map(({ baris: r, kelasId }) => {
    const s = siswaKeObjek(r);
    const k = kelasDari(kelasId);
    // Soal kelas ini, hanya dari pulau yang dipakai kelas ini
    const lv = k ? levels.filter((l) => levelBerlaku(l, k.id, k.zonaIds)) : [];
    const ids = new Set(lv.map((l) => l.id));
    const pr = k ? (progresPer.get(`${s.id}|${k.id}`) || []).filter((p) => ids.has(p.levelId)) : [];
    const selesai = pr.filter((p) => p.selesai);
    const waktu = [terakhir.get(s.id), s.dibuatPada, ...pr.map((p) => p.diperbarui)].filter(Boolean).sort();
    return {
      siswa: s,
      kelasId: k?.id || null,
      levels: lv,
      progres: pr,
      baris: {
        id: s.id,
        namaLengkap: s.namaLengkap,
        namaPanggilan: s.namaPanggilan,
        avatar: s.avatar,
        jenisKelamin: s.jenisKelamin,
        // Kelas baris statistik ini (dibatasi akses & filter). Untuk TAMPILAN kelas murid pakai semuaKelas.
        kelasId: k?.id || null,
        kelasNama: k?.nama || 'Tanpa kelas',
        semuaKelas: kelasDiikuti(kelasLengkap, anggota, s.id), // semua kelas yang diikuti murid, tanpa saringan
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

/**
 * Satu baris per murid dari statistik per keanggotaan (tabel Siswa tanpa filter kelas, log aktivitas).
 * Angka dijumlahkan dari semua kelas yang tercakup; nilai = rata-rata nilai semua level selesai di kelas-kelas itu.
 * Bila hanya satu kelas yang tercakup (filter kelas aktif), angkanya sama persis dengan baris kelas itu.
 */
export function gabungPerSiswa(stat) {
  const peta = new Map();
  for (const x of stat) {
    const ada = peta.get(x.siswa.id);
    if (!ada) {
      peta.set(x.siswa.id, { ...x.baris, _nilaiSelesai: x.progres.filter((p) => p.selesai).map((p) => p.nilai || 0) });
      continue;
    }
    ada.levelSelesai += x.baris.levelSelesai;
    ada.totalLevel += x.baris.totalLevel;
    ada.totalBintang += x.baris.totalBintang;
    ada._nilaiSelesai.push(...x.progres.filter((p) => p.selesai).map((p) => p.nilai || 0));
    if (String(x.baris.terakhirAktif || '') > String(ada.terakhirAktif || '')) ada.terakhirAktif = x.baris.terakhirAktif;
    ada.kelasNama = `${ada.kelasNama}, ${x.baris.kelasNama}`;
  }
  return [...peta.values()].map(({ _nilaiSelesai, ...b }) => ({ ...b, nilai: rataRata(_nilaiSelesai) }));
}
