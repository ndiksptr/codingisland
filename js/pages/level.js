// js/pages/level.js — halaman bermain (#/level/:id)
// Kiri (±40%): kartu soal, chip perintah, editor, tombol. Kanan (±60%): panggung 16:9.
// Di HP panggung tampil di atas, editor di bawah.

import { esc, robot, tombol, bukaModal, toast } from '../ui.js';
import {
  getKelas, getProgres, getDrafKode, simpanDrafKode, getPreferensi, simpanPreferensi,
  catatPercobaan, tambahLamaBermain
} from '../store.js';
import { pindah } from '../router.js';
import { LABEL_JENIS } from '../data/levels.js';
import { ikonGembok, ikonBug, ikonPanah } from '../game/ikon.js';
import { buatEditor } from '../game/editor.js';
import { buatPanggung } from '../game/panggung.js';
import { jalankanKodeSiswa } from '../game/runner.js';
import { hitungBintang, NILAI_BINTANG } from '../game/skor.js';
import { kurangiGerak } from '../game/efek.js';
import { muatPeta } from './peta.js';

const KECEPATAN = { pelan: 700, normal: 400, cepat: 160 };
const URL_CONFETTI = 'https://esm.sh/canvas-confetti@1.9.3';
const BATAS_DETIK_SEGMEN = 600; // jeda lama tanpa aktivitas tidak dihitung lebih dari 10 menit

// Teks yang disisipkan chip perintah ('|' = posisi kursor)
const TEMPLAT = {
  maju: 'maju()',
  belok_kiri: 'belok_kiri()',
  belok_kanan: 'belok_kanan()',
  ambil: 'ambil()',
  lompat: 'lompat()',
  ulangi: 'ulangi 2 {\n  |\n}',
  jika: 'jika ada_rintangan() {\n  |\n}',
  selama: 'selama bukan sampai_tujuan() {\n  |\n}',
  buat: 'buat langkah = 2',
  ada_rintangan: 'ada_rintangan()',
  ada_jurang: 'ada_jurang()',
  ada_koin: 'ada_koin()',
  sampai_tujuan: 'sampai_tujuan()'
};
const STRUKTUR = ['ulangi', 'jika', 'selama', 'buat'];
const labelChip = (p) => (STRUKTUR.includes(p) ? p : `${p}()`);

function kartuInfo(isi) {
  return `
    <section class="mx-auto max-w-lg px-4 py-10 sm:py-14">
      <div class="kartu muncul flex flex-col items-center text-center gap-3">${isi}</div>
    </section>`;
}

// Tulis nama perintah di instruksi sebagai kode, mis. maju(4)
function formatInstruksi(teks) {
  return esc(teks).replace(/\b([a-z_]+\(\d*\))/g, '<code class="kode-inline">$1</code>');
}

// tujuanTeks boleh berupa objek {teks, jenis, jumlah} atau teks biasa
function normalkanTujuan(t) {
  if (typeof t !== 'string') return t;
  const ambil = t.match(/ambil\s+(\d+)/i);
  if (ambil) return { teks: t, jenis: 'ambil', jumlah: Number(ambil[1]) };
  if (/bendera|tujuan/i.test(t)) return { teks: t, jenis: 'sampai' };
  return { teks: t, jenis: 'lain' };
}

function sakelar(teks, attr, aktif) {
  return `
    <label class="sakelar">
      <input type="checkbox" role="switch" ${attr} ${aktif ? 'checked' : ''}>
      <span class="sakelar-jalur" aria-hidden="true"></span>
      <span>${esc(teks)}</span>
    </label>`;
}

let janjiConfetti = null;
async function ledakkanConfetti() {
  if (kurangiGerak()) return;
  try {
    janjiConfetti ||= import(URL_CONFETTI).then((m) => m.default);
    const confetti = await janjiConfetti;
    const warna = ['#287A74', '#55A9A0', '#AEEED3', '#FFF8B0', '#E8743B'];
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 }, colors: warna, disableForReducedMotion: true });
    setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { y: 0.4 }, colors: warna, disableForReducedMotion: true }), 250);
  } catch {
    janjiConfetti = null; // tanpa confetti pun tetap jalan
  }
}

