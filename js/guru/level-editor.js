// js/guru/level-editor.js — #/guru/level/baru dan #/guru/level/:id/edit
// Kiri: form soal (judul, zona, jenis, tingkat, instruksi + pratinjau, tujuan, perintah, kode awal,
// solusi, batas baris, clue, kelas tujuan). Kanan: editor dunia di atas panggung yang sama dengan siswa.
// "Terbitkan" hanya aktif jika lolos alasanBelumSiap() — store memeriksanya lagi saat menyimpan.

import { esc, toast, gambarRobot } from '../ui.js';
import { guruGetLevel, guruSimpanLevel } from '../store.js';
import { pindah } from '../router.js';
import { ZONA, cariZona } from '../data/zona.js';
import { LABEL_JENIS, PERINTAH_ZONA } from '../data/levels.js';
import { SEMUA_PERINTAH, hitungJumlahBaris, jalankanKode } from '../game/interpreter.js';
import { alasanBelumSiap } from '../game/validasi-level.js';
import { buatEditor } from '../game/editor.js';
import { buatPanggung } from '../game/panggung.js';
import { jalankanKodeSiswa } from '../game/runner.js';
import { CLUE } from '../game/skor.js';
import { ikonBendera, ikonBug, svgRintangan } from '../game/ikon.js';
import { formatInstruksi } from '../pages/level.js';
import { IKON } from './komponen.js';

const RINTANGAN_ZONA = { pantai: 'batu', laut: 'karang', gurun: 'kaktus', salju: 'es' };
const ARAH = ['timur', 'selatan', 'barat', 'utara'];
const MAKS_UNDO = 20;
const salin = (o) => JSON.parse(JSON.stringify(o));

const ALAT = [
  { id: 'robot', teks: 'Robot', bantuan: 'Klik petak untuk menaruh robot. Klik robot untuk memutar arahnya.' },
  { id: 'bendera', teks: 'Bendera', bantuan: 'Klik petak untuk menaruh bendera tujuan (hanya satu).' },
  { id: 'koin', teks: 'Koin wajib', bantuan: 'Koin wajib harus diambil siswa sebelum ke bendera.' },
  { id: 'berlian', teks: 'Berlian bonus', bantuan: 'Berlian bonus boleh diambil, tidak wajib.' },
  { id: 'rintangan', teks: 'Rintangan', bantuan: 'Rintangan mengikuti zona: batu, karang, kaktus, atau es.' },
  { id: 'jurang', teks: 'Jurang', bantuan: 'Jurang harus dilompati dengan lompat().' },
  { id: 'hapus', teks: 'Penghapus', bantuan: 'Klik benda untuk menghapusnya. Robot tidak bisa dihapus, pindahkan saja.' }
];

function ikonAlat(id, zona) {
  switch (id) {
    case 'robot': return `<img src="${gambarRobot('hai')}" alt="">`;
    case 'bendera': return ikonBendera();
    case 'koin': return '<img src="image/item/koin.png" alt="">';
    case 'berlian': return '<img src="image/item/berlian.png" alt="">';
    case 'rintangan': return svgRintangan(RINTANGAN_ZONA[zona], zona);
    case 'jurang': return '<span class="jurang-mini"></span>';
    default: return IKON.penghapus;
  }
}

const duniaBawaan = () => ({
  kolom: 8, baris: 5,
  robot: { x: 0, y: 2, arah: 'timur' },
  tujuan: { x: 7, y: 2 },
  item: [], rintangan: [], jurang: []
});

