// js/pages/peta.js — peta pulau untuk siswa
// #/peta        : ringkasan 4 pulau
// #/peta/:zona  : peta satu pulau dengan jalur berkelok dan lingkaran level

import { esc, robot, gambarRobot, tombol, bukaModal, toast } from '../ui.js';
import { sesiAktif, daftarLevelTerbit, getSemuaProgres, aturZonaTerlihat } from '../store.js';
import { pindah } from '../router.js';
import { ZONA } from '../data/zona.js';
import { LABEL_JENIS } from '../data/levels.js';
import { hitungPeta, levelAktif } from '../game/kemajuan.js';
import { buatJalur } from '../game/jalur.js';
import { ikonGembok, ikonBug, ikonPanah, deretBintang } from '../game/ikon.js';
import { mainkanTransisiPulauBaru } from '../game/efek.js';

const TIPS = [
  'Baca soalnya pelan-pelan dulu ya!',
  'Hitung kotak langkah robot sebelum mengetik.',
  'Salah itu biasa. Coba lagi pasti bisa!',
  'Kumpulkan 3 bintang supaya koinmu makin banyak.',
  'Butuh bantuan? Beli petunjuk pakai koin.',
  'Level berlencana kumbang berisi kode yang salah. Perbaiki ya!',
  'Kalahkan boss untuk membuka pulau berikutnya!',
  'Klik aku kalau mau tips lain.'
];
const TIPS_MELAMUN = 'Hmm... kok sepi? Ayo pilih level!';
const LAMA_DIAM_MS = 20000;

const tipsAcak = (kecuali = '') => {
  const pilihan = TIPS.filter((t) => t !== kecuali);
  return pilihan[Math.floor(Math.random() * pilihan.length)];
};

// =====================================================================
// Data bersama
// =====================================================================
/** Muat status peta untuk siswa yang sedang masuk. */
export async function muatPeta() {
  const sesi = await sesiAktif();
  const siswa = sesi.pengguna;
  const [levels, progres] = await Promise.all([
    daftarLevelTerbit({ kelasId: siswa.kelasId }),
    getSemuaProgres({ siswaId: siswa.id })
  ]);
  return { siswa, status: hitungPeta(levels, progres) };
}

/** Putar animasi sekali jika ada zona yang baru terbuka sejak terakhir dilihat. */
async function periksaPulauBaru(siswa, status) {
  const terbuka = status.filter((z) => z.terbuka).map((z) => z.zona.id);
  const terlihat = Array.isArray(siswa.zonaTerlihat) ? siswa.zonaTerlihat : null;
  if (!terlihat) {
    // Data lama tanpa catatan: simpan diam-diam tanpa animasi
    await aturZonaTerlihat(siswa.id, terbuka);
    return;
  }
  const baru = status.filter((z) => z.terbuka && !terlihat.includes(z.zona.id));
  if (!baru.length) return;
  await aturZonaTerlihat(siswa.id, [...terlihat, ...terbuka]);
  // Tunggu halaman tampil dulu
  setTimeout(async () => {
    await mainkanTransisiPulauBaru();
    toast(`Pulau baru terbuka! Selamat datang di ${baru[baru.length - 1].zona.nama}.`, 'sukses', 4000);
  }, 350);
}

