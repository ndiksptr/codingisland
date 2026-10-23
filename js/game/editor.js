// js/game/editor.js — editor kode untuk siswa
// Memakai CodeMirror 6 dari js/vendor/codemirror.js (dibundel sekali, tanpa CDN). Jika gagal dimuat,
// otomatis memakai textarea dengan nomor baris. Keduanya punya API yang sama:
//   { jenis, getNilai, setNilai, sisipkan, sorotBaris, tandaiGalat, bersihkanSorotan, fokus, hancurkan }

// Bundel lokal berisi state, view, commands, language, autocomplete, dan @lezer/highlight
// (versi dipin di package.json; dibuat ulang dengan npm run build:vendor)
const URL_CM = '../vendor/codemirror.js';
const BATAS_MUAT_MS = 6000;

const STRUKTUR = new Set(['ulangi', 'jika', 'lainnya', 'selama', 'buat', 'bukan', 'kali']);
const PERINTAH = new Set(['maju', 'belok_kiri', 'belok_kanan', 'ambil', 'lompat', 'ada_rintangan', 'ada_jurang', 'ada_koin', 'sampai_tujuan']);

// Tempatkan kursor di posisi '|' pada templat
function pecahTemplat(teks) {
  const i = teks.indexOf('|');
  return i < 0 ? { isi: teks, kursor: teks.length } : { isi: teks.replace('|', ''), kursor: i };
}

let janjiCM = null;
function muatCodeMirror() {
  if (!janjiCM) {
    const muat = import(URL_CM)
      .then(({ state, view, commands, language, autocomplete, highlight }) =>
        ({ state, view, commands, language, autocomplete, highlight }));
    const batas = new Promise((_, tolak) => setTimeout(() => tolak(new Error('CodeMirror terlalu lama dimuat')), BATAS_MUAT_MS));
    janjiCM = Promise.race([muat, batas]).catch((err) => { janjiCM = null; throw err; });
  }
  return janjiCM;
}

/**
 * Buat editor di dalam `wadah`.
 * opsi: { nilai, saatUbah(teks), saranKata: ['maju', ...], label }
 */
export async function buatEditor(wadah, opsi = {}) {
  try {
    const cm = await muatCodeMirror();
    return editorCodeMirror(cm, wadah, opsi);
  } catch (err) {
    console.warn('[editor] CodeMirror gagal dimuat, memakai textarea cadangan.', err);
    return editorTextarea(wadah, opsi);
  }
}

