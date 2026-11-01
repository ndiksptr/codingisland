// js/game/editor-blok.js — editor blok seret-lepas (mode blok) untuk siswa dan guru
// Tanpa pustaka luar: memakai pointer event, jadi jalan dengan mouse maupun layar sentuh.
// Blok di palet bisa diseret ke area kerja, atau cukup diklik untuk ditambahkan di bagian paling bawah.
// Blok ulangi / jika / selama punya wadah isi, jadi blok boleh bersarang (ulangi di dalam ulangi, jika di dalam ulangi).
// Blok diseret kembali ke palet = dibuang (atau tekan tombol ×).
//
// API sama dengan editor teks (js/game/editor.js) supaya halaman bermain tidak perlu jalur sendiri:
//   { jenis: 'blok', getNilai, getBlok, setBlok, sorotBaris, tandaiGalat, bersihkanSorotan, fokus, aturPerintah, hancurkan }
// getNilai() = kode teks hasil terjemahan (js/game/blok.js) yang dijalankan interpreter biasa.

import { esc } from '../ui.js';
import { NAMA_SYARAT, namaDalam } from './kamus-perintah.js';
import { blokBaru, blokKeTeks, normalkanBlok } from './blok.js';
import { SEMUA_PERINTAH } from './interpreter.js';

const AMBANG_SERET = 6; // piksel sebelum tekan-geser dianggap menyeret
const KATEGORI = {
  maju: 'gerak', belok_kiri: 'gerak', belok_kanan: 'gerak',
  ambil: 'aksi', lompat: 'aksi',
  ulangi: 'ulang', selama: 'ulang', jika: 'jika', buat: 'variabel', atur: 'variabel'
};
const kategoriBlok = (n) => KATEGORI[n.t === 'perintah' ? n.nama : n.t] || 'gerak';

/**
 * Buat editor blok di dalam `wadah`.
 * opsi: { blok: [...], perintah: ['maju', ...] (perintah yang dibuka, nama Indonesia), bahasa: 'id'|'en',
 *         label, saatUbah(kodeTeks, blok) }
 */
