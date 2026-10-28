// worker.js — pintu masuk Cloudflare Worker Coding Island
// /api/<sumber>/...  -> penangan di functions/api/<sumber>/[[rute]].js (D1 binding "DB")
// alamat lain        -> berkas statis (index.html, css/, js/, image/) lewat binding ASSETS

import { onRequest as auth } from './functions/api/auth/[[rute]].js';
import { onRequest as kelas } from './functions/api/kelas/[[rute]].js';
import { onRequest as siswa } from './functions/api/siswa/[[rute]].js';
import { onRequest as level } from './functions/api/level/[[rute]].js';
import { onRequest as progres } from './functions/api/progres/[[rute]].js';
import { onRequest as nilai } from './functions/api/nilai/[[rute]].js';
import { onRequest as aktivitas } from './functions/api/aktivitas/[[rute]].js';
import { json } from './server/http.js';
import { siapkanDb } from './server/siapkan-db.js';

const API = { auth, kelas, siswa, level, progres, nilai, aktivitas };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    // Dipanggil sekali per perangkat oleh index.html: minta browser membuang cache berkas lama
    // (versi lama sempat disimpan sampai 1 hari dan masih berisi akun demo)
    if (url.pathname === '/api/bersihkan-cache') {
      return new Response(null, { status: 204, headers: { 'Clear-Site-Data': '"cache"', 'Cache-Control': 'no-store' } });
    }

    const [sumber, ...rute] = url.pathname.slice('/api/'.length).split('/');
    const penangan = API[sumber];
    if (!penangan) return json({ galat: 'Permintaan ini tidak dikenali. Muat ulang halaman, lalu coba lagi.' }, 404);
    if (!env.DB) {
      console.error('Binding D1 "DB" tidak ada. Periksa d1_databases di wrangler.toml.');
      return json({ galat: 'Coding Island belum siap dipakai. Hubungi admin sekolah.' }, 500);
    }

    try {
      await siapkanDb(env.DB);
    } catch (err) {
      console.error(err);
      return json({ galat: 'Coding Island sedang bersiap. Tunggu sebentar, lalu coba lagi.' }, 503);
    }
    // Bentuk context sama dengan Pages Functions, jadi berkas di functions/api tidak perlu diubah
    return penangan({ request, env, params: { rute }, data: {}, waitUntil: (p) => ctx.waitUntil(p) });
  }
};