// =====================================================================
// #/peta — ringkasan pulau
// =====================================================================
function kartuZonaHTML(sz) {
  const { zona } = sz;
  const persen = sz.total ? Math.round((sz.selesai / sz.total) * 100) : 0;
  const status = !sz.terbuka ? 'terkunci' : sz.tuntas ? 'tuntas' : 'terbuka';
  const labelStatus = { terkunci: 'Terkunci', terbuka: 'Terbuka', tuntas: 'Tuntas!' }[status];

  const isi = `
    <img src="${esc(zona.gambar)}" alt="" class="kartu-zona-gambar" loading="lazy">
    <span class="kartu-zona-tirai" aria-hidden="true"></span>
    <span class="relative z-10 flex flex-col flex-1 p-4 sm:p-5">
      <span class="flex items-center justify-between gap-2">
        <span class="chip-pulau">Pulau ${zona.nomor}</span>
        <span class="chip-status" data-status="${status}">${labelStatus}</span>
      </span>
      ${!sz.terbuka ? `
        <span class="m-auto flex flex-col items-center text-center gap-2 py-2">
          <span class="grid place-items-center w-16 h-16 rounded-full bg-white/90 text-tinta">${ikonGembok(34)}</span>
          <span class="font-judul text-lg sm:text-xl font-extrabold teks-bayangan">${esc(sz.syarat)}</span>
        </span>` : '<span class="flex-1"></span>'}
      <span class="block">
        <span class="block font-judul text-3xl sm:text-4xl font-extrabold leading-none teks-bayangan">${esc(zona.nama)}</span>
        <span class="mt-2 inline-block rounded-xl bg-kuning text-tinta px-2.5 py-0.5 font-bold">${esc(zona.konsep)}</span>
        <span class="mt-3 flex items-center gap-3">
          <span class="bilah-progres flex-1" role="progressbar" aria-valuemin="0" aria-valuemax="${sz.total}" aria-valuenow="${sz.selesai}" aria-label="Level selesai di ${esc(zona.nama)}">
            <span style="width:${persen}%"></span>
          </span>
          <span class="font-bold whitespace-nowrap">${sz.selesai}/${sz.total} level</span>
        </span>
        <span class="mt-2 flex items-center gap-1.5 font-bold">
          <img src="image/item/bintang.png" alt="" class="w-6 h-6 object-contain"> ${sz.bintang} / ${sz.bintangMaks} bintang
        </span>
      </span>
    </span>`;

  if (!sz.terbuka) {
    return `<li><button type="button" class="kartu-zona" data-status="terkunci" data-syarat="${esc(sz.syarat)}"
      style="--aksen:${zona.warna}" aria-label="${esc(zona.nama)} terkunci. ${esc(sz.syarat)}">${isi}</button></li>`;
  }
  return `<li><a href="#/peta/${esc(zona.id)}" class="kartu-zona" data-status="${status}" style="--aksen:${zona.warna}"
    aria-label="Buka pulau ${esc(zona.nama)}, ${sz.selesai} dari ${sz.total} level selesai">${isi}</a></li>`;
}

export async function renderPeta(halaman) {
  const { siswa, status } = await muatPeta();
  const totalBintang = status.reduce((n, z) => n + z.bintang, 0);
  const maksBintang = status.reduce((n, z) => n + z.bintangMaks, 0);
  const totalSelesai = status.reduce((n, z) => n + z.selesai, 0);
  const totalLevel = status.reduce((n, z) => n + z.total, 0);

  halaman.innerHTML = `
    <section class="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div class="flex flex-col sm:flex-row sm:items-end gap-4">
        <div class="flex items-center gap-3">
          ${robot('gembira', { kelas: 'w-20 sm:w-28 h-auto melayang shrink-0', alt: '' })}
          <div>
            <h1 class="font-judul text-4xl sm:text-5xl font-extrabold text-teal-tua leading-none">Peta Pulau</h1>
            <p class="text-lg font-bold mt-1">Pilih pulau dan mulai bertualang, ${esc(siswa.namaPanggilan)}!</p>
          </div>
        </div>
        <div class="sm:ml-auto flex flex-wrap gap-2">
          <span class="chip-uang chip-koin"><img src="image/item/bintang.png" alt="">${totalBintang}/${maksBintang} bintang</span>
          <span class="chip-uang chip-berlian"><img src="image/item/benar.png" alt="">${totalSelesai}/${totalLevel} level</span>
        </div>
      </div>

      <ol class="mt-6 sm:mt-8 grid gap-5 sm:gap-6 md:grid-cols-2">
        ${status.map(kartuZonaHTML).join('')}
      </ol>
    </section>`;

  halaman.addEventListener('click', (e) => {
    const terkunci = e.target.closest('.kartu-zona[data-status="terkunci"]');
    if (terkunci) toast(`${terkunci.dataset.syarat} ya!`, 'info');
  });

  await periksaPulauBaru(siswa, status);
}

