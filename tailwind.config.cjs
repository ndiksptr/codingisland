// tailwind.config.cjs — konfigurasi Tailwind CLI v3 (dulu ditulis di index.html untuk Tailwind CDN)
// Build: npm run build:css  ->  css/tailwind.css (di-commit, karena deploy tidak menjalankan build)
module.exports = {
  // Semua kelas Tailwind ditulis lengkap di HTML/JS, jadi cukup memindai berkas ini
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      // Warna dan font proyek, mis. bg-teal-tua, text-tinta, font-judul (sama persis dengan versi CDN)
      colors: {
        teal: { DEFAULT: '#55A9A0', tua: '#287A74' },
        mint: '#AEEED3',
        kuning: '#FFF8B0',
        tinta: '#12332F',
        oranye: '#E8743B',
        latar: '#F6FBF9'
      },
      fontFamily: {
        judul: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        isi: ['Nunito', 'system-ui', 'sans-serif'],
        kode: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      }
    }
  }
};
