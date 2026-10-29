// js/guru/sertifikat.js — #/guru/sertifikat: daftar penerima sertifikat Juara per kelas + isi sertifikat kelas
// Guru melihat kelas yang diampunya, admin semua kelas. Sertifikat terbuka otomatis saat murid mengalahkan
// boss pulau terakhir di kelas itu (aturan yang sama dengan halaman juara murid). Guru mengatur nama sekolah
// dan penanda tangan per kelas; kosong = ditandatangani Robot Tutor. Lihat & cetak memakai sertifikatHTML()
// yang sama dengan halaman murid.

import { esc, bukaModal, toast, jenisGalat } from '../ui.js';
import { guruSertifikatKelas, guruSimpanSertifikatKelas, simpanPreferensi } from '../store.js';
import { muatUlang } from '../router.js';
import { cariZona } from '../data/zona.js';
import { labelTingkatKelas } from '../data/kelas.js';
import { sertifikatHTML } from '../pages/juara.js';
import { IKON, kosong, avatarSiswa, formatTanggal } from './komponen.js';

/** Cetak satu sertifikat: hanya .wadah-cetak-sertifikat yang tampil saat dicetak (lihat @media print di app.css). */
function cetakSertifikat(html) {
  document.querySelector('.wadah-cetak-sertifikat')?.remove();
  const wadah = document.createElement('div');
  wadah.className = 'wadah-cetak-sertifikat';
  wadah.innerHTML = html;
  document.body.appendChild(wadah);
  document.body.classList.add('mencetak-sertifikat');
  const selesai = () => {
    document.body.classList.remove('mencetak-sertifikat');
    wadah.remove();
    window.removeEventListener('afterprint', selesai);
  };
  window.addEventListener('afterprint', selesai);
  window.print();
}

/** Tampilkan sertifikat di kotak besar; tombol Cetak mencetak sertifikat itu saja. */
async function lihatSertifikat(judul, data) {
  const html = sertifikatHTML(data);
  const pilihan = await bukaModal({
    judul,
    lebar: true,
    isi: `<div class="text-left">${html}</div>`,
    tombol: [{ teks: 'Tutup', nilai: false, varian: 'sekunder' }, { teks: 'Cetak', nilai: 'cetak', ikon: 'image/item/piala.png' }]
  });
  if (pilihan === 'cetak') cetakSertifikat(html);
}

function formIsiHTML(kelas, p) {
  return `
    <form class="dg-kartu mt-5" data-form-isi aria-labelledby="judul-isi-sertifikat">
      <h2 id="judul-isi-sertifikat" class="dg-subjudul">Isi sertifikat ${esc(kelas.nama)}</h2>
      <p class="text-sm mb-3">Berlaku untuk semua sertifikat kelas ini, termasuk yang sudah terbuka. Kosongkan penanda tangan agar
        sertifikat ditandatangani <strong>Robot Tutor</strong>.</p>
      <div class="dg-form-grid">
        <label class="dg-label sm:col-span-2">Nama sekolah (opsional)
          <input name="sekolah" class="dg-input" maxlength="60" placeholder="Contoh: MI Assyairiyah Attahiriyah" value="${esc(p.sekolah)}">
        </label>
        <label class="dg-label">Nama penanda tangan
          <input name="ttdNama" class="dg-input" maxlength="60" placeholder="Contoh: Bu Sari, S.Pd." value="${esc(p.ttdNama)}">
        </label>
        <label class="dg-label">Jabatan
          <input name="ttdJabatan" class="dg-input" maxlength="60" placeholder="Contoh: Guru Kelas / Pembina Ekskul" value="${esc(p.ttdJabatan)}">
        </label>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="submit" class="tombol tombol-utama tombol-kecil" data-simpan-isi>Simpan</button>
        <button type="button" class="tombol tombol-sekunder tombol-kecil" data-contoh>${IKON.lihat}<span>Lihat contoh</span></button>
      </div>
    </form>`;
}

