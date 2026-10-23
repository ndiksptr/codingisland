// tests/e2e/alat.mjs — alat bantu Playwright: sesi dari helper API, pemantau console, editor kode

import { expect } from '@playwright/test';
import { BASE_URL, klien } from '../helper.mjs';

/** Pakai sesi (cookie) dari klien helper di browser, tanpa mengisi form masuk. */
export async function pakaiSesi(context, k) {
  const [nama, nilai] = k.cookie().split('=');
  await context.clearCookies();
  await context.addCookies([{ name: nama, value: nilai, url: BASE_URL, httpOnly: true, secure: true, sameSite: 'Lax' }]);
}

/** Ambil sesi browser sebagai klien helper (untuk menyiapkan data lewat API). */
export async function klienDariBrowser(context) {
  const c = (await context.cookies(BASE_URL)).find((x) => x.name === 'ci_sesi');
  const k = klien();
  k.aturCookie(`ci_sesi=${c.value}`);
  return k;
}

/** Catat error console & error halaman. Hasil: array pesan (diisi selama halaman hidup). */
export function pantauGalat(page) {
  const galat = [];
  page.on('console', (m) => { if (m.type() === 'error') galat.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => galat.push(`pageerror: ${e.message}`));
  return galat;
}

/**
 * Buka rute hash sebagai MUAT PENUH (bukan sekadar ganti hash), agar sesi/cache JS dari cookie
 * sebelumnya tidak terbawa, lalu tunggu router selesai merender isi halaman.
 */
export async function buka(page, hash) {
  const tujuan = `/${hash.startsWith('#') ? hash : `#${hash}`}`;
  if (page.url() !== 'about:blank') await page.goto('about:blank');
  await page.goto(tujuan);
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return app && app.children.length > 0 && !app.querySelector(':scope > .loader'); // .loader = penanda router sedang memuat
  });
  await page.waitForTimeout(250);
}

/** Ganti seluruh isi editor kode (CodeMirror) dengan teks. ketik=true mengetik per huruf. */
export async function isiEditor(page, kode, { ketik = false } = {}) {
  const editor = page.locator('.cm-content').first();
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  if (ketik) {
    await page.keyboard.type(kode, { delay: 30 });
    await page.keyboard.press('Escape'); // tutup saran ketik bila muncul
  } else {
    await page.keyboard.insertText(kode);
  }
}

/** Isi kotak PIN 4 angka (fieldset[data-kolom]) dengan mengetik. */
export async function isiPin(page, kolom, pin) {
  await page.locator(`[data-kolom="${kolom}"] input`).first().click();
  await page.keyboard.type(pin, { delay: 40 });
}
