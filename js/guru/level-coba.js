// js/guru/level-coba.js — #/guru/level/:id/coba: guru mencoba level seperti siswa
// Memakai editor, panggung, dan runner yang sama dengan siswa, tetapi tidak menyimpan apa pun
// (tidak ada percobaan, koin, atau progres yang tercatat). Draf juga bisa dicoba.

import { esc } from '../ui.js';
import { guruGetLevel } from '../store.js';
import { cariZona } from '../data/zona.js';
import { LABEL_JENIS } from '../data/levels.js';
import { buatEditor } from '../game/editor.js';
import { buatPanggung } from '../game/panggung.js';
import { jalankanKodeSiswa } from '../game/runner.js';
import { hitungBintang, NILAI_BINTANG } from '../game/skor.js';
import { ikonBug } from '../game/ikon.js';
import { formatInstruksi, normalkanTujuan } from '../pages/level.js';
import { IKON } from './komponen.js';

export async function renderCobaLevel(wadah, { params }) {
  const l = await guruGetLevel(params.id);
  const zona = cariZona(l.zona);
  const tujuan = (l.tujuanTeks || []).map(normalkanTujuan);

  wadah.innerHTML = `
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <a href="#/guru/level" class="dg-tautan-kecil">← Kembali ke daftar level</a>
      ${l.bisaEdit ? `<a href="#/guru/level/${esc(l.id)}/edit" class="dg-tautan-kecil">Edit level ini</a>` : ''}
      <span class="dg-chip">Mode coba: tidak ada yang disimpan</span>
    </div>
    <div class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
      <div class="flex flex-col gap-4 min-w-0">
        <div class="kartu kartu-soal">
          <span class="lencana-jenis" data-jenis="${esc(l.jenis)}">${l.jenis === 'debug' ? ikonBug(16) : ''} ${esc(LABEL_JENIS[l.jenis])}</span>
          <h2 class="mt-2 font-judul text-3xl font-extrabold text-teal-tua leading-tight">${esc(l.judul)}</h2>
          <p class="mt-2 text-lg">${formatInstruksi(l.instruksi || l.ringkasan || '')}</p>
          ${tujuan.length ? `<ul class="daftar-tujuan mt-3">${tujuan.map((t) => `<li><span class="centang" aria-hidden="true"></span><span>${esc(t.teks)}</span></li>`).join('')}</ul>` : ''}
          <p class="mt-3 text-sm">Perintah: ${(l.perintahTersedia || []).map((p) => `<code class="kode-inline">${esc(p)}</code>`).join(' ')}</p>
        </div>
        <div class="editor-kode" data-editor><p class="p-3 text-sm">Menyiapkan editor...</p></div>
        <div class="flex flex-wrap items-center gap-3">
          <button type="button" class="tombol tombol-utama" data-jalankan>${IKON.main}<span>Jalankan</span></button>
          <button type="button" class="tombol tombol-sekunder" data-ulang>Ulang Posisi</button>
          <button type="button" class="tombol tombol-sekunder" data-isi-solusi>Isi dengan solusi</button>
          <button type="button" class="tombol tombol-sekunder" data-isi-awal>Kode awal</button>
        </div>
        <p class="font-bold" data-hasil role="status"></p>
      </div>
      <div class="xl:sticky xl:top-20 min-w-0">
        <div data-panggung class="${l.jenis === 'boss' ? 'bingkai-boss' : ''}"></div>
      </div>
    </div>`;

  const $ = (s) => wadah.querySelector(s);
  const editor = await buatEditor($('[data-editor]'), { nilai: l.kodeAwal || '', saranKata: l.perintahTersedia || [], label: 'Kode coba' });
  const panggung = buatPanggung($('[data-panggung]'), { dunia: l.dunia, zona });
  panggung.tampilPetak(true);
  panggung.bicara('Mode coba untuk guru. Tulis kode lalu tekan Jalankan.');
  let token = { batal: false };

  async function jalankan() {
    const tombol = $('[data-jalankan]');
    tombol.disabled = true;
    token.batal = true;
    token = { batal: false };
    const t = token;
    try {
      panggung.reset();
      editor.bersihkanSorotan();
      panggung.aturPose('berpikir');
      const hasil = await jalankanKodeSiswa(editor.getNilai(), l.dunia, { perintahTersedia: l.perintahTersedia });
      if (hasil.galat?.jenis === 'sintaks') {
        panggung.aturPose('salah');
        panggung.bicara(hasil.alasan);
        editor.tandaiGalat(hasil.galat.baris);
      } else {
        panggung.aturPose('hai');
        await panggung.animasikan(hasil.jejak, { durasi: 350, token: t, saatPeristiwa: (e) => e.baris && editor.sorotBaris(e.baris) });
        if (t.batal) return;
        editor.sorotBaris(null);
        panggung.aturPose(hasil.berhasil ? 'gembira' : ['tabrak', 'keluar', 'jatuh'].includes(hasil.galat?.jenis) ? 'kaget' : 'sedih');
        if (hasil.berhasil) panggung.lompatGembira();
        panggung.bicara(hasil.alasan);
        if (!hasil.berhasil && hasil.galat?.baris) editor.tandaiGalat(hasil.galat.baris);
      }
      const bintang = hitungBintang({ berhasil: hasil.berhasil, clueDibeli: 0, jumlahBaris: hasil.jumlahBaris, batasBaris: l.batasBaris });
      $('[data-hasil]').textContent = hasil.berhasil
        ? `Berhasil! Siswa tanpa clue akan mendapat ${bintang} bintang (nilai ${NILAI_BINTANG[bintang]}). Kode ${hasil.jumlahBaris} baris, batas bintang 3: ${l.batasBaris} baris.`
        : `Belum berhasil: ${hasil.alasan}`;
    } finally {
      tombol.disabled = false;
    }
  }

  wadah.addEventListener('click', (e) => {
    if (e.target.closest('[data-jalankan]')) jalankan();
    if (e.target.closest('[data-ulang]')) { token.batal = true; panggung.reset(); editor.bersihkanSorotan(); $('[data-hasil]').textContent = ''; }
    if (e.target.closest('[data-isi-solusi]')) editor.setNilai(l.solusi || '');
    if (e.target.closest('[data-isi-awal]')) editor.setNilai(l.kodeAwal || '');
  });

  return () => {
    token.batal = true;
    panggung.hancurkan();
    editor.hancurkan();
  };
}
