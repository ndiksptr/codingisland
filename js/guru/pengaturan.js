// js/guru/pengaturan.js — #/guru/pengaturan: nama & password sendiri;
// guru & admin: zona aktif/nonaktif (berlaku untuk semua kelas);
// khusus admin: harga clue dan koin awal siswa baru.

import { esc, toast, bukaModal } from '../ui.js';
import { guruUbahNama, guruUbahPassword, adminSimpanPengaturan, guruDaftarZona, guruAturZona } from '../store.js';
import { muatUlang } from '../router.js';
import { CLUE } from '../game/skor.js';

function zonaHTML(z) {
  return `
    <li class="dg-zona-baris">
      <span class="dg-zona-warna" style="background:${esc(z.warna)}" aria-hidden="true"></span>
      <span class="min-w-0 flex-1">
        <span class="block font-bold">${esc(z.nama)}</span>
        <span class="block text-sm">${esc(z.konsep)} · ${z.jumlahLevel} level</span>
      </span>
      <label class="sakelar">
        <input type="checkbox" role="switch" data-zona="${esc(z.id)}" ${z.aktif ? 'checked' : ''} aria-label="Zona ${esc(z.nama)} aktif">
        <span class="sakelar-jalur" aria-hidden="true"></span>
        <span>${z.aktif ? 'Aktif' : 'Nonaktif'}</span>
      </label>
    </li>`;
}

/** Isi kotak konfirmasi menonaktifkan zona, dengan angka dari data terbaru. */
function isiKonfirmasiZona(z) {
  const murid = z.totalMurid
    ? `, dan <strong>${z.belumSelesai} dari ${z.totalMurid} murid</strong> belum menyelesaikannya`
    : '. Belum ada murid yang terdaftar';
  return `
    <p>Zona ${esc(z.nama)} berisi <strong>${z.jumlahLevel} level</strong>${murid}.
      Level tersebut tidak akan dihitung lagi dalam nilai akhir mereka. Lanjutkan?</p>
    <p class="mt-2 text-sm">Zona ini disembunyikan dari peta murid di <strong>semua kelas</strong>. Progres, bintang, koin,
      dan berlian murid tidak dihapus, dan muncul kembali bila zona diaktifkan lagi. Nilai yang sudah ditimpa guru tidak berubah.</p>`;
}

export async function renderPengaturan(wadah, { konteks }) {
  const { guru, admin, pengaturan } = konteks;
  const daftarZona = await guruDaftarZona();

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

      <section class="dg-kartu" aria-labelledby="judul-zona">
        <h2 class="dg-subjudul" id="judul-zona">Zona permainan</h2>
        <p class="text-sm mb-3">Berlaku untuk semua kelas. Zona nonaktif tidak tampil di peta murid dan levelnya tidak dihitung dalam nilai.</p>
        <ul class="dg-daftar-zona" data-daftar-zona>${daftarZona.map(zonaHTML).join('')}</ul>
      </section>

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
        </form>` : ''}
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
    toast('Nama berhasil disimpan.', 'sukses');
    muatUlang();
  });

  pasangForm('[data-form-sandi]', async (fd, form) => {
    if (String(fd.get('baru')) !== String(fd.get('ulang'))) throw new Error('Password baru dan ulangannya belum sama.');
    await guruUbahPassword(String(fd.get('lama') || ''), String(fd.get('baru') || ''));
    form.reset();
    toast('Password berhasil diganti.', 'sukses');
  });

  // Zona: menonaktifkan perlu konfirmasi berisi angka sebenarnya; mengaktifkan langsung
  wadah.querySelector('[data-daftar-zona]').addEventListener('change', async (e) => {
    const sakelar = e.target.closest('[data-zona]');
    if (!sakelar) return;
    const aktif = sakelar.checked;
    sakelar.checked = !aktif; // tampilan baru berubah setelah tersimpan
    sakelar.disabled = true;
    try {
      const z = (await guruDaftarZona()).find((x) => x.id === sakelar.dataset.zona);
      if (!aktif) {
        const ya = await bukaModal({
          judul: `Nonaktifkan ${z.nama}?`,
          isi: isiKonfirmasiZona(z),
          tombol: [{ teks: 'Batal', nilai: false, varian: 'sekunder' }, { teks: 'Nonaktifkan', nilai: true, varian: 'bahaya' }]
        });
        if (!ya) return;
      }
      await guruAturZona(z.id, aktif);
      toast(`Zona ${z.nama} ${aktif ? 'diaktifkan' : 'dinonaktifkan'}.`, 'sukses');
      muatUlang();
    } catch (err) {
      toast(err.message, 'peringatan');
    } finally {
      sakelar.disabled = false;
    }
  });

  pasangForm('[data-form-permainan]', async (fd) => {
    await adminSimpanPengaturan({
      hargaClue: [fd.get('clue1'), fd.get('clue2'), fd.get('clue3')],
      koinAwal: fd.get('koinAwal')
    });
    toast('Pengaturan permainan disimpan.', 'sukses');
    muatUlang();
  });
}
