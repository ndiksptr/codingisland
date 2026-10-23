// scripts/build-vendor.mjs — bundel pustaka pihak ketiga & salin font agar situs tidak bergantung CDN
// Jalankan: npm run build:vendor   (hasilnya di-commit: js/vendor/*.js dan fonts/*)
//   js/vendor/codemirror.js  CodeMirror 6 (state, view, commands, language, autocomplete, @lezer/highlight)
//   js/vendor/confetti.js    canvas-confetti
//   fonts/                   Baloo 2, Nunito, JetBrains Mono (woff2 variabel, subset latin & latin-ext, lisensi OFL)

import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const akar = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

// ---------- Bundel JavaScript (ES module, diperkecil) ----------
for (const nama of ['codemirror', 'confetti']) {
  await build({
    entryPoints: [akar(`src/vendor/${nama}.js`)],
    outfile: akar(`js/vendor/${nama}.js`),
    bundle: true,
    format: 'esm',
    minify: true,
    target: 'es2020',
    legalComments: 'eof',
    banner: { js: `/* js/vendor/${nama}.js — DIBUAT OTOMATIS oleh scripts/build-vendor.mjs. Jangan diedit. */` }
  });
  console.log(`js/vendor/${nama}.js dibuat`);
}

// ---------- Font ----------
mkdirSync(akar('fonts'), { recursive: true });
const FONT = [
  ['baloo-2', 'baloo-2'],
  ['nunito', 'nunito'],
  ['jetbrains-mono', 'jetbrains-mono']
];
const lisensi = [];
for (const [paket, berkas] of FONT) {
  for (const subset of ['latin', 'latin-ext']) {
    const nama = `${berkas}-${subset}-wght-normal.woff2`;
    copyFileSync(akar(`node_modules/@fontsource-variable/${paket}/files/${nama}`), akar(`fonts/${nama}`));
  }
  lisensi.push(`===== ${paket} =====\n${readFileSync(akar(`node_modules/@fontsource-variable/${paket}/LICENSE`), 'utf8')}`);
}
writeFileSync(akar('fonts/LICENSE-OFL.txt'),
  `Font di folder ini berlisensi SIL Open Font License 1.1 (disalin dari paket @fontsource-variable).\n\n${lisensi.join('\n\n')}`);
console.log('fonts/ disalin (6 berkas woff2 + LICENSE-OFL.txt)');
