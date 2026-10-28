// js/data/kelas.js — jenis kelas dan labelnya (dipakai server dan browser, tanpa DOM)
// Kelas reguler punya tingkat 3–6; kelas ekskul anggotanya campuran, jadi ditulis "Ekskul", bukan "Kelas sekian".
// Selain label dan urutan tampilan, ekskul berperilaku sama persis dengan kelas reguler.

export const JENIS_KELAS = ['reguler', 'ekskul'];
export const TINGKAT_KELAS = [3, 4, 5, 6];

// Kolom tingkat wajib terisi (NOT NULL, CHECK 1–6); untuk ekskul nilainya hanya pengisi dan tidak ditampilkan
export const TINGKAT_PENGISI_EKSKUL = 3;

/** "Ekskul" atau "Kelas 4". k: objek kelas { jenis, tingkat }. */
export const labelTingkatKelas = (k) => (k?.jenis === 'ekskul' ? 'Ekskul' : `Kelas ${k?.tingkat ?? '-'}`);
