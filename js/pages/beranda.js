// js/pages/beranda.js — landing page (#/)

import { esc, robot, tombol } from "../ui.js";
import { ZONA } from "../data/zona.js";
import { sesiAktif } from "../store.js";
import { footerSitus } from "./footer.js";

// Bendera finish (SVG inline) untuk ilustrasi "Jalankan Robot"
const BENDERA = `
  <svg viewBox="0 0 48 64" class="w-12 h-16" aria-hidden="true">
    <rect x="8" y="6" width="5" height="54" rx="2.5" fill="#12332F"/>
    <path d="M13 8 H42 L34 19 L42 30 H13 Z" fill="#E8743B"/>
    <path d="M13 8 H27 V19 H13 Z M27 19 H42 L34 19 Z" fill="#FFF8B0" opacity=".9"/>
    <ellipse cx="10.5" cy="60" rx="9" ry="3" fill="#12332F" opacity=".2"/>
  </svg>`;

const PANAH_BAWAH = `
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6"/>
  </svg>`;

// Tombol hero menyesuaikan siapa yang sedang masuk
function tombolHero(sesi) {
  if (sesi?.jenis === "siswa") {
    return tombol({
      teks: `Lanjut Main, ${sesi.pengguna.namaPanggilan}!`,
      href: "#/peta",
      varian: "utama",
      ikon: "image/item/roket.png",
    });
  }
  if (sesi?.jenis === "guru") {
    return tombol({
      teks: "Buka Dashboard Guru",
      href: "#/guru",
      varian: "utama",
    });
  }
  return `
    ${tombol({ teks: "Daftar", href: "#/daftar", varian: "utama", ikon: "image/item/roket.png", kelas: "sm:min-w-[11rem]" })}
    ${tombol({ teks: "Masuk", href: "#/masuk", varian: "sekunder", kelas: "sm:min-w-[11rem]" })}`;
}

function bagianHero(sesi) {
  return `
    <section class="relative tinggi-layar flex items-center overflow-hidden">
      <img src="image/background/pantai.jpeg" alt="" class="absolute inset-0 w-full h-full object-cover" fetchpriority="high">
      <div class="absolute inset-0 hero-overlay" aria-hidden="true"></div>

      <div class="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 pt-10 pb-24 md:py-16 grid md:grid-cols-2 items-center gap-6 md:gap-10">
        <!-- Teks dan tombol -->
        <div class="order-2 md:order-1 text-center md:text-left text-white hero-panel">
          <p class="muncul inline-block rounded-2xl bg-kuning text-tinta font-bold px-4 py-1 text-base sm:text-lg">
            MI. Assyairiyah Attahiriyah
          </p>
          <h1 class="muncul tunda-1 mt-4 font-judul font-extrabold text-5xl sm:text-6xl lg:text-7xl leading-none teks-bayangan">
            Coding Island
          </h1>
          <p class="muncul tunda-2 mt-4 text-xl sm:text-2xl font-bold teks-bayangan max-w-xl mx-auto md:mx-0">
            Belajar ngoding sambil berpetualang bersama Robot Tutor
          </p>

          <div class="muncul tunda-3 mt-8 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            ${tombolHero(sesi)}
          </div>

          <a href="#/guru/masuk" class="muncul tunda-4 mt-6 inline-block font-bold text-white/90 underline underline-offset-4 hover:text-kuning">
            Masuk sebagai Guru
          </a>
        </div>

        <!-- Robot Tutor -->
        <div class="order-1 md:order-2 flex flex-col items-center">
          <div class="gelembung muncul tunda-2 mb-3">Hai! Ayo main bersama!</div>
          ${robot("hai", { kelas: "melayang w-40 sm:w-56 lg:w-72 h-auto drop-shadow-2xl", alt: "Robot Tutor melambaikan tangan" })}
        </div>
      </div>

      <button type="button" data-gulir="pulau"
        class="melayang absolute bottom-5 left-1/2 -translate-x-1/2 z-10 grid place-items-center w-12 h-12 rounded-full bg-white/90 text-teal-tua shadow-lg"
        aria-label="Lihat 4 pulau">
        ${PANAH_BAWAH}
      </button>
    </section>`;
}

function kartuZona(z, i) {
  return `
    <article class="kartu p-0 overflow-hidden flex flex-col" data-gulir-muncul style="--tunda-gulir:${i * 0.12}s">
      <div class="relative aspect-video">
        <img src="${esc(z.gambar)}" alt="Pemandangan ${esc(z.nama)}" class="absolute inset-0 w-full h-full object-cover" loading="lazy">
        <span class="absolute top-3 left-3 rounded-2xl bg-teal-tua text-white font-judul font-bold px-3 py-0.5 text-base shadow">
          Pulau ${z.nomor}
        </span>
      </div>
      <div class="p-5 flex flex-col gap-2 flex-1">
        <h3 class="font-judul text-2xl font-extrabold text-teal-tua">${esc(z.nama)}</h3>
        <p class="self-start rounded-2xl bg-kuning px-3 py-0.5 font-bold">${esc(z.konsep)}</p>
        <p class="text-base">${esc(z.deskripsi)}</p>
      </div>
    </article>`;
}

function bagianZona() {
  return `
    <section id="pulau" class="scroll-mt-4 py-16 sm:py-20">
      <div class="mx-auto max-w-6xl px-4 sm:px-6">
        <div class="text-center max-w-2xl mx-auto" data-gulir-muncul>
          <h2 class="font-judul text-4xl sm:text-5xl font-extrabold text-teal-tua">Jelajahi 4 Pulau</h2>
          <p class="mt-3 text-lg sm:text-xl">Setiap pulau punya jurus coding baru. Selesaikan semua dan jadi juara!</p>
        </div>
        <div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          ${ZONA.map((z, i) => kartuZona(z, i)).join("")}
        </div>
      </div>
    </section>`;
}

