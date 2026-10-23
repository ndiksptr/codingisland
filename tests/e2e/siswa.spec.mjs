// tests/e2e/siswa.spec.mjs — alur siswa: daftar 3 langkah, peta, pantai-1 diketik, modal bintang,
// level 2 terbuka, perbaiki bug pantai-3, beli clue. Lalu guru A melihat siswa itu & mengunduh CSV.

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { siapkanDunia, akhiran, hurufAcak } from '../helper.mjs';
import { LEVEL_AWAL } from '../../js/data/levels.js';
import { pantauGalat, buka, isiEditor, isiPin, klienDariBrowser } from './alat.mjs';

test.describe.configure({ mode: 'serial' });

const solusi = (id) => LEVEL_AWAL.find((l) => l.id === id).solusi;
let d;
const murid = { nama: `Rara ${hurufAcak(6)}`, panggilan: 'Rara', username: `rara${akhiran(6)}`, pin: '2468' };

test.beforeAll(async () => { d = await siapkanDunia({ jumlahSiswa3: 0, jumlahSiswa5: 1 }); });

test('siswa mendaftar lewat form tiga langkah lalu masuk ke peta', async ({ page }) => {
  const galat = pantauGalat(page);
  await buka(page, '#/daftar');
  // Langkah 1: nama & avatar
  await page.fill('#d-nama', murid.nama);
  await page.fill('#d-panggilan', murid.panggilan);
  await page.locator('.pilih-avatar').filter({ hasText: 'Perempuan' }).click();
  await page.click('[data-lanjut]');
  // Langkah 2: kelas & kode kelas
  await expect(page.locator('[data-langkah="2"]')).toBeVisible();
  await page.selectOption('#d-kelas', d.kelas3.id);
  await page.fill('#d-kode', d.kelas3.kodeKelas);
  await page.click('[data-lanjut]');
  // Langkah 3: username & PIN dua kali
  await expect(page.locator('[data-langkah="3"]')).toBeVisible();
  await page.fill('#d-username', murid.username);
  await isiPin(page, 'pin', murid.pin);
  await isiPin(page, 'pinUlang', murid.pin);
  await page.click('[data-lanjut]');
  // Modal sambutan lalu peta
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText(`Halo, ${murid.panggilan}!`);
  await modal.getByRole('button', { name: /Ayo ke Peta/ }).click();
  await expect(page).toHaveURL(/#\/peta$/);
  await expect(page.locator('.header-siswa')).toContainText(murid.panggilan);
  expect(galat).toEqual([]);
});

test('menyelesaikan pantai-1 dengan mengetik kode, melihat modal bintang, level 2 terbuka', async ({ page }) => {
  const galat = pantauGalat(page);
  await buka(page, '#/masuk');
  await page.fill('[name="username"]', murid.username);
  await isiPin(page, 'pin', murid.pin); // masuk otomatis setelah 4 angka
  await expect(page).toHaveURL(/#\/peta/);

  await buka(page, '#/peta/pantai');
  await expect(page.locator('[data-level="pantai-1"]')).toHaveAttribute('data-status', 'terbuka');
  await expect(page.locator('[data-level="pantai-2"]')).toHaveAttribute('data-status', 'terkunci');

  await buka(page, '#/level/pantai-1');
  await isiEditor(page, solusi('pantai-1'), { ketik: true });
  await page.click('[data-jalankan]');
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await expect(modal.getByRole('img', { name: '3 dari 3 bintang' })).toBeVisible();
  await expect(modal).toContainText('Nilai 100');
  await modal.getByRole('button', { name: /Main lagi|Coba lagi/ }).click();

  await buka(page, '#/peta/pantai');
  await expect(page.locator('[data-level="pantai-1"]')).toHaveAttribute('data-status', 'selesai');
  await expect(page.locator('[data-level="pantai-2"]')).toHaveAttribute('data-status', 'terbuka');
  expect(galat).toEqual([]);
});

test('memperbaiki bug di level debug pantai-3', async ({ page, context }) => {
  await buka(page, '#/masuk');
  await page.fill('[name="username"]', murid.username);
  await isiPin(page, 'pin', murid.pin);
  await expect(page).toHaveURL(/#\/peta/);
  // pantai-2 diselesaikan lewat API dengan sesi browser yang sama
  const api = await klienDariBrowser(context);
  expect((await api('progres/pantai-2/percobaan', { metode: 'POST', data: { kode: solusi('pantai-2'), detik: 5 } })).isi.berhasil).toBe(true);

  await buka(page, '#/level/pantai-3');
  const awal = LEVEL_AWAL.find((l) => l.id === 'pantai-3').kodeAwal;
  await expect(page.locator('.cm-content')).toContainText(awal.split('\n')[0]);
  // Kode awal yang salah memang gagal
  await page.click('[data-jalankan]');
  await expect(page.locator('[data-jalankan]')).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Perbaiki lalu jalankan lagi
  await isiEditor(page, solusi('pantai-3'));
  await page.click('[data-jalankan]');
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await expect(modal.getByRole('img', { name: /dari 3 bintang/ })).toBeVisible();
});

test('membeli clue: teks clue terbuka dan koin berkurang 5', async ({ page }) => {
  await buka(page, '#/masuk');
  await page.fill('[name="username"]', murid.username);
  await isiPin(page, 'pin', murid.pin);
  await expect(page).toHaveURL(/#\/peta/);
  await buka(page, '#/level/pantai-4');
  const koinTeks = async () => Number((await page.locator('.chip-koin').first().innerText()).replace(/\D/g, ''));
  const koin0 = await koinTeks();
  await page.click('[data-clue]');
  const kartu = page.locator('[data-kartu-clue="1"]');
  await page.click('[data-beli-clue="1"]');
  await expect(kartu).toContainText(LEVEL_AWAL.find((l) => l.id === 'pantai-4').clue[0].slice(0, 20));
  await expect(page.locator('[data-koin-clue]')).toHaveText(String(koin0 - 5));
  await page.keyboard.press('Escape');
  await expect.poll(koinTeks).toBe(koin0 - 5);
});

test('guru A melihat siswa itu di Ringkasan, Siswa, Nilai, lalu mengunduh CSV', async ({ page }) => {
  const galat = pantauGalat(page);
  await buka(page, '#/guru/masuk');
  await page.fill('#g-username', d.guruA.username);
  await page.fill('#g-password', d.guruA.password);
  await page.click('[data-kirim]');
  await expect(page).toHaveURL(/#\/guru$/);
  await expect(page.locator('main')).toContainText(murid.panggilan); // aktivitas terbaru di Ringkasan

  await buka(page, '#/guru/siswa');
  await expect(page.locator('tbody')).toContainText(murid.nama);
  await expect(page.locator('tbody')).not.toContainText(d.siswa5[0].siswa.namaLengkap); // siswa Kelas Uji 5 tidak terlihat

  await buka(page, '#/guru/nilai');
  await expect(page.locator('main')).toContainText(murid.nama);
  const [unduhan] = await Promise.all([page.waitForEvent('download'), page.click('[data-ekspor]')]);
  expect(unduhan.suggestedFilename()).toMatch(/^nilai-kelas-uji-3-\d{4}-\d{2}-\d{2}\.csv$/);
  const isi = readFileSync(await unduhan.path(), 'utf8').replace(/^﻿/, '');
  const [kepala, ...baris] = isi.split('\r\n');
  expect(kepala.startsWith('Nama lengkap,Kelas,P1 Langkah Pertama,')).toBe(true);
  expect(kepala.endsWith(',Nilai akhir,Ditimpa,Alasan')).toBe(true);
  expect(baris.some((b) => b.startsWith(`${murid.nama},Kelas Uji 3,100,`))).toBe(true);
  expect(galat).toEqual([]);
});
