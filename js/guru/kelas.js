// js/guru/kelas.js — #/guru/kelas: daftar kelas, kode kelas, tambah/edit/hapus

import { esc, bukaModal, bukaFormModal, toast } from '../ui.js';
import { guruDaftarKelas, guruSimpanKelas, guruHapusKelas, guruKodeKelasBaru, adminDaftarGuru } from '../store.js';
import { IKON, kosong, tombolAksi } from './komponen.js';
import { muatUlang } from '../router.js';

async function salinTeks(teks) {
  try {
    await navigator.clipboard.writeText(teks);
    return true;
  } catch {
    // Cadangan untuk browser yang menolak clipboard
    const ta = document.createElement('textarea');
    ta.value = teks;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function formKelasHTML(kelas, daftarGuru, idSaya) {
  return `
    <div class="dg-form-grid">
      <label class="dg-label">Nama kelas
        <input name="nama" class="dg-input" required maxlength="30" placeholder="Contoh: Kelas 3B" value="${esc(kelas?.nama || '')}">
      </label>
      <label class="dg-label">Tingkat
        <select name="tingkat" class="dg-input">
          ${[3, 4, 5, 6].map((t) => `<option value="${t}" ${kelas?.tingkat === t ? 'selected' : ''}>Kelas ${t}</option>`).join('')}
        </select>
      </label>
    </div>
    ${daftarGuru ? `
      <fieldset class="mt-3">
        <legend class="dg-label">Guru pengampu</legend>
        <div class="dg-pilihan-grid">
          ${daftarGuru.map((g) => `
            <label class="dg-centang"><input type="checkbox" name="guruIds" value="${esc(g.id)}" ${kelas?.guru?.some((x) => x.id === g.id) ? 'checked' : ''}> ${esc(g.nama)}${g.id === idSaya ? ' (Anda)' : g.peran === 'admin' ? ' (admin)' : ''}</label>`).join('')}
        </div>
        ${daftarGuru.some((g) => g.peran === 'guru') ? '' : '<p class="mt-2 text-sm">Belum ada akun guru lain. Buat akun guru di menu <strong>Guru</strong>, lalu pilih di sini.</p>'}
      </fieldset>` : '<p class="mt-3 text-sm text-teal-tua">Kelas baru otomatis Anda ampu. Kode kelas dibuat otomatis.</p>'}`;
}

export async function renderKelas(wadah, { konteks, kelasId }) {
  const admin = konteks.admin;

  async function gambar() {
    let daftar = await guruDaftarKelas();
    if (kelasId) daftar = daftar.filter((k) => k.id === kelasId);

    wadah.innerHTML = `
      <div class="dg-kartu">
        <div class="dg-kartu-kepala">
          <div>
            <h2 class="dg-subjudul">Daftar kelas</h2>
            <p class="text-sm">Bagikan <strong>kode kelas</strong> kepada siswa agar mereka bisa mendaftar sendiri.</p>
          </div>
          <button type="button" class="tombol tombol-utama tombol-kecil" data-tambah-kelas>${IKON.tambah}<span>Tambah Kelas</span></button>
        </div>
        ${daftar.length ? `
          <div class="dg-tabel-wadah">
            <table class="dg-tabel">
              <thead><tr>
                <th>Nama kelas</th><th>Tingkat</th><th>Kode kelas</th><th>Guru pengampu</th>
                <th class="text-right">Siswa</th><th class="text-right">Rata-rata nilai</th><th class="text-right">Aksi</th>
              </tr></thead>
              <tbody>
                ${daftar.map((k) => `
                  <tr>
                    <td class="font-bold">${esc(k.nama)}</td>
                    <td>${k.tingkat}</td>
                    <td>
                      <span class="inline-flex items-center gap-1">
                        <code class="dg-kode">${esc(k.kodeKelas)}</code>
                        ${tombolAksi(IKON.salin, `Salin kode ${k.kodeKelas}`, `data-salin="${esc(k.kodeKelas)}"`)}
                        ${tombolAksi(IKON.segarkan, 'Buat kode baru', `data-kode-baru="${esc(k.id)}"`)}
                      </span>
                    </td>
                    <td>${k.guru.length ? k.guru.map((g) => `<span class="dg-chip">${esc(g.nama)}</span>`).join(' ') : '<span class="text-sm text-[#B24E1C] font-bold">Belum ada</span>'}</td>
                    <td class="text-right">${k.jumlahSiswa}</td>
                    <td class="text-right">${k.rataNilai || '-'}</td>
                    <td class="text-right whitespace-nowrap">
                      ${tombolAksi(IKON.edit, `Edit ${k.nama}`, `data-edit="${esc(k.id)}"`)}
                      ${tombolAksi(IKON.hapus, k.jumlahSiswa ? 'Kelas masih berisi siswa' : `Hapus ${k.nama}`, `data-hapus="${esc(k.id)}" ${k.jumlahSiswa ? 'disabled' : ''}`, true)}
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`
          : kosong('Belum ada kelas', 'Buat kelas pertama Anda, lalu bagikan kode kelasnya kepada siswa.',
            `<button type="button" class="tombol tombol-utama tombol-kecil" data-tambah-kelas>${IKON.tambah}<span>Tambah Kelas</span></button>`)}
      </div>`;
    return daftar;
  }

  let daftar = await gambar();

  async function bukaForm(kelas) {
    const daftarGuru = admin ? await adminDaftarGuru() : null;
    const hasil = await bukaFormModal({
      judul: kelas ? `Edit ${kelas.nama}` : 'Tambah kelas',
      isi: formKelasHTML(kelas, daftarGuru, konteks.guru.id),
      saatSimpan: async (fd) => {
        const nama = String(fd.get('nama') || '').trim();
        if (nama.length < 2) return { galat: 'Nama kelas belum diisi.' };
        return guruSimpanKelas({
          id: kelas?.id,
          nama,
          tingkat: Number(fd.get('tingkat')),
          ...(admin ? { guruIds: fd.getAll('guruIds') } : {})
        });
      }
    });
    if (hasil) {
      toast(kelas ? 'Kelas berhasil diperbarui.' : `Kelas ${hasil.nama} dibuat. Kodenya ${hasil.kodeKelas}.`, 'sukses');
      muatUlang(); // filter kelas di topbar ikut diperbarui
    }
  }

  wadah.addEventListener('click', async (e) => {
    const t = (sel) => e.target.closest(sel);
    if (t('[data-tambah-kelas]')) return bukaForm(null);

    const salin = t('[data-salin]');
    if (salin) {
      const ok = await salinTeks(salin.dataset.salin);
      return toast(ok ? `Kode ${salin.dataset.salin} disalin.` : 'Gagal menyalin. Salin manual ya.', ok ? 'sukses' : 'peringatan');
    }

    const kodeBaru = t('[data-kode-baru]');
    if (kodeBaru) {
      const kelas = daftar.find((k) => k.id === kodeBaru.dataset.kodeBaru);
      const ya = await bukaModal({
        judul: 'Buat kode kelas baru?',
        isi: `<p>Kode lama <strong>${esc(kelas.kodeKelas)}</strong> tidak bisa dipakai lagi untuk mendaftar. Siswa yang sudah terdaftar tidak terpengaruh.</p>`,
        tombol: [{ teks: 'Batal', nilai: false, varian: 'sekunder' }, { teks: 'Buat kode baru', nilai: true }]
      });
      if (!ya) return undefined;
      try {
        const kode = await guruKodeKelasBaru(kelas.id);
        toast(`Kode baru ${kelas.nama}: ${kode}`, 'sukses');
        daftar = await gambar();
      } catch (err) { toast(err.message, 'peringatan'); }
      return undefined;
    }

    const edit = t('[data-edit]');
    if (edit) return bukaForm(daftar.find((k) => k.id === edit.dataset.edit));

    const hapus = t('[data-hapus]');
    if (hapus && !hapus.disabled) {
      const kelas = daftar.find((k) => k.id === hapus.dataset.hapus);
      const ya = await bukaModal({
        judul: `Hapus ${kelas.nama}?`,
        isi: '<p>Kelas yang dihapus tidak bisa dikembalikan.</p>',
        tombol: [{ teks: 'Batal', nilai: false, varian: 'sekunder' }, { teks: 'Hapus', nilai: true, varian: 'bahaya' }]
      });
      if (!ya) return undefined;
      try {
        await guruHapusKelas(kelas.id);
        toast(`${kelas.nama} dihapus.`, 'sukses');
        muatUlang();
      } catch (err) { toast(err.message, 'peringatan'); }
    }
    return undefined;
  });
}
