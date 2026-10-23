// js/pages/footer.js — footer situs yang dipakai ulang

import { robot } from "../ui.js";

export function footerSitus() {
  const tahun = new Date().getFullYear();
  return `
    <footer class="bg-teal-tua text-white">
      <div class="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div class="flex items-center gap-3">
          ${robot("gembira", { kelas: "w-12 h-auto", alt: "" })}
          <div>
            <p class="font-judul text-2xl font-extrabold leading-none">Coding Island</p>
            <p class="text-sm text-white/85">Properti MI Assyairiyah Attahiriyah</p>
          </div>
        </div>
        <div class="flex flex-col items-center sm:items-end gap-1">
          <p class="text-sm text-white/85 flex items-center gap-1">
            © ${tahun} · Belajar dengan Semangat
          </p>
        </div>
      </div>
    </footer>`;
}
