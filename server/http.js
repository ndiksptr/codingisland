// server/http.js — respons JSON, galat API, dan router kecil untuk Pages Functions
// Setiap file functions/api/<sumber>/[[rute]].js memakai buatRouter() untuk memetakan
// metode + path ke fungsi penangan.

/** Galat yang aman ditampilkan ke pengguna (pesan ramah + kode status HTTP). */
export class GalatApi extends Error {
  constructor(status, pesan) {
    super(pesan);
    this.status = status;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}

export async function bacaJson(request) {
  try {
    return (await request.json()) || {};
  } catch {
    throw new GalatApi(400, 'Ada data yang tidak terbaca. Muat ulang halaman, lalu coba lagi.');
  }
}

/** Ambil parameter kueri (?a=b) sebagai objek. */
export const kueri = (request) => Object.fromEntries(new URL(request.url).searchParams);

/**
 * Buat penangan onRequest dari daftar rute.
 * rute: [[metode, pola, penangan(context, params)], ...]
 * pola: 'kelas/:id/kode-baru' relatif terhadap folder sumber daya ('' = akar).
 * Penangan boleh mengembalikan Response atau data biasa (dijadikan JSON).
 */
export function buatRouter(daftarRute) {
  return async function onRequest(context) {
    const segmen = [].concat(context.params.rute || []).filter(Boolean);
    const metode = context.request.method;

    // Perlindungan CSRF ringan: perubahan data wajib JSON (form lintas situs tidak bisa mengirim JSON)
    if (!['GET', 'HEAD'].includes(metode)) {
      const tipe = context.request.headers.get('Content-Type') || '';
      const panjang = Number(context.request.headers.get('Content-Length') || 0);
      if (panjang > 0 && !tipe.includes('application/json')) return json({ galat: 'Ada data yang tidak terbaca. Muat ulang halaman, lalu coba lagi.' }, 415);
    }

    for (const [m, pola, penangan] of daftarRute) {
      if (m !== metode) continue;
      const bagian = pola.split('/').filter(Boolean);
      if (bagian.length !== segmen.length) continue;
      const params = {};
      const cocok = bagian.every((b, i) => {
        if (b.startsWith(':')) { params[b.slice(1)] = decodeURIComponent(segmen[i]); return true; }
        return b === segmen[i];
      });
      if (!cocok) continue;
      try {
        const hasil = await penangan(context, params);
        // null tetap dikirim sebagai null (mis. "tidak ditemukan"); undefined menjadi { ok: true }
        return hasil instanceof Response ? hasil : json(hasil === undefined ? { ok: true } : hasil);
      } catch (err) {
        if (err instanceof GalatApi) return json({ galat: err.message }, err.status);
        console.error(err);
        // Pelanggaran UNIQUE dari D1 (mis. username kembar) diterjemahkan agar ramah
        if (/UNIQUE constraint failed/i.test(String(err?.message))) return json({ galat: 'Data ini sudah dipakai. Ganti dengan yang lain, lalu coba lagi.' }, 409);
        return json({ galat: 'Coding Island sedang ada gangguan. Tunggu sebentar, lalu coba lagi.' }, 500);
      }
    }
    return json({ galat: 'Permintaan ini tidak dikenali. Muat ulang halaman, lalu coba lagi.' }, 404);
  };
}
