// js/guru/guru.js — #/guru/guru (khusus admin): tambah, edit, hapus guru, tetapkan kelas, ganti password guru
// (diketik admin, tombol Sarankan hanya mengisi kolom), dan masuk sebagai guru (menyamar) tanpa login ulang

import { esc, bukaModal, bukaFormModal, toast, jenisGalat } from '../ui.js';
import { adminDaftarGuru, adminSimpanGuru, adminHapusGuru, adminResetPasswordGuru, adminMasukSebagaiGuru } from '../store.js';
import { muatUlang, pindah } from '../router.js';
import { IKON, kosong, tombolAksi } from './komponen.js';

// Saran password mudah dibaca, mis. "kpnu-7r3d" (tanpa huruf/angka yang mirip: i l o 0 1).
// Hanya mengisi kolom; yang tersimpan selalu isi kolom saat Simpan ditekan.
const HURUF_SARAN = 'abcdefghjkmnpqrstuvwxyz23456789';
const sarankanPassword = () => {
  const acak = crypto.getRandomValues(new Uint32Array(8));
  const k = [...acak].map((n) => HURUF_SARAN[n % HURUF_SARAN.length]).join('');
  return `${k.slice(0, 4)}-${k.slice(4)}`;
};

function formGuruHTML(guru, semuaKelas, akunSendiri) {
  const kelasDipilih = new Set((guru?.kelas || []).map((k) => k.id));
  return `
    <div class="dg-form-grid">
      <label class="dg-label">Nama<input name="nama" class="dg-input" maxlength="40" placeholder="Contoh: Bu Rina" value="${esc(guru?.nama || '')}"></label>
      <label class="dg-label">Username<input name="username" class="dg-input font-kode" maxlength="24" autocomplete="off" placeholder="contoh: bu.rina" value="${esc(guru?.username || '')}"></label>
      ${guru ? '' : '<label class="dg-label">Password awal<input name="password" type="text" class="dg-input font-kode" minlength="6" autocomplete="off" placeholder="minimal 6 karakter"></label>'}
      <label class="dg-label">Peran
        <select name="peran" class="dg-input" ${akunSendiri ? 'disabled' : ''}>
          <option value="guru" ${guru?.peran === 'guru' ? 'selected' : ''}>Guru</option>
          <option value="admin" ${guru?.peran === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </label>
    </div>
    <fieldset class="mt-3">
      <legend class="dg-label">Kelas yang diampu</legend>
      <div class="dg-pilihan-grid">
        ${semuaKelas.map((k) => `<label class="dg-centang"><input type="checkbox" name="kelasIds" value="${esc(k.id)}" ${kelasDipilih.has(k.id) ? 'checked' : ''}> ${esc(k.nama)}</label>`).join('') || '<p class="text-sm">Belum ada kelas.</p>'}
      </div>
    </fieldset>`;
}

