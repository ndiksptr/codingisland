// js/game/panggung.js — panggung 16:9 tempat robot bergerak
// Panggung hanya menggambar dan menganimasikan jejak dari interpreter; ia tidak menjalankan kode.
// API: { reset, animasikan, aturPose, bicara, tampilPetak, lompatGembira, hancurkan }

import { esc, gambarRobot } from '../ui.js';
import { ikonBendera, svgRintangan } from './ikon.js';
import { kurangiGerak } from './efek.js';

const GAMBAR_ITEM = { koin: 'image/item/koin.png', berlian: 'image/item/berlian.png' };
const SUDUT_ARAH = { timur: 0, selatan: 90, barat: 180, utara: -90 };
const GESER = { utara: [0, -1], timur: [1, 0], selatan: [0, 1], barat: [-1, 0] };

const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Buat panggung di dalam `wadah`.
 * dunia: data dunia level; zona: objek zona (untuk background & jenis rintangan)
 */
export function buatPanggung(wadah, { dunia, zona }) {
  const { kolom, baris } = dunia;
  const pos = (x, y) => `style="--x:${x};--y:${y}"`;

  wadah.innerHTML = `
    <div class="panggung" data-panggung>
      <img src="${esc(zona.gambar)}" alt="" class="panggung-bg">
      <div class="panggung-grid" data-grid>
        <div class="lapisan-petak" style="grid-template-columns:repeat(${kolom},1fr);grid-template-rows:repeat(${baris},1fr)" aria-hidden="true">
          ${'<span></span>'.repeat(kolom * baris)}
        </div>
        ${(dunia.jurang || []).map((j) => `<div class="objek" ${pos(j.x, j.y)}><span class="jurang"></span></div>`).join('')}
        ${(dunia.rintangan || []).map((r) => `<div class="objek objek-rintangan" ${pos(r.x, r.y)}>${svgRintangan(r.jenis, zona.id)}</div>`).join('')}
        ${dunia.tujuan ? `<div class="objek objek-bendera" ${pos(dunia.tujuan.x, dunia.tujuan.y)}>${ikonBendera()}</div>` : ''}
        ${(dunia.item || []).map((it, i) => `
          <div class="objek objek-item" ${pos(it.x, it.y)} data-item="${i}" data-x="${it.x}" data-y="${it.y}">
            <img src="${GAMBAR_ITEM[it.jenis] || GAMBAR_ITEM.koin}" alt="" class="melayang" style="animation-delay:${(i % 4) * -0.7}s">
          </div>`).join('')}
        <div class="objek robot-panggung" data-robot>
          <div class="robot-goyang" data-goyang>
            <div class="robot-badan" data-badan><img src="${gambarRobot('hai')}" alt="" data-pose></div>
          </div>
          <span class="robot-panah" data-panah aria-hidden="true"></span>
          <p class="gelembung gelembung-robot" data-balon role="status" aria-live="polite" hidden></p>
        </div>
      </div>
    </div>`;

  const elPanggung = wadah.querySelector('[data-panggung]');
  const elGrid = wadah.querySelector('[data-grid]');
  const elRobot = wadah.querySelector('[data-robot]');
  const elGoyang = wadah.querySelector('[data-goyang]');
  const elBadan = wadah.querySelector('[data-badan]');
  const elPose = wadah.querySelector('[data-pose]');
  const elPanah = wadah.querySelector('[data-panah]');
  const elBalon = wadah.querySelector('[data-balon]');

  let sel = 40;
  let robot = { ...dunia.robot };
  let animasiAktif = [];

  // ---------- Ukuran petak mengikuti ukuran panggung ----------
  function ukurUlang() {
    const r = elPanggung.getBoundingClientRect();
    if (!r.width) return;
    sel = Math.max(16, Math.floor(Math.min((r.width * 0.94) / kolom, (r.height * 0.86) / baris)));
    elGrid.style.setProperty('--sel', `${sel}px`);
    elGrid.style.width = `${sel * kolom}px`;
    elGrid.style.height = `${sel * baris}px`;
  }
  const pengamat = new ResizeObserver(ukurUlang);
  pengamat.observe(elPanggung);
  ukurUlang();

  // ---------- Keadaan robot ----------
  function letakkan(x, y) {
    elRobot.style.setProperty('--x', x);
    elRobot.style.setProperty('--y', y);
    robot.x = x;
    robot.y = y;
  }
  function aturArah(arah) {
    robot.arah = arah;
    elBadan.classList.toggle('hadap-kiri', arah === 'barat');
    elPanah.style.setProperty('--sudut', `${SUDUT_ARAH[arah] ?? 0}deg`);
  }
  function aturPose(pose) {
    elPose.src = gambarRobot(pose);
  }
  function bicara(teks) {
    if (!teks) { elBalon.hidden = true; return; }
    elBalon.textContent = teks;
    elBalon.hidden = false;
    // Posisi balon menyesuaikan letak robot agar tidak keluar panggung
    elBalon.classList.toggle('balon-bawah', robot.y === 0);
    elBalon.classList.toggle('balon-kiri', robot.x < kolom / 3);
    elBalon.classList.toggle('balon-kanan', robot.x > (kolom * 2) / 3);
  }
  function animasi(el, keyframes, durasi, opsi = {}) {
    if (!durasi || kurangiGerak()) return Promise.resolve();
    const a = el.animate(keyframes, { duration: durasi, easing: 'ease-in-out', ...opsi });
    animasiAktif.push(a);
    return a.finished.catch(() => {}).finally(() => { animasiAktif = animasiAktif.filter((x) => x !== a); });
  }
  const px = (x, y, dy = 0) => `translate(${x * sel}px, ${(y + dy) * sel}px)`;

  function goyang() {
    elGoyang.classList.remove('goyang', 'lompat-gembira');
    void elGoyang.offsetWidth;
    elGoyang.classList.add('goyang');
  }

  /** Kembalikan semua ke keadaan awal level. */
  function reset() {
    animasiAktif.forEach((a) => a.cancel());
    animasiAktif = [];
    robot = { ...dunia.robot };
    letakkan(robot.x, robot.y);
    aturArah(robot.arah);
    aturPose('hai');
    bicara(null);
    elBadan.classList.remove('jatuh');
    elGoyang.classList.remove('goyang', 'lompat-gembira');
    wadah.querySelectorAll('[data-item]').forEach((el) => el.classList.remove('diambil'));
  }

  // ---------- Item terbang ke penghitung di header ----------
  function terbangkanItem(elItem, jenis, durasi) {
    elItem.classList.add('diambil');
    const target = document.querySelector(`.header-siswa ${jenis === 'berlian' ? '.chip-berlian' : '.chip-koin'} img`);
    if (!target || kurangiGerak()) return;
    const awal = elItem.getBoundingClientRect();
    const akhir = target.getBoundingClientRect();
    const klon = document.createElement('img');
    klon.src = GAMBAR_ITEM[jenis] || GAMBAR_ITEM.koin;
    klon.alt = '';
    klon.className = 'item-terbang';
    Object.assign(klon.style, { left: `${awal.left}px`, top: `${awal.top}px`, width: `${awal.width}px`, height: `${awal.height}px` });
    document.body.appendChild(klon);
    const dx = akhir.left + akhir.width / 2 - (awal.left + awal.width / 2);
    const dy = akhir.top + akhir.height / 2 - (awal.top + awal.height / 2);
    klon.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 60}px) scale(1.2)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${dx}px, ${dy}px) scale(.4)`, opacity: 0.6 }
    ], { duration: Math.max(500, durasi * 1.6), easing: 'ease-in' }).finished
      .catch(() => {})
      .finally(() => {
        klon.remove();
        target.closest('.chip-uang')?.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
          { duration: 300 }
        );
      });
  }

  // ---------- Animasi satu peristiwa ----------
  async function mainkan(e, durasi) {
    const dari = { x: robot.x, y: robot.y };
    switch (e.jenis) {
      case 'gerak':
        letakkan(e.x, e.y);
        await animasi(elRobot, [{ transform: px(dari.x, dari.y) }, { transform: px(e.x, e.y) }], durasi);
        break;
      case 'lompat': {
        letakkan(e.x, e.y);
        const tx = (dari.x + e.x) / 2;
        const ty = (dari.y + e.y) / 2;
        await animasi(elRobot, [
          { transform: px(dari.x, dari.y) },
          { transform: px(tx, ty, -0.9) },
          { transform: px(e.x, e.y) }
        ], durasi * 1.5);
        break;
      }
      case 'belok':
        aturArah(e.arah);
        await animasi(elGoyang, [{ transform: 'rotate(0)' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(0)' }], durasi * 0.6);
        break;
      case 'ambil': {
        const elItem = e.item && [...wadah.querySelectorAll('[data-item]:not(.diambil)')]
          .find((el) => Number(el.dataset.x) === e.item.x && Number(el.dataset.y) === e.item.y);
        if (elItem) {
          terbangkanItem(elItem, e.item.jenis, durasi);
          await animasi(elGoyang, [{ transform: 'translateY(0)' }, { transform: 'translateY(-12%)' }, { transform: 'translateY(0)' }], durasi * 0.7);
        } else {
          bicara('Tidak ada apa-apa di sini.');
          await tunggu(Math.max(durasi, 400));
          bicara(null);
        }
        break;
      }
      case 'tabrak':
      case 'keluar': {
        // Maju sedikit, terpental kembali, lalu kaget dan bergoyang
        const [dx, dy] = GESER[robot.arah];
        const jauh = e.jenis === 'keluar' ? 0.5 : 0.35;
        await animasi(elRobot, [
          { transform: px(dari.x, dari.y) },
          { transform: px(dari.x + dx * jauh, dari.y + dy * jauh) },
          { transform: px(dari.x, dari.y) }
        ], durasi);
        aturPose('kaget');
        goyang();
        break;
      }
      case 'jatuh':
        letakkan(e.x, e.y);
        await animasi(elRobot, [{ transform: px(dari.x, dari.y) }, { transform: px(e.x, e.y) }], durasi);
        aturPose('kaget');
        elBadan.classList.add('jatuh');
        await tunggu(kurangiGerak() ? 0 : 500);
        break;
      default:
        break;
    }
  }

  /**
   * Animasikan jejak satu per satu.
   * opsi: { durasi (ms per langkah), token { batal }, saatPeristiwa(e, i) }
   */
  async function animasikan(jejak, { durasi = 400, token = {}, saatPeristiwa = null } = {}) {
    const d = kurangiGerak() ? 0 : durasi;
    for (let i = 0; i < jejak.length; i++) {
      if (token.batal) return false;
      saatPeristiwa?.(jejak[i], i);
      await mainkan(jejak[i], d);
      if (kurangiGerak()) await tunggu(Math.min(150, durasi / 2)); // tetap beri jeda agar sorotan baris terlihat
    }
    return !token.batal;
  }

  function lompatGembira() {
    elGoyang.classList.remove('goyang', 'lompat-gembira');
    void elGoyang.offsetWidth;
    elGoyang.classList.add('lompat-gembira');
  }

  reset();

  return {
    reset,
    animasikan,
    aturPose,
    bicara,
    lompatGembira,
    tampilPetak(ya) { elGrid.classList.toggle('tanpa-petak', !ya); },
    hancurkan() {
      pengamat.disconnect();
      animasiAktif.forEach((a) => a.cancel());
    }
  };
}