// =====================================================================
// #/peta/:zona — peta satu pulau
// =====================================================================
function bulatanHTML(l, p, lebar, tinggi) {
  const boss = l.jenis === 'boss';
  const teksStatus = {
    terkunci: 'terkunci',
    terbuka: 'siap dimainkan',
    selesai: `selesai dengan ${l.bintang} bintang`
  }[l.status];
  const label = `Level ${l.nomor}: ${l.judul}${boss ? ' (boss)' : ''}${l.jenis === 'debug' ? ' (perbaiki bug)' : ''}, ${teksStatus}`;

  return `
    <div class="titik-level" style="left:${((p.x / lebar) * 100).toFixed(2)}%;top:${((p.y / tinggi) * 100).toFixed(2)}%">
      <button type="button" class="bulatan-level ${boss ? 'bulatan-boss' : ''}" data-status="${l.status}"
        data-level="${esc(l.id)}" aria-label="${esc(label)}" ${l.status === 'terkunci' ? 'aria-disabled="true"' : ''}>
        ${boss ? '<img src="image/item/piala.png" alt="" class="ikon-piala">' : ''}
        ${l.status === 'terkunci' ? ikonGembok(boss ? 32 : 26) : `<span>${l.nomor}</span>`}
        ${l.jenis === 'debug' ? `<span class="lencana-bug" title="Level perbaiki bug">${ikonBug(15)}</span>` : ''}
      </button>
      ${l.status === 'selesai' ? deretBintang(l.bintang, { ukuran: 'w-7 h-7', kelas: 'bintang-bawah' }) : ''}
    </div>`;
}

function robotPetaHTML(level, p, lebar, tinggi) {
  if (!level) return '';
  const x = p.x / lebar;
  const y = p.y / tinggi;
  const sisi = x < 0.62 ? 'di-kanan' : 'di-kiri';
  const bawah = y < 0.25 ? 'di-bawah' : '';
  return `
    <div class="robot-peta ${sisi} ${bawah}" style="left:${(x * 100).toFixed(2)}%;top:${(y * 100).toFixed(2)}%">
      <p class="gelembung gelembung-peta" data-tips aria-live="polite">${esc(tipsAcak())}</p>
      <button type="button" class="robot-peta-tombol" data-robot aria-label="Robot Tutor. Klik untuk tips lain">
        <img src="${gambarRobot('hai')}" alt="" class="robot-peta-gambar melayang" data-gambar-robot>
      </button>
    </div>`;
}

function panggungHTML(sz, potret) {
  const { lebar, tinggi, d, titik } = buatJalur(sz.levels.length, { potret });
  const aktif = levelAktif(sz);
  const iAktif = sz.levels.indexOf(aktif);
  const tebalBayang = potret ? 34 : 24;
  const tebalGaris = potret ? 14 : 10;

  return `
    <div class="panggung-peta ${potret ? 'potret' : 'lanskap'}" style="aspect-ratio:${lebar} / ${tinggi}">
      <div class="panggung-latar"><img src="${esc(sz.zona.gambar)}" alt=""></div>
      <svg class="absolute inset-0 w-full h-full" viewBox="0 0 ${lebar} ${tinggi}" preserveAspectRatio="none" aria-hidden="true">
        <path d="${d}" fill="none" stroke="rgba(18,51,47,.35)" stroke-width="${tebalBayang}" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${d}" fill="none" stroke="#fff" stroke-width="${tebalGaris}" stroke-linecap="round" stroke-dasharray="${potret ? '26 30' : '22 26'}"/>
      </svg>
      <div role="list" aria-label="Daftar level ${esc(sz.zona.nama)}">
        ${sz.levels.map((l, i) => `<div role="listitem">${bulatanHTML(l, titik[i], lebar, tinggi)}</div>`).join('')}
      </div>
      ${iAktif >= 0 ? robotPetaHTML(aktif, titik[iAktif], lebar, tinggi) : ''}
    </div>`;
}

