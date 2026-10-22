// js/game/efek.js — efek visual sekali jalan

export const kurangiGerak = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Roket dan Robot Tutor terbang melintas dari kiri bawah ke kanan atas.
 * Selesai (resolve) setelah animasi habis. Dilewati jika pengguna mengurangi gerakan.
 */
export function mainkanTransisiPulauBaru() {
  return new Promise((resolve) => {
    if (kurangiGerak()) return resolve();

    const lapisan = document.createElement('div');
    lapisan.className = 'lapisan-terbang';
    lapisan.setAttribute('aria-hidden', 'true');
    lapisan.innerHTML = `
      <img src="image/item/roket-miring.png" alt="" class="terbang-melintas terbang-roket">
      <img src="image/robot/terbang.png" alt="" class="terbang-melintas terbang-robot">`;
    document.body.appendChild(lapisan);

    let selesai = false;
    const akhiri = () => {
      if (selesai) return;
      selesai = true;
      lapisan.remove();
      resolve();
    };
    lapisan.querySelector('.terbang-robot').addEventListener('animationend', akhiri);
    setTimeout(akhiri, 3500); // cadangan jika animationend tidak terpicu
  });
}
