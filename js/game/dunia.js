// js/game/dunia.js — ubah dunia level dari/ke peta teks sederhana
// Berguna untuk menulis level dengan cepat dan untuk halaman uji.
//
// Simbol:  .  kosong      #  batu (rintangan)   O  jurang
//          F  tujuan/bendera   $  koin wajib    *  koin tidak wajib
//          >  <  ^  v  robot menghadap timur / barat / utara / selatan

const SIMBOL_ROBOT = { '>': 'timur', '<': 'barat', '^': 'utara', v: 'selatan' };
const PANAH_ARAH = { timur: '>', barat: '<', utara: '^', selatan: 'v' };

/**
 * Buat objek dunia dari array baris teks (atau satu string bergaris baru).
 * opsi.rintangan: jenis rintangan untuk simbol # (batu, karang, kaktus, es)
 */
export function duniaDariTeks(peta, { rintangan = 'batu' } = {}) {
  const baris = (Array.isArray(peta) ? peta : String(peta).split('\n')).map((b) => b.trim()).filter(Boolean);
  const dunia = {
    kolom: Math.max(...baris.map((b) => b.length)),
    baris: baris.length,
    robot: { x: 0, y: 0, arah: 'timur' },
    tujuan: null,
    item: [],
    rintangan: [],
    jurang: []
  };
  baris.forEach((teks, y) => {
    [...teks].forEach((c, x) => {
      if (SIMBOL_ROBOT[c]) dunia.robot = { x, y, arah: SIMBOL_ROBOT[c] };
      else if (c === 'F') dunia.tujuan = { x, y };
      else if (c === '#') dunia.rintangan.push({ jenis: rintangan, x, y });
      else if (c === 'O') dunia.jurang.push({ x, y });
      else if (c === '$') dunia.item.push({ jenis: 'koin', x, y, wajib: true });
      else if (c === '*') dunia.item.push({ jenis: 'koin', x, y, wajib: false });
    });
  });
  return dunia;
}

/**
 * Gambar dunia sebagai teks. robot & itemDiambil opsional (untuk keadaan akhir).
 * itemDiambil: array {x, y} item yang sudah diambil.
 */
export function duniaKeTeks(dunia, { robot = dunia.robot, itemDiambil = [] } = {}) {
  const grid = Array.from({ length: dunia.baris }, () => Array(dunia.kolom).fill('.'));
  const taruh = (x, y, c) => { if (grid[y] && x >= 0 && x < dunia.kolom) grid[y][x] = c; };
  dunia.jurang.forEach((j) => taruh(j.x, j.y, 'O'));
  dunia.rintangan.forEach((r) => taruh(r.x, r.y, '#'));
  if (dunia.tujuan) taruh(dunia.tujuan.x, dunia.tujuan.y, 'F');
  dunia.item
    .filter((it) => !itemDiambil.some((d) => d.x === it.x && d.y === it.y))
    .forEach((it) => taruh(it.x, it.y, it.wajib === false ? '*' : '$'));
  if (robot) taruh(robot.x, robot.y, PANAH_ARAH[robot.arah] || 'R');
  return grid.map((b) => b.join(' ')).join('\n');
}
