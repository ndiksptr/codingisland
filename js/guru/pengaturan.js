// js/guru/pengaturan.js — #/guru/pengaturan: nama & password sendiri;
// khusus admin: harga clue, koin awal siswa baru, dan sakelar darurat mode blok.
// (Sakelar zona aktif/nonaktif ada di halaman Level & Soal, js/guru/level.js.)

import { esc, toast, jenisGalat, bukaModal } from '../ui.js';
import { guruUbahNama, guruUbahPassword, adminSimpanPengaturan, adminAturModeBlok } from '../store.js';
import { muatUlang } from '../router.js';
import { CLUE } from '../game/skor.js';

export async function renderPengaturan(wadah, { konteks }) {
  const { guru, admin, pengaturan } = konteks;

  wadah.innerHTML = `
    <div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <form class="dg-kartu" data-form-nama novalidate>
        <h2 class="dg-subjudul mb-3">Profil</h2>
        <label class="dg-label">Nama tampilan<input name="nama" class="dg-input" maxlength="40" value="${esc(guru.nama)}"></label>
        <p class="text-sm mt-2">Username: <code class="dg-kode">${esc(guru.username)}</code></p>
        <p class="pesan-kolom pesan-galat" data-galat></p>
        <button type="submit" class="tombol tombol-utama tombol-kecil">Simpan nama</button>
      </form>

      <form class="dg-kartu" data-form-sandi novalidate>
        <h2 class="dg-subjudul mb-3">Ganti password</h2>
        <div class="dg-form-grid">
          <label class="dg-label sm:col-span-2">Password lama<input name="lama" type="password" class="dg-input" autocomplete="current-password"></label>
          <label class="dg-label">Password baru<input name="baru" type="password" class="dg-input" autocomplete="new-password" minlength="6"></label>
          <label class="dg-label">Ulangi password baru<input name="ulang" type="password" class="dg-input" autocomplete="new-password"></label>
        </div>
        <p class="pesan-kolom pesan-galat" data-galat></p>
        <button type="submit" class="tombol tombol-utama tombol-kecil">Ganti password</button>
      </form>

      ${admin ? `
        <form class="dg-kartu" data-form-permainan novalidate>
          <h2 class="dg-subjudul">Pengaturan permainan <span class="dg-chip">Admin</span></h2>
          <p class="text-sm mb-3">Berlaku untuk semua siswa. Perubahan harga clue tidak mengubah clue yang sudah dibeli.</p>
          <div class="dg-form-grid">
            ${CLUE.map((c, i) => `
              <label class="dg-label">Harga Clue ${c.nomor} <span class="font-normal text-sm">(${esc(c.nama)})</span>
                <input name="clue${c.nomor}" type="number" min="0" max="999" class="dg-input" value="${pengaturan.hargaClue[i]}">
              </label>`).join('')}
            <label class="dg-label">Koin awal siswa baru
              <input name="koinAwal" type="number" min="0" max="999" class="dg-input" value="${pengaturan.koinAwal}">
            </label>
          </div>
          <p class="pesan-kolom pesan-galat" data-galat></p>
          <button type="submit" class="tombol tombol-utama tombol-kecil">Simpan pengaturan</button>
        </form>

        <section class="dg-kartu" aria-labelledby="judul-mode-blok">
          <h2 id="judul-mode-blok" class="dg-subjudul">Mode blok <span class="dg-chip">Admin</span></h2>
          <p class="text-sm mb-3">Sakelar darurat. Bila dimatikan, <strong>semua soal</strong> tampil dan dinilai sebagai mode teks untuk semua siswa.
            Pilihan mode di tiap soal tidak diubah, jadi menyalakannya lagi langsung mengembalikan semuanya.</p>
          <label class="sakelar">
            <input type="checkbox" role="switch" data-mode-blok ${pengaturan.modeBlokAktif ? 'checked' : ''}>
            <span class="sakelar-jalur" aria-hidden="true"></span>
            <span>${pengaturan.modeBlokAktif ? 'Mode blok menyala' : 'Mode blok dimatikan: semua soal tampil sebagai teks'}</span>
          </label>
        </section>` : ''}
    </div>`;

  // Kirim form, tampilkan pesan galat di dalam form itu
  const pasangForm = (selektor, kirim) => {
    const form = wadah.querySelector(selektor);
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const galat = form.querySelector('[data-galat]');
      const tombol = form.querySelector('[type="submit"]');
      galat.textContent = '';
      tombol.disabled = true;
      try {
        await kirim(new FormData(form), form);
      } catch (err) {
        galat.textContent = err.message;
      } finally {
        tombol.disabled = false;
      }
    });
  };

  pasangForm('[data-form-nama]', async (fd) => {
    await guruUbahNama(String(fd.get('nama') || ''));
    toast('Nama tampilan berhasil disimpan.', 'sukses');
    muatUlang();
  });

  pasangForm('[data-form-sandi]', async (fd, form) => {
    if (String(fd.get('baru')) !== String(fd.get('ulang'))) throw new Error('Password baru dan ulangannya belum sama.');
    await guruUbahPassword(String(fd.get('lama') || ''), String(fd.get('baru') || ''));
    form.reset();
    toast('Password berhasil diganti.', 'sukses');
  });

  // Sakelar darurat mode blok: tampilan baru berubah setelah tersimpan
  wadah.querySelector('[data-mode-blok]')?.addEventListener('change', async (e) => {
    const sakelar = e.target;
    const aktif = sakelar.checked;
    sakelar.checked = !aktif;
    const ya = await bukaModal({
      judul: aktif ? 'Nyalakan mode blok?' : 'Matikan mode blok untuk semua siswa?',
      isi: aktif
        ? '<p>Soal yang diatur ke mode Blok atau Teks dan blok kembali tampil sesuai pengaturannya.</p>'
        : '<p>Semua soal akan tampil dan dinilai sebagai mode teks untuk semua siswa, sampai sakelar ini dinyalakan lagi. Progres dan bintang siswa tidak berubah.</p>',
      tombol: [{ teks: 'Batal', nilai: false, varian: 'sekunder' }, { teks: aktif ? 'Nyalakan' : 'Matikan', nilai: true, varian: aktif ? 'utama' : 'bahaya' }]
    });
    if (!ya) return;
    sakelar.disabled = true;
    try {
      await adminAturModeBlok(aktif);
      toast(aktif ? 'Mode blok berhasil dinyalakan.' : 'Mode blok berhasil dimatikan. Semua soal tampil sebagai teks.', 'sukses');
      muatUlang();
    } catch (err) {
      toast(err.message, jenisGalat(err));
      sakelar.disabled = false;
    }
  });

  pasangForm('[data-form-permainan]', async (fd) => {
    await adminSimpanPengaturan({
      hargaClue: [fd.get('clue1'), fd.get('clue2'), fd.get('clue3')],
      koinAwal: fd.get('koinAwal')
    });
    toast('Pengaturan permainan berhasil disimpan.', 'sukses');
    muatUlang();
  });
}
