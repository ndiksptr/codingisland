// tests/e2e/guru-level.spec.mjs — guru membuat level baru (salin pantai-1), menguji jawaban, menerbitkan;
// siswa kelasnya melihat level itu, siswa kelas lain tidak.

import { test, expect } from '@playwright/test';
import { siapkanDunia, hurufAcak } from '../helper.mjs';
import { pakaiSesi, pantauGalat, buka } from './alat.mjs';

let d;
test.beforeAll(async () => { d = await siapkanDunia({ jumlahSiswa3: 1, jumlahSiswa5: 1 }); });

test('guru A membuat, menguji, dan menerbitkan level untuk Kelas Uji 3 saja', async ({ page, context }) => {
  const galat = pantauGalat(page);
  const judul = `Level Uji ${hurufAcak(6)}`;
  await pakaiSesi(context, d.guruA.klien);
  await buka(page, '#/guru/level');
  await page.click('[data-aksi="duplikat"][data-id="pantai-1"]');
  await expect(page).toHaveURL(/#\/guru\/level\/.+\/edit$/);

  const inputJudul = page.locator('[data-isi="judul"]');
  await expect(inputJudul).toBeVisible();
  await inputJudul.fill(judul);
  // Uji jawaban di panggung editor
  await page.click('[data-uji]');
  await expect(page.locator('[data-hasil-uji]')).toContainText('Solusi berhasil', { timeout: 30_000 });
  // Terbitkan
  await expect(page.locator('[data-terbitkan]')).toBeEnabled();
  await page.click('[data-terbitkan]');
  await expect(page.locator('.toast').filter({ hasText: 'terbit' })).toBeVisible();
  await expect(page.locator('[data-status-level]')).toHaveText('Terbit');

  // Siswa Kelas Uji 3 melihat level itu, siswa Kelas Uji 5 tidak
  const lv3 = (await d.siswa3[0].klien('level/terbit')).isi;
  const lv5 = (await d.siswa5[0].klien('level/terbit')).isi;
  expect(lv3.some((l) => l.judul === judul)).toBe(true);
  expect(lv5.some((l) => l.judul === judul)).toBe(false);

  // Terlihat juga di peta siswa Kelas Uji 3 (sebelum boss Pantai)
  await pakaiSesi(context, d.siswa3[0].klien);
  await buka(page, '#/peta/pantai');
  const id = lv3.find((l) => l.judul === judul).id;
  await expect(page.locator(`[data-level="${id}"]`)).toHaveCount(1);
  await pakaiSesi(context, d.siswa5[0].klien);
  await buka(page, '#/peta/pantai');
  await expect(page.locator(`[data-level="${id}"]`)).toHaveCount(0);
  expect(galat).toEqual([]);
});