export async function renderEditorLevel(wadah, { params, konteks }) {
  const lama = params.id ? await guruGetLevel(params.id) : null;
  if (lama && !lama.bisaEdit) {
    throw new Error('Anda hanya bisa mengedit level buatan Anda sendiri. Gunakan Duplikat untuk membuat salinan yang bisa diedit.');
  }
  const admin = konteks.admin;
  const tingkatGuru = [...new Set(konteks.kelas.map((k) => k.tingkat))].sort();

  // ---------- Keadaan form ----------
  const st = lama ? {
    judul: lama.judul, zona: lama.zona, jenis: lama.jenis, tingkat: lama.tingkat || [3, 4, 5, 6],
    instruksi: lama.instruksi || '', tantanganBonus: lama.tantanganBonus || '',
    tujuanTeks: salin(lama.tujuanTeks || []), perintahTersedia: (lama.perintahTersedia || []).slice(),
    batasBaris: lama.batasBaris || 1, clue: (lama.clue || ['', '', '']).slice(), kelasIds: lama.kelasIds ? lama.kelasIds.slice() : null,
    dunia: salin(lama.dunia), status: lama.status
  } : {
    judul: '', zona: 'pantai', jenis: 'ketik', tingkat: tingkatGuru.length ? tingkatGuru : [3, 4, 5, 6],
    instruksi: '', tantanganBonus: '', tujuanTeks: [{ teks: 'Sampai di bendera', jenis: 'sampai' }],
    perintahTersedia: PERINTAH_ZONA.pantai.slice(), batasBaris: 1, clue: ['', '', ''],
    kelasIds: admin ? null : konteks.kelas.map((k) => k.id), dunia: duniaBawaan(), status: 'baru'
  };
  let perintahManual = !!lama;
  let tujuanManual = !!lama;
  let batasManual = !!lama;
  let alat = 'robot';
  const riwayat = [];

  const opsiKolom = [...new Set([6, 7, 8, 9, 10, st.dunia.kolom])].sort((a, b) => a - b);
  const opsiBaris = [...new Set([4, 5, 6, st.dunia.baris])].sort((a, b) => a - b);
  const labelStatus = { baru: 'Level baru', draf: 'Draf', terbit: 'Terbit', nonaktif: 'Nonaktif', sebagian: 'Sebagian nonaktif' };

  wadah.innerHTML = `
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <a href="#/guru/level" class="dg-tautan-kecil">← Kembali ke daftar level</a>
      <span class="dg-lencana" data-jenis="${st.status === 'terbit' ? 'selesai' : 'clue'}" data-status-level>${esc(labelStatus[st.status] || st.status)}</span>
      ${lama?.bawaan ? '<span class="dg-chip">Level bawaan (diedit admin)</span>' : ''}
    </div>

    <div class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-start">
      <!-- ================= Kiri: form ================= -->
      <div class="flex flex-col gap-5 min-w-0">
        <section class="dg-kartu">
          <h2 class="dg-subjudul mb-3">Informasi level</h2>
          <div class="dg-form-grid">
            <label class="dg-label sm:col-span-2">Judul<input class="dg-input" data-isi="judul" maxlength="60" placeholder="Contoh: Jembatan Kayu" value="${esc(st.judul)}"></label>
            <label class="dg-label">Zona
              <select class="dg-input" data-isi="zona">${ZONA.map((z) => `<option value="${z.id}" ${z.id === st.zona ? 'selected' : ''}>${esc(z.nama)} (${esc(z.konsep)})</option>`).join('')}</select>
            </label>
            <label class="dg-label">Jenis
              <select class="dg-input" data-isi="jenis">${Object.entries(LABEL_JENIS).map(([k, v]) => `<option value="${k}" ${k === st.jenis ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
            </label>
          </div>
          <fieldset class="mt-3">
            <legend class="dg-label">Tingkat kelas sasaran</legend>
            <div class="flex flex-wrap gap-4 mt-1">
              ${[3, 4, 5, 6].map((t) => `<label class="dg-centang"><input type="checkbox" data-tingkat value="${t}" ${st.tingkat.includes(t) ? 'checked' : ''}> Kelas ${t}</label>`).join('')}
            </div>
          </fieldset>
          <fieldset class="mt-3">
            <legend class="dg-label">Kelas tujuan <span class="font-normal text-sm">(hanya siswa kelas ini yang melihat level saat terbit)</span></legend>
            <div class="dg-pilihan-grid">
              ${admin ? `<label class="dg-centang"><input type="checkbox" data-semua-kelas ${st.kelasIds === null ? 'checked' : ''}> Semua kelas</label>` : ''}
              ${konteks.kelas.map((k) => `<label class="dg-centang"><input type="checkbox" data-kelas value="${esc(k.id)}" ${st.kelasIds === null || st.kelasIds.includes(k.id) ? 'checked' : ''} ${st.kelasIds === null ? 'disabled' : ''}> ${esc(k.nama)}</label>`).join('')}
            </div>
          </fieldset>
        </section>

        <section class="dg-kartu">
          <h2 class="dg-subjudul mb-3">Instruksi untuk siswa</h2>
          <label class="dg-label">Instruksi (singkat)<textarea class="dg-input min-h-[5rem]" data-isi="instruksi" maxlength="500" placeholder="Contoh: Lompati jurang dan ambil koin, lalu ke bendera!">${esc(st.instruksi)}</textarea></label>
          <label class="dg-label mt-3">Tantangan bonus <span class="font-normal text-sm">(opsional, tampil untuk kelas 5–6)</span>
            <input class="dg-input" data-isi="tantanganBonus" maxlength="200" value="${esc(st.tantanganBonus)}">
          </label>
          <p class="dg-label mt-4">Pratinjau tampilan siswa</p>
          <div class="pratinjau-siswa" data-pratinjau></div>
        </section>

        <section class="dg-kartu">
          <div class="dg-kartu-kepala mb-2">
            <h2 class="dg-subjudul">Tujuan</h2>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="tombol tombol-sekunder tombol-kecil" data-tujuan-otomatis>Isi dari panggung</button>
              <button type="button" class="tombol tombol-sekunder tombol-kecil" data-tujuan-tambah>${IKON.tambah}<span>Tambah</span></button>
            </div>
          </div>
          <div class="flex flex-col gap-2" data-daftar-tujuan></div>
        </section>

        <section class="dg-kartu">
          <div class="dg-kartu-kepala mb-2">
            <h2 class="dg-subjudul">Perintah yang tersedia</h2>
            <button type="button" class="tombol tombol-sekunder tombol-kecil" data-perintah-zona>Sesuaikan dengan zona</button>
          </div>
          <div class="dg-pilihan-grid" data-daftar-perintah>
            ${SEMUA_PERINTAH.map((p) => `<label class="dg-centang font-kode text-sm"><input type="checkbox" data-perintah value="${p}"> ${p}</label>`).join('')}
          </div>
        </section>

        <section class="dg-kartu">
          <h2 class="dg-subjudul mb-3">Kode</h2>
          <p class="dg-label">Kode awal <span class="font-normal text-sm" data-catatan-kode-awal></span></p>
          <div class="editor-kode mt-1" data-editor-awal><p class="p-3 text-sm">Menyiapkan editor...</p></div>
          <p class="dg-label mt-4">Solusi <span class="font-normal text-sm">(wajib; dipakai untuk menguji level)</span></p>
          <div class="editor-kode mt-1" data-editor-solusi><p class="p-3 text-sm">Menyiapkan editor...</p></div>
          <div class="mt-3 flex flex-wrap items-end gap-3">
            <label class="dg-label">Batas baris untuk bintang 3
              <input type="number" min="1" max="50" class="dg-input w-32" data-isi="batasBaris" value="${st.batasBaris}">
            </label>
            <p class="text-sm text-teal-tua font-bold pb-2" data-saran-baris></p>
          </div>
        </section>

        <section class="dg-kartu">
          <h2 class="dg-subjudul mb-3">Clue</h2>
          ${CLUE.map((c, i) => `
            <label class="dg-label ${i ? 'mt-3' : ''}">Clue ${c.nomor}: ${esc(c.nama)}
              <textarea class="dg-input min-h-[3.5rem]" data-clue="${i}" maxlength="500">${esc(st.clue[i] || '')}</textarea>
            </label>`).join('')}
        </section>
      </div>

      <!-- ================= Kanan: editor dunia ================= -->
      <div class="xl:sticky xl:top-20 flex flex-col gap-4 min-w-0">
        <section class="dg-kartu">
          <div class="dg-kartu-kepala mb-3">
            <h2 class="dg-subjudul">Editor dunia</h2>
            <div class="flex flex-wrap items-center gap-2">
              <label class="dg-label-sebaris">Kolom<select class="dg-input" data-ukuran="kolom">${opsiKolom.map((n) => `<option ${n === st.dunia.kolom ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
              <label class="dg-label-sebaris">Baris<select class="dg-input" data-ukuran="baris">${opsiBaris.map((n) => `<option ${n === st.dunia.baris ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
              <button type="button" class="tombol tombol-sekunder tombol-kecil" data-undo disabled>${IKON.undo}<span>Undo</span></button>
            </div>
          </div>
          <div class="palet-alat" role="toolbar" aria-label="Alat editor dunia" data-palet></div>
          <p class="text-sm mt-2 min-h-[1.25rem]" data-bantuan-alat></p>
          <div class="mt-2" data-wadah-panggung></div>
        </section>

        <section class="dg-kartu">
          <div class="flex flex-wrap items-center gap-3">
            <button type="button" class="tombol tombol-sekunder" data-uji>${IKON.main}<span>Uji Jawaban</span></button>
            <p class="text-sm font-bold flex-1 min-w-[12rem]" data-hasil-uji role="status"></p>
          </div>
          <div class="mt-4 dg-status-terbit" data-status-terbit></div>
          <div class="mt-3 flex flex-wrap gap-3 justify-end">
            <button type="button" class="tombol tombol-sekunder" data-simpan-draf>Simpan Draf</button>
            <button type="button" class="tombol tombol-utama" data-terbitkan>Terbitkan</button>
          </div>
        </section>
      </div>
    </div>`;

  const $ = (s) => wadah.querySelector(s);
  const $$ = (s) => [...wadah.querySelectorAll(s)];

  // =====================================================================
  // Editor kode (CodeMirror atau textarea cadangan)
  // =====================================================================
  let jadwal = null;
  const jadwalkan = () => { clearTimeout(jadwal); jadwal = setTimeout(perbaruiStatus, 300); };
  const [editorAwal, editorSolusi] = await Promise.all([
    buatEditor($('[data-editor-awal]'), { nilai: lama?.kodeAwal || '', saranKata: SEMUA_PERINTAH, label: 'Kode awal', saatUbah: jadwalkan }),
    buatEditor($('[data-editor-solusi]'), { nilai: lama?.solusi || '', saranKata: SEMUA_PERINTAH, label: 'Solusi', saatUbah: () => { sarankanBatas(); jadwalkan(); } })
  ]);

  // =====================================================================
  // Data level dari form
  // =====================================================================
  function dataLevel() {
    return {
      id: lama?.id,
      judul: st.judul.trim(),
      zona: st.zona,
      jenis: st.jenis,
      tingkat: st.tingkat,
      instruksi: st.instruksi,
      tantanganBonus: st.tantanganBonus,
      tujuanTeks: st.tujuanTeks,
      perintahTersedia: st.perintahTersedia,
      kodeAwal: editorAwal.getNilai(),
      solusi: editorSolusi.getNilai(),
      batasBaris: st.batasBaris,
      clue: st.clue,
      kelasIds: st.kelasIds,
      dunia: st.dunia
    };
  }

  // ---------- Pratinjau seperti tampilan siswa ----------
  function gambarPratinjau() {
    $('[data-pratinjau]').innerHTML = `
      <div class="kartu kartu-soal">
        <span class="lencana-jenis" data-jenis="${esc(st.jenis)}">${st.jenis === 'debug' ? ikonBug(16) : ''} ${esc(LABEL_JENIS[st.jenis])}</span>
        <h3 class="mt-2 font-judul text-2xl font-extrabold text-teal-tua leading-tight">${esc(st.judul || 'Judul level')}</h3>
        <p class="mt-1 text-lg">${st.instruksi ? formatInstruksi(st.instruksi) : '<span class="text-[#6E8F8A]">Instruksi akan tampil di sini.</span>'}</p>
        ${st.tantanganBonus ? `<p class="tantangan-bonus mt-2"><img src="image/item/berlian.png" alt="" class="w-6 h-6 object-contain shrink-0"><span><strong>Tantangan bonus:</strong> ${formatInstruksi(st.tantanganBonus)}</span></p>` : ''}
        ${st.tujuanTeks.length ? `<ul class="daftar-tujuan mt-3">${st.tujuanTeks.map((t) => `<li><span class="centang" aria-hidden="true"></span><span>${esc(t.teks)}</span></li>`).join('')}</ul>` : ''}
      </div>`;
  }

  // ---------- Tujuan ----------
  const jumlahKoinWajib = () => st.dunia.item.filter((it) => it.wajib !== false).length;
  function tujuanOtomatis() {
    const n = jumlahKoinWajib();
    st.tujuanTeks = [...(n ? [{ teks: `Ambil ${n} koin`, jenis: 'ambil', jumlah: n }] : []), { teks: 'Sampai di bendera', jenis: 'sampai' }];
  }
  function gambarTujuan() {
    $('[data-daftar-tujuan]').innerHTML = st.tujuanTeks.map((t, i) => `
      <div class="flex flex-wrap items-center gap-2" data-baris-tujuan="${i}">
        <select class="dg-input w-auto" data-tujuan-jenis aria-label="Jenis tujuan">
          <option value="sampai" ${t.jenis === 'sampai' ? 'selected' : ''}>Sampai bendera</option>
          <option value="ambil" ${t.jenis === 'ambil' ? 'selected' : ''}>Ambil koin</option>
        </select>
        ${t.jenis === 'ambil' ? `<input type="number" min="1" max="20" class="dg-input w-20" data-tujuan-jumlah value="${t.jumlah || 1}" aria-label="Jumlah koin">` : ''}
        <input class="dg-input flex-1 min-w-[10rem]" data-tujuan-teks maxlength="80" value="${esc(t.teks)}" aria-label="Teks tujuan">
        <button type="button" class="dg-tombol-ikon bahaya" data-tujuan-hapus aria-label="Hapus tujuan">${IKON.hapus}</button>
      </div>`).join('') || '<p class="text-sm">Belum ada tujuan.</p>';
  }

  // ---------- Perintah ----------
  function gambarPerintah() {
    $$('[data-perintah]').forEach((c) => { c.checked = st.perintahTersedia.includes(c.value); });
  }

  // ---------- Saran batas baris ----------
  function sarankanBatas() {
    const n = Math.max(1, hitungJumlahBaris(editorSolusi.getNilai()));
    $('[data-saran-baris]').textContent = `Saran dari solusi: ${n} baris`;
    if (!batasManual) {
      st.batasBaris = n;
      $('[data-isi="batasBaris"]').value = n;
    }
  }

  // ---------- Status siap terbit ----------
  function perbaruiStatus() {
    const data = dataLevel();
    const alasan = alasanBelumSiap(data);
    const tombol = $('[data-terbitkan]');
    tombol.disabled = alasan.length > 0;
    $('[data-status-terbit]').innerHTML = alasan.length
      ? `<p class="font-bold text-[#B24E1C]">Belum bisa diterbitkan:</p><ul class="dg-alasan">${alasan.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`
      : `<p class="font-bold text-teal-tua flex items-center gap-2">${IKON.periksa} Siap diterbitkan. Solusi berhasil${st.jenis === 'debug' ? ' dan kode awal gagal' : ''}.</p>`;
    $('[data-catatan-kode-awal]').textContent = st.jenis === 'debug'
      ? '(wajib: kode yang sengaja salah untuk diperbaiki siswa)'
      : '(opsional: isi editor saat siswa membuka level)';
    gambarPratinjau();
  }

  // =====================================================================
  // Editor dunia
  // =====================================================================
  const wadahPanggung = $('[data-wadah-panggung]');
  let panggung = null;
  let sedangUji = false;

  function isiPetak(x, y) {
    const d = st.dunia;
    if (d.robot && d.robot.x === x && d.robot.y === y) return 'robot';
    if (d.tujuan && d.tujuan.x === x && d.tujuan.y === y) return 'bendera';
    if (d.item.some((o) => o.x === x && o.y === y)) return 'item';
    if (d.rintangan.some((o) => o.x === x && o.y === y)) return 'rintangan';
    if (d.jurang.some((o) => o.x === x && o.y === y)) return 'jurang';
    return null;
  }

  function gambarPanggung() {
    panggung?.hancurkan();
    const zona = cariZona(st.zona);
    // Panggung butuh tujuan untuk digambar; tanpa bendera cukup tidak ditampilkan
    panggung = buatPanggung(wadahPanggung, { dunia: st.dunia, zona });
    panggung.tampilPetak(true);
    wadahPanggung.classList.toggle('bingkai-boss', st.jenis === 'boss');
    const grid = wadahPanggung.querySelector('[data-grid]');
    const lapis = document.createElement('div');
    lapis.className = 'lapisan-klik';
    lapis.style.gridTemplateColumns = `repeat(${st.dunia.kolom}, 1fr)`;
    lapis.style.gridTemplateRows = `repeat(${st.dunia.baris}, 1fr)`;
    for (let y = 0; y < st.dunia.baris; y++) {
      for (let x = 0; x < st.dunia.kolom; x++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.x = x;
        b.dataset.y = y;
        const isi = isiPetak(x, y);
        b.setAttribute('aria-label', `Petak kolom ${x + 1}, baris ${y + 1}${isi ? `, berisi ${isi}` : ', kosong'}`);
        lapis.appendChild(b);
      }
    }
    grid.appendChild(lapis);
  }

  function gambarPalet() {
    $('[data-palet]').innerHTML = ALAT.map((a) => `
      <button type="button" class="alat-tombol" data-alat="${a.id}" aria-pressed="${a.id === alat}">
        <span class="alat-ikon">${ikonAlat(a.id, st.zona)}</span><span>${esc(a.teks)}</span>
      </button>`).join('');
    $('[data-bantuan-alat]').textContent = ALAT.find((a) => a.id === alat).bantuan;
  }

  function simpanRiwayat() {
    riwayat.push(salin(st.dunia));
    if (riwayat.length > MAKS_UNDO) riwayat.shift();
    $('[data-undo]').disabled = false;
  }

  function setelahUbahDunia() {
    if (!tujuanManual) { tujuanOtomatis(); gambarTujuan(); }
    gambarPanggung();
    jadwalkan();
  }

  function klikPetak(x, y) {
    const d = st.dunia;
    const isi = isiPetak(x, y);
    const penuh = () => toast('Petak sudah terisi. Pakai Penghapus dulu.', 'info');

    if (alat === 'robot') {
      if (isi === 'robot') {
        simpanRiwayat();
        d.robot.arah = ARAH[(ARAH.indexOf(d.robot.arah) + 1) % 4];
      } else if (isi) return penuh();
      else { simpanRiwayat(); d.robot = { x, y, arah: d.robot?.arah || 'timur' }; }
    } else if (alat === 'bendera') {
      if (isi === 'bendera') return undefined;
      if (isi) return penuh();
      simpanRiwayat();
      d.tujuan = { x, y };
    } else if (alat === 'hapus') {
      if (!isi) return undefined;
      if (isi === 'robot') return toast('Robot tidak bisa dihapus. Pilih alat Robot lalu klik petak lain untuk memindahkannya.', 'info');
      simpanRiwayat();
      if (isi === 'bendera') d.tujuan = null;
      d.item = d.item.filter((o) => o.x !== x || o.y !== y);
      d.rintangan = d.rintangan.filter((o) => o.x !== x || o.y !== y);
      d.jurang = d.jurang.filter((o) => o.x !== x || o.y !== y);
    } else {
      if (isi) return penuh();
      simpanRiwayat();
      if (alat === 'koin') d.item.push({ jenis: 'koin', x, y, wajib: true });
      if (alat === 'berlian') d.item.push({ jenis: 'berlian', x, y, wajib: false });
      if (alat === 'rintangan') d.rintangan.push({ jenis: RINTANGAN_ZONA[st.zona], x, y });
      if (alat === 'jurang') d.jurang.push({ x, y });
    }
    setelahUbahDunia();
    return undefined;
  }

  function undo() {
    const sebelumnya = riwayat.pop();
    if (!sebelumnya) return;
    st.dunia = sebelumnya;
    $('[data-undo]').disabled = riwayat.length === 0;
    $('[data-ukuran="kolom"]').value = st.dunia.kolom;
    $('[data-ukuran="baris"]').value = st.dunia.baris;
    setelahUbahDunia();
  }

  function ubahUkuran(kolom, baris) {
    simpanRiwayat();
    const d = st.dunia;
    const dalam = (o) => o.x < kolom && o.y < baris;
    d.kolom = kolom;
    d.baris = baris;
    d.item = d.item.filter(dalam);
    d.rintangan = d.rintangan.filter(dalam);
    d.jurang = d.jurang.filter(dalam);
    if (d.tujuan && !dalam(d.tujuan)) d.tujuan = null;
    if (!dalam(d.robot)) {
      // Cari petak kosong pertama untuk robot
      d.robot = null;
      for (let y = 0; y < baris && !d.robot; y++) {
        for (let x = 0; x < kolom && !d.robot; x++) if (!isiPetak(x, y)) d.robot = { x, y, arah: 'timur' };
      }
    }
    setelahUbahDunia();
  }

  // =====================================================================
  // Uji jawaban (animasi seperti siswa)
  // =====================================================================
  async function ujiJawaban() {
    if (sedangUji) return;
    const data = dataLevel();
    const hasilUji = $('[data-hasil-uji]');
    if (!data.dunia.tujuan) { hasilUji.textContent = 'Taruh bendera tujuan dulu.'; return; }
    if (!data.solusi.trim()) { hasilUji.textContent = 'Tulis solusinya dulu.'; return; }
    sedangUji = true;
    const tombol = $('[data-uji]');
    tombol.disabled = true;
    wadahPanggung.querySelector('.lapisan-klik')?.classList.add('mati');
    try {
      panggung.reset();
      panggung.aturPose('berpikir');
      const hasil = await jalankanKodeSiswa(data.solusi, data.dunia, { perintahTersedia: data.perintahTersedia });
      if (hasil.galat?.jenis === 'sintaks') {
        panggung.aturPose('salah');
        panggung.bicara(hasil.alasan);
        editorSolusi.tandaiGalat(hasil.galat.baris);
      } else {
        panggung.aturPose('hai');
        await panggung.animasikan(hasil.jejak, { durasi: 280, saatPeristiwa: (e) => e.baris && editorSolusi.sorotBaris(e.baris) });
        editorSolusi.sorotBaris(null);
        panggung.aturPose(hasil.berhasil ? 'gembira' : 'sedih');
        if (hasil.berhasil) panggung.lompatGembira();
        panggung.bicara(hasil.alasan);
        if (!hasil.berhasil && hasil.galat?.baris) editorSolusi.tandaiGalat(hasil.galat.baris);
      }
      let teks = hasil.berhasil
        ? `Solusi berhasil: ${hasil.jumlahBaris} baris, ${hasil.jumlahLangkah} langkah.`
        : `Solusi gagal: ${hasil.alasan}`;
      if (data.jenis === 'debug' && hitungJumlahBaris(data.kodeAwal)) {
        const awal = jalankanKode(data.kodeAwal, data.dunia, { perintahTersedia: data.perintahTersedia });
        teks += awal.berhasil ? ' Kode awal masih berhasil (harusnya gagal).' : ` Kode awal gagal seperti seharusnya (${awal.alasan}).`;
      }
      hasilUji.textContent = teks;
      hasilUji.className = `text-sm font-bold flex-1 min-w-[12rem] ${hasil.berhasil ? 'text-teal-tua' : 'text-[#B24E1C]'}`;
    } finally {
      sedangUji = false;
      tombol.disabled = false;
      wadahPanggung.querySelector('.lapisan-klik')?.classList.remove('mati');
    }
  }

  // =====================================================================
  // Simpan
  // =====================================================================
  async function simpan(terbit) {
    const tombol = $(terbit ? '[data-terbitkan]' : '[data-simpan-draf]');
    if (!st.judul.trim()) { toast('Isi judul dulu sebelum menyimpan.', 'peringatan'); $('[data-isi="judul"]').focus(); return; }
    tombol.disabled = true;
    try {
      const hasil = await guruSimpanLevel(dataLevel(), { terbit });
      toast(terbit
        ? `"${hasil.judul}" terbit! Siswa ${hasil.kelas ? hasil.kelas.join(', ') : 'semua kelas'} sudah bisa memainkannya.`
        : `Draf "${hasil.judul}" disimpan.`, 'sukses');
      if (!lama) { pindah(`/guru/level/${hasil.id}/edit`); return; }
      st.status = hasil.status;
      const lencana = $('[data-status-level]');
      lencana.textContent = labelStatus[hasil.status] || hasil.status;
      lencana.dataset.jenis = hasil.status === 'terbit' ? 'selesai' : 'clue';
    } catch (err) {
      toast(err.message, 'peringatan');
    } finally {
      tombol.disabled = false;
      perbaruiStatus();
    }
  }

  // =====================================================================
  // Event
  // =====================================================================
  wadah.addEventListener('input', (e) => {
    const t = e.target;
    const kunci = t.dataset.isi;
    if (kunci === 'judul' || kunci === 'instruksi' || kunci === 'tantanganBonus') st[kunci] = t.value;
    else if (kunci === 'batasBaris') { st.batasBaris = Math.max(1, Number(t.value) || 1); batasManual = true; }
    else if (t.dataset.clue !== undefined) st.clue[Number(t.dataset.clue)] = t.value;
    else if (t.closest('[data-baris-tujuan]')) {
      const i = Number(t.closest('[data-baris-tujuan]').dataset.barisTujuan);
      tujuanManual = true;
      if (t.matches('[data-tujuan-teks]')) st.tujuanTeks[i].teks = t.value;
      if (t.matches('[data-tujuan-jumlah]')) st.tujuanTeks[i].jumlah = Math.max(1, Number(t.value) || 1);
    } else return;
    jadwalkan();
  });

  wadah.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.isi === 'zona') {
      st.zona = t.value;
      // Rintangan menyesuaikan zona baru
      st.dunia.rintangan.forEach((r) => { r.jenis = RINTANGAN_ZONA[st.zona]; });
      if (!perintahManual) { st.perintahTersedia = PERINTAH_ZONA[st.zona].slice(); gambarPerintah(); }
      gambarPalet();
      gambarPanggung();
    } else if (t.dataset.isi === 'jenis') {
      st.jenis = t.value;
      gambarPanggung();
    } else if (t.matches('[data-tingkat]')) {
      st.tingkat = $$('[data-tingkat]:checked').map((c) => Number(c.value));
    } else if (t.matches('[data-semua-kelas]')) {
      st.kelasIds = t.checked ? null : $$('[data-kelas]:checked').map((c) => c.value);
      $$('[data-kelas]').forEach((c) => { c.disabled = t.checked; if (t.checked) c.checked = true; });
    } else if (t.matches('[data-kelas]')) {
      st.kelasIds = $$('[data-kelas]:checked').map((c) => c.value);
    } else if (t.matches('[data-perintah]')) {
      perintahManual = true;
      st.perintahTersedia = $$('[data-perintah]:checked').map((c) => c.value);
    } else if (t.matches('[data-tujuan-jenis]')) {
      const i = Number(t.closest('[data-baris-tujuan]').dataset.barisTujuan);
      tujuanManual = true;
      st.tujuanTeks[i] = t.value === 'ambil'
        ? { teks: `Ambil ${jumlahKoinWajib() || 1} koin`, jenis: 'ambil', jumlah: jumlahKoinWajib() || 1 }
        : { teks: 'Sampai di bendera', jenis: 'sampai' };
      gambarTujuan();
    } else if (t.dataset.ukuran) {
      ubahUkuran(Number($('[data-ukuran="kolom"]').value), Number($('[data-ukuran="baris"]').value));
      return;
    } else return;
    jadwalkan();
  });

  wadah.addEventListener('click', (e) => {
    const t = e.target;
    const petak = t.closest('.lapisan-klik button');
    if (petak) return klikPetak(Number(petak.dataset.x), Number(petak.dataset.y));
    const tombolAlat = t.closest('[data-alat]');
    if (tombolAlat) { alat = tombolAlat.dataset.alat; gambarPalet(); return undefined; }
    if (t.closest('[data-undo]')) return undo();
    if (t.closest('[data-uji]')) return ujiJawaban();
    if (t.closest('[data-simpan-draf]')) return simpan(false);
    if (t.closest('[data-terbitkan]')) return simpan(true);
    if (t.closest('[data-tujuan-otomatis]')) { tujuanOtomatis(); tujuanManual = false; gambarTujuan(); jadwalkan(); return undefined; }
    if (t.closest('[data-tujuan-tambah]')) {
      tujuanManual = true;
      st.tujuanTeks.push({ teks: 'Sampai di bendera', jenis: 'sampai' });
      gambarTujuan();
      jadwalkan();
      return undefined;
    }
    const hapusTujuan = t.closest('[data-tujuan-hapus]');
    if (hapusTujuan) {
      tujuanManual = true;
      st.tujuanTeks.splice(Number(hapusTujuan.closest('[data-baris-tujuan]').dataset.barisTujuan), 1);
      gambarTujuan();
      jadwalkan();
      return undefined;
    }
    if (t.closest('[data-perintah-zona]')) {
      perintahManual = false;
      st.perintahTersedia = PERINTAH_ZONA[st.zona].slice();
      gambarPerintah();
      jadwalkan();
    }
    return undefined;
  });

  // Ctrl+Z untuk undo dunia (kecuali sedang mengetik di kolom atau editor kode)
  const pintasan = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.closest('input, textarea, select, .cm-editor')) {
      e.preventDefault();
      undo();
    }
  };
  document.addEventListener('keydown', pintasan);

  // ---------- Gambar awal ----------
  gambarPalet();
  gambarTujuan();
  gambarPerintah();
  gambarPanggung();
  sarankanBatas();
  perbaruiStatus();

  return () => {
    clearTimeout(jadwal);
    document.removeEventListener('keydown', pintasan);
    panggung?.hancurkan();
    editorAwal.hancurkan();
    editorSolusi.hancurkan();
  };
}
