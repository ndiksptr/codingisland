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

    const [sumber, ...rute] = url.pathname.slice('/api/'.length).split('/');
    const penangan = API[sumber];
    if (!penangan) return json({ galat: 'Alamat API tidak ditemukan.' }, 404);
    if (!env.DB) return json({ galat: 'Database belum terhubung (binding DB tidak ada).' }, 500);

    try {
      await siapkanDb(env.DB);
    } catch (err) {
      console.error(err);
      return json({ galat: 'Database belum siap. Coba lagi sebentar ya.' }, 503);
    }
    // Bentuk context sama dengan Pages Functions, jadi berkas di functions/api tidak perlu diubah
    return penangan({ request, env, params: { rute }, data: {}, waitUntil: (p) => ctx.waitUntil(p) });
  }
};