export async function renderLevel(halaman, { params }) {
  const { siswa, status } = await muatPeta();
  let level = null;
  let sz = null;
  for (const z of status) {
    const l = z.levels.find((x) => x.id === params.id);
    if (l) { level = l; sz = z; break; }
  }

  // ---------- Level tidak ada / terkunci / belum siap ----------
  if (!level) {
    halaman.innerHTML = kartuInfo(`
      ${robot('kaget', { kelas: 'w-28 h-auto', alt: '' })}
      <h1 class="font-judul text-3xl font-extrabold text-teal-tua">Level tidak ditemukan</h1>
      <p class="text-lg">Mungkin level ini belum dibuka gurumu.</p>
      ${tombol({ teks: 'Kembali ke Peta', href: '#/peta', varian: 'utama' })}`);
    return;
  }
  const kembali = tombol({ teks: `Kembali ke ${sz.zona.nama}`, href: `#/peta/${sz.zona.id}`, varian: 'sekunder' });
  if (level.status === 'terkunci') {
    halaman.innerHTML = kartuInfo(`
      ${robot('sedih', { kelas: 'w-28 h-auto', alt: '' })}
      <span class="grid place-items-center w-14 h-14 rounded-full bg-latar">${ikonGembok(30)}</span>
      <h1 class="font-judul text-3xl font-extrabold text-teal-tua">Level ini masih terkunci</h1>
      <p class="text-lg">${sz.terbuka ? 'Selesaikan level sebelumnya dulu ya!' : `${esc(sz.syarat)} ya!`}</p>
      ${kembali}`);
    return;
  }
  if (!level.dunia) {
    halaman.innerHTML = kartuInfo(`
      ${robot('berpikir', { kelas: 'w-28 h-auto melayang', alt: '' })}
      <p class="font-bold text-teal-tua">${esc(sz.zona.nama)} · ${esc(LABEL_JENIS[level.jenis] || level.jenis)}</p>
      <h1 class="font-judul text-3xl font-extrabold text-teal-tua">Level ${level.nomor}: ${esc(level.judul)}</h1>
      <p class="rounded-2xl bg-kuning p-3 font-bold">Soal level ini sedang disiapkan Robot Tutor. Sebentar lagi siap!</p>
      ${kembali}`);
    return;
  }

  // ---------- Data pendukung ----------
  const [kelas, progresAwal, draf, pref] = await Promise.all([
    getKelas(siswa.kelasId),
    getProgres(siswa.id, level.id),
    getDrafKode(siswa.id, level.id),
    getPreferensi()
  ]);
  const tingkat = kelas?.tingkat ?? 3;
  const bantuBawaan = tingkat <= 4; // kelas 3–4: bantu ketik selalu aktif
  let bantuKetik = bantuBawaan || !!pref.bantuKetik;
  let kecepatan = KECEPATAN[pref.kecepatan] ? pref.kecepatan : 'normal';
  const tampilPetakAwal = pref.tampilPetak !== false;
  let progres = progresAwal;
  const perintah = level.perintahTersedia || Object.keys(TEMPLAT);
  const daftarTujuan = (level.tujuanTeks || []).map(normalkanTujuan);
  const kodeMula = draf ?? progres?.kodeTerakhir ?? level.kodeAwal ?? '';

  const lencana = level.jenis === 'debug'
    ? `${ikonBug(16)} ${LABEL_JENIS.debug}`
    : level.jenis === 'boss' ? `<img src="image/item/piala.png" alt="" class="w-5 h-5 object-contain"> ${LABEL_JENIS.boss}` : LABEL_JENIS.ketik;

  halaman.innerHTML = `
    <section class="mx-auto max-w-7xl px-3 sm:px-5 py-4 sm:py-6">
      <div class="flex items-center gap-2 mb-3">
        <a href="#/peta/${esc(sz.zona.id)}" class="tombol tombol-sekunder tombol-kecil" aria-label="Kembali ke peta ${esc(sz.zona.nama)}">
          ${ikonPanah('kiri', 20)}<span class="hidden sm:inline">${esc(sz.zona.nama)}</span>
        </a>
        <p class="font-bold text-teal-tua truncate">Pulau ${sz.zona.nomor} · Level ${level.nomor}</p>
      </div>

      <div class="grid gap-4 lg:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
        <!-- Kolom kiri: soal, perintah, editor -->
        <div class="order-2 lg:order-1 flex flex-col gap-4 min-w-0">
          <div class="kartu kartu-soal">
            <div class="flex flex-wrap items-center gap-2">
              <span class="lencana-jenis" data-jenis="${esc(level.jenis)}">${lencana}</span>
              ${progres?.selesai ? `<span class="text-sm font-bold">Terbaik: ${'★'.repeat(progres.bintang)}${'☆'.repeat(3 - progres.bintang)}</span>` : ''}
            </div>
            <h1 class="mt-2 font-judul text-3xl sm:text-4xl font-extrabold text-teal-tua leading-tight">${esc(level.judul)}</h1>
            <p class="mt-2 text-lg">${formatInstruksi(level.instruksi || level.ringkasan || '')}</p>
            ${daftarTujuan.length ? `
              <h2 class="mt-4 font-judul text-xl font-extrabold">Tujuan</h2>
              <ul class="daftar-tujuan mt-1">
                ${daftarTujuan.map((t, i) => `
                  <li data-tujuan="${i}"><span class="centang" aria-hidden="true"></span><span>${esc(t.teks)}</span><span class="sr-only" data-status-tujuan>belum</span></li>`).join('')}
              </ul>` : ''}
          </div>

          <div class="kartu py-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="font-judul text-xl font-extrabold">Perintah</h2>
              ${bantuBawaan
                ? '<span class="text-sm font-bold text-teal-tua">Klik perintah untuk menambahkannya</span>'
                : sakelar('Bantu ketik', 'data-sakelar-bantu', bantuKetik)}
            </div>
            <div class="mt-2 flex flex-wrap gap-2" data-chips>
              ${perintah.map((p) => `<button type="button" class="chip-perintah" data-chip="${esc(p)}">${esc(labelChip(p))}</button>`).join('')}
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="label-kolom mb-0">Kode</span>
              <span class="text-sm font-bold text-teal-tua" data-info-baris></span>
            </div>
            <div class="editor-kode" data-editor><p class="p-4 font-bold text-teal-tua">Menyiapkan editor...</p></div>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button type="button" class="tombol tombol-utama tombol-jalankan" data-jalankan>
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>
              <span>Jalankan</span>
            </button>
            ${tombol({ teks: 'Ulang Posisi', varian: 'sekunder', attr: 'data-ulang' })}
            <div class="pilihan-kecepatan" role="radiogroup" aria-label="Kecepatan robot">
              ${Object.keys(KECEPATAN).map((k) => `
                <label><input type="radio" name="kecepatan" value="${k}" ${k === kecepatan ? 'checked' : ''}><span>${k[0].toUpperCase() + k.slice(1)}</span></label>`).join('')}
            </div>
            <div data-slot-clue></div>
          </div>
        </div>

        <!-- Kolom kanan: panggung -->
        <div class="order-1 lg:order-2 lg:sticky lg:top-24 flex flex-col gap-2 min-w-0">
          <div data-wadah-panggung></div>
          <div class="flex flex-wrap items-center justify-between gap-2">
            ${sakelar('Tampilkan petak', 'data-sakelar-petak', tampilPetakAwal)}
            <span class="hidden sm:inline text-sm font-bold text-teal-tua">Ctrl + Enter untuk menjalankan</span>
          </div>
        </div>
      </div>
    </section>`;

  const $ = (s) => halaman.querySelector(s);
  const tombolJalankan = $('[data-jalankan]');
  const infoBaris = $('[data-info-baris]');

  // ---------- Panggung ----------
  const panggung = buatPanggung($('[data-wadah-panggung]'), { dunia: level.dunia, zona: sz.zona });
  panggung.tampilPetak(tampilPetakAwal);
  panggung.bicara(progres?.selesai ? 'Mau coba dapat bintang lebih banyak?' : 'Hai! Tulis kodenya, lalu tekan Jalankan.');

  // ---------- Editor + simpan otomatis ----------
  let timerDraf = null;
  let drafTertunda = null;
  const simpanDraf = () => {
    if (drafTertunda === null) return;
    simpanDrafKode(siswa.id, level.id, drafTertunda);
    drafTertunda = null;
  };
  const perbaruiInfoBaris = (kode) => {
    const n = String(kode).split('\n').filter((b) => { const t = b.replace(/\/\/.*$/, '').trim(); return t && !/^[}\s]+$/.test(t); }).length;
    infoBaris.textContent = level.batasBaris ? `${n} baris · target ⭐3: ≤ ${level.batasBaris}` : `${n} baris`;
    infoBaris.classList.toggle('text-oranye', !!level.batasBaris && n > level.batasBaris);
  };
  const editor = await buatEditor($('[data-editor]'), {
    nilai: kodeMula,
    saranKata: perintah,
    label: `Editor kode level ${level.judul}`,
    saatUbah: (kode) => {
      drafTertunda = kode;
      perbaruiInfoBaris(kode);
      clearTimeout(timerDraf);
      timerDraf = setTimeout(simpanDraf, 600);
    }
  });
  perbaruiInfoBaris(kodeMula);

  // ---------- Chip perintah (bantu ketik) ----------
  const aturChip = () => {
    halaman.querySelectorAll('[data-chip]').forEach((c) => {
      c.setAttribute('aria-disabled', String(!bantuKetik));
      c.title = bantuKetik ? `Tambahkan ${labelChip(c.dataset.chip)}` : 'Nyalakan "Bantu ketik" untuk menambahkan dengan klik';
    });
  };
  aturChip();
  $('[data-chips]').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip]');
    if (!chip) return;
    if (!bantuKetik) { toast('Nyalakan "Bantu ketik" dulu, atau ketik sendiri ya.', 'info'); return; }
    editor.sisipkan(TEMPLAT[chip.dataset.chip] || `${chip.dataset.chip}()`);
  });
  $('[data-sakelar-bantu]')?.addEventListener('change', (e) => {
    bantuKetik = e.target.checked;
    simpanPreferensi({ bantuKetik });
    aturChip();
  });
  $('[data-sakelar-petak]').addEventListener('change', (e) => {
    panggung.tampilPetak(e.target.checked);
    simpanPreferensi({ tampilPetak: e.target.checked });
  });
  halaman.querySelectorAll('[name="kecepatan"]').forEach((r) => r.addEventListener('change', () => {
    kecepatan = r.value;
    simpanPreferensi({ kecepatan });
  }));

  // ---------- Daftar tujuan bercentang ----------
  let jumlahAmbil = 0;
  function aturTujuan(i, tercapai) {
    const li = halaman.querySelector(`[data-tujuan="${i}"]`);
    if (!li) return;
    li.classList.toggle('tercapai', tercapai);
    li.querySelector('[data-status-tujuan]').textContent = tercapai ? 'tercapai' : 'belum';
  }
  function resetTujuan() {
    jumlahAmbil = 0;
    daftarTujuan.forEach((_, i) => aturTujuan(i, false));
  }
  function perbaruiTujuan(e) {
    if (e.jenis === 'ambil' && e.item) jumlahAmbil++;
    daftarTujuan.forEach((t, i) => {
      if (t.jenis === 'ambil' && jumlahAmbil >= (t.jumlah || 1)) aturTujuan(i, true);
      if (t.jenis === 'sampai' && e.jenis === 'selesai') aturTujuan(i, true);
    });
  }

  // ---------- Lama bermain ----------
  let tandaWaktu = Date.now();
  const ambilDetik = () => {
    const d = Math.min(BATAS_DETIK_SEGMEN, Math.round((Date.now() - tandaWaktu) / 1000));
    tandaWaktu = Date.now();
    return d;
  };

  // ---------- Level berikutnya ----------
  async function tujuanLanjut() {
    const { status: st } = await muatPeta();
    const iz = st.findIndex((z) => z.zona.id === sz.zona.id);
    const zonaKini = st[iz];
    const il = zonaKini.levels.findIndex((l) => l.id === level.id);
    const lanjut = zonaKini.levels[il + 1];
    if (lanjut) return { path: lanjut.status !== 'terkunci' ? `/level/${lanjut.id}` : `/peta/${zonaKini.zona.id}`, ada: true };
    const zonaBerikut = st[iz + 1];
    if (zonaBerikut?.terbuka) return { path: `/peta/${zonaBerikut.zona.id}`, ada: true };
    return { path: '/peta', ada: false };
  }

  // ---------- Modal hasil ----------
  async function tampilkanHasil({ bintang, nilai, koinDidapat, jumlahBaris, clueDibeli }) {
    let saran = '';
    if (bintang < 3) {
      saran = clueDibeli > 0
        ? 'Selesaikan tanpa clue untuk dapat lebih banyak bintang.'
        : `Coba pakai paling banyak ${level.batasBaris} baris untuk 3 bintang. Kodemu sekarang ${jumlahBaris} baris.`;
    }
    const lanjut = await tujuanLanjut();
    const pilihan = await bukaModal({
      judul: bintang === 3 ? 'Sempurna!' : 'Hebat, berhasil!',
      pose: 'gembira',
      isi: `
        <div class="flex justify-center items-end gap-1 my-2" role="img" aria-label="${bintang} dari 3 bintang">
          ${[1, 2, 3].map((n) => `<img src="image/item/bintang.png" alt="" class="bintang-hasil ${n === 2 ? 'tengah' : ''} ${n <= bintang ? 'bintang-muncul' : 'bintang-kosong'}" style="animation-delay:${0.2 + n * 0.35}s">`).join('')}
        </div>
        <p class="font-judul text-2xl font-extrabold">Nilai ${nilai}</p>
        ${koinDidapat > 0
          ? `<div class="mt-3 inline-flex items-center gap-2 rounded-2xl bg-kuning px-4 py-2 font-judul text-2xl font-extrabold muncul" style="animation-delay:1.4s">
               <img src="image/item/koin.png" alt="" class="w-9 h-9 object-contain"> +${koinDidapat} koin</div>`
          : '<p class="mt-2">Hadiah koin level ini sudah kamu ambil. Kejar bintang baru ya!</p>'}
        ${saran ? `<p class="mt-3 rounded-2xl bg-mint p-3 font-bold">${esc(saran)}</p>` : ''}`,
      tombol: [
        { teks: bintang < 3 ? 'Coba lagi untuk 3 bintang' : 'Main lagi', nilai: 'ulang', varian: 'sekunder' },
        { teks: lanjut.ada ? 'Lanjut ke level berikutnya' : 'Lihat Peta Pulau', nilai: 'lanjut', ikon: 'image/item/roket.png' }
      ]
    });
    if (pilihan === 'lanjut') pindah(lanjut.path);
    else {
      panggung.reset();
      resetTujuan();
      editor.bersihkanSorotan();
      editor.fokus();
    }
  }

  // ---------- Jalankan ----------
  let sedangJalan = false;
  let tokenJalan = null;
  let catatTertunda = null; // dicatat setelah animasi (atau saat batal/keluar halaman)
  const jalankanCatat = async () => {
    const f = catatTertunda;
    catatTertunda = null;
    return f ? f() : null;
  };

  function aturTombolJalan(jalan) {
    sedangJalan = jalan;
    tombolJalankan.disabled = jalan;
    tombolJalankan.querySelector('span').textContent = jalan ? 'Berjalan...' : 'Jalankan';
  }

  async function jalankan() {
    if (sedangJalan) return;
    aturTombolJalan(true);
    const token = { batal: false };
    tokenJalan = token;
    try {
      simpanDraf();
      panggung.reset();
      resetTujuan();
      editor.bersihkanSorotan();
      panggung.aturPose('berpikir');
      panggung.bicara('Hmm, aku baca kodenya dulu...');

      const kode = editor.getNilai();
      const hasil = await jalankanKodeSiswa(kode, level.dunia, { perintahTersedia: level.perintahTersedia });
      if (token.batal) return;

      const clueDibeli = progres?.clueDibeli || 0;
      const bintang = hitungBintang({ berhasil: hasil.berhasil, clueDibeli, jumlahBaris: hasil.jumlahBaris, batasBaris: level.batasBaris });
      const nilai = NILAI_BINTANG[bintang];
      const detik = ambilDetik();
      catatTertunda = () => catatPercobaan(siswa.id, level.id, {
        berhasil: hasil.berhasil, bintang, nilai, kode, detik, judul: level.judul
      });

      const jenisGalat = hasil.galat?.jenis;
      if (jenisGalat === 'sintaks') {
        await jalankanCatat();
        panggung.aturPose('salah');
        panggung.bicara(hasil.alasan);
        editor.tandaiGalat(hasil.galat.baris);
        return;
      }

      panggung.bicara(null);
      panggung.aturPose('hai');
      const tuntas = await panggung.animasikan(hasil.jejak, {
        durasi: KECEPATAN[kecepatan],
        token,
        saatPeristiwa: (e) => {
          if (e.baris) editor.sorotBaris(e.baris);
          perbaruiTujuan(e);
        }
      });
      const tercatat = await jalankanCatat();
      if (tercatat?.progres) progres = tercatat.progres;
      if (!tuntas || token.batal) return;
      editor.sorotBaris(null);

      if (hasil.berhasil) {
        panggung.aturPose('gembira');
        panggung.lompatGembira();
        panggung.bicara('Hore! Aku sampai!');
        ledakkanConfetti();
        await new Promise((r) => setTimeout(r, kurangiGerak() ? 0 : 800));
        if (token.batal) return;
        await tampilkanHasil({
          bintang, nilai, koinDidapat: tercatat?.koinDidapat || 0, jumlahBaris: hasil.jumlahBaris, clueDibeli
        });
        return;
      }

      // Gagal: ekspresi sesuai penyebab
      if (['tabrak', 'keluar', 'jatuh'].includes(jenisGalat)) {
        panggung.aturPose('kaget');
      } else if (['kelelahan', 'galat'].includes(jenisGalat)) {
        panggung.aturPose('salah');
      } else {
        panggung.aturPose('sedih');
      }
      if (hasil.galat?.baris) editor.tandaiGalat(hasil.galat.baris);
      panggung.bicara(hasil.alasan);
    } finally {
      if (tokenJalan === token) aturTombolJalan(false);
    }
  }

  tombolJalankan.addEventListener('click', jalankan);
  $('[data-ulang]').addEventListener('click', () => {
    if (tokenJalan) tokenJalan.batal = true;
    jalankanCatat();
    aturTombolJalan(false);
    panggung.reset();
    resetTujuan();
    editor.bersihkanSorotan();
    panggung.bicara('Siap! Aku kembali ke awal.');
  });

  // Ctrl/Cmd + Enter menjalankan kode
  const pintasan = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      jalankan();
    }
  };
  document.addEventListener('keydown', pintasan);

  // ---------- Bersihkan saat meninggalkan halaman ----------
  return () => {
    if (tokenJalan) tokenJalan.batal = true;
    document.removeEventListener('keydown', pintasan);
    clearTimeout(timerDraf);
    simpanDraf();
    jalankanCatat();
    tambahLamaBermain(siswa.id, level.id, ambilDetik());
    panggung.hancurkan();
    editor.hancurkan();
  };
}
