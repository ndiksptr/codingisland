// js/guru/csv.js — pembuat CSV dashboard guru (fungsi murni, tanpa DOM, bisa diuji di Node)

/** Ubah daftar objek menjadi teks CSV. kolom: urutan kunci; nilai berisi koma/kutip/baris baru diberi kutip. */
export function buatCSV(kolom, data) {
  const sel = (v) => {
    const t = String(v ?? '');
    return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [kolom.join(','), ...data.map((d) => kolom.map((k) => sel(d[k])).join(','))].join('\r\n');
}

const LABEL_SINGKAT = { pantai: 'P', laut: 'L', gurun: 'G', salju: 'S' };

/** Label pendek level per zona: P1, P2, L1, ... (urutan sesuai daftar levels). */
export function labelLevelNilai(levels) {
  const nomorDiZona = {};
  return levels.map((l) => {
    nomorDiZona[l.zona] = (nomorDiZona[l.zona] || 0) + 1;
    return `${LABEL_SINGKAT[l.zona] || l.zona[0].toUpperCase()}${nomorDiZona[l.zona]}`;
  });
}

/**
 * Tabel CSV nilai satu kelas dari hasil API GET /api/nilai/:kelasId.
 * Kolom: Nama lengkap, Kelas, satu kolom per level ("P1 Judul"), Nilai akhir, Ditimpa, Alasan.
 */
export function csvNilai(data) {
  const labelLevel = labelLevelNilai(data.levels);
  const kolomLevel = data.levels.map((l, i) => `${labelLevel[i]} ${l.judul}`);
  const kolom = ['Nama lengkap', 'Kelas', ...kolomLevel, 'Nilai akhir', 'Ditimpa', 'Alasan'];
  const baris = data.siswa.map((s) => ({
    'Nama lengkap': s.namaLengkap,
    Kelas: data.kelas.nama,
    ...Object.fromEntries(data.levels.map((l, i) => [kolomLevel[i], s.sel[l.id].nilai])),
    'Nilai akhir': s.nilaiAkhir,
    Ditimpa: s.timpa ? 'Ya' : 'Tidak',
    Alasan: s.timpa?.alasan || ''
  }));
  return buatCSV(kolom, baris);
}