function tabelHTML(siswa) {
  return `
    <div class="dg-tabel-wadah">
      <table class="dg-tabel">
        <thead><tr>
          <th><span class="sr-only">Avatar</span></th><th>Nama lengkap</th><th>Status</th><th>Tanggal juara</th>
          <th class="text-right">Bintang</th><th class="text-right">Level selesai</th><th class="text-right">Sertifikat</th>
        </tr></thead>
        <tbody>
          ${siswa.map((s) => `
            <tr class="${s.juara ? '' : 'dg-baris-pudar'}">
              <td>${avatarSiswa(s.avatar)}</td>
              <td class="font-bold">${esc(s.namaLengkap)}</td>
              <td>${s.juara ? '<span class="dg-lencana" data-jenis="juara">Juara</span>' : '<span class="text-sm">Belum</span>'}</td>
              <td class="whitespace-nowrap">${s.juara ? esc(formatTanggal(s.sertifikat.tanggal)) : '-'}</td>
              <td class="text-right">${s.juara ? `${s.sertifikat.totalBintang}/${s.sertifikat.maksBintang}` : s.totalBintang}</td>
              <td class="text-right">${s.levelSelesai}/${s.totalLevel}</td>
              <td class="text-right whitespace-nowrap">
                ${s.juara
                  ? `<button type="button" class="tombol tombol-sekunder tombol-kecil" data-lihat="${esc(s.id)}">${IKON.lihat}<span>Lihat &amp; cetak</span></button>`
                  : '<span class="text-sm">Belum terbuka</span>'}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

export async function renderSertifikatGuru(wadah, { konteks, kelasId }) {
  if (!konteks.kelas.length) {
    wadah.innerHTML = `<div class="dg-kartu">${kosong('Belum ada kelas', 'Buat kelas dulu di menu Kelas, lalu sertifikat siswanya akan tampil di sini.')}</div>`;
    return;
  }
  // Kelas yang dipilih: dari filter global, atau kelas pertama (sama seperti halaman Nilai)
  const idKelas = kelasId || konteks.kelas[0].id;
  const data = await guruSertifikatKelas(idKelas);
  const { kelas, siswa } = data;
  let pengaturan = data.pengaturan;
  const jumlahJuara = siswa.filter((s) => s.juara).length;

  wadah.innerHTML = `
    <div class="dg-kartu">
      <div class="dg-kartu-kepala">
        <div class="flex flex-wrap items-center gap-3">
          <label class="dg-label-sebaris">Kelas
            <select class="dg-input" data-pilih-kelas>
              ${konteks.kelas.map((k) => `<option value="${esc(k.id)}" ${k.id === idKelas ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}
            </select>
          </label>
          <span class="text-sm">${esc(labelTingkatKelas(kelas))} · <strong>${jumlahJuara}</strong> dari ${siswa.length} siswa sudah menjadi juara</span>
        </div>
      </div>
      <p class="text-sm mb-3">${data.pulauTerakhir
        ? `Sertifikat terbuka otomatis saat siswa mengalahkan boss <strong>${esc(data.pulauTerakhir)}</strong>, pulau terakhir kelas ini.`
        : 'Kelas ini belum punya pulau yang berisi soal, jadi belum ada siswa yang bisa menjadi juara.'}</p>
      ${siswa.length ? tabelHTML(siswa) : kosong('Belum ada siswa di kelas ini', 'Bagikan kode kelas atau tambahkan siswa di menu Siswa.')}
    </div>
    ${formIsiHTML(kelas, pengaturan)}`;

  wadah.querySelector('[data-pilih-kelas]').addEventListener('change', async (e) => {
    await simpanPreferensi({ kelasGuru: e.target.value });
    muatUlang();
  });

  const form = wadah.querySelector('[data-form-isi]');
  const isiForm = () => ({
    sekolah: form.sekolah.value.trim(),
    ttdNama: form.ttdNama.value.trim(),
    ttdJabatan: form.ttdJabatan.value.trim()
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isi = isiForm();
    if (isi.ttdJabatan && !isi.ttdNama) { toast('Isi nama penanda tangan dulu, baru jabatannya.', 'peringatan'); form.ttdNama.focus(); return; }
    const tombolSimpan = form.querySelector('[data-simpan-isi]');
    tombolSimpan.disabled = true;
    try {
      pengaturan = await guruSimpanSertifikatKelas(kelas.id, isi);
      toast(`Isi sertifikat ${kelas.nama} berhasil disimpan.`, 'sukses');
    } catch (err) {
      toast(err.message, jenisGalat(err));
    } finally {
      tombolSimpan.disabled = false;
    }
  });

  wadah.addEventListener('click', async (e) => {
    const lihat = e.target.closest('[data-lihat]');
    if (lihat) {
      const s = siswa.find((x) => x.id === lihat.dataset.lihat);
      // Isi sertifikat terbaru (bila baru saja disimpan) langsung terpakai
      return lihatSertifikat(`Sertifikat ${s.namaLengkap}`, { ...s.sertifikat, pengaturan });
    }
    if (e.target.closest('[data-contoh]')) {
      // Contoh memakai isian form saat ini (walau belum disimpan) dan pulau kelas ini
      const zona = (konteks.kelas.find((k) => k.id === kelas.id)?.zonaIds || []).map(cariZona).filter(Boolean).map((z) => z.nama);
      return lihatSertifikat('Contoh sertifikat', {
        namaLengkap: 'Nama Siswa', kelas: kelas.nama, totalBintang: 27, maksBintang: 30,
        pulau: zona.length ? zona : ['Pantai'], tanggal: new Date().toISOString(), pengaturan: isiForm()
      });
    }
    return undefined;
  });
}