function legendaHTML() {
  const item = (isi, teks) => `<li class="flex items-center gap-2">${isi}<span>${teks}</span></li>`;
  return `
    <ul class="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 font-bold text-sm sm:text-base">
      ${item('<span class="legenda-titik" data-status="terbuka"></span>', 'Siap main')}
      ${item('<span class="legenda-titik" data-status="selesai"></span>', 'Selesai')}
      ${item(`<span class="legenda-titik grid place-items-center" data-status="terkunci">${ikonGembok(14)}</span>`, 'Terkunci')}
      ${item(`<span class="legenda-titik grid place-items-center bg-kuning">${ikonBug(14)}</span>`, 'Perbaiki bug')}
      ${item('<img src="image/item/piala.png" alt="" class="w-6 h-6 object-contain">', 'Boss')}
    </ul>`;
}

function halamanTerkunciHTML(sz) {
  return `
    <section class="mx-auto max-w-lg px-4 py-12">
      <div class="kartu muncul flex flex-col items-center text-center gap-3">
        ${robot('sedih', { kelas: 'w-28 h-auto', alt: '' })}
        <span class="grid place-items-center w-14 h-14 rounded-full bg-latar">${ikonGembok(30)}</span>
        <h1 class="font-judul text-3xl font-extrabold text-teal-tua">${esc(sz.zona.nama)} masih terkunci</h1>
        <p class="text-lg">${esc(sz.syarat)} ya!</p>
        ${tombol({ teks: 'Kembali ke Peta Pulau', href: '#/peta', varian: 'utama' })}
      </div>
    </section>`;
}

async function bukaPratinjau(l, zona) {
  const pose = l.jenis === 'boss' ? 'terbang' : l.jenis === 'debug' ? 'berpikir' : 'gembira';
  const ikonJenis = l.jenis === 'debug'
    ? ikonBug(18)
    : l.jenis === 'boss' ? '<img src="image/item/piala.png" alt="" class="w-6 h-6 object-contain">' : '';
  const main = await bukaModal({
    judul: `Level ${l.nomor}: ${l.judul}`,
    pose,
    isi: `
      <div class="flex flex-wrap justify-center gap-2 mb-3">
        <span class="inline-flex items-center gap-1.5 rounded-xl ${l.jenis === 'boss' ? 'bg-oranye' : l.jenis === 'debug' ? 'bg-kuning' : 'bg-mint'} px-3 py-1 font-bold">
          ${ikonJenis}${esc(LABEL_JENIS[l.jenis] || l.jenis)}
        </span>
        <span class="rounded-xl bg-latar px-3 py-1 font-bold">${esc(zona.nama)}</span>
      </div>
      <p class="text-lg">${esc(l.ringkasan || '')}</p>
      <div class="mt-4 rounded-2xl bg-kuning p-3">
        <p class="font-bold mb-1">Bintang terbaikmu</p>
        ${l.status === 'selesai' ? deretBintang(l.bintang, { ukuran: 'w-10 h-10' }) : '<p>Belum pernah selesai. Ayo coba!</p>'}
      </div>`,
    tombol: [
      { teks: 'Nanti', nilai: false, varian: 'sekunder' },
      { teks: 'Main!', nilai: true, ikon: 'image/item/roket.png', kelas: 'tombol-main' }
    ]
  });
  if (main) pindah(`/level/${l.id}`);
}

