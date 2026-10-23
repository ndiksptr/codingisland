// server/kripto.js — hash PIN/password dengan PBKDF2 (Web Crypto) dan token sesi
// Format hash: pbkdf2$sha256$<iterasi>$<salt base64>$<hash base64>
// Dipakai juga oleh scripts/buat-schema.mjs (Node 18+ punya crypto.subtle yang sama).

const enc = new TextEncoder();
export const ITERASI_BAWAAN = 100000; // batas atas PBKDF2 di Cloudflare Workers

const keBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const dariBase64 = (teks) => Uint8Array.from(atob(teks), (c) => c.charCodeAt(0));

async function turunkan(rahasia, salt, iterasi) {
  const kunci = await crypto.subtle.importKey('raw', enc.encode(String(rahasia)), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iterasi }, kunci, 256);
}

/** Hash rahasia dengan salt acak. */
export async function hashRahasia(rahasia, iterasi = ITERASI_BAWAAN) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await turunkan(rahasia, salt, iterasi);
  return `pbkdf2$sha256$${iterasi}$${keBase64(salt)}$${keBase64(hash)}`;
}

/** Bandingkan rahasia dengan hash tersimpan (perbandingan waktu-konstan). */
export async function cocokRahasia(rahasia, tersimpan) {
  const [alg, fungsi, iter, saltB64, hashB64] = String(tersimpan || '').split('$');
  if (alg !== 'pbkdf2' || fungsi !== 'sha256' || !saltB64 || !hashB64) return false;
  const hasil = new Uint8Array(await turunkan(rahasia, dariBase64(saltB64), Number(iter) || ITERASI_BAWAAN));
  const target = dariBase64(hashB64);
  if (hasil.length !== target.length) return false;
  let beda = 0;
  for (let i = 0; i < hasil.length; i++) beda |= hasil[i] ^ target[i];
  return beda === 0;
}

// Hash palsu untuk menyamakan waktu jawaban saat username tidak ada
let hashPalsu = null;
export async function samarkanWaktu(rahasia) {
  hashPalsu ||= await hashRahasia('tidak-ada-pengguna', ITERASI_BAWAAN);
  await cocokRahasia(rahasia, hashPalsu);
  return false;
}

export function tokenAcak(jumlahByte = 32) {
  return [...crypto.getRandomValues(new Uint8Array(jumlahByte))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(teks) {
  const hasil = await crypto.subtle.digest('SHA-256', enc.encode(String(teks)));
  return [...new Uint8Array(hasil)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Angka/huruf acak tanpa karakter yang mirip (untuk kode kelas & password sementara). */
export function teksAcak(panjang, huruf) {
  const a = crypto.getRandomValues(new Uint8Array(panjang));
  return [...a].map((n) => huruf[n % huruf.length]).join('');
}

export const acakPin = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0');
export const acakPassword = () => teksAcak(8, 'abcdefghjkmnpqrstuvwxyz23456789');
export const acakKodeKelas = () => teksAcak(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
export const idBaru = (awalan) => `${awalan}_${Date.now().toString(36)}${tokenAcak(3)}`;
