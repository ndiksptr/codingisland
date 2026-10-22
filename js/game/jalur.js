// js/game/jalur.js — membuat jalur berkelok dan titik level secara otomatis
// Tidak ada koordinat manual: titik level dibagi rata menurut panjang jalur,
// jadi level tambahan buatan guru tetap tertata.

const SAMPEL = 240;

/**
 * Buat jalur untuk n level.
 * potret = true untuk layar HP (jalur dari bawah ke atas, panggung memanjang).
 * Hasil: { lebar, tinggi, d (atribut path SVG), titik: [{x, y}] }
 */
export function buatJalur(n, { potret = false } = {}) {
  const jumlah = Math.max(1, n);

  // Ukuran kanvas (unit SVG). Lanskap selalu 16:9.
  const lebar = potret ? 900 : 1600;
  const tinggi = potret ? Math.max(1600, 260 + jumlah * 300) : 900;

  // Fungsi kurva berkelok: t dari 0 sampai 1
  const gelombang = potret ? Math.max(1.5, jumlah * 0.55) : Math.max(1.25, jumlah * 0.4);
  const kurva = potret
    ? (t) => ({
      x: lebar * (0.5 + 0.3 * Math.sin(t * Math.PI * 2 * gelombang / 2)),
      y: tinggi * (0.93 - 0.86 * t)
    })
    : (t) => ({
      x: lebar * (0.07 + 0.86 * t),
      y: tinggi * (0.55 - 0.26 * Math.sin(t * Math.PI * 2 * gelombang / 2))
    });

  // Ambil sampel dan hitung panjang kumulatif
  const sampel = [];
  let panjang = 0;
  for (let i = 0; i <= SAMPEL; i++) {
    const p = kurva(i / SAMPEL);
    if (i > 0) {
      const q = sampel[i - 1];
      panjang += Math.hypot(p.x - q.x, p.y - q.y);
    }
    sampel.push({ ...p, s: panjang });
  }

  // Titik level dibagi rata berdasarkan panjang jalur
  const titik = [];
  for (let i = 0; i < jumlah; i++) {
    const rasio = jumlah === 1 ? 0.5 : 0.05 + (0.9 * i) / (jumlah - 1);
    titik.push(titikPadaPanjang(sampel, rasio * panjang));
  }

  const d = sampel.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return { lebar, tinggi, d, titik };
}

function titikPadaPanjang(sampel, s) {
  for (let i = 1; i < sampel.length; i++) {
    if (sampel[i].s >= s) {
      const a = sampel[i - 1];
      const b = sampel[i];
      const r = (s - a.s) / (b.s - a.s || 1);
      return { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r };
    }
  }
  const akhir = sampel[sampel.length - 1];
  return { x: akhir.x, y: akhir.y };
}
