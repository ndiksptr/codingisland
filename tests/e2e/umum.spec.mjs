// tests/e2e/umum.spec.mjs — semua halaman utama tanpa error console, tampilan HP 375 px tanpa geser samping,
// navigasi keyboard di modal, dan kasus interpreter yang butuh Web Worker.

import { test, expect } from '@playwright/test';
import { siapkanDunia } from '../helper.mjs';
import { LEVEL_AWAL } from '../../js/data/levels.js';
import { pakaiSesi, pantauGalat, buka } from './alat.mjs';

let d;
test.beforeAll(async () => {
  d = await siapkanDunia({ jumlahSiswa3: 1, jumlahSiswa5: 0 });
  await d.siswa3[0].klien('progres/pantai-1/percobaan', { metode: 'POST', data: { kode: LEVEL_AWAL[0].solusi, detik: 5 } });
});

const HALAMAN = {
  umum: ['#/', '#/masuk', '#/daftar', '#/guru/masuk', '#/bantuan', '#/pasang', '#/tidak-ada-halaman'],
  siswa: ['#/peta', '#/peta/pantai', '#/level/pantai-1', '#/level/pantai-2', '#/profil', '#/bantuan'],
  guru: ['#/guru', '#/guru/kelas', '#/guru/siswa', '#/guru/level', '#/guru/level/baru', '#/guru/level/pantai-1/coba', '#/guru/nilai', '#/guru/aktivitas', '#/guru/pengaturan']
};
const HALAMAN_ADMIN = ['#/guru/guru', '#/guru/pengaturan', '#/guru/level/pantai-1/edit'];

async function kunjungi(page, daftar) {
  const galat = pantauGalat(page);
  for (const h of daftar) {
    await buka(page, h);
    await page.waitForTimeout(300);
    expect(galat, `error di ${h}`).toEqual([]);
  }
}

test('semua halaman umum tanpa error console', async ({ page }) => {
  await kunjungi(page, HALAMAN.umum);
});

test('semua halaman siswa tanpa error console', async ({ page, context }) => {
  await pakaiSesi(context, d.siswa3[0].klien);
  await kunjungi(page, HALAMAN.siswa);
});

test('semua halaman guru & admin tanpa error console', async ({ page, context }) => {
  await pakaiSesi(context, d.guruA.klien);
  await kunjungi(page, HALAMAN.guru);
  await pakaiSesi(context, d.admin);
  await kunjungi(page, HALAMAN_ADMIN);
});

test('tampilan HP 375 px: tidak ada scroll horizontal', async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const cek = async (daftar) => {
    for (const h of daftar) {
      await buka(page, h);
      await page.waitForTimeout(300);
      const lebar = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(lebar, `scroll horizontal di ${h}`).toBeLessThanOrEqual(375);
    }
  };
  await context.clearCookies();
  await cek(HALAMAN.umum);
  await pakaiSesi(context, d.siswa3[0].klien);
  await cek(HALAMAN.siswa);
  await pakaiSesi(context, d.guruA.klien);
  await cek(HALAMAN.guru);
});

test('navigasi keyboard di modal: fokus terkunci di dalam, Escape menutup, fokus kembali', async ({ page, context }) => {
  await pakaiSesi(context, d.siswa3[0].klien);
  await buka(page, '#/peta');
  const keluar = page.locator('[data-keluar]');
  await keluar.focus();
  await page.keyboard.press('Enter');
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute('aria-modal', 'true');
  // Tab berkali-kali: fokus tidak pernah keluar dari modal
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]'))).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]'))).toBe(true);
  // Escape menutup tanpa keluar, fokus kembali ke tombol Keluar
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(keluar).toBeFocused();
  await expect(page).toHaveURL(/#\/peta$/);
});

test('interpreter di browser: semua kasus uji (termasuk batas waktu Web Worker) lulus', async ({ page }) => {
  test.setTimeout(120_000);
  await buka(page, '#/');
  const jumlah = await page.evaluate(async () => (await import('/js/game/uji-interpreter-kasus.js')).KASUS_UJI.length);
  expect(jumlah).toBeGreaterThan(20);
  const gagal = [];
  // Satu kasus per evaluate, masing-masing dengan batas 10 detik, agar kasus yang macet terlihat namanya
  for (let i = 0; i < jumlah; i++) {
    const r = await page.evaluate(async (i) => {
      const { jalankanKodeSiswa } = await import('/js/game/runner.js');
      const { KASUS_UJI } = await import('/js/game/uji-interpreter-kasus.js');
      const { duniaDariTeks } = await import('/js/game/dunia.js');
      const k = KASUS_UJI[i];
      const h = await Promise.race([
        jalankanKodeSiswa(k.kode, duniaDariTeks(k.peta), k.opsi || {}),
        new Promise((res) => setTimeout(() => res(null), 10_000))
      ]);
      if (!h) return { nama: k.nama, catatan: 'macet lebih dari 10 detik' };
      const c = k.cek(h);
      return { nama: k.nama, catatan: c === true ? null : String(c) };
    }, i);
    if (r.catatan) gagal.push(r);
  }
  expect(gagal, JSON.stringify(gagal)).toEqual([]);
});
