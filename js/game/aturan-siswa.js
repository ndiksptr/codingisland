// js/game/aturan-siswa.js — aturan validasi data siswa (fungsi murni)
// Dipakai halaman pendaftaran (lewat store.js) DAN server (functions/api), agar pesannya sama.

/** Periksa satu kolom data siswa. Mengembalikan pesan ramah, atau '' jika benar. */
export function periksaKolomSiswa(kolom, nilai) {
  const v = typeof nilai === 'string' ? nilai.trim() : nilai;
  switch (kolom) {
    case 'namaLengkap':
      if (!v) return 'Tulis nama lengkapmu dulu ya.';
      if (v.length < 3) return 'Nama lengkap minimal 3 huruf.';
      if (v.length > 50) return 'Nama lengkap paling banyak 50 huruf.';
      if (!/^[A-Za-zÀ-ɏ' .-]+$/.test(v)) return 'Nama hanya boleh berisi huruf dan spasi.';
      return '';
    case 'namaPanggilan':
      if (!v) return 'Tulis nama panggilanmu ya.';
      if (!/^[A-Za-zÀ-ɏ]+$/.test(v)) return 'Nama panggilan cukup huruf saja, tanpa spasi.';
      if (v.length < 2 || v.length > 12) return 'Nama panggilan 2 sampai 12 huruf.';
      return '';
    case 'avatar':
      return v === 'pria' || v === 'wanita' ? '' : 'Pilih salah satu gambar ya.';
    case 'kelasId':
      return v ? '' : 'Pilih kelasmu dulu ya.';
    case 'kodeKelas':
      if (!v) return 'Ketik kode kelas dari gurumu ya.';
      if (!/^[A-Za-z0-9]{6}$/.test(v)) return 'Kode kelas terdiri dari 6 huruf atau angka.';
      return '';
    case 'username':
      if (!v) return 'Username belum diisi.';
      if (!/^[a-z][a-z0-9]{2,15}$/.test(v)) return 'Username 3–16 huruf kecil atau angka, diawali huruf.';
      return '';
    case 'pin':
      return /^\d{4}$/.test(String(v ?? '')) ? '' : 'PIN harus 4 angka.';
    default:
      return '';
  }
}