export function buatEditorBlok(wadah, opsi = {}) {
  const bahasa = opsi.bahasa === 'en' ? 'en' : 'id';
  const n = (kata) => namaDalam(kata, bahasa);
  let tersedia = opsi.perintah || SEMUA_PERINTAH;
  let model = normalkanBlok(opsi.blok) || [];
  let idBerikut = 1;
  const simpul = new Map(); // id -> blok
  const induk = new Map();  // id -> array tempat blok itu berada
  let petaBaris = [];       // baris kode ke-(i+1) -> blok (dari terjemahan terakhir)
  beriId(model);

  function beriId(daftar) {
    for (const b of daftar || []) {
      if (!b._id) b._id = `b${idBerikut++}`;
      beriId(b.isi);
      beriId(b.lainnya);
    }
  }

  // ---------- Kerangka ----------
  wadah.innerHTML = `
    <div class="editor-blok">
      <div class="blok-palet" data-blok-palet-wadah aria-label="Pilihan blok"></div>
      <div class="blok-kerja" data-blok-kerja tabindex="0" role="region" aria-label="${esc(opsi.label || 'Editor blok')}">
        <div class="blok-daftar blok-daftar-akar" data-blok-daftar="akar" data-kosong="Seret blok ke sini, atau klik blok di sebelah kiri"></div>
      </div>
    </div>`;
  const elPalet = wadah.querySelector('[data-blok-palet-wadah]');
  const elKerja = wadah.querySelector('[data-blok-kerja]');
  const elAkar = wadah.querySelector('[data-blok-daftar="akar"]');

  // ---------- Palet ----------
  const syaratTersedia = () => {
    const s = NAMA_SYARAT.filter((x) => tersedia.includes(x));
    return s.length ? s : NAMA_SYARAT;
  };
  function gambarPalet() {
    const ada = (k) => tersedia.includes(k);
    const item = (jenis, teks, kategori) =>
      `<button type="button" class="blok-palet-item blok-k-${kategori}" data-blok-palet="${jenis}" title="Seret atau klik untuk menambah">${esc(teks)}</button>`;
    const grup = (judul, isi) => (isi.length ? `<div class="blok-palet-grup"><p class="blok-palet-judul">${judul}</p>${isi.join('')}</div>` : '');
    elPalet.innerHTML = `
      <p class="blok-palet-petunjuk">Seret blok ke area kode, atau klik untuk menambah di bawah. Seret ke sini untuk membuang.</p>
      ${grup('Gerak', ['maju', 'belok_kiri', 'belok_kanan'].filter(ada).map((p) => item(p, `${n(p)}()`, 'gerak')))}
      ${grup('Aksi', ['ambil', 'lompat'].filter(ada).map((p) => item(p, `${n(p)}()`, 'aksi')))}
      ${grup('Kontrol', [
        ada('ulangi') ? item('ulangi', `${n('ulangi')} … ${n('kali')}`, 'ulang') : '',
        ada('jika') ? item('jika', `${n('jika')} …`, 'jika') : '',
        ada('jika') ? item('jika_lainnya', `${n('jika')} … ${n('lainnya')}`, 'jika') : '',
        ada('selama') ? item('selama', `${n('selama')} …`, 'ulang') : ''
      ].filter(Boolean))}
      ${grup('Variabel', ada('buat') ? [item('buat', `${n('buat')} … = …`, 'variabel'), item('atur', '… = …', 'variabel')] : [])}`;
  }

  // ---------- Area kerja ----------
  const input = (medan, nilai, lebar, label) =>
    `<input class="blok-isian" data-blok-ubah="${medan}" value="${esc(nilai)}" size="${lebar}" maxlength="40" autocomplete="off" spellcheck="false" aria-label="${esc(label)}">`;
  const tombolHapus = '<button type="button" class="blok-hapus" data-blok-hapus aria-label="Buang blok ini" title="Buang blok">×</button>';
  function pilihanSyarat(b) {
    const daftar = [...new Set([...syaratTersedia(), b.syarat.nama])];
    return `
      <button type="button" class="blok-bukan" data-blok-bukan aria-pressed="${b.syarat.bukan}" title="Klik untuk memakai / melepas ${esc(n('bukan'))}">${esc(n('bukan'))}</button>
      <select class="blok-isian" data-blok-ubah="syarat" aria-label="Syarat">
        ${daftar.map((s) => `<option value="${s}" ${s === b.syarat.nama ? 'selected' : ''}>${esc(n(s))}()</option>`).join('')}
      </select>`;
  }
  const daftarHTML = (d, kunci, kosong = 'Taruh blok di sini') =>
    `<div class="blok-daftar" data-blok-daftar="${kunci}" data-kosong="${kosong}">${d.map(blokHTML).join('')}</div>`;

  function blokHTML(b) {
    const k = kategoriBlok(b);
    const atas = (isi) => `<div class="blok-kepala" data-blok-pegangan>${isi}${tombolHapus}</div>`;
    let isi;
    switch (b.t) {
      case 'perintah':
        isi = atas(`<span class="blok-teks">${esc(n(b.nama))}(</span>${b.nama === 'maju' ? input('arg', b.arg, 3, 'Berapa petak (kosong = 1)') : ''}<span class="blok-teks">)</span>`);
        break;
      case 'ulangi':
        isi = atas(`<span class="blok-teks">${esc(n('ulangi'))}</span>${input('jumlah', b.jumlah, 3, 'Berapa kali')}<span class="blok-teks">${esc(n('kali'))}</span>`)
          + daftarHTML(b.isi, `${b._id}:isi`) + '<div class="blok-ekor"></div>';
        break;
      case 'jika':
        isi = atas(`<span class="blok-teks">${esc(n('jika'))}</span>${pilihanSyarat(b)}
            <button type="button" class="blok-lainnya" data-blok-lainnya title="${b.lainnya ? 'Hapus' : 'Tambah'} bagian ${esc(n('lainnya'))}">${b.lainnya ? '−' : '+'} ${esc(n('lainnya'))}</button>`)
          + daftarHTML(b.isi, `${b._id}:isi`)
          + (b.lainnya ? `<div class="blok-tengah"><span class="blok-teks">${esc(n('lainnya'))}</span></div>${daftarHTML(b.lainnya, `${b._id}:lainnya`)}` : '')
          + '<div class="blok-ekor"></div>';
        break;
      case 'selama':
        isi = atas(`<span class="blok-teks">${esc(n('selama'))}</span>${pilihanSyarat(b)}`)
          + daftarHTML(b.isi, `${b._id}:isi`) + '<div class="blok-ekor"></div>';
        break;
      case 'buat':
        isi = atas(`<span class="blok-teks">${esc(n('buat'))}</span>${input('nama', b.nama, 8, 'Nama variabel')}<span class="blok-teks">=</span>${input('nilai', b.nilai, 6, 'Nilai')}`);
        break;
      case 'atur':
        isi = atas(`${input('nama', b.nama, 8, 'Nama variabel')}<span class="blok-teks">=</span>${input('nilai', b.nilai, 10, 'Nilai baru')}`);
        break;
      default:
        isi = '';
    }
    return `<div class="blok blok-k-${k} ${['ulangi', 'jika', 'selama'].includes(b.t) ? 'blok-wadah' : ''}" data-blok-id="${b._id}">${isi}</div>`;
  }

  function petakan(daftar) {
    for (const b of daftar) {
      simpul.set(b._id, b);
      induk.set(b._id, daftar);
      if (b.isi) petakan(b.isi);
      if (b.lainnya) petakan(b.lainnya);
    }
  }

  function gambar() {
    simpul.clear();
    induk.clear();
    beriId(model);
    petakan(model);
    elAkar.innerHTML = model.map(blokHTML).join('');
  }

  const kodeSekarang = () => {
    const hasil = blokKeTeks(model, bahasa);
    petaBaris = hasil.baris;
    return hasil.kode;
  };
  const kabari = () => { if (opsi.saatUbah) opsi.saatUbah(kodeSekarang(), normalkanBlok(model)); };
  const berubah = () => { gambar(); kabari(); };

  function daftarDariKunci(kunci) {
    if (kunci === 'akar') return model;
    const [id, bagian] = kunci.split(':');
    const b = simpul.get(id);
    return b ? (bagian === 'lainnya' ? b.lainnya : b.isi) : null;
  }
  function lepas(id) {
    const d = induk.get(id);
    const b = simpul.get(id);
    if (d && b) d.splice(d.indexOf(b), 1);
    return b;
  }

  // ---------- Isian & tombol di dalam blok ----------
  wadah.addEventListener('input', (e) => {
    const t = e.target.closest('[data-blok-ubah]');
    if (!t) return;
    const b = simpul.get(t.closest('[data-blok-id]')?.dataset.blokId);
    if (!b) return;
    if (t.dataset.blokUbah === 'syarat') b.syarat.nama = t.value;
    else b[t.dataset.blokUbah] = t.value;
    kabari();
  });

  let akhirSeret = 0;
  wadah.addEventListener('click', (e) => {
    const t = e.target;
    const id = t.closest('[data-blok-id]')?.dataset.blokId;
    if (t.closest('[data-blok-hapus]') && id) { lepas(id); berubah(); return; }
    if (t.closest('[data-blok-bukan]') && id) { const b = simpul.get(id); b.syarat.bukan = !b.syarat.bukan; berubah(); return; }
    if (t.closest('[data-blok-lainnya]') && id) { const b = simpul.get(id); b.lainnya = b.lainnya ? null : []; berubah(); return; }
    const palet = t.closest('[data-blok-palet]');
    if (palet && Date.now() - akhirSeret > 300) {
      // Klik (tanpa menyeret): tambahkan di paling bawah
      const b = blokBaru(palet.dataset.blokPalet, syaratTersedia()[0]);
      if (!b) return;
      model.push(b);
      berubah();
      elKerja.querySelector(`[data-blok-id="${b._id}"]`)?.scrollIntoView({ block: 'nearest' });
    }
  });

  // ---------- Seret & lepas (pointer event) ----------
  let seret = null;
  let penanda = null;

  function mulaiSeret(e) {
    const asal = seret.el;
    const r = asal.getBoundingClientRect();
    const hantu = (seret.sumber === 'palet' ? asal : asal.querySelector('.blok-kepala') || asal).cloneNode(true);
    hantu.classList.add('blok-hantu');
    hantu.style.width = `${Math.min(r.width, 320)}px`;
    document.body.appendChild(hantu);
    seret.hantu = hantu;
    seret.dx = Math.min(e.clientX - r.left, 40);
    seret.dy = Math.min(e.clientY - r.top, 20);
    if (seret.sumber === 'blok') asal.classList.add('blok-diseret');
    wadah.classList.add('sedang-menyeret');
    penanda = document.createElement('div');
    penanda.className = 'blok-penanda';
    penanda.setAttribute('aria-hidden', 'true');
  }

  function cariTujuan(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el || !wadah.contains(el)) return null;
    if (el.closest('[data-blok-palet-wadah]')) return { buang: true };
    let daftarEl = el.closest('[data-blok-daftar]');
    if (!daftarEl && el.closest('[data-blok-kerja]')) daftarEl = elAkar;
    if (!daftarEl) return null;
    // Blok tidak boleh dimasukkan ke dalam dirinya sendiri
    if (seret.sumber === 'blok' && seret.el.contains(daftarEl)) return null;
    const anak = [...daftarEl.children].filter((c) => c.matches('[data-blok-id]') && c !== seret.el);
    let indeks = anak.length;
    for (let i = 0; i < anak.length; i++) {
      const r = anak[i].getBoundingClientRect();
      if (y < r.top + Math.min(r.height / 2, 22)) { indeks = i; break; }
    }
    return { daftarEl, kunci: daftarEl.dataset.blokDaftar, indeks, sebelum: anak[indeks] || null };
  }

  function gulirOtomatis(y) {
    const r = elKerja.getBoundingClientRect();
    if (y < r.top + 30) elKerja.scrollTop -= 12;
    else if (y > r.bottom - 30) elKerja.scrollTop += 12;
  }

  function saatGerak(e) {
    if (!seret || e.pointerId !== seret.pointerId) return;
    if (!seret.mulai) {
      if (Math.hypot(e.clientX - seret.x0, e.clientY - seret.y0) < AMBANG_SERET) return;
      seret.mulai = true;
      mulaiSeret(e);
    }
    e.preventDefault();
    seret.hantu.style.transform = `translate(${e.clientX - seret.dx}px, ${e.clientY - seret.dy}px)`;
    gulirOtomatis(e.clientY);
    const tujuan = cariTujuan(e.clientX, e.clientY);
    seret.tujuan = tujuan;
    elPalet.classList.toggle('blok-palet-buang', !!tujuan?.buang && seret.sumber === 'blok');
    if (tujuan && !tujuan.buang) tujuan.daftarEl.insertBefore(penanda, tujuan.sebelum);
    else penanda.remove();
  }

  function selesaiSeret(e) {
    if (!seret || e.pointerId !== seret.pointerId) return;
    const s = seret;
    seret = null;
    window.removeEventListener('pointermove', saatGerak);
    window.removeEventListener('pointerup', selesaiSeret);
    window.removeEventListener('pointercancel', selesaiSeret);
    if (!s.mulai) return; // hanya klik: ditangani event click
    akhirSeret = Date.now();
    s.hantu?.remove();
    penanda?.remove();
    s.el.classList.remove('blok-diseret');
    wadah.classList.remove('sedang-menyeret');
    elPalet.classList.remove('blok-palet-buang');
    const tujuan = e.type === 'pointercancel' ? null : s.tujuan;
    if (!tujuan) return;
    if (tujuan.buang) {
      if (s.sumber === 'blok') { lepas(s.id); berubah(); }
      return;
    }
    const daftar = daftarDariKunci(tujuan.kunci);
    if (!daftar) return;
    const b = s.sumber === 'palet' ? blokBaru(s.jenis, syaratTersedia()[0]) : lepas(s.id);
    if (!b) return;
    daftar.splice(Math.min(tujuan.indeks, daftar.length), 0, b);
    berubah();
  }

  wadah.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || seret) return;
    const palet = e.target.closest('[data-blok-palet]');
    const pegangan = e.target.closest('[data-blok-pegangan]');
    if (!palet && (!pegangan || e.target.closest('input, select, button'))) return;
    const blokEl = pegangan?.closest('[data-blok-id]');
    seret = palet
      ? { sumber: 'palet', jenis: palet.dataset.blokPalet, el: palet }
      : { sumber: 'blok', id: blokEl.dataset.blokId, el: blokEl };
    Object.assign(seret, { x0: e.clientX, y0: e.clientY, pointerId: e.pointerId, mulai: false });
    window.addEventListener('pointermove', saatGerak, { passive: false });
    window.addEventListener('pointerup', selesaiSeret);
    window.addEventListener('pointercancel', selesaiSeret);
  });

  // ---------- Sorotan (blok yang sedang dijalankan / salah) ----------
  const elBlok = (b) => (b ? elKerja.querySelector(`[data-blok-id="${b._id}"]`) : null);
  function bersihkanSorotan() {
    elKerja.querySelectorAll('.blok-jalan, .blok-galat').forEach((el) => el.classList.remove('blok-jalan', 'blok-galat'));
  }
  function sorot(baris, kelas) {
    elKerja.querySelectorAll(`.${kelas}`).forEach((el) => el.classList.remove(kelas));
    const el = elBlok(petaBaris[(baris || 0) - 1]);
    if (!el) return;
    el.classList.add(kelas);
    el.scrollIntoView({ block: 'nearest' });
  }

  gambarPalet();
  gambar();
  kodeSekarang();

  return {
    jenis: 'blok',
    getNilai: () => kodeSekarang(),
    getBlok: () => normalkanBlok(model),
    setBlok(d) { model = normalkanBlok(d) || []; berubah(); },
    sorotBaris: (baris) => (baris ? sorot(baris, 'blok-jalan') : elKerja.querySelectorAll('.blok-jalan').forEach((el) => el.classList.remove('blok-jalan'))),
    tandaiGalat: (baris) => sorot(baris, 'blok-galat'),
    bersihkanSorotan,
    fokus: () => elKerja.focus(),
    /** Ganti daftar perintah yang dibuka (editor guru saat centang perintah berubah). */
    aturPerintah(daftar) { tersedia = daftar?.length ? daftar : SEMUA_PERINTAH; gambarPalet(); gambar(); },
    hancurkan() {
      window.removeEventListener('pointermove', saatGerak);
      window.removeEventListener('pointerup', selesaiSeret);
      window.removeEventListener('pointercancel', selesaiSeret);
      seret?.hantu?.remove();
      wadah.innerHTML = '';
    }
  };
}
