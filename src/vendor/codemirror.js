// src/vendor/codemirror.js — titik masuk bundel CodeMirror 6 (npm run build:vendor -> js/vendor/codemirror.js)
// Satu berkas berisi semua paket agar @codemirror/state hanya ada satu salinan.
export * as state from '@codemirror/state';
export * as view from '@codemirror/view';
export * as commands from '@codemirror/commands';
export * as language from '@codemirror/language';
export * as autocomplete from '@codemirror/autocomplete';
export * as highlight from '@lezer/highlight';