// =====================================================================
// CodeMirror 6
// =====================================================================
function editorCodeMirror(cm, wadah, { nilai = '', saatUbah = null, saranKata = [], label = 'Editor kode' }) {
  const { EditorState, StateEffect, StateField } = cm.state;
  const { EditorView, Decoration, keymap, lineNumbers, highlightActiveLineGutter, drawSelection } = cm.view;
  const { defaultKeymap, history, historyKeymap } = cm.commands;
  const { StreamLanguage, HighlightStyle, syntaxHighlighting, bracketMatching } = cm.language;
  const { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } = cm.autocomplete;
  const { tags } = cm.highlight;

  // Pewarnaan sederhana: perintah, kata kunci, angka, komentar
  const bahasa = StreamLanguage.define({
    token(stream) {
      if (stream.eatSpace()) return null;
      if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
      if (stream.match(/^\d+/)) return 'number';
      if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)) {
        const kata = stream.current().toLowerCase();
        if (STRUKTUR.has(kata)) return 'keyword';
        if (PERINTAH.has(kata)) return 'builtin';
        return 'variable';
      }
      stream.next();
      return null;
    }
  });
  const gaya = HighlightStyle.define([
    { tag: tags.keyword, color: '#8E3FB5', fontWeight: '700' },
    { tag: tags.standard(tags.variableName), color: '#287A74', fontWeight: '700' },
    { tag: tags.number, color: '#B24E1C', fontWeight: '700' },
    { tag: tags.comment, color: '#6E8F8A', fontStyle: 'italic' }
  ]);

  // Autocomplete nama perintah yang tersedia
  const pilihan = saranKata.map((k) => {
    const templat = { ulangi: 'ulangi 2 {', jika: 'jika ', selama: 'selama ', buat: 'buat ' }[k];
    const pakaiKurung = PERINTAH.has(k);
    return { label: k, type: pakaiKurung ? 'function' : 'keyword', apply: templat || (pakaiKurung ? `${k}()` : k) };
  });
  const sumberSaran = (ctx) => {
    const kata = ctx.matchBefore(/[a-zA-Z_]+/);
    if (!kata || (kata.from === kata.to && !ctx.explicit)) return null;
    return { from: kata.from, options: pilihan, validFor: /^[a-zA-Z_]*$/ };
  };

  // Sorotan baris: baris yang sedang dijalankan & baris error
  const aturSorot = StateEffect.define();
  const medanSorot = StateField.define({
    create: () => Decoration.none,
    update(deko, tr) {
      // Mengetik menghapus sorotan (jalan & error)
      if (tr.docChanged && !tr.effects.some((e) => e.is(aturSorot))) return Decoration.none;
      deko = deko.map(tr.changes);
      for (const e of tr.effects) {
        if (!e.is(aturSorot)) continue;
        const rentang = [];
        const { aktif, galat } = e.value;
        const jumlah = tr.state.doc.lines;
        const tambah = (n, kelas) => {
          if (n && n >= 1 && n <= jumlah) rentang.push(Decoration.line({ class: kelas }).range(tr.state.doc.line(n).from));
        };
        if (aktif === galat) tambah(galat, 'cm-baris-galat');
        else {
          const urut = [[aktif, 'cm-baris-jalan'], [galat, 'cm-baris-galat']].filter(([n]) => n).sort((a, b) => a[0] - b[0]);
          urut.forEach(([n, k]) => tambah(n, k));
        }
        deko = Decoration.set(rentang, true);
      }
      return deko;
    },
    provide: (f) => EditorView.decorations.from(f)
  });

  const tema = EditorView.theme({
    '&': { fontSize: '18px', backgroundColor: '#fff', color: '#12332F' },
    '.cm-content': { fontFamily: '"JetBrains Mono", ui-monospace, monospace', padding: '10px 0' },
    '.cm-gutters': { backgroundColor: '#F6FBF9', color: '#6E8F8A', border: 'none', borderRight: '2px solid #DCEFE8' },
    '.cm-scroller': { minHeight: '13rem', maxHeight: '24rem', fontFamily: '"JetBrains Mono", ui-monospace, monospace', lineHeight: '1.6' },
    '&.cm-focused': { outline: 'none' },
    '.cm-activeLineGutter': { backgroundColor: '#E5F7EF', color: '#287A74' },
    '.cm-cursor': { borderLeftColor: '#287A74', borderLeftWidth: '2px' },
    '.cm-tooltip-autocomplete': { fontFamily: '"JetBrains Mono", monospace', fontSize: '16px' }
  });

  let diam = false; // jangan panggil saatUbah saat setNilai dari program
  let sorot = { aktif: null, galat: null };
  wadah.innerHTML = ''; // hapus teks "Menyiapkan editor..."
  const view = new EditorView({
    parent: wadah,
    state: EditorState.create({
      doc: nilai,
      selection: { anchor: nilai.length }, // kursor di akhir kode agar sisipan tidak menimpa komentar awal
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        closeBrackets(),
        bracketMatching(),
        bahasa,
        syntaxHighlighting(gaya),
        autocompletion({ override: [sumberSaran], icons: false }),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap]),
        medanSorot,
        tema,
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'false', autocapitalize: 'off' }),
        EditorView.updateListener.of((u) => {
          if (!u.docChanged) return;
          sorot = { aktif: null, galat: null };
          if (!diam) saatUbah?.(u.state.doc.toString());
        })
      ]
    })
  });

  const kirimSorot = (gulirKe) => {
    const effects = [aturSorot.of({ ...sorot })];
    if (gulirKe && gulirKe <= view.state.doc.lines) {
      effects.push(EditorView.scrollIntoView(view.state.doc.line(gulirKe).from, { y: 'nearest' }));
    }
    view.dispatch({ effects });
  };

  return {
    jenis: 'codemirror',
    getNilai: () => view.state.doc.toString(),
    setNilai(teks) {
      diam = true;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: teks } });
      diam = false;
    },
    /** Sisipkan templat di kursor ('|' = posisi kursor akhir), ditambah baris baru. */
    sisipkan(templat) {
      const { isi, kursor } = pecahTemplat(templat);
      const pos = view.state.selection.main.head;
      const baris = view.state.doc.lineAt(pos);
      const sebelum = baris.text.slice(0, pos - baris.from);
      const indent = (baris.text.match(/^\s*/) || [''])[0];
      // Jika kursor di belakang teks lain, mulai di baris baru
      const awalan = sebelum.trim() ? `\n${indent}` : '';
      const teks = awalan + isi.replace(/\n/g, `\n${indent}`) + `\n${indent}`;
      const posKursor = pos + awalan.length + isi.slice(0, kursor).replace(/\n/g, `\n${indent}`).length;
      view.dispatch({ changes: { from: pos, insert: teks }, selection: { anchor: posKursor }, scrollIntoView: true });
      view.focus();
    },
    sorotBaris(n) { sorot.aktif = n || null; kirimSorot(n); },
    tandaiGalat(n) { sorot.galat = n || null; kirimSorot(n); },
    bersihkanSorotan() { sorot = { aktif: null, galat: null }; kirimSorot(null); },
    fokus() { view.focus(); },
    hancurkan() { view.destroy(); }
  };
}

