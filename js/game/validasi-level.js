// js/game/validasi-level.js — periksa data level lewat interpreter
// Dipakai editor level guru (tombol Terbitkan), store.js (sebelum menyimpan level terbit),
// dan ciDev.validasiLevel(). Fungsi murni (tanpa DOM), bisa dijalankan di Node.

import { jalankanKode, hitungJumlahBaris } from './interpreter.js';

/**
 * Daftar alasan sebuah level belum boleh diterbitkan (kosong = siap).
 * Solusi harus berhasil dan tidak melebihi batasBaris; kode awal tidak boleh langsung berhasil;
 * level debug wajib punya kode awal yang salah logika.
 */
export function alasanBelumSiap(l) {
  const alasan = [];
  if (!l.judul || String(l.judul).trim().length < 3) alasan.push('Judul minimal 3 huruf.');
  if (!l.dunia?.robot) alasan.push('Taruh robot di panggung.');
  if (!l.dunia?.tujuan) alasan.push('Taruh bendera tujuan di panggung.');
  if (!Array.isArray(l.perintahTersedia) || !l.perintahTersedia.length) alasan.push('Pilih minimal satu perintah.');
  if (!Array.isArray(l.tujuanTeks) || !l.tujuanTeks.length) alasan.push('Tambahkan minimal satu tujuan.');
  if (!Array.isArray(l.clue) || l.clue.length !== 3 || l.clue.some((c) => !String(c || '').trim())) alasan.push('Isi ketiga clue.');
  if (!l.dunia?.robot || !l.dunia?.tujuan) return alasan;

  const opsi = { perintahTersedia: l.perintahTersedia || null };
  if (!String(l.solusi || '').trim()) {
    alasan.push('Solusi belum diisi.');
  } else {
    const h = jalankanKode(l.solusi, l.dunia, opsi);
    if (!h.berhasil) alasan.push(`Solusi belum berhasil: ${h.alasan}`);
    else if (l.batasBaris && h.jumlahBaris > l.batasBaris) alasan.push(`Solusi ${h.jumlahBaris} baris, melebihi batas bintang 3 (${l.batasBaris} baris).`);
  }

  const adaKodeAwal = hitungJumlahBaris(l.kodeAwal || '') > 0;
  if (l.jenis === 'debug') {
    if (!adaKodeAwal) alasan.push('Level debug wajib punya kode awal yang sengaja salah.');
    else {
      const k = jalankanKode(l.kodeAwal, l.dunia, opsi);
      if (k.berhasil) alasan.push('Kode awal level debug masih berhasil. Buat kodenya salah dulu.');
      else if (k.galat?.jenis === 'sintaks') alasan.push(`Kode awal debug sebaiknya salah logika, bukan salah tulis (${k.alasan}).`);
    }
  } else if (adaKodeAwal && jalankanKode(l.kodeAwal, l.dunia, opsi).berhasil) {
    alasan.push('Kode awal sudah langsung berhasil. Kosongkan atau ubah kode awalnya.');
  }

  const wajib = (l.dunia.item || []).filter((it) => it.wajib !== false).length;
  const targetAmbil = (l.tujuanTeks || []).filter((t) => t.jenis === 'ambil').reduce((n, t) => n + (Number(t.jumlah) || 0), 0);
  if (wajib !== targetAmbil) alasan.push(`Tujuan "ambil" (${targetAmbil}) belum sama dengan jumlah koin wajib di panggung (${wajib}).`);
  return alasan;
}

/**
 * Periksa banyak level sekaligus. Hasil: array baris tabel
 * { id, jenis, berhasil, jumlahBaris, batasBaris, kodeAwalGagal, lulus, catatan }
 */
export function validasiLevel(levels) {
  return levels.map((l) => {
    if (!l.dunia) {
      return { id: l.id, jenis: l.jenis, berhasil: false, jumlahBaris: 0, batasBaris: l.batasBaris ?? null, kodeAwalGagal: null, lulus: false, catatan: 'belum ada dunia' };
    }
    const opsi = { perintahTersedia: l.perintahTersedia || null };
    const hasil = jalankanKode(l.solusi || '', l.dunia, opsi);
    const awal = jalankanKode(l.kodeAwal || '', l.dunia, opsi);
    const masalah = alasanBelumSiap(l);
    return {
      id: l.id,
      jenis: l.jenis,
      berhasil: hasil.berhasil,
      jumlahBaris: hasil.jumlahBaris,
      batasBaris: l.batasBaris ?? null,
      kodeAwalGagal: !awal.berhasil,
      lulus: masalah.length === 0,
      catatan: masalah.join(' ') || 'OK'
    };
  });
}