export async function renderGuru(wadah, { konteks }) {
  const daftar = await adminDaftarGuru();
  const semuaKelas = konteks.kelas; // admin melihat semua kelas
  // Masuk sebagai guru: hanya admin, hanya ke akun berperan guru, bukan diri sendiri (server memeriksa lagi)
  const bolehMasukSebagai = (g) => konteks.admin && !konteks.menyamar && g.peran === 'guru' && g.id !== konteks.guru.id;

  wadah.innerHTML = `
    <div class="dg-kartu">
      <div class="dg-kartu-kepala">
        <div>
          <h2 class="dg-subjudul">Akun guru</h2>
          <p class="text-sm">Guru hanya bisa melihat kelas yang diampunya. Admin bisa melihat semua kelas.</p>
        </div>
        <button type="button" class="tombol tombol-utama tombol-kecil" data-tambah-guru>${IKON.tambah}<span>Tambah Guru</span></button>
      </div>
      ${daftar.length ? `
        <div class="dg-tabel-wadah">
          <table class="dg-tabel">
            <thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Kelas diampu</th><th class="text-right">Aksi</th></tr></thead>
            <tbody>
              ${daftar.map((g) => `
                <tr>
                  <td class="font-bold">${esc(g.nama)} ${g.id === konteks.guru.id ? '<span class="dg-chip">Anda</span>' : ''}</td>
                  <td><code class="dg-kode">${esc(g.username)}</code></td>
                  <td><span class="dg-lencana" data-jenis="${g.peran === 'admin' ? 'piala' : 'masuk'}">${g.peran === 'admin' ? 'Admin' : 'Guru'}</span></td>
                  <td>${g.peran === 'admin' ? '<span class="text-sm">Semua kelas</span>' : (g.kelas.map((k) => `<span class="dg-chip">${esc(k.nama)}</span>`).join(' ') || '<span class="text-sm text-[#B24E1C] font-bold">Belum ada</span>')}</td>
                  <td class="text-right whitespace-nowrap">
                    ${bolehMasukSebagai(g) ? tombolAksi(IKON.masukSebagai, `Masuk sebagai ${g.nama}`, `data-aksi="menyamar" data-id="${esc(g.id)}"`) : ''}
                    ${tombolAksi(IKON.edit, `Edit ${g.nama}`, `data-aksi="edit" data-id="${esc(g.id)}"`)}
                    ${g.peran === 'guru' ? tombolAksi(IKON.kunci, `Ganti password ${g.nama}`, `data-aksi="sandi" data-id="${esc(g.id)}"`) : ''}
                    ${tombolAksi(IKON.hapus, g.id === konteks.guru.id ? 'Tidak bisa menghapus akun sendiri' : `Hapus ${g.nama}`, `data-aksi="hapus" data-id="${esc(g.id)}" ${g.id === konteks.guru.id ? 'disabled' : ''}`, true)}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`
        : kosong('Belum ada guru', 'Tambahkan akun guru agar mereka bisa memantau kelasnya.')}
    </div>`;

  async function bukaForm(guru) {
    const akunSendiri = guru?.id === konteks.guru.id;
    const hasil = await bukaFormModal({
      judul: guru ? `Edit ${guru.nama}` : 'Tambah guru',
      isi: formGuruHTML(guru, semuaKelas, akunSendiri),
      saatSimpan: (fd) => adminSimpanGuru({
        id: guru?.id,
        nama: String(fd.get('nama') || ''),
        username: String(fd.get('username') || ''),
        ...(guru ? {} : { password: String(fd.get('password') || '') }),
        ...(akunSendiri ? {} : { peran: fd.get('peran') }),
        kelasIds: fd.getAll('kelasIds')
      })
    });
    if (hasil) {
      toast(guru ? `Data guru ${hasil.nama} berhasil disimpan.` : `Akun guru ${hasil.nama} berhasil dibuat.`, 'sukses');
      muatUlang();
    }
  }

  wadah.addEventListener('click', async (e) => {
    if (e.target.closest('[data-tambah-guru]')) return bukaForm(null);
    const tombol = e.target.closest('[data-aksi]');
    if (!tombol || tombol.disabled) return undefined;
    const guru = daftar.find((g) => g.id === tombol.dataset.id);

    if (tombol.dataset.aksi === 'edit') return bukaForm(guru);

    if (tombol.dataset.aksi === 'menyamar') {
      const ya = await bukaModal({
        judul: `Masuk sebagai ${guru.nama}?`,
        isi: `
          <p>Anda akan melihat dashboard persis seperti <strong>${esc(guru.nama)}</strong>: hanya kelas yang diampunya.</p>
          <p class="mt-2">Perubahan nilai, PIN, dan catatan tetap tercatat atas nama Anda. Ganti password dan kelola akun guru tidak bisa selama di akun ini.</p>
          <p class="mt-2">Tekan <strong>Kembali ke akun admin</strong> di bilah atas untuk kembali.</p>`,
        tombol: [{ teks: 'Batal', nilai: false, varian: 'sekunder' }, { teks: 'Masuk', nilai: true }]
      });
      if (!ya) return undefined;
      try {
        await adminMasukSebagaiGuru(guru.id);
        toast(`Anda masuk sebagai ${guru.nama}.`, 'sukses');
        pindah('/guru');
      } catch (err) { toast(err.message, jenisGalat(err)); }
      return undefined;
    }

    if (tombol.dataset.aksi === 'sandi') {
      // Admin mengetik password baru (pola sama dengan PIN murid). Password hanya ada di memori halaman
      // ini sampai kotak "Password baru" ditutup; tidak disimpan di mana pun dan tidak ditulis ke console.
      const hasil = await bukaFormModal({
        judul: `Ganti password ${guru.nama}`,
        isi: `
          <p class="mb-3">Password lama tidak bisa dipakai lagi, dan ${esc(guru.nama)} akan keluar dari semua perangkat.
            Password baru ditampilkan sekali untuk Anda catat.</p>
          <label for="sandi-baru" class="dg-label">Password baru (minimal 8 karakter)</label>
          <div class="flex gap-2 mt-1">
            <input id="sandi-baru" name="password" type="text" class="dg-input font-kode" maxlength="64"
              autocomplete="new-password" autocapitalize="none" spellcheck="false">
            <button type="button" class="tombol tombol-sekunder tombol-kecil shrink-0" data-sarankan-sandi>Sarankan</button>
          </div>`,
        teksSimpan: 'Simpan',
        saatBuka: (form) => {
          const kolom = form.querySelector('[name="password"]');
          form.querySelector('[data-sarankan-sandi]').addEventListener('click', () => {
            kolom.value = sarankanPassword();
            kolom.focus();
            kolom.select();
          });
        },
        saatSimpan: async (fd) => {
          const password = String(fd.get('password') || '');
          // Sama dengan halaman pemasangan; server memeriksa ulang
          if (password.length < 8) return { galat: 'Password minimal 8 karakter.' };
          await adminResetPasswordGuru(guru.id, password);
          return { password };
        }
      });
      if (!hasil) return undefined;
      toast(`Password ${guru.nama} berhasil diganti.`, 'sukses');
      await bukaModal({
        judul: 'Password baru',
        isi: `
          <p>Berikan kepada <strong>${esc(guru.nama)}</strong>. Password ini <strong>tidak akan ditampilkan lagi</strong> setelah kotak ini ditutup.</p>
          <div class="dg-kotak-pin">
            <div><span>Username</span><strong>${esc(guru.username)}</strong></div>
            <div><span>Password</span><strong>${esc(hasil.password)}</strong></div>
          </div>`,
        tombol: [{ teks: 'Sudah saya catat', nilai: true }],
        bisaDitutup: false
      });
      return undefined;
    }

    if (tombol.dataset.aksi === 'hapus') {
      const ya = await bukaModal({
        judul: `Hapus ${guru.nama}?`,
        isi: '<p>Akun guru ini akan dihapus. Kelas yang diampunya tetap ada, tetapi tidak lagi memiliki guru ini.</p>',
        tombol: [{ teks: 'Batal', nilai: false, varian: 'sekunder' }, { teks: 'Hapus', nilai: true, varian: 'bahaya' }]
      });
      if (!ya) return undefined;
      try {
        await adminHapusGuru(guru.id);
        toast(`Akun guru ${guru.nama} berhasil dihapus.`, 'sukses');
        muatUlang();
      } catch (err) { toast(err.message, jenisGalat(err)); }
    }
    return undefined;
  });
}
