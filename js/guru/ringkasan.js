// js/guru/ringkasan.js — #/guru: statistik, siswa yang perlu bantuan, progres per zona, aktivitas terbaru

import { esc } from '../ui.js';
import { guruRingkasan } from '../store.js';
import { IKON, kartuStat, kosong, avatarSiswa, waktuRelatif, lencanaAktivitas } from './komponen.js';

const BATAS_BANTUAN = 8;

// Diagram batang SVG sederhana (tanpa library): rata-rata persen level selesai per zona
function diagramZona(zona) {
  const lebar = 520;
  const tinggiBatang = 30;
  const jarak = 18;
  const kiri = 150;
  const tinggi = zona.length * (tinggiBatang + jarak) + 10;
  const panjang = lebar - kiri - 60;
  return `
    <svg viewBox="0 0 ${lebar} ${tinggi}" class="w-full h-auto" role="img" aria-label="Rata-rata progres per pulau">
      ${zona.map((z, i) => {
        const y = 5 + i * (tinggiBatang + jarak);
        const w = Math.max(2, (z.persen / 100) * panjang);
        return `
          <text x="${kiri - 12}" y="${y + tinggiBatang / 2 + 6}" text-anchor="end" font-size="16" font-weight="700" fill="#12332F" font-family="Nunito, sans-serif">${esc(z.nama)}</text>
          <rect x="${kiri}" y="${y}" width="${panjang}" height="${tinggiBatang}" rx="8" fill="#E6F3EF"/>
          <rect x="${kiri}" y="${y}" width="${w}" height="${tinggiBatang}" rx="8" fill="${z.warna}"/>
          <text x="${kiri + w + 8}" y="${y + tinggiBatang / 2 + 6}" font-size="16" font-weight="800" fill="#287A74" font-family="Nunito, sans-serif">${z.persen}%</text>`;
      }).join('')}
    </svg>`;
}

export async function renderRingkasan(wadah, { kelasId }) {
  const data = await guruRingkasan({ kelasId });
  const { statistik: st } = data;

  wadah.innerHTML = `
    <div class="dg-grid-stat">
      ${kartuStat({ label: 'Jumlah siswa', nilai: st.jumlahSiswa, ikon: IKON.siswa })}
      ${kartuStat({ label: 'Jumlah kelas', nilai: st.jumlahKelas, ikon: IKON.kelas })}
      ${kartuStat({ label: 'Level terbit', nilai: st.levelTerbit, ikon: IKON.level })}
      ${kartuStat({ label: 'Rata-rata nilai', nilai: st.rataNilai || '-', ikon: IKON.nilai, catatan: 'dari level yang selesai' })}
      ${kartuStat({ label: 'Aktif 7 hari', nilai: `${st.aktif7}/${st.jumlahSiswa}`, ikon: IKON.aktivitas })}
    </div>

    <div class="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
      <section class="dg-kartu" aria-labelledby="judul-bantuan">
        <div class="dg-kartu-kepala">
          <h2 id="judul-bantuan" class="dg-subjudul">Siswa yang perlu bantuan</h2>
          <span class="dg-lencana" data-jenis="coba">${data.perluBantuan.length} siswa</span>
        </div>
        ${data.perluBantuan.length ? `
          <ul class="dg-daftar">
            ${data.perluBantuan.slice(0, BATAS_BANTUAN).map((s) => `
              <li>
                <a href="#/guru/siswa/${esc(s.id)}" class="dg-daftar-baris">
                  ${avatarSiswa(s.avatar)}
                  <span class="min-w-0 flex-1">
                    <span class="block font-bold truncate">${esc(s.namaLengkap)} <span class="font-normal text-sm text-teal-tua">· ${esc(s.kelasNama)}</span></span>
                    <span class="block text-sm ${s.macet ? 'text-[#B24E1C] font-bold' : ''}">${esc(s.alasan.join(' · '))}</span>
                  </span>
                  <span class="dg-tautan-kecil">Detail →</span>
                </a>
              </li>`).join('')}
          </ul>
          ${data.perluBantuan.length > BATAS_BANTUAN ? `<a href="#/guru/siswa" class="dg-tautan-kecil mt-3 inline-block">Lihat semua siswa →</a>` : ''}`
          : kosong('Semua siswa berjalan lancar.', 'Belum ada siswa yang macet atau lama tidak bermain.')}
      </section>

      <section class="dg-kartu" aria-labelledby="judul-zona">
        <div class="dg-kartu-kepala">
          <h2 id="judul-zona" class="dg-subjudul">Rata-rata progres per pulau</h2>
          <span class="text-sm text-teal-tua font-bold">% level selesai</span>
        </div>
        ${st.jumlahSiswa ? diagramZona(data.progresZona) : kosong('Belum ada data', 'Progres akan muncul setelah siswa mulai bermain.')}
      </section>
    </div>

    <section class="dg-kartu mt-5" aria-labelledby="judul-aktivitas">
      <div class="dg-kartu-kepala">
        <h2 id="judul-aktivitas" class="dg-subjudul">10 aktivitas terbaru</h2>
        <a href="#/guru/aktivitas" class="dg-tautan-kecil">Semua aktivitas →</a>
      </div>
      ${data.aktivitas.length ? `
        <ul class="dg-linimasa">
          ${data.aktivitas.map((a) => `
            <li>
              ${lencanaAktivitas(a.jenis)}
              <span class="flex-1 min-w-0"><strong>${esc(a.namaSiswa)}</strong> <span class="text-sm text-teal-tua">(${esc(a.kelasNama)})</span> — ${esc(a.keterangan)}</span>
              <time class="text-sm text-[#5E7471] whitespace-nowrap" datetime="${esc(a.waktu)}">${esc(waktuRelatif(a.waktu))}</time>
            </li>`).join('')}
        </ul>`
        : kosong('Belum ada aktivitas', 'Ajak siswa mendaftar dengan kode kelas, lalu aktivitas mereka akan muncul di sini.')}
    </section>`;
}
