// js/game/ikon.js — ikon SVG inline yang dipakai di peta dan level

/** Gembok terkunci. */
export function ikonGembok(ukuran = 24, warna = 'currentColor') {
  return `
    <svg width="${ukuran}" height="${ukuran}" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="${warna}" stroke-width="2.6" stroke-linecap="round"/>
      <rect x="4" y="10.5" width="16" height="11" rx="3" fill="${warna}"/>
      <circle cx="12" cy="15" r="1.8" fill="#fff"/>
      <rect x="11.1" y="15.5" width="1.8" height="3.2" rx=".9" fill="#fff"/>
    </svg>`;
}

/** Kumbang kecil penanda level debug. */
export function ikonBug(ukuran = 16) {
  return `
    <svg width="${ukuran}" height="${ukuran}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#12332F" stroke-width="2" stroke-linecap="round">
      <path d="M8 6.5 6 4.5M16 6.5l2-2"/>
      <path d="M4 12h3M17 12h3M4.5 18l3-2M19.5 18l-3-2M5 7.5l2.5 2M19 7.5l-2.5 2"/>
      <ellipse cx="12" cy="14" rx="5" ry="6.5" fill="#12332F"/>
      <circle cx="12" cy="7" r="3" fill="#12332F"/>
      <path d="M12 8.5v12" stroke="#FFF8B0" stroke-width="1.6"/>
    </svg>`;
}

/** Panah kiri/kanan. */
export function ikonPanah(arah = 'kanan', ukuran = 26) {
  const d = arah === 'kiri' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7';
  return `
    <svg width="${ukuran}" height="${ukuran}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="${d}"/>
    </svg>`;
}

/** Deretan bintang 0–3 memakai bintang.png (yang kosong dibuat pudar). */
export function deretBintang(jumlah, { ukuran = 'w-5 h-5', kelas = '' } = {}) {
  return `
    <span class="deret-bintang ${kelas}" aria-label="${jumlah} dari 3 bintang" role="img">
      ${[1, 2, 3].map((n) => `<img src="image/item/bintang.png" alt="" class="${ukuran} object-contain ${n <= jumlah ? '' : 'bintang-kosong'}">`).join('')}
    </span>`;
}

/** Bendera finish. */
export function ikonBendera() {
  return `
    <svg viewBox="0 0 64 64" class="w-full h-full" aria-hidden="true">
      <ellipse cx="20" cy="58" rx="13" ry="4" fill="#12332F" opacity=".25"/>
      <rect x="17" y="6" width="6" height="52" rx="3" fill="#12332F"/>
      <circle cx="20" cy="6" r="4" fill="#FFF8B0" stroke="#12332F" stroke-width="2"/>
      <path d="M23 10 H56 L47 22 L56 34 H23 Z" fill="#E8743B" stroke="#12332F" stroke-width="2" stroke-linejoin="round"/>
      <path d="M23 10 H38 V22 H23 Z M38 22 H52 L47 22 L52 28 H38 Z" fill="#FFF8B0"/>
    </svg>`;
}

// Rintangan sesuai zona: batu (pantai), karang (laut), kaktus (gurun), es (salju)
const RINTANGAN = {
  batu: `
    <ellipse cx="32" cy="56" rx="24" ry="5" fill="#12332F" opacity=".25"/>
    <path d="M8 52 C6 38 14 24 26 20 C36 14 50 20 55 32 C60 42 58 52 52 54 Z" fill="#8C9A98" stroke="#4E5B59" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M18 32 C22 26 30 24 34 26" fill="none" stroke="#C9D3D1" stroke-width="4" stroke-linecap="round"/>
    <path d="M40 46 C44 44 48 40 49 36" fill="none" stroke="#6E7C7A" stroke-width="3" stroke-linecap="round"/>`,
  karang: `
    <ellipse cx="32" cy="57" rx="22" ry="4" fill="#12332F" opacity=".25"/>
    <path d="M32 56 V30 M32 40 L20 26 M20 26 V14 M20 30 L12 22 M32 36 L44 22 M44 22 V12 M44 28 L54 20" fill="none" stroke="#E8743B" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M32 56 V30 M32 40 L20 26 M20 26 V14 M32 36 L44 22 M44 22 V12" fill="none" stroke="#F7A07A" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M22 56 H42" stroke="#B4521F" stroke-width="6" stroke-linecap="round"/>`,
  kaktus: `
    <ellipse cx="32" cy="57" rx="18" ry="4" fill="#12332F" opacity=".25"/>
    <path d="M26 56 V14 a6 6 0 0 1 12 0 V56 Z" fill="#4E9A5B" stroke="#2C5E36" stroke-width="2.5"/>
    <path d="M26 36 H18 a5 5 0 0 1 -5 -5 V22 a4 4 0 0 1 8 0 V28 H26" fill="#4E9A5B" stroke="#2C5E36" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M38 30 H45 V18 a4 4 0 0 1 8 0 V27 a7 7 0 0 1 -7 7 H38" fill="#4E9A5B" stroke="#2C5E36" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 12 V52" stroke="#78C285" stroke-width="2" stroke-dasharray="3 5"/>`,
  es: `
    <ellipse cx="32" cy="57" rx="22" ry="4" fill="#12332F" opacity=".25"/>
    <path d="M10 54 L14 26 L28 12 L46 16 L56 34 L52 54 Z" fill="#CDEFFB" stroke="#5FA8C9" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M14 26 L30 30 L46 16 M30 30 L34 54 M30 30 L56 34" fill="none" stroke="#8FCDE6" stroke-width="2"/>
    <path d="M20 22 L26 17" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`
};
const RINTANGAN_ZONA = { pantai: 'batu', laut: 'karang', gurun: 'kaktus', salju: 'es' };

/** SVG rintangan. jenis tidak dikenal memakai rintangan khas zona. */
export function svgRintangan(jenis, zona = 'pantai') {
  const isi = RINTANGAN[jenis] || RINTANGAN[RINTANGAN_ZONA[zona]] || RINTANGAN.batu;
  return `<svg viewBox="0 0 64 64" class="w-full h-full" aria-hidden="true">${isi}</svg>`;
}