// =====================================================================
// Cadangan: textarea dengan nomor baris
// =====================================================================
function editorTextarea(wadah, { nilai = '', saatUbah = null, label = 'Editor kode' }) {
  wadah.innerHTML = `
    <div class="editor-cadangan">
      <pre class="editor-cadangan-nomor" aria-hidden="true"></pre>
      <div class="editor-cadangan-isi">
        <div class="editor-cadangan-sorot" data-sorot-jalan hidden></div>
        <div class="editor-cadangan-sorot galat" data-sorot-galat hidden></div>
        <textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="${label}"></textarea>
      </div>
    </div>`;
  const ta = wadah.querySelector('textarea');
  const nomor = wadah.querySelector('.editor-cadangan-nomor');
  const sorotJalan = wadah.querySelector('[data-sorot-jalan]');
  const sorotGalat = wadah.querySelector('[data-sorot-galat]');
  ta.value = nilai;
  ta.setSelectionRange(nilai.length, nilai.length);

  const tinggiBaris = () => parseFloat(getComputedStyle(ta).lineHeight) || 28.8;
  const atasPadding = () => parseFloat(getComputedStyle(ta).paddingTop) || 10;
  const sorot = { aktif: null, galat: null };

  function gambarNomor() {
    const n = ta.value.split('\n').length;
    nomor.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
    nomor.scrollTop = ta.scrollTop;
    letakkanSorot();
  }
  function letakkanSorot() {
    for (const [el, n] of [[sorotJalan, sorot.aktif], [sorotGalat, sorot.galat]]) {
      el.hidden = !n;
      if (n) el.style.top = `${atasPadding() + (n - 1) * tinggiBaris() - ta.scrollTop}px`;
      el.style.height = `${tinggiBaris()}px`;
    }
  }
  function gulirKe(n) {
    if (!n) return;
    const y = atasPadding() + (n - 1) * tinggiBaris();
    if (y < ta.scrollTop || y > ta.scrollTop + ta.clientHeight - tinggiBaris()) ta.scrollTop = Math.max(0, y - ta.clientHeight / 2);
  }

  ta.addEventListener('input', () => {
    sorot.aktif = null;
    sorot.galat = null;
    gambarNomor();
    saatUbah?.(ta.value);
  });
  ta.addEventListener('scroll', () => { nomor.scrollTop = ta.scrollTop; letakkanSorot(); });
  // Tab menyisipkan 2 spasi (Esc lalu Tab untuk keluar dari editor)
  let lepasTab = false;
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { lepasTab = true; return; }
    if (e.key === 'Tab' && !e.shiftKey && !lepasTab) {
      e.preventDefault();
      ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
    }
    if (e.key !== 'Tab') lepasTab = false;
  });
  gambarNomor();

  return {
    jenis: 'textarea',
    getNilai: () => ta.value,
    setNilai(teks) { ta.value = teks; gambarNomor(); },
    sisipkan(templat) {
      const { isi, kursor } = pecahTemplat(templat);
      const pos = ta.selectionStart;
      const awalBaris = ta.value.lastIndexOf('\n', pos - 1) + 1;
      const sebelum = ta.value.slice(awalBaris, pos);
      const indent = (ta.value.slice(awalBaris).match(/^[ \t]*/) || [''])[0];
      const awalan = sebelum.trim() ? `\n${indent}` : '';
      const teks = awalan + isi.replace(/\n/g, `\n${indent}`) + `\n${indent}`;
      ta.setRangeText(teks, pos, ta.selectionEnd, 'end');
      const posKursor = pos + awalan.length + isi.slice(0, kursor).replace(/\n/g, `\n${indent}`).length;
      ta.setSelectionRange(posKursor, posKursor);
      ta.focus();
      ta.dispatchEvent(new Event('input'));
    },
    sorotBaris(n) { sorot.aktif = n || null; gulirKe(n); letakkanSorot(); },
    tandaiGalat(n) { sorot.galat = n || null; gulirKe(n); letakkanSorot(); },
    bersihkanSorotan() { sorot.aktif = null; sorot.galat = null; letakkanSorot(); },
    fokus() { ta.focus(); },
    hancurkan() { wadah.innerHTML = ''; }
  };
}