export async function renderPetaZona(halaman, { params }) {
  const { siswa, status } = await muatPeta();
  const indeks = status.findIndex((z) => z.zona.id === params.zona);
  if (indeks < 0) {
    const { renderTidakDitemukan } = await import('./tidak-ditemukan.js');
    return renderTidakDitemukan(halaman);
  }
  const sz = status[indeks];
  if (!sz.terbuka) {
    halaman.innerHTML = halamanTerkunciHTML(sz);
    return;
  }

  const sebelum = status[indeks - 1];
  const sesudah = status[indeks + 1];
  const tombolZona = (target, arah) => {
    if (!target) return `<span class="w-12 shrink-0" aria-hidden="true"></span>`;
    const label = `Pulau ${arah === 'kiri' ? 'sebelumnya' : 'berikutnya'}: ${target.zona.nama}${target.terbuka ? '' : ' (terkunci)'}`;
    return `<button type="button" class="tombol tombol-sekunder tombol-bulat" data-pindah-zona="${esc(target.zona.id)}"
      aria-label="${esc(label)}" title="${esc(label)}" ${target.terbuka ? '' : 'disabled'}>${ikonPanah(arah)}</button>`;
  };

  halaman.innerHTML = `
    <section class="mx-auto max-w-6xl px-3 sm:px-6 py-4 sm:py-6">
      <div class="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <a href="#/peta" class="tombol tombol-sekunder tombol-kecil shrink-0" aria-label="Kembali ke ringkasan pulau">
          ${ikonPanah('kiri', 20)}<span class="hidden sm:inline">Ringkasan Pulau</span>
        </a>
        <div class="flex-1 min-w-0 text-center">
          <p class="text-sm sm:text-base font-bold text-teal-tua truncate">Pulau ${sz.zona.nomor} · ${esc(sz.zona.konsep)}</p>
          <h1 class="font-judul text-2xl sm:text-4xl font-extrabold text-tinta leading-none truncate">${esc(sz.zona.nama)}</h1>
        </div>
        ${tombolZona(sebelum, 'kiri')}
        ${tombolZona(sesudah, 'kanan')}
      </div>

      <div data-panggung></div>

      <p class="mt-4 text-center font-bold text-lg">
        ${sz.selesai} dari ${sz.total} level selesai ·
        <img src="image/item/bintang.png" alt="" class="inline w-6 h-6 object-contain align-text-bottom"> ${sz.bintang}/${sz.bintangMaks}
      </p>
      ${legendaHTML()}
    </section>`;

  // ---------- Gambar panggung sesuai orientasi ----------
  const wadahPanggung = halaman.querySelector('[data-panggung]');
  const mqPotret = window.matchMedia('(max-width: 767px)');
  const gambarPanggung = () => {
    wadahPanggung.innerHTML = panggungHTML(sz, mqPotret.matches);
    aturRobot('hai');
  };

  // ---------- Robot: tips acak & melamun setelah 20 detik diam ----------
  let timerDiam = null;
  let poseRobot = 'hai';
  function aturRobot(pose, tipsBaru = false) {
    const img = wadahPanggung.querySelector('[data-gambar-robot]');
    const balon = wadahPanggung.querySelector('[data-tips]');
    if (!img || !balon) return;
    if (pose === 'melamun') balon.textContent = TIPS_MELAMUN;
    else if (tipsBaru || poseRobot === 'melamun') balon.textContent = tipsAcak(balon.textContent);
    img.src = gambarRobot(pose);
    poseRobot = pose;
  }
  function adaInteraksi() {
    if (poseRobot === 'melamun') aturRobot('hai');
    clearTimeout(timerDiam);
    timerDiam = setTimeout(() => aturRobot('melamun'), LAMA_DIAM_MS);
  }
  const jenisInteraksi = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'];
  jenisInteraksi.forEach((j) => window.addEventListener(j, adaInteraksi, { passive: true }));

  gambarPanggung();
  adaInteraksi();
  mqPotret.addEventListener('change', gambarPanggung);

  // ---------- Klik ----------
  halaman.addEventListener('click', (e) => {
    if (e.target.closest('[data-robot]')) return aturRobot('hai', true);

    const zonaLain = e.target.closest('[data-pindah-zona]');
    if (zonaLain && !zonaLain.disabled) return pindah(`/peta/${zonaLain.dataset.pindahZona}`);

    const btn = e.target.closest('[data-level]');
    if (!btn) return;
    const l = sz.levels.find((x) => x.id === btn.dataset.level);
    if (!l) return;
    if (l.status === 'terkunci') return toast('Selesaikan level sebelumnya dulu ya!', 'info');
    bukaPratinjau(l, sz.zona);
  });

  await periksaPulauBaru(siswa, status);

  // Bersihkan saat pindah halaman
  return () => {
    clearTimeout(timerDiam);
    jenisInteraksi.forEach((j) => window.removeEventListener(j, adaInteraksi));
    mqPotret.removeEventListener('change', gambarPanggung);
  };
}