function langkah(nomor, judul, teks, ilustrasi) {
  return `
    <li class="kartu flex flex-col items-center text-center gap-4" data-gulir-muncul style="--tunda-gulir:${(nomor - 1) * 0.15}s">
      <span class="grid place-items-center w-12 h-12 rounded-full bg-teal-tua text-white font-judul text-2xl font-extrabold" aria-hidden="true">${nomor}</span>
      <div class="w-full h-40 rounded-2xl bg-latar grid place-items-center p-3">${ilustrasi}</div>
      <h3 class="font-judul text-2xl font-extrabold text-teal-tua">
        <span class="sr-only">Langkah ${nomor}: </span>${esc(judul)}
      </h3>
      <p class="text-base sm:text-lg">${esc(teks)}</p>
    </li>`;
}

function bagianCaraBermain() {
  const ilustrasiKetik = `
    <div class="mini-editor" aria-hidden="true">
      <div class="mini-editor-atas"><i></i><i></i><i></i></div>
      <pre><span class="kata-kunci">maju</span> 3
<span class="kata-kunci">belok</span> kanan
<span class="kata-kunci">maju</span> 2</pre>
    </div>`;

  const ilustrasiJalankan = `
    <div class="flex items-end justify-center gap-2 w-full" aria-hidden="true">
      ${robot("terbang", { kelas: "melayang w-20 h-auto", alt: "" })}
      <svg viewBox="0 0 100 30" class="w-20 sm:w-24 h-8 mb-4">
        <path d="M2 22 Q50 -6 92 18" fill="none" stroke="#55A9A0" stroke-width="4" stroke-dasharray="8 7" stroke-linecap="round"/>
        <path d="M84 12 L94 19 L83 24" fill="none" stroke="#55A9A0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      ${BENDERA}
    </div>`;

  const ilustrasiBintang = `
    <div class="flex flex-col items-center gap-2" aria-hidden="true">
      <div class="flex items-end gap-1">
        <img src="image/item/bintang.png" alt="" class="w-12 h-12 object-contain">
        <img src="image/item/bintang.png" alt="" class="w-16 h-16 object-contain -mb-1">
        <img src="image/item/bintang.png" alt="" class="w-12 h-12 object-contain">
      </div>
      <div class="flex items-center gap-2 rounded-2xl bg-kuning px-3 py-1 font-judul font-bold text-lg">
        <img src="image/item/koin.png" alt="" class="w-7 h-7 object-contain"> +10
      </div>
    </div>`;

  return `
    <section class="py-16 sm:py-20 bg-mint/40">
      <div class="mx-auto max-w-6xl px-4 sm:px-6">
        <div class="text-center max-w-2xl mx-auto" data-gulir-muncul>
          <h2 class="font-judul text-4xl sm:text-5xl font-extrabold text-teal-tua">Cara Bermain</h2>
          <p class="mt-3 text-lg sm:text-xl">Cuma tiga langkah. Gampang, kan?</p>
        </div>
        <ol class="mt-10 grid gap-6 md:grid-cols-3">
          ${langkah(1, "Ketik Kode", "Tulis perintah dalam Bahasa Indonesia, misalnya maju 3.", ilustrasiKetik)}
          ${langkah(2, "Jalankan Robot", "Tekan tombol Jalankan dan lihat robot bergerak ke bendera.", ilustrasiJalankan)}
          ${langkah(3, "Kumpulkan Bintang", "Selesaikan level, dapatkan bintang dan koin!", ilustrasiBintang)}
        </ol>
        <div class="mt-10 flex justify-center" data-gulir-muncul>
          ${tombol({ teks: "Ayo Mulai!", href: "#/daftar", varian: "utama", ikon: "image/item/roket-miring.png" })}
        </div>
      </div>
    </section>`;
}

/**
 * Animasi muncul saat digulir: elemen [data-gulir-muncul] naik perlahan ketika masuk layar.
 * Mati bila pengguna memilih "kurangi gerak" atau browser tidak mendukung IntersectionObserver.
 * Hasil: fungsi pembersih untuk router.
 */
function pasangAnimasiGulir(akar) {
  const kurangiGerak = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (kurangiGerak || !("IntersectionObserver" in window)) return () => {};
  const pengamat = new IntersectionObserver(
    (entri) => {
      for (const e of entri) {
        if (!e.isIntersecting) continue;
        const el = e.target;
        el.classList.add("terlihat");
        pengamat.unobserve(el); // cukup sekali
        // Setelah selesai, lepas kelasnya agar efek hover kartu kembali normal (tanpa jeda)
        const jeda = parseFloat(getComputedStyle(el).transitionDelay) || 0;
        setTimeout(
          () => el.classList.remove("gulir-muncul", "terlihat"),
          (jeda + 0.8) * 1000,
        );
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
  );
  akar.querySelectorAll("[data-gulir-muncul]").forEach((el) => {
    el.classList.add("gulir-muncul");
    pengamat.observe(el);
  });
  return () => pengamat.disconnect();
}

/** Render landing page. */
export async function renderBeranda(halaman) {
  const sesi = await sesiAktif();
  halaman.innerHTML =
    bagianHero(sesi) + bagianZona() + bagianCaraBermain() + footerSitus();

  // Tombol panah: gulir halus ke bagian pulau
  halaman.querySelector("[data-gulir]")?.addEventListener("click", (e) => {
    const target = document.getElementById(e.currentTarget.dataset.gulir);
    const kurangiGerak = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target?.scrollIntoView({
      behavior: kurangiGerak ? "auto" : "smooth",
      block: "start",
    });
  });

  return pasangAnimasiGulir(halaman);
}
