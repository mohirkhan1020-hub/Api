/* ══════════════════════════════════════════════════════════════
   ALL-IN-ONE TOOLS — script.js
   Part 1: Helpers, App, Routing, Dark Mode, Search, Toasts
   ══════════════════════════════════════════════════════════════ */

'use strict';

// ─── 1. HELPERS ───────────────────────────────────────────────
/**
 * Short query selector.
 * @param {string} sel CSS selector
 * @param {ParentNode} [root=document]
 * @returns {Element|null}
 */
const $ = (sel, root = document) => root.querySelector(sel);

/**
 * Short query selector all → array.
 * @param {string} sel
 * @param {ParentNode} [root=document]
 * @returns {Element[]}
 */
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * Create an element with attributes/props.
 * @param {string} tag
 * @param {Object} [attrs]
 * @param {string|Node|Array} [children]
 * @returns {HTMLElement}
 */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

/**
 * Debounce a function.
 * @param {Function} fn
 * @param {number} [wait=250]
 * @returns {Function}
 */
function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Format bytes as human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Pad a number to 2 digits.
 * @param {number} n
 * @returns {string}
 */
const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Trigger a browser download from a Blob or URL.
 * @param {Blob|string} data
 * @param {string} filename
 */
function download(data, filename) {
  let url;
  let revoke = false;
  if (typeof data === 'string') {
    url = data;
  } else {
    url = URL.createObjectURL(data);
    revoke = true;
  }
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Read a File as a data URL.
 * @param {File|Blob} file
 * @returns {Promise<string>}
 */
function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('Read failed'));
    r.readAsDataURL(file);
  });
}

/**
 * Read a File as text.
 * @param {File|Blob} file
 * @returns {Promise<string>}
 */
function readAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('Read failed'));
    r.readAsText(file);
  });
}

/**
 * Load an image element from a source (URL/dataURL/blob).
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}

/**
 * File type/size guard. Throws friendly errors.
 * @param {File} file
 * @param {{types?: string[], maxMB?: number, label?: string}} [opts]
 */
function assertFile(file, { types, maxMB, label = 'File' } = {}) {
  if (!file) throw new Error(`${label} is required.`);
  if (types && types.length) {
    const ok = types.some((t) => {
      if (t.endsWith('/*')) return file.type.startsWith(t.slice(0, -1));
      return file.type === t;
    });
    if (!ok) throw new Error(`${label} must be one of: ${types.join(', ')}`);
  }
  if (maxMB && file.size > maxMB * 1024 * 1024) {
    throw new Error(`${label} is too large (max ${maxMB} MB).`);
  }
}

/**
 * Copy text to the clipboard with fallback.
 * @param {string} text
 * @returns {Promise<void>}
 */
async function copyText(text) {
  if (!text) throw new Error('Nothing to copy.');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = el('textarea', {});
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.append(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

/**
 * Export text as a .txt file.
 * @param {string} text
 * @param {string} [filename='output.txt']
 */
function downloadText(text, filename = 'output.txt') {
  const blob = new Blob([text ?? ''], { type: 'text/plain;charset=utf-8' });
  download(blob, filename);
}

/**
 * Set up a progress bar for async operations.
 * @param {HTMLElement} wrap
 * @param {number} pct 0-100
 * @param {string} [text]
 */
function setProgress(wrap, pct, text) {
  if (!wrap) return;
  wrap.hidden = false;
  wrap.classList.add('running');
  const bar = $('.progress-bar', wrap);
  const label = $('.progress-label', wrap);
  if (bar) bar.style.setProperty('--p', pct); // unused fallback
  if (bar) bar.style.cssText = '';
  if (bar) bar.dataset.pct = String(pct);
  if (bar) {
    // width via inline style on pseudo-element isn't possible; use a child div fallback
    bar.style.setProperty('--w', `${pct}%`);
    // Standard browsers: we use a child width element
  }
  // Simpler: set width on a child if present
  const fill = bar && bar.firstElementChild;
  if (fill) fill.style.width = `${pct}%`;
  if (bar && !fill) bar.style.background =
    `linear-gradient(90deg, var(--primary) ${pct}%, var(--surface) ${pct}%)`;
  if (label) label.textContent = text ?? `${Math.round(pct)}%`;
}

/** Hide progress bar. */
function hideProgress(wrap) {
  if (!wrap) return;
  wrap.hidden = true;
  wrap.classList.remove('running');
}

// ─── 2. TOASTS ────────────────────────────────────────────────
/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} [type='info']
 */
function toast(message, type = 'info') {
  const region = $('#toast-region');
  if (!region) return;
  const t = el('div', { class: `toast ${type}`, role: 'status' }, [
    el('i', {
      class: type === 'success' ? 'fa-solid fa-circle-check'
        : type === 'error' ? 'fa-solid fa-circle-exclamation'
        : 'fa-solid fa-circle-info',
      'aria-hidden': 'true',
    }),
    el('span', {}, message),
  ]);
  region.append(t);
  setTimeout(() => {
    t.classList.add('hide');
    setTimeout(() => t.remove(), 220);
  }, 3200);
}

// ─── 3. TOOL REGISTRY (drives home grid) ──────────────────────
/**
 * @typedef {{id:string, title:string, desc:string, icon:string, group:string}} ToolMeta
 * @type {ToolMeta[]}
 */
const TOOLS = [
  // Group A
  { id: 'tool-ocr',        group: 'A', icon: 'fa-id-card',               title: 'ID Card Scanner',       desc: 'Extract text from ID images with OCR.' },
  { id: 'tool-passport',   group: 'A', icon: 'fa-passport',              title: 'Passport Photo',        desc: 'Make a 35×45 mm or 2×2 in photo.' },
  { id: 'tool-aadhaar',    group: 'A', icon: 'fa-address-card',          title: 'Aadhaar Extractor',     desc: 'Parse name, number, DOB, address.' },
  { id: 'tool-pan',        group: 'A', icon: 'fa-id-badge',              title: 'PAN Extractor',         desc: 'Extract PAN number, name, DOB.' },
  { id: 'tool-dl',         group: 'A', icon: 'fa-car',                   title: 'Driving License',       desc: 'Extract DL number, name, validity.' },
  { id: 'tool-voter',      group: 'A', icon: 'fa-check-to-slot',         title: 'Voter ID Scanner',      desc: 'Extract EPIC number, name, age.' },
  { id: 'tool-bizcard',    group: 'A', icon: 'fa-address-book',          title: 'Business Card',         desc: 'Extract name, phone, email, site.' },
  { id: 'tool-multiscan',  group: 'A', icon: 'fa-copy',                  title: 'Multi-Page Scan',       desc: 'Combine images into one PDF.' },
  // Group B
  { id: 'tool-img2pdf',    group: 'B', icon: 'fa-image',                 title: 'Image to PDF',          desc: 'Turn images into a single PDF.' },
  { id: 'tool-pdf2img',    group: 'B', icon: 'fa-file-image',            title: 'PDF to Image',          desc: 'Render each PDF page to PNG/JPG.' },
  { id: 'tool-pdf-merge',  group: 'B', icon: 'fa-object-group',          title: 'PDF Merge',             desc: 'Merge multiple PDFs into one.' },
  { id: 'tool-pdf-split',  group: 'B', icon: 'fa-scissors',              title: 'PDF Split',             desc: 'Extract a page range to new PDF.' },
  { id: 'tool-pdf-compress', group: 'B', icon: 'fa-compress',            title: 'PDF Compress',          desc: 'Shrink PDFs by re-rendering pages.' },
  { id: 'tool-pdf-rotate', group: 'B', icon: 'fa-rotate',                title: 'PDF Rotate',            desc: 'Rotate pages 90/180/270°.' },
  { id: 'tool-pdf-delete', group: 'B', icon: 'fa-trash-can',             title: 'PDF Page Delete',       desc: 'Remove pages from a PDF.' },
  { id: 'tool-pdf-watermark', group: 'B', icon: 'fa-droplet',            title: 'PDF Watermark',         desc: 'Stamp text watermarks on pages.' },
  { id: 'tool-pdf-protect', group: 'B', icon: 'fa-lock',                 title: 'PDF Protect',           desc: 'Encrypt PDF with a password.' },
  { id: 'tool-text2pdf',   group: 'B', icon: 'fa-file-lines',            title: 'Text to PDF',           desc: 'Convert pasted text to a PDF.' },
  // Group C
  { id: 'tool-image-compress', group: 'C', icon: 'fa-compress',          title: 'Image Compressor',      desc: 'Reduce size with quality control.' },
  { id: 'tool-image-resize',   group: 'C', icon: 'fa-up-right-and-down-left-from-center', title: 'Image Resizer', desc: 'Resize with aspect-ratio lock.' },
  { id: 'tool-image-crop',     group: 'C', icon: 'fa-crop-simple',       title: 'Image Cropper',         desc: 'Crop with fixed or free ratios.' },
  { id: 'tool-image-rotate',   group: 'C', icon: 'fa-rotate',            title: 'Image Rotator',         desc: 'Rotate and flip images.' },
  { id: 'tool-image-convert',  group: 'C', icon: 'fa-right-left',        title: 'Format Converter',      desc: 'JPG ↔ PNG ↔ WebP.' },
  { id: 'tool-img2b64',        group: 'C', icon: 'fa-code',              title: 'Image to Base64',       desc: 'Convert images to data URIs.' },
  { id: 'tool-b64img',         group: 'C', icon: 'fa-image',             title: 'Base64 to Image',       desc: 'Decode data URIs back to images.' },
  { id: 'tool-bg-remove',      group: 'C', icon: 'fa-eraser',            title: 'BG Remover',            desc: 'Replace a background colour.' },
  { id: 'tool-image-watermark', group: 'C', icon: 'fa-droplet',          title: 'Image Watermark',       desc: 'Add text watermark overlays.' },
  { id: 'tool-grayscale',      group: 'C', icon: 'fa-circle-half-stroke', title: 'Grayscale',            desc: 'One-click grayscale conversion.' },
  { id: 'tool-image-color',    group: 'C', icon: 'fa-eye-dropper',       title: 'Color Picker',          desc: 'Sample pixel HEX/RGB values.' },
  { id: 'tool-image-meta',     group: 'C', icon: 'fa-info-circle',       title: 'Metadata Viewer',       desc: 'Read image metadata/EXIF.' },
  { id: 'tool-passport-grid',  group: 'C', icon: 'fa-table-cells',       title: 'Passport Grid',         desc: 'Tile 4/6/8 copies on A4.' },
  // Group D
  { id: 'tool-qr-gen',      group: 'D', icon: 'fa-qrcode',               title: 'QR Generator',          desc: 'Create text/vCard/WiFi QR codes.' },
  { id: 'tool-qr-scan',     group: 'D', icon: 'fa-camera',               title: 'QR Scanner',            desc: 'Scan QR codes with your camera.' },
  { id: 'tool-barcode-gen', group: 'D', icon: 'fa-barcode',              title: 'Barcode Generator',     desc: 'Code128, EAN13, UPC barcodes.' },
  { id: 'tool-barcode-scan', group: 'D', icon: 'fa-camera-retro',        title: 'Barcode Scanner',       desc: 'Scan barcodes with your camera.' },
  // Group E
  { id: 'tool-word-count',  group: 'E', icon: 'fa-file-word',            title: 'Word Counter',          desc: 'Words, chars, sentences, paras.' },
  { id: 'tool-char-count',  group: 'E', icon: 'fa-text-width',           title: 'Character Counter',     desc: 'Chars with/without spaces + bytes.' },
  { id: 'tool-case',        group: 'E', icon: 'fa-font',                 title: 'Case Converter',        desc: 'UPPER, lower, Title, camel, snake.' },
  { id: 'tool-tts',         group: 'E', icon: 'fa-volume-high',          title: 'Text to Speech',        desc: 'Browser TTS with voice control.' },
  { id: 'tool-stt',         group: 'E', icon: 'fa-microphone',           title: 'Speech to Text',        desc: 'Live dictation with Web Speech.' },
  { id: 'tool-dedupe',      group: 'E', icon: 'fa-layer-group',          title: 'Remove Duplicates',     desc: 'Dedupe lines, case optional.' },
  { id: 'tool-b64-text',    group: 'E', icon: 'fa-code',                 title: 'Base64 Text',           desc: 'UTF-8 safe text encode/decode.' },
  { id: 'tool-url',         group: 'E', icon: 'fa-link',                 title: 'URL Encoder',           desc: 'Percent-encode or decode text.' },
  { id: 'tool-lorem',       group: 'E', icon: 'fa-paragraph',            title: 'Lorem Ipsum',           desc: 'Generate placeholder text.' },
  { id: 'tool-text-sort',   group: 'E', icon: 'fa-arrow-down-a-z',       title: 'Text Reverser',         desc: 'Sort lines or reverse strings.' },
  // Group F
  { id: 'tool-age',       group: 'F', icon: 'fa-cake-candles',           title: 'Age Calculator',        desc: 'Exact age + days to birthday.' },
  { id: 'tool-bmi',       group: 'F', icon: 'fa-weight-scale',           title: 'BMI Calculator',        desc: 'Metric or imperial BMI.' },
  { id: 'tool-emi',       group: 'F', icon: 'fa-indian-rupee-sign',      title: 'EMI Calculator',        desc: 'Monthly EMI + yearly summary.' },
  { id: 'tool-percent',   group: 'F', icon: 'fa-percent',                title: 'Percentage',            desc: '3-in-1 percentage calculator.' },
  { id: 'tool-currency',  group: 'F', icon: 'fa-money-bill-transfer',    title: 'Currency',              desc: 'Manual offline converter.' },
  { id: 'tool-unit',      group: 'F', icon: 'fa-ruler-combined',         title: 'Unit Converter',        desc: 'Length, weight, temp, area, volume.' },
  { id: 'tool-password',  group: 'F', icon: 'fa-key',                    title: 'Password Generator',    desc: 'Strong random passwords.' },
  { id: 'tool-random',    group: 'F', icon: 'fa-dice',                   title: 'Random Numbers',        desc: 'Generate numbers in a range.' },
  // Group G
  { id: 'tool-stopwatch', group: 'G', icon: 'fa-stopwatch',              title: 'Stopwatch',             desc: 'Start, pause, lap, reset.' },
  { id: 'tool-timer',     group: 'G', icon: 'fa-hourglass-half',         title: 'Countdown Timer',       desc: 'HH:MM:SS with a beep on end.' },
  { id: 'tool-notepad',   group: 'G', icon: 'fa-note-sticky',            title: 'Notepad',               desc: 'Autosaving local note pad.' },
  { id: 'tool-todo',      group: 'G', icon: 'fa-list-check',             title: 'To-Do List',            desc: 'Persistent, editable tasks.' },
  { id: 'tool-palette',   group: 'G', icon: 'fa-palette',                title: 'Color Palette',         desc: 'Shades + complementary colours.' },
  { id: 'tool-camera',    group: 'G', icon: 'fa-camera',                 title: 'Camera Capture',        desc: 'Snapshot via getUserMedia.' },
  { id: 'tool-hash',      group: 'G', icon: 'fa-fingerprint',            title: 'File Hash',             desc: 'MD5 / SHA-1 / SHA-256 hashes.' },
];

// ─── 4. APP ───────────────────────────────────────────────────
const App = {
  state: {
    currentTool: null,
    darkMode: false,
    searchTerm: '',
  },

  /** Boot the app. */
  init() {
    this.initTheme();
    this.renderGrid();
    this.bindGlobal();
    this.routeFromHash();
    $('#year').textContent = String(new Date().getFullYear());
  },

  // ── Theme ─────────────────────────────
  /** Load theme preference and apply it. */
  initTheme() {
    let saved = null;
    try { saved = localStorage.getItem('ait-theme'); } catch { /* ignore */ }
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const dark = saved === 'dark' || (!saved && prefersDark);
    this.applyTheme(dark);
  },

  /** Apply a theme. @param {boolean} dark */
  applyTheme(dark) {
    this.state.darkMode = dark;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const btn = $('#theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', String(dark));
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      const icon = btn.querySelector('i');
      if (icon) icon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
    try { localStorage.setItem('ait-theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
  },

  /** Toggle the theme. */
  toggleTheme() {
    this.applyTheme(!this.state.darkMode);
  },

  // ── Routing ───────────────────────────
  /** Read hash and open the matching view. */
  routeFromHash() {
    const hash = (location.hash || '').replace(/^#/, '');
    const target = hash && document.getElementById(hash) ? hash : 'home';
    this.showView(target);
  },

  /** Show a view by id; hides others. @param {string} id */
  showView(id) {
    const views = $$('.view');
    let found = false;
    views.forEach((v) => {
      const active = v.id === id;
      v.classList.toggle('active', active);
      if (active) { found = true; }
      // Lazy-clean canvases to avoid memory leaks on hidden views.
      if (!active) {
        v.querySelectorAll('canvas').forEach((c) => {
          const ctx = c.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, c.width, c.height);
        });
      }
    });
    if (!found) {
      const home = document.getElementById('home');
      if (home) home.classList.add('active');
      id = 'home';
    }
    this.state.currentTool = id === 'home' ? null : id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Update aria-current on nav links
    $$('.main-nav a').forEach((a) => {
      const linkId = a.getAttribute('href')?.replace('#', '');
      if (linkId === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  },

  /** Programmatic navigation. @param {string} id */
  navigate(id) {
    if (location.hash !== `#${id}`) {
      history.pushState(null, '', `#${id}`);
    }
    this.showView(id);
  },

  // ── Search / Grid ─────────────────────
  /** Build home page tool cards. */
  renderGrid() {
    const grid = $('#tools-grid');
    if (!grid) return;
    grid.innerHTML = '';
    TOOLS.forEach((tool) => {
      const card = el('a', {
        href: `#${tool.id}`,
        class: 'tool-card',
        role: 'listitem',
        dataset: { id: tool.id, title: tool.title.toLowerCase(), desc: tool.desc.toLowerCase() },
        'aria-label': `${tool.title}: ${tool.desc}`,
      }, [
        el('span', { class: 'card-icon' }, [el('i', { class: `fa-solid ${tool.icon}`, 'aria-hidden': 'true' })]),
        el('h3', {}, tool.title),
        el('p', {}, tool.desc),
        el('span', { class: 'card-badge' }, `Tool ${TOOLS.indexOf(tool) + 1}`),
      ]);
      grid.append(card);
    });
    this.updateGridCount(TOOLS.length);
  },

  /** Update "Showing N tools" text. @param {number} n */
  updateGridCount(n) {
    const elc = $('#grid-count');
    if (elc) elc.textContent = `Showing ${n} tool${n === 1 ? '' : 's'}`;
    const noRes = $('#no-results');
    if (noRes) noRes.hidden = n !== 0;
  },

  /** Filter grid by search term. @param {string} term */
  filterGrid(term) {
    const q = term.trim().toLowerCase();
    const cards = $$('#tools-grid .tool-card');
    let visible = 0;
    cards.forEach((card) => {
      const hay = `${card.dataset.title} ${card.dataset.desc}`;
      const match = !q || hay.includes(q);
      card.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    this.updateGridCount(visible);
  },

  // ── Global bindings ───────────────────
  /** Attach event listeners. */
  bindGlobal() {
    // Theme toggle
    $('#theme-toggle')?.addEventListener('click', () => this.toggleTheme());

    // Search
    const search = $('#tool-search');
    if (search) {
      search.addEventListener('input', debounce((e) => {
        const v = e.target.value;
        this.state.searchTerm = v;
        if (this.state.currentTool !== null) this.navigate('home');
        this.filterGrid(v);
      }, 250));
    }

    // Mobile menu
    const menuBtn = $('#menu-toggle');
    const nav = $('#main-nav');
    menuBtn?.addEventListener('click', () => {
      const open = nav?.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(!!open));
    });

    // Hash routing
    window.addEventListener('hashchange', () => this.routeFromHash());

    // Delegated navigation for [data-back]
    document.body.addEventListener('click', (e) => {
      const back = e.target.closest('[data-back]');
      if (back) {
        e.preventDefault();
        history.length > 1 ? history.back() : this.navigate('home');
      }
    });

    // Dialog
    const dlg = $('#modal-info');
    $('#open-info')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (dlg && typeof dlg.showModal === 'function') dlg.showModal();
      else dlg?.setAttribute('open', '');
    });

    // Close mobile nav on link click
    nav?.addEventListener('click', (e) => {
      if (e.target.tagName === 'A' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        menuBtn?.setAttribute('aria-expanded', 'false');
      }
    });
  },
};

// Boot once DOM is ready (script is deferred, so it's ready now).
document.addEventListener('DOMContentLoaded', () => App.init());

// ─── Expose for subsequent parts (all other IIFE-free code uses these) ───
window.AIT = { $, $$, el, debounce, formatBytes, pad2, download, readAsDataURL, readAsText, loadImage, assertFile, copyText, downloadText, setProgress, hideProgress, toast, App, TOOLS };
/* ══════════════════════════════════════════════════════════════
   Part 2: Group A (ID/Document) + Group B (PDF) tool logic
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';
  const { $, el, assertFile, readAsDataURL, readAsText, loadImage, download, downloadText,
          copyText, setProgress, hideProgress, toast, formatBytes } = window.AIT;

  // ─── SHARED OCR HELPER ──────────────────────────────────────
  /** Run Tesseract OCR on an image element.
   * @param {HTMLImageElement} img
   * @param {HTMLElement} progressWrap
   * @returns {Promise<string>}
   */
  async function runOcr(img, progressWrap) {
    if (!window.Tesseract) throw new Error('OCR engine not loaded. Check your connection.');
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && progressWrap) {
          setProgress(progressWrap, Math.round((m.progress || 0) * 100), `${Math.round((m.progress || 0) * 100)}%`);
        }
      },
    });
    try {
      const { data } = await worker.recognize(img);
      return (data?.text || '').trim();
    } finally {
      await worker.terminate();
    }
  }

  /** Load a file as an image element (converts PDF first page if PDF). */
  async function fileToImageElement(file) {
    if (file.type === 'application/pdf') {
      if (!window.pdfjsLib) {
        // pdfjs is not among our CDN list; fall back to an error
        throw new Error('PDF input needs pdf.js which is not loaded. Please use an image file.');
      }
    }
    const url = await readAsDataURL(file);
    return loadImage(url);
  }

  /** Download OCR text as .txt. */
  function bindDownloadText(btnId, getText, filename) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const txt = getText();
      if (!txt) return toast('Nothing to download yet.', 'error');
      downloadText(txt, filename);
      toast('Download started.', 'success');
    });
  }

  // ═══════════════════════════════════════════════════════════
  // GROUP A — ID / DOCUMENT
  // ═══════════════════════════════════════════════════════════

  // 01 — OCR
  (function initOcr() {
    const fileIn = $('#inp-ocr-file');
    if (!fileIn) return;
    const runBtn = $('#btn-ocr-run');
    const resetBtn = $('#btn-ocr-reset');
    const out = $('#out-ocr-text');
    const prog = $('#prog-ocr');
    const canvas = $('#canvas-ocr');

    runBtn?.addEventListener('click', async () => {
      const file = fileIn.files?.[0];
      try {
        assertFile(file, { types: ['image/*', 'application/pdf'], maxMB: 20, label: 'Image' });
        runBtn.disabled = true;
        out.value = '';
        setProgress(prog, 0, 'Starting…');
        const img = await fileToImageElement(file);
        // show on canvas
        if (canvas) {
          canvas.hidden = false;
          canvas.width = Math.min(img.width, 1200);
          canvas.height = Math.round(img.height * (canvas.width / img.width));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        const text = await runOcr(img, prog);
        out.value = text || '(no text detected)';
        hideProgress(prog);
        toast('OCR complete.', 'success');
      } catch (err) {
        hideProgress(prog);
        toast(err.message || 'OCR failed.', 'error');
      } finally {
        runBtn.disabled = false;
      }
    });

    resetBtn?.addEventListener('click', () => {
      fileIn.value = '';
      out.value = '';
      if (canvas) { canvas.hidden = true; canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); }
      hideProgress(prog);
    });
    $('#btn-ocr-copy')?.addEventListener('click', async () => {
      try { await copyText(out.value); toast('Copied.', 'success'); }
      catch (e) { toast(e.message, 'error'); }
    });
    bindDownloadText('btn-ocr-download', () => out.value, 'ocr-text.txt');
  })();

  // 02 — Passport Photo
  (function initPassport() {
    const fileIn = $('#inp-passport-file');
    if (!fileIn) return;
    const canvas = $('#canvas-passport');
    let currentImg = null;

    function getDims() {
      const size = $('#sel-passport-size')?.value || '35x45';
      // assume 300 DPI: 1mm = 11.811 px
      const pxPerMm = 300 / 25.4;
      if (size === '2x2') return { w: 600, h: 600 };
      return { w: Math.round(35 * pxPerMm), h: Math.round(45 * pxPerMm) };
    }

    async function generate() {
      const file = fileIn.files?.[0];
      try {
        assertFile(file, { types: ['image/*'], maxMB: 20, label: 'Photo' });
        const url = await readAsDataURL(file);
        currentImg = await loadImage(url);
        const { w, h } = getDims();
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        // cover-fit source
        const s = Math.max(w / currentImg.width, h / currentImg.height);
        const dw = currentImg.width * s;
        const dh = currentImg.height * s;
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2;
        const bg = $('#sel-passport-bg')?.value || 'none';
        if (bg !== 'none') {
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(currentImg, dx, dy, dw, dh);
        toast('Photo ready.', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    $('#btn-passport-run')?.addEventListener('click', generate);
    $('#btn-passport-reset')?.addEventListener('click', () => {
      fileIn.value = '';
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      currentImg = null;
    });
    $('#btn-passport-download')?.addEventListener('click', () => {
      if (!currentImg) return toast('Generate a photo first.', 'error');
      canvas.toBlob((blob) => {
        if (!blob) return toast('Export failed.', 'error');
        download(blob, 'passport-photo.jpg');
        toast('Downloaded.', 'success');
      }, 'image/jpeg', 0.92);
    });
  })();

  // 03–07: shared structured extractor factory
  /**
   * Build a generic "upload → OCR → regex parse → structured output" tool.
   * @param {object} cfg
   */
  function initStructured(cfg) {
    const fileIn = document.getElementById(cfg.fileId);
    if (!fileIn) return;
    const runBtn = document.getElementById(cfg.runId);
    const resetBtn = document.getElementById(cfg.resetId);
    const out = document.getElementById(cfg.outId);
    const prog = document.getElementById(cfg.progId);

    runBtn?.addEventListener('click', async () => {
      try {
        const files = cfg.multi ? Array.from(fileIn.files || []) : [fileIn.files?.[0]];
        if (cfg.multi) {
          if (!files.length) throw new Error('Please select the required image(s).');
        } else {
          assertFile(files[0], { types: ['image/*'], maxMB: 20, label: 'Image' });
        }
        runBtn.disabled = true;
        out.value = '';
        setProgress(prog, 0, 'Starting…');
        let combined = '';
        for (const f of files) {
          const url = await readAsDataURL(f);
          const img = await loadImage(url);
          combined += '\n' + await runOcr(img, prog);
        }
        const data = cfg.parse(combined);
        out.value = cfg.format(data, combined);
        hideProgress(prog);
        toast('Extraction complete.', 'success');
      } catch (err) {
        hideProgress(prog);
        toast(err.message || 'Extraction failed.', 'error');
      } finally {
        runBtn.disabled = false;
      }
    });

    resetBtn?.addEventListener('click', () => {
      fileIn.value = '';
      out.value = '';
      hideProgress(prog);
    });
    bindDownloadText(cfg.downloadId, () => out.value, cfg.downloadName || 'extracted.txt');
  }

  // 03 — Aadhaar
  initStructured({
    fileId: 'inp-aadhaar-front', runId: 'btn-aadhaar-run', resetId: 'btn-aadhaar-reset',
    outId: 'out-aadhaar', progId: 'prog-aadhaar', downloadId: 'btn-aadhaar-download',
    downloadName: 'aadhaar.txt',
    multi: true,
    parse(text) {
      const clean = text.replace(/\s+/g, ' ');
      const aadhaar = clean.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/)?.[0]?.replace(/\s/g, '') || '';
      const dob = clean.match(/(?:DOB|Year of Birth|YOB)[: ]*(\d{2}[\/-]\d{2}[\/-]\d{4}|\d{4})/i)?.[1] || '';
      const gender = clean.match(/\b(Male|Female|Transgender)\b/i)?.[1] || '';
      const nameLine = clean.match(/(?:Name|नाम)[: ]*([A-Za-z][A-Za-z\s.]+)/i)?.[1]?.trim()
        || clean.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/)?.[1] || '';
      const addrMatch = clean.match(/(?:Address|पता)[: ]*([\s\S]+?)(?:\d{6}|$)/i);
      const address = (addrMatch?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      return { aadhaar, dob, gender, name: nameLine, address };
    },
    format(d, raw) {
      return `Aadhaar Extractor Result
========================
Aadhaar Number : ${d.aadhaar || '—'}
Name           : ${d.name || '—'}
DOB / YOB      : ${d.dob || '—'}
Gender         : ${d.gender || '—'}
Address        : ${d.address || '—'}

--- Raw OCR ---
${raw.trim()}`;
    },
  });

  // 04 — PAN
  initStructured({
    fileId: 'inp-pan-file', runId: 'btn-pan-run', resetId: 'btn-pan-reset',
    outId: 'out-pan', progId: 'prog-pan', downloadId: 'btn-pan-download',
    downloadName: 'pan.txt',
    parse(text) {
      const clean = text.replace(/\s+/g, ' ');
      const pan = clean.match(/\b[A-Z]{5}\d{4}[A-Z]\b/)?.[0] || '';
      const dob = clean.match(/(\d{2}[\/-]\d{2}[\/-]\d{4})/)?.[1] || '';
      const father = clean.match(/Father'?s?\s*Name[: ]*([A-Za-z][A-Za-z\s.]+)/i)?.[1]?.trim() || '';
      const name = clean.match(/\bName[: ]*([A-Za-z][A-Za-z\s.]+)/i)?.[1]?.trim() || '';
      return { pan, dob, father, name };
    },
    format(d, raw) {
      return `PAN Card Result
===============
PAN Number     : ${d.pan || '—'}
Name           : ${d.name || '—'}
Father's Name  : ${d.father || '—'}
DOB            : ${d.dob || '—'}

--- Raw OCR ---
${raw.trim()}`;
    },
  });

  // 05 — DL
  initStructured({
    fileId: 'inp-dl-file', runId: 'btn-dl-run', resetId: 'btn-dl-reset',
    outId: 'out-dl', progId: 'prog-dl', downloadId: 'btn-dl-download',
    downloadName: 'driving-license.txt',
    parse(text) {
      const clean = text.replace(/\s+/g, ' ');
      const dl = clean.match(/\b[A-Z]{2}\d{2}\s?\d{4}\s?\d{7}\b/i)?.[0] || clean.match(/\b[A-Z]{2}\d{2,4}\d{7,11}\b/)?.[0] || '';
      const dob = clean.match(/(?:DOB|Date of Birth)[: ]*(\d{2}[\/-]\d{2}[\/-]\d{4})/i)?.[1] || '';
      const valid = clean.match(/(?:Valid Till|Validity|Valid Upto)[: ]*(\d{2}[\/-]\d{2}[\/-]\d{4})/i)?.[1] || '';
      const name = clean.match(/\bName[: ]*([A-Za-z][A-Za-z\s.]+)/i)?.[1]?.trim() || '';
      const addr = clean.match(/(?:Address|Addr)[: ]*([\s\S]+?)(?:Valid|DL|$)/i)?.[1]?.replace(/\s+/g, ' ').trim().slice(0, 300) || '';
      return { dl, dob, valid, name, addr };
    },
    format(d, raw) {
      return `Driving License Result
=====================
DL Number   : ${d.dl || '—'}
Name        : ${d.name || '—'}
DOB         : ${d.dob || '—'}
Valid Till  : ${d.valid || '—'}
Address     : ${d.addr || '—'}

--- Raw OCR ---
${raw.trim()}`;
    },
  });

  // 06 — Voter ID
  initStructured({
    fileId: 'inp-voter-file', runId: 'btn-voter-run', resetId: 'btn-voter-reset',
    outId: 'out-voter', progId: 'prog-voter', downloadId: 'btn-voter-download',
    downloadName: 'voter-id.txt',
    parse(text) {
      const clean = text.replace(/\s+/g, ' ');
      const epic = clean.match(/\b[A-Z]{3}\d{7}\b/)?.[0] || '';
      const name = clean.match(/\b(?:Name|Elector'?s?\s*Name)[: ]*([A-Za-z][A-Za-z\s.]+)/i)?.[1]?.trim() || '';
      const age = clean.match(/\bAge[: ]*(\d{1,3})\b/i)?.[1] || '';
      const gender = clean.match(/\b(Male|Female|Other)\b/i)?.[1] || '';
      const addr = clean.match(/(?:Address)[: ]*([\s\S]+?)(?:\d{6}|$)/i)?.[1]?.replace(/\s+/g, ' ').trim().slice(0, 300) || '';
      return { epic, name, age, gender, addr };
    },
    format(d, raw) {
      return `Voter ID Result
===============
EPIC Number : ${d.epic || '—'}
Name        : ${d.name || '—'}
Age         : ${d.age || '—'}
Gender      : ${d.gender || '—'}
Address     : ${d.addr || '—'}

--- Raw OCR ---
${raw.trim()}`;
    },
  });

  // 07 — Business Card
  initStructured({
    fileId: 'inp-bizcard-file', runId: 'btn-bizcard-run', resetId: 'btn-bizcard-reset',
    outId: 'out-bizcard', progId: 'prog-bizcard', downloadId: 'btn-bizcard-download',
    downloadName: 'business-card.txt',
    parse(text) {
      const clean = text.replace(/\s+/g, ' ');
      const email = clean.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] || '';
      const phone = clean.match(/\+?\d[\d\s().-]{7,}\d/)?.[0] || '';
      const website = clean.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?/i)?.[0] || '';
      const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const name = lines[0] || '';
      const company = lines[1] || '';
      return { name, company, phone, email, website };
    },
    format(d, raw) {
      return `Business Card Result
====================
Name    : ${d.name || '—'}
Company : ${d.company || '—'}
Phone   : ${d.phone || '—'}
Email   : ${d.email || '—'}
Website : ${d.website || '—'}

--- Raw OCR ---
${raw.trim()}`;
    },
  });

  // 08 — Multi-page document scanner → PDF
  (function initMultiScan() {
    const fileIn = $('#inp-multiscan-files');
    if (!fileIn) return;
    const status = $('#out-multiscan-status');
    let resultBlob = null;

    function autoContrast(ctx, w, h) {
      try {
        const img = ctx.getImageData(0, 0, w, h);
        const data = img.data;
        let min = 255, max = 0;
        for (let i = 0; i < data.length; i += 4) {
          const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (l < min) min = l;
          if (l > max) max = l;
        }
        const range = Math.max(1, max - min);
        for (let i = 0; i < data.length; i += 4) {
          for (let c = 0; c < 3; c++) {
            data[i + c] = Math.min(255, Math.max(0, ((data[i + c] - min) / range) * 255));
          }
        }
        ctx.putImageData(img, 0, 0);
      } catch { /* ignore */ }
    }

    $('#btn-multiscan-run')?.addEventListener('click', async () => {
      const files = Array.from(fileIn.files || []);
      try {
        if (!files.length) throw new Error('Select at least one image.');
        if (!window.jspdf?.jsPDF) throw new Error('jsPDF not loaded.');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
        let first = true;
        for (const f of files) {
          assertFile(f, { types: ['image/*'], maxMB: 20, label: 'Image' });
          const url = await readAsDataURL(f);
          const img = await loadImage(url);
          const c = document.createElement('canvas');
          c.width = img.width; c.height = img.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          autoContrast(ctx, c.width, c.height);
          const dataUrl = c.toDataURL('image/jpeg', 0.85);
          const pw = pdf.internal.pageSize.getWidth();
          const ph = pdf.internal.pageSize.getHeight();
          const s = Math.min(pw / img.width, ph / img.height);
          const dw = img.width * s, dh = img.height * s;
          if (!first) pdf.addPage();
          pdf.addImage(dataUrl, 'JPEG', (pw - dw) / 2, (ph - dh) / 2, dw, dh);
          first = false;
        }
        resultBlob = pdf.output('blob');
        if (status) status.textContent = `PDF ready: ${formatBytes(resultBlob.size)} across ${files.length} page(s).`;
        toast('Multi-page PDF ready.', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    $('#btn-multiscan-reset')?.addEventListener('click', () => {
      fileIn.value = '';
      resultBlob = null;
      if (status) status.textContent = '';
    });
    $('#btn-multiscan-download')?.addEventListener('click', () => {
      if (!resultBlob) return toast('Build the PDF first.', 'error');
      download(resultBlob, 'scanned-document.pdf');
      toast('Downloaded.', 'success');
    });
  })();

  // ═══════════════════════════════════════════════════════════
  // GROUP B — PDF
  // ═══════════════════════════════════════════════════════════

  // 09 — Image to PDF
  (function initImg2Pdf() {
    const fileIn = $('#inp-img2pdf-files');
    if (!fileIn) return;
    let blob = null;

    $('#btn-img2pdf-run')?.addEventListener('click', async () => {
      const files = Array.from(fileIn.files || []);
      const status = $('#out-img2pdf-status');
      try {
        if (!files.length) throw new Error('Select at least one image.');
        if (!window.jspdf?.jsPDF) throw new Error('jsPDF not loaded.');
        const { jsPDF } = window.jspdf;
        const size = $('#sel-img2pdf-size')?.value || 'a4';
        let pdf;
        let first = true;
        for (const f of files) {
          assertFile(f, { types: ['image/*'], maxMB: 20, label: 'Image' });
          const url = await readAsDataURL(f);
          const img = await loadImage(url);
          if (!pdf) {
            if (size === 'fit') pdf = new jsPDF({ unit: 'px', format: [img.width, img.height] });
            else pdf = new jsPDF({ unit: 'pt', format: size });
          }
          const pw = pdf.internal.pageSize.getWidth();
          const ph = pdf.internal.pageSize.getHeight();
          const s = Math.min(pw / img.width, ph / img.height);
          const dw = img.width * s, dh = img.height * s;
          if (!first) pdf.addPage();
          pdf.addImage(url, 'JPEG', (pw - dw) / 2, (ph - dh) / 2, dw, dh);
          first = false;
        }
        blob = pdf.output('blob');
        if (status) status.textContent = `PDF ready: ${formatBytes(blob.size)} · ${files.length} page(s).`;
        toast('PDF created.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
    $('#btn-img2pdf-reset')?.addEventListener('click', () => {
      fileIn.value = ''; blob = null;
      const s = $('#out-img2pdf-status'); if (s) s.textContent = '';
    });
    $('#btn-img2pdf-download')?.addEventListener('click', () => {
      if (!blob) return toast('Create the PDF first.', 'error');
      download(blob, 'images.pdf');
      toast('Downloaded.', 'success');
    });
  })();

  // 10 — PDF to Image (uses pdf-lib? no — pdf.js needed. We have no pdf.js CDN; use a friendly fallback.)
  (function initPdf2Img() {
    const fileIn = $('#inp-pdf2img-file');
    if (!fileIn) return;
    const pagesOut = $('#out-pdf2img-pages');
    const prog = $('#prog-pdf2img');

    $('#btn-pdf2img-run')?.addEventListener('click', async () => {
      try {
        const file = fileIn.files?.[0];
        assertFile(file, { types: ['application/pdf'], maxMB: 50, label: 'PDF' });
        if (pagesOut) pagesOut.innerHTML = '';
        toast('PDF page rendering needs pdf.js. Using a canvas-based conversion via pdf-lib is not possible for rendering raster images — please use the "Image to PDF" tool in reverse, or add pdf.js to the CDN list.', 'info');
        setProgress(prog, 100, 'Unavailable');
        setTimeout(() => hideProgress(prog), 1200);
      } catch (err) { toast(err.message, 'error'); }
    });
    $('#btn-pdf2img-reset')?.addEventListener('click', () => {
      fileIn.value = '';
      if (pagesOut) pagesOut.innerHTML = '';
      hideProgress(prog);
    });
  })();

  // 11 — PDF Merge (pdf-lib)
  (function initPdfMerge() {
    const fileIn = $('#inp-pdf-merge-files');
    if (!fileIn) return;
    let blob = null;
    const status = $('#out-pdf-merge-status');

    $('#btn-pdf-merge-run')?.addEventListener('click', async () => {
      const files = Array.from(fileIn.files || []);
      try {
        if (files.length < 2) throw new Error('Select 2 or more PDFs.');
        if (!window.PDFLib) throw new Error('pdf-lib not loaded.');
        const merged = await PDFLib.PDFDocument.create();
        for (const f of files) {
          assertFile(f, { types: ['application/pdf'], maxMB: 50, label: 'PDF' });
          const buf = await f.arrayBuffer();
          const src = await PDFLib.PDFDocument.load(buf);
          const pages = await merged.copyPages(src, src.getPageIndices());
          pages.forEach((p) => merged.addPage(p));
        }
        const bytes = await merged.save();
        blob = new Blob([bytes], { type: 'application/pdf' });
        if (status) status.textContent = `Merged: ${formatBytes(blob.size)} · ${files.length} files.`;
        toast('PDFs merged.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
    $('#btn-pdf-merge-reset')?.addEventListener('click', () => {
      fileIn.value = ''; blob = null; if (status) status.textContent = '';
    });
    $('#btn-pdf-merge-download')?.addEventListener('click', () => {
      if (!blob) return toast('Merge first.', 'error');
      download(blob, 'merged.pdf'); toast('Downloaded.', 'success');
    });
  })();

  // Parse page ranges: "1-3,5,7" → [0,1,2,4,6] (0-based)
  function parseRanges(s) {
    const set = new Set();
    for (const part of s.split(',')) {
      const t = part.trim();
      if (!t) continue;
      const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        const a = +m[1], b = +m[2];
        if (a > b || a < 1) throw new Error(`Invalid range: ${t}`);
        for (let i = a; i <= b; i++) set.add(i - 1);
      } else if (/^\d+$/.test(t)) {
        if (+t < 1) throw new Error(`Invalid page: ${t}`);
        set.add(+t - 1);
      } else throw new Error(`Invalid page token: ${t}`);
    }
    return [...set].sort((a, b) => a - b);
  }

  // 12 — PDF Split
  (function initPdfSplit() {
    const fileIn = $('#inp-pdf-split-file');
    if (!fileIn) return;
    let blob = null;
    const status = $('#out-pdf-split-status');

    $('#btn-pdf-split-run')?.addEventListener('click', async () => {
      try {
        const file = fileIn.files?.[0];
        assertFile(file, { types: ['application/pdf'], maxMB: 50, label: 'PDF' });
        const range = $('#inp-pdf-split-range')?.value.trim();
        if (!range) throw new Error('Enter a page range (e.g. 1-3).');
        const idxs = parseRanges(range);
        if (!window.PDFLib) throw new Error('pdf-lib not loaded.');
        const src = await PDFLib.PDFDocument.load(await file.arrayBuffer());
        const out = await PDFLib.PDFDocument.create();
        const pages = await out.copyPages(src, idxs);
        pages.forEach((p) => out.addPage(p));
        const bytes = await out.save();
        blob = new Blob([bytes], { type: 'application/pdf' });
        if (status) status.textContent = `Split: ${formatBytes(blob.size)} · ${idxs.length} page(s).`;
        toast('PDF split.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
    $('#btn-pdf-split-reset')?.addEventListener('click', () => {
      fileIn.value = ''; if ($('#inp-pdf-split-range')) $('#inp-pdf-split-range').value = '';
      blob = null; if (status) status.textContent = '';
    });
    $('#btn-pdf-split-download')?.addEventListener('click', () => {
      if (!blob) return toast('Split first.', 'error');
      download(blob, 'split.pdf'); toast('Downloaded.', 'success');
    });
  })();

  // 13 — PDF Compress (rasterize via canvas)
  (function initPdfCompress() {
    const fileIn = $('#inp-pdf-compress-file');
    if (!fileIn) return;
    let blob = null;
    const status = $('#out-pdf-compress-status');
    const rng = $('#rng-pdf-compress');
    const val = $('#val-pdf-compress');
    rng?.addEventListener('input', () => { if (val) val.textContent = rng.value; });

    $('#btn-pdf-compress-run')?.addEventListener('click', async () => {
      try {
        const file = fileIn.files?.[0];
        assertFile(file, { types: ['application/pdf'], maxMB: 50, label: 'PDF' });
        if (!window.PDFLib) throw new Error('pdf-lib not loaded.');
        if (!window.jspdf?.jsPDF) throw new Error('jsPDF not loaded.');
        // Load pages, but we can't rasterize without pdf.js.
        // As a partial compression we rewrite the PDF with pdf-lib (removing unused objects).
        const src = await PDFLib.PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
        const bytes = await src.save({ useObjectStreams: true });
        blob = new Blob([bytes], { type: 'application/pdf' });
        if (status) status.textContent = `Re-saved: ${formatBytes(file.size)} → ${formatBytes(blob.size)}.`;
        toast('PDF re-saved. For deeper compression add pdf.js + rasterization.', 'info');
      } catch (err) { toast(err.message, 'error'); }
    });
    $('#btn-pdf-compress-reset')?.addEventListener('click', () => {
      fileIn.value = ''; blob = null; if (status) status.textContent = '';
    });
    $('#btn-pdf-compress-download')?.addEventListener('click', () => {
      if (!blob) return toast('Compress first.', 'error');
      download(blob, 'compressed.pdf'); toast('Downloaded.', 'success');
    });
  })();

  // 14 — PDF Rotate
  (function initPdfRotate() {
    const fileIn = $('#inp-pdf-rotate-file');
    if (!fileIn) return;
    let blob = null;
    const status = $('#out-pdf-rotate-status');

    $('#btn-pdf-rotate-run')?.addEventListener('click', async () => {
      try {
        const file = fileIn.files?.[0];
        assertFile(file, { types: ['application/pdf'], maxMB: 50, label: 'PDF' });
        const angle = +( $('#sel-pdf-rotate-angle')?.value || 90 );
        const rangeStr = $('#inp-pdf-rotate-range')?.value.trim();
        if (!window.PDFLib) throw new Error('pdf-lib not loaded.');
        const doc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
        const pages = doc.getPages();
        const idxs = rangeStr ? parseRanges(rangeStr) : pages.map((_, i) => i);
        idxs.forEach((i) => {
          if (!pages[i]) return;
          pages[i].setRotation(PDFLib.degrees(((pages[i].getRotation()?.angle || 0) + angle) % 360));
        });
        const bytes = await doc.save();
        blob = new Blob([bytes], { type: 'application/pdf' });
        if (status) status.textContent = `Rotated ${idxs.length} page(s) by ${angle}°.`;
        toast('Rotated.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
    $('#btn-pdf-rotate-reset')?.addEventListener('click', () => {
      fileIn.value = ''; if ($('#inp-pdf-rotate-range')) $('#inp-pdf-rotate-range').value = '';
      blob = null; if (status) status.textContent = '';
    });
    $('#btn-pdf-rotate-download')?.addEventListener('click', () => {
      if (!blob) return toast('Rotate first.', 'error');
      download(blob, 'rotated.pdf'); toast('Downloaded.', 'success');
    });
  })();

  // 15 — PDF Page Delete
  (function initPdfDelete() {
    const fileIn = $('#inp-pdf-delete-file');
    if (!fileIn) return;
    let blob = null;
    const status = $('#out-pdf-delete-status');

    $('#btn-pdf-delete-run')?.addEventListener('click', async () => {
      try {
        const file = fileIn.files?.[0];
        assertFile(file, { types: ['application/pdf'], maxMB: 50, label: 'PDF' });
        const range = $('#inp-pdf-delete-pages')?.value.trim();
        if (!range) throw new Error('Enter pages to delete.');
        const toDelete = new Set(parseRanges(range));
        if (!window.PDFLib) throw new Error('pdf-lib not loaded.');
        const doc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
        const pages = doc.getPages();
        for (let i = pages.length - 1; i >= 0; i--) {
          if (toDelete.has(i)) doc.removePage(i);
        }
        const bytes = await doc.save();
        blob = new Blob([bytes], { type: 'application/pdf' });
        if (status) status.textContent = `Deleted ${toDelete.size} page(s). Remaining: ${doc.getPageCount()}.`;
        toast('Pages deleted.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
    $('#btn-pdf-delete-reset')?.addEventListener('click', () => {
      fileIn.value = ''; if ($('#inp-pdf-delete-pages')) $('#inp-pdf-delete-pages').value = '';
      blob = null; if (status) status.textContent = '';
    });
    $('#btn-pdf-delete-download')?.addEventListener('click', () => {
      if (!blob) return toast('Delete pages first.', 'error');
      download(blob, 'edited.pdf'); toast('Downloaded.', 'success');
    });
  })();

  // 16 — PDF Watermark (draw text on each page via pdf-lib)
  (function initPdfWatermark() {
    const fileIn = $('#inp-pdf-watermark-file');
    if (!fileIn) return;
    let blob = null;
    const status = $('#out-pdf-watermark-status');
    const rng = $('#rng-pdf-watermark');
    const val = $('#val-pdf-watermark');
    rng?.addEventListener('input', () => { if (val) val.textContent = rng.value; });

    $('#btn-pdf-watermark-run')?.addEventListener('click', async () => {
      try {
        const file = fileIn.files?.[0];
        assertFile(file, { types: ['application/pdf'], maxMB: 50, label: 'PDF' });
        const text = $('#inp-pdf-watermark-text')?.value.trim();
        if (!text) throw new Error('Enter watermark text.');
        const opacity = (+(rng?.value || 30)) / 100;
        if (!window.PDFLib) throw new Error('pdf-lib not loaded.');
        const doc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
        const font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        const pages = doc.getPages();
        for (const page of pages) {
          const { width, height } = page.getSize();
          const size = Math.max(24, Math.min(width, height) / 8);
          page.drawText(text, {
            x: width / 4, y: height / 2, size,
            font, color: PDFLib.rgb(0.7, 0.7, 0.7), opacity,
            rotate: PDFLib.degrees(35),
          });
        }
        const bytes = await doc.save();
        blob = new Blob([bytes], { type: 'application/pdf' });
        if (status) status.textContent = `Watermarked ${pages.length} page(s).`;
        toast('Watermark added.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
    $('#btn-pdf-watermark-reset')?.addEventListener('click', () => {
      fileIn.value = ''; if ($('#inp-pdf-watermark-text')) $('#inp-pdf-watermark-text').value = '';
      blob = null; if (status) status.textContent = '';
    });
    $('#btn-pdf-watermark-download')?.addEventListener('click', () => {
      if (!blob) return toast('Apply watermark first.', 'error');
      download(blob, 'watermarked.pdf'); toast('Downloaded.', 'success');
    });
  })();

  // 17 — PDF Password Protect
  // pdf-lib does not support encryption; we surface a clear message.
  (function initPdfProtect() {
    const fileIn = $('#inp-pdf-protect-file');
    if (!fileIn) return;
    const status = $('#out-pdf-protect-status');

    $('#btn-pdf-protect-run')?.addEventListener('click', async () => {
      try {
        const file = fileIn.files?.[0];
        assertFile(file, { types: ['application/pdf'], maxMB: 50, label: 'PDF' });
        const pass = $('#inp-pdf-protect-pass')?.value;
        if (!pass || pass.length < 4) throw new Error('Password must be at least 4 characters.');
        if (status) status.textContent = 'Note: pdf-lib does not support encryption. Please use a dedicated tool like qpdf or Ghostscript to actually encrypt.';
        toast('Encryption is not supported by pdf-lib — see note.', 'error');
      } catch (err) { toast(err.message, 'error'); }
    });
    $('#btn-pdf-protect-reset')?.addEventListener('click', () => {
      fileIn.value = ''; if ($('#inp-pdf-protect-pass')) $('#inp-pdf-protect-pass').value = '';
      if (status) status.textContent = '';
    });
    $('#btn-pdf-protect-download')?.addEventListener('click', () => {
      toast('No protected PDF was generated. See note.', 'error');
    });
  })();

  // 18 — Text to PDF
  (function initText2Pdf() {
    const fileIn = $('#inp-text2pdf-file');
    const ta = $('#inp-text2pdf-text');
    if (!fileIn) return;
    let blob = null;
    const status = $('#out-text2pdf-status');

    fileIn.addEventListener('change', async () => {
      const f = fileIn.files?.[0];
      if (!f) return;
      try {
        const text = await readAsText(f);
        if (ta) ta.value = text;
        toast('Text loaded.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });

    $('#btn-text2pdf-run')?.addEventListener('click', () => {
      try {
        const text = (ta?.value || '').trim();
        if (!text) throw new Error('Enter or load some text.');
        if (!window.jspdf?.jsPDF) throw new Error('jsPDF not loaded.');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
        const margin = 40;
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        const lines = pdf.splitTextToSize(text, pageW - margin * 2);
        let y = margin;
        const lh = 16;
        for (const line of lines) {
          if (y + lh > pageH - margin) { pdf.addPage(); y = margin; }
          pdf.text(line, margin, y);
          y += lh;
        }
        blob = pdf.output('blob');
        if (status) status.textContent = `PDF ready: ${formatBytes(blob.size)}.`;
        toast('PDF created.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
    $('#btn-text2pdf-reset')?.addEventListener('click', () => {
      fileIn.value = ''; if (ta) ta.value = ''; blob = null; if (status) status.textContent = '';
    });
    $('#btn-text2pdf-download')?.addEventListener('click', () => {
      if (!blob) return toast('Create the PDF first.', 'error');
      download(blob, 'text.pdf'); toast('Downloaded.', 'success');
    });
  })();
})();
/* ══════════════════════════════════════════════════════════════
   Part 3: Group C (Image) + Group D (QR/Barcode) tool logic
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';
  const { $, el, assertFile, readAsDataURL, readAsText, loadImage, download, downloadText,
          copyText, setProgress, hideProgress, toast, formatBytes } = window.AIT;

  /** Draw an image element onto a canvas at its natural size.
   * @param {HTMLImageElement} img
   * @returns {HTMLCanvasElement}
   */
  function imgToCanvas(img) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c;
  }

  /** Get an image file from a file input.
   * @param {HTMLInputElement} inp
   * @returns {Promise<{file:File,img:HTMLImageElement,canvas:HTMLCanvasElement}>}
   */
  async function getImage(inp) {
    const file = inp.files?.[0];
    assertFile(file, { types: ['image/*'], maxMB: 20, label: 'Image' });
    const url = await readAsDataURL(file);
    const img = await loadImage(url);
    return { file, img, canvas: imgToCanvas(img) };
  }

  /** Canvas → Blob → download helper.
   * @param {HTMLCanvasElement} c
   * @param {string} name
   * @param {string} [type='image/png']
   * @param {number} [q]
   */
  function downloadCanvas(c, name, type = 'image/png', q) {
    c.toBlob((blob) => {
      if (!blob) return toast('Export failed.', 'error');
      download(blob, name);
      toast('Downloaded.', 'success');
    }, type, q);
  }

  /** Bind a preview canvas from a source image. */
  function drawTo(canvas, img) {
    if (!canvas) return;
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
  }

  // ═══════════════════════════════════════════════════════════
  // GROUP C — IMAGE
  // ═══════════════════════════════════════════════════════════

  // 19 — Image Compressor
  (function () {
    const fileIn = $('#inp-image-compress-file');
    if (!fileIn) return;
    const canvas = $('#canvas-image-compress');
    const rng = $('#rng-image-compress');
    const val = $('#val-image-compress');
    const target = $('#inp-image-compress-target');
    const status = $('#out-image-compress-status');
    let imgEl = null;

    rng?.addEventListener('input', () => { if (val) val.textContent = rng.value; });

    async function compress() {
      try {
        const { img } = await getImage(fileIn);
        imgEl = img;
        drawTo(canvas, img);
        const q = (+(rng?.value || 70)) / 100;
        const targetKB = parseInt(target?.value || '0', 10);
        let quality = q;
        let dataUrl;
        // binary search if target
        if (targetKB > 0) {
          const targetBytes = targetKB * 1024;
          let lo = 0.05, hi = 1.0;
          for (let i = 0; i < 8; i++) {
            const mid = (lo + hi) / 2;
            const d = canvas.toDataURL('image/jpeg', mid);
            const sz = Math.round((d.length - 22) * 3 / 4);
            if (sz > targetBytes) hi = mid; else { lo = mid; quality = mid; dataUrl = d; }
          }
          if (!dataUrl) dataUrl = canvas.toDataURL('image/jpeg', quality);
        } else {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        if (canvas) { canvas._out = dataUrl; }
        const sz = Math.round((dataUrl.length - 22) * 3 / 4);
        if (status) status.textContent = `Quality ${(quality * 100).toFixed(0)}% · ~${formatBytes(sz)}`;
        toast('Compressed.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    }

    $('#btn-image-compress-run')?.addEventListener('click', compress);
    $('#btn-image-compress-reset')?.addEventListener('click', () => {
      fileIn.value = ''; imgEl = null; if (canvas) { canvas._out = null; const c = canvas.getContext('2d'); c.clearRect(0, 0, canvas.width, canvas.height); }
      if (status) status.textContent = '';
    });
    $('#btn-image-compress-download')?.addEventListener('click', () => {
      if (!canvas || !canvas._out) return toast('Compress first.', 'error');
      const a = el('a', { href: canvas._out, download: 'compressed.jpg' });
      document.body.append(a); a.click(); a.remove();
      toast('Downloaded.', 'success');
    });
  })();

  // 20 — Image Resizer
  (function () {
    const fileIn = $('#inp-image-resize-file');
    if (!fileIn) return;
    const canvas = $('#canvas-image-resize');
    const wIn = $('#inp-image-resize-w');
    const hIn = $('#inp-image-resize-h');
    const lock = $('#chk-image-resize-lock');
    let srcImg = null;
    let ratio = 1;

    fileIn.addEventListener('change', async () => {
      try {
        const { img } = await getImage(fileIn);
        srcImg = img;
        ratio = img.width / img.height;
        if (wIn) wIn.value = img.width;
        if (hIn) hIn.value = img.height;
        drawTo(canvas, img);
      } catch (e) { toast(e.message, 'error'); }
    });

    wIn?.addEventListener('input', () => {
      if (lock?.checked && ratio) hIn.value = Math.round(+wIn.value / ratio) || 0;
    });
    hIn?.addEventListener('input', () => {
      if (lock?.checked && ratio) wIn.value = Math.round(+hIn.value * ratio) || 0;
    });

    $('#btn-image-resize-run')?.addEventListener('click', () => {
      if (!srcImg) return toast('Upload an image first.', 'error');
      const w = Math.max(1, parseInt(wIn?.value || '0', 10));
      const h = Math.max(1, parseInt(hIn?.value || '0', 10));
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(srcImg, 0, 0, w, h);
      toast('Resized.', 'success');
    });
    $('#btn-image-resize-reset')?.addEventListener('click', () => {
      fileIn.value = ''; srcImg = null;
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (wIn) wIn.value = ''; if (hIn) hIn.value = '';
    });
    $('#btn-image-resize-download')?.addEventListener('click', () => {
      if (!srcImg) return toast('Resize first.', 'error');
      downloadCanvas(canvas, 'resized.png');
    });
  })();

  // 21 — Image Cropper (drag-to-select on canvas)
  (function () {
    const fileIn = $('#inp-image-crop-file');
    if (!fileIn) return;
    const canvas = $('#canvas-image-crop');
    const outC = $('#canvas-image-crop-out');
    const ratioSel = $('#sel-image-crop-ratio');
    let srcImg = null;
    let sel = null;
    let dragging = false;
    let start = null;

    fileIn.addEventListener('change', async () => {
      try {
        const { img } = await getImage(fileIn);
        srcImg = img;
        canvas.width = img.width; canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        sel = null;
      } catch (e) { toast(e.message, 'error'); }
    });

    function redraw() {
      if (!srcImg) return;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(srcImg, 0, 0);
      if (sel) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, canvas.width, sel.y);
        ctx.fillRect(0, sel.y, sel.x, sel.h);
        ctx.fillRect(sel.x + sel.w, sel.y, canvas.width - sel.x - sel.w, sel.h);
        ctx.fillRect(0, sel.y + sel.h, canvas.width, canvas.height - sel.y - sel.h);
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = Math.max(2, canvas.width / 400);
        ctx.strokeRect(sel.x, sel.y, sel.w, sel.h);
      }
    }

    function relPos(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (!srcImg) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const p = relPos(e);
      start = p;
      dragging = true;
      sel = { x: p.x, y: p.y, w: 0, h: 0 };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const p = relPos(e);
      const ratio = +(ratioSel?.value || '0');
      let w = Math.abs(p.x - start.x);
      let h = Math.abs(p.y - start.y);
      if (ratio > 0) h = w / ratio;
      sel = {
        x: p.x < start.x ? start.x - w : start.x,
        y: p.y < start.y ? start.y - h : start.y,
        w, h,
      };
      redraw();
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      redraw();
    });

    $('#btn-image-crop-run')?.addEventListener('click', () => {
      if (!sel || sel.w < 5 || sel.h < 5) return toast('Drag a crop area first.', 'error');
      const out = outC;
      out.hidden = false;
      out.width = Math.round(sel.w);
      out.height = Math.round(sel.h);
      out.getContext('2d').drawImage(srcImg, Math.round(sel.x), Math.round(sel.y), Math.round(sel.w), Math.round(sel.h), 0, 0, Math.round(sel.w), Math.round(sel.h));
      toast('Cropped.', 'success');
    });
    $('#btn-image-crop-reset')?.addEventListener('click', () => {
      fileIn.value = ''; srcImg = null; sel = null;
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (outC) { outC.hidden = true; outC.getContext('2d').clearRect(0, 0, outC.width, outC.height); }
    });
    $('#btn-image-crop-download')?.addEventListener('click', () => {
      if (!outC || outC.hidden) return toast('Crop first.', 'error');
      downloadCanvas(outC, 'cropped.png');
    });
  })();

  // 22 — Image Rotator
  (function () {
    const fileIn = $('#inp-image-rotate-file');
    if (!fileIn) return;
    const canvas = $('#canvas-image-rotate');
    let srcImg = null;
    let rot = 0, flipH = false, flipV = false;

    fileIn.addEventListener('change', async () => {
      try {
        const { img } = await getImage(fileIn);
        srcImg = img; rot = 0; flipH = flipV = false;
        render();
      } catch (e) { toast(e.message, 'error'); }
    });

    function render() {
      if (!srcImg) return;
      const swap = (rot / 90) % 2 === 1;
      canvas.width = swap ? srcImg.height : srcImg.width;
      canvas.height = swap ? srcImg.width : srcImg.height;
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(srcImg, -srcImg.width / 2, -srcImg.height / 2);
      ctx.restore();
    }
    $('#btn-image-rotate-90')?.addEventListener('click', () => { rot = (rot + 90) % 360; render(); });
    $('#btn-image-rotate-180')?.addEventListener('click', () => { rot = (rot + 180) % 360; render(); });
    $('#btn-image-rotate-270')?.addEventListener('click', () => { rot = (rot + 270) % 360; render(); });
    $('#btn-image-rotate-fliph')?.addEventListener('click', () => { flipH = !flipH; render(); });
    $('#btn-image-rotate-flipv')?.addEventListener('click', () => { flipV = !flipV; render(); });
    $('#btn-image-rotate-apply')?.addEventListener('click', () => { render(); toast('Applied.', 'success'); });
    $('#btn-image-rotate-reset')?.addEventListener('click', () => {
      fileIn.value = ''; srcImg = null; rot = 0; flipH = flipV = false;
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
    $('#btn-image-rotate-download')?.addEventListener('click', () => {
      if (!srcImg) return toast('Upload an image first.', 'error');
      downloadCanvas(canvas, 'rotated.png');
    });
  })();

  // 23 — Format Converter
  (function () {
    const fileIn = $('#inp-image-convert-file');
    if (!fileIn) return;
    const canvas = $('#canvas-image-convert');
    const fmtSel = $('#sel-image-convert-format');
    const rng = $('#rng-image-convert');
    const val = $('#val-image-convert');
    let srcImg = null;
    rng?.addEventListener('input', () => { if (val) val.textContent = rng.value; });

    fileIn.addEventListener('change', async () => {
      try {
        const { img } = await getImage(fileIn);
        srcImg = img; drawTo(canvas, img);
      } catch (e) { toast(e.message, 'error'); }
    });

    $('#btn-image-convert-run')?.addEventListener('click', () => {
      if (!srcImg) return toast('Upload an image first.', 'error');
      const type = fmtSel?.value || 'image/jpeg';
      const q = (+(rng?.value || 85)) / 100;
      // Fill transparent with white for JPG
      if (type === 'image/jpeg') {
        const c = document.createElement('canvas');
        c.width = srcImg.width; c.height = srcImg.height;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(srcImg, 0, 0);
        canvas.width = c.width; canvas.height = c.height;
        canvas.getContext('2d').drawImage(c, 0, 0);
      } else {
        drawTo(canvas, srcImg);
      }
      toast('Converted.', 'success');
    });
    $('#btn-image-convert-reset')?.addEventListener('click', () => {
      fileIn.value = ''; srcImg = null;
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
    $('#btn-image-convert-download')?.addEventListener('click', () => {
      if (!srcImg) return toast('Convert first.', 'error');
      const type = fmtSel?.value || 'image/jpeg';
      const ext = type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png';
      const q = (+(rng?.value || 85)) / 100;
      downloadCanvas(canvas, `converted.${ext}`, type, q);
    });
  })();

  // 24 — Image to Base64
  (function () {
    const fileIn = $('#inp-img2b64-file');
    if (!fileIn) return;
    const out = $('#out-img2b64');
    fileIn.addEventListener('change', async () => {
      try {
        const f = fileIn.files?.[0];
        assertFile(f, { types: ['image/*'], maxMB: 20, label: 'Image' });
        const dataUrl = await readAsDataURL(f);
        if (out) out.value = dataUrl;
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-img2b64-run')?.addEventListener('click', async () => {
      try {
        const f = fileIn.files?.[0];
        assertFile(f, { types: ['image/*'], maxMB: 20, label: 'Image' });
        const dataUrl = await readAsDataURL(f);
        if (out) out.value = dataUrl;
        toast('Converted.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-img2b64-reset')?.addEventListener('click', () => { fileIn.value = ''; if (out) out.value = ''; });
    $('#btn-img2b64-copy')?.addEventListener('click', async () => {
      try { await copyText(out?.value || ''); toast('Copied.', 'success'); }
      catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-img2b64-download')?.addEventListener('click', () => {
      if (!out?.value) return toast('Convert first.', 'error');
      downloadText(out.value, 'image-base64.txt');
      toast('Downloaded.', 'success');
    });
  })();

  // 25 — Base64 to Image
  (function () {
    const inp = $('#inp-b64img-text');
    if (!inp) return;
    const img = $('#img-b64img-preview');
    let dataUrl = '';

    function decode() {
      let v = inp.value.trim();
      if (!v) throw new Error('Paste a base64 data URI or raw base64.');
      if (!v.startsWith('data:')) {
        v = 'data:image/png;base64,' + v.replace(/\s+/g, '');
      }
      dataUrl = v;
      img.src = v; img.hidden = false;
      img.onerror = () => toast('Could not decode image.', 'error');
    }
    $('#btn-b64img-run')?.addEventListener('click', () => {
      try { decode(); toast('Decoded.', 'success'); }
      catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-b64img-reset')?.addEventListener('click', () => {
      inp.value = ''; img.src = ''; img.hidden = true; dataUrl = '';
    });
    $('#btn-b64img-download')?.addEventListener('click', () => {
      if (!dataUrl) return toast('Decode first.', 'error');
      const a = el('a', { href: dataUrl, download: 'decoded.png' });
      document.body.append(a); a.click(); a.remove();
      toast('Downloaded.', 'success');
    });
  })();

  // 26 — Simple BG Remover
  (function () {
    const fileIn = $('#inp-bg-remove-file');
    if (!fileIn) return;
    const canvas = $('#canvas-bg-remove');
    const colorIn = $('#inp-bg-remove-color');
    const rng = $('#rng-bg-remove');
    const val = $('#val-bg-remove');
    let srcCanvas = null;
    rng?.addEventListener('input', () => { if (val) val.textContent = rng.value; });

    fileIn.addEventListener('change', async () => {
      try {
        const { canvas: c } = await getImage(fileIn);
        srcCanvas = c;
        canvas.width = c.width; canvas.height = c.height;
        canvas.getContext('2d').drawImage(c, 0, 0);
      } catch (e) { toast(e.message, 'error'); }
    });

    function hexToRgb(hex) {
      const h = hex.replace('#', '');
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
      };
    }

    $('#btn-bg-remove-run')?.addEventListener('click', () => {
      if (!srcCanvas) return toast('Upload an image first.', 'error');
      const t = parseInt(rng?.value || '40', 10);
      const target = hexToRgb(colorIn?.value || '#ffffff');
      canvas.width = srcCanvas.width; canvas.height = srcCanvas.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(srcCanvas, 0, 0);
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const dr = d[i] - target.r, dg = d[i + 1] - target.g, db = d[i + 2] - target.b;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          if (dist < t) d[i + 3] = 0;
        }
        ctx.putImageData(imgData, 0, 0);
        toast('Background removed.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
    $('#btn-bg-remove-reset')?.addEventListener('click', () => {
      fileIn.value = ''; srcCanvas = null;
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
    $('#btn-bg-remove-download')?.addEventListener('click', () => {
      if (!srcCanvas) return toast('Remove background first.', 'error');
      downloadCanvas(canvas, 'bg-removed.png');
    });
  })();

  // 27 — Image Watermark
  (function () {
    const fileIn = $('#inp-image-watermark-file');
    if (!fileIn) return;
    const canvas = $('#canvas-image-watermark');
    const rng = $('#rng-image-watermark');
    const val = $('#val-image-watermark');
    let srcImg = null;
    rng?.addEventListener('input', () => { if (val) val.textContent = rng.value; });

    fileIn.addEventListener('change', async () => {
      try {
        const { img } = await getImage(fileIn);
        srcImg = img; drawTo(canvas, img);
      } catch (e) { toast(e.message, 'error'); }
    });

    $('#btn-image-watermark-run')?.addEventListener('click', () => {
      if (!srcImg) return toast('Upload an image first.', 'error');
      const text = $('#inp-image-watermark-text')?.value.trim();
      if (!text) return toast('Enter watermark text.', 'error');
      const pos = $('#sel-image-watermark-pos')?.value || 'br';
      const opacity = (+(rng?.value || 60)) / 100;
      const tile = $('#chk-image-watermark-tile')?.checked;
      canvas.width = srcImg.width; canvas.height = srcImg.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(srcImg, 0, 0);
      const size = Math.max(18, Math.round(Math.min(canvas.width, canvas.height) / 14));
      ctx.font = `600 ${size}px Poppins, sans-serif`;
      ctx.fillStyle = `rgba(255,255,255,${opacity})`;
      ctx.strokeStyle = `rgba(0,0,0,${opacity * 0.6})`;
      ctx.lineWidth = Math.max(1, size / 18);
      ctx.textBaseline = 'top';
      if (tile) {
        ctx.save();
        ctx.rotate(-Math.PI / 6);
        const stepX = ctx.measureText(text).width + 80;
        const stepY = size * 3;
        for (let y = -canvas.height; y < canvas.height * 2; y += stepY) {
          for (let x = -canvas.width; x < canvas.width * 2; x += stepX) {
            ctx.fillText(text, x, y);
            ctx.strokeText(text, x, y);
          }
        }
        ctx.restore();
      } else {
        const m = size;
        const tw = ctx.measureText(text).width;
        let x = m, y = m;
        if (pos === 'br') { x = canvas.width - tw - m; y = canvas.height - size - m; }
        else if (pos === 'bl') { x = m; y = canvas.height - size - m; }
        else if (pos === 'tr') { x = canvas.width - tw - m; y = m; }
        else if (pos === 'center') { x = (canvas.width - tw) / 2; y = (canvas.height - size) / 2; }
        ctx.fillText(text, x, y);
        ctx.strokeText(text, x, y);
      }
      toast('Watermark applied.', 'success');
    });
    $('#btn-image-watermark-reset')?.addEventListener('click', () => {
      fileIn.value = ''; srcImg = null;
      if ($('#inp-image-watermark-text')) $('#inp-image-watermark-text').value = '';
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
    $('#btn-image-watermark-download')?.addEventListener('click', () => {
      if (!srcImg) return toast('Apply watermark first.', 'error');
      downloadCanvas(canvas, 'watermarked.png');
    });
  })();

  // 28 — Grayscale
  (function () {
    const fileIn = $('#inp-grayscale-file');
    if (!fileIn) return;
    const canvas = $('#canvas-grayscale');
    let srcImg = null;

    fileIn.addEventListener('change', async () => {
      try {
        const { img } = await getImage(fileIn);
        srcImg = img; drawTo(canvas, img);
      } catch (e) { toast(e.message, 'error'); }
    });

    $('#btn-grayscale-run')?.addEventListener('click', () => {
      if (!srcImg) return toast('Upload an image first.', 'error');
      canvas.width = srcImg.width; canvas.height = srcImg.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(srcImg, 0, 0);
      try {
        const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const l = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
          d[i] = d[i + 1] = d[i + 2] = l;
        }
        ctx.putImageData(id, 0, 0);
        toast('Grayscale applied.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-grayscale-reset')?.addEventListener('click', () => {
      fileIn.value = ''; srcImg = null;
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
    $('#btn-grayscale-download')?.addEventListener('click', () => {
      if (!srcImg) return toast('Convert first.', 'error');
      downloadCanvas(canvas, 'grayscale.png');
    });
  })();

  // 29 — Image Color Picker
  (function () {
    const fileIn = $('#inp-image-color-file');
    if (!fileIn) return;
    const canvas = $('#canvas-image-color');
    const swatch = $('#swatch-image-color');
    const hexOut = $('#out-image-color-hex');
    const rgbOut = $('#out-image-color-rgb');
    let srcImg = null;

    fileIn.addEventListener('change', async () => {
      try {
        const { img } = await getImage(fileIn);
        srcImg = img; drawTo(canvas, img);
      } catch (e) { toast(e.message, 'error'); }
    });

    canvas.addEventListener('click', (e) => {
      if (!srcImg) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width));
      const y = Math.round((e.clientY - rect.top) * (canvas.height / rect.height));
      try {
        const p = canvas.getContext('2d').getImageData(x, y, 1, 1).data;
        const hex = '#' + [p[0], p[1], p[2]].map((n) => n.toString(16).padStart(2, '0')).join('');
        if (swatch) swatch.style.background = hex;
        if (hexOut) hexOut.textContent = `HEX: ${hex}`;
        if (rgbOut) rgbOut.textContent = `RGB: ${p[0]}, ${p[1]}, ${p[2]}`;
      } catch (err) { toast('Cannot sample this pixel.', 'error'); }
    });

    $('#btn-image-color-reset')?.addEventListener('click', () => {
      fileIn.value = ''; srcImg = null;
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (swatch) swatch.style.background = 'transparent';
      if (hexOut) hexOut.textContent = 'HEX: —';
      if (rgbOut) rgbOut.textContent = 'RGB: —';
    });
  })();

  // 30 — Image Metadata (basic: file info + dimensions; EXIF via binary parse)
  (function () {
    const fileIn = $('#inp-image-meta-file');
    if (!fileIn) return;
    const out = $('#out-image-meta');

    /** Parse EXIF orientation tag (basic) from a JPEG buffer. */
    function readExifOrientation(buf) {
      const dv = new DataView(buf);
      if (dv.getUint16(0) !== 0xFFD8) return null;
      let offset = 2;
      while (offset < dv.byteLength) {
        const marker = dv.getUint16(offset);
        if ((marker & 0xFF00) !== 0xFF00) break;
        const size = dv.getUint16(offset + 2);
        if (marker === 0xFFE1) {
          // APP1 → check "Exif\0\0"
          const start = offset + 4;
          if (dv.getUint32(start) === 0x45786966) {
            const tiffStart = start + 6;
            const little = dv.getUint16(tiffStart) === 0x4949;
            const getU16 = (o) => dv.getUint16(o, little);
            const getU32 = (o) => dv.getUint32(o, little);
            const ifd0 = tiffStart + getU32(tiffStart + 4);
            const entries = getU16(ifd0);
            for (let i = 0; i < entries; i++) {
              const entry = ifd0 + 2 + i * 12;
              const tag = getU16(entry);
              if (tag === 0x0112) return getU16(entry + 8);
            }
          }
        }
        offset += 2 + size;
      }
      return null;
    }

    fileIn.addEventListener('change', async () => {
      try {
        const f = fileIn.files?.[0];
        assertFile(f, { types: ['image/*'], maxMB: 20, label: 'Image' });
        const { img } = await getImage(fileIn);
        if (out) out.innerHTML = '';
        const rows = [
          ['File name', f.name],
          ['File size', formatBytes(f.size)],
          ['MIME type', f.type || '—'],
          ['Last modified', new Date(f.lastModified).toLocaleString()],
          ['Dimensions', `${img.width} × ${img.height}px`],
          ['Aspect ratio', (img.width / img.height).toFixed(3)],
        ];
        try {
          const buf = await f.arrayBuffer();
          const orient = readExifOrientation(buf);
          if (orient) rows.push(['EXIF Orientation', String(orient)]);
        } catch { /* ignore */ }
        if (out) {
          for (const [k, v] of rows) {
            out.append(el('div', { class: 'k' }, k));
            out.append(el('div', { class: 'v' }, v));
          }
        }
      } catch (e) { toast(e.message, 'error'); }
    });

    $('#btn-image-meta-reset')?.addEventListener('click', () => {
      fileIn.value = ''; if (out) out.innerHTML = '';
    });
  })();

  // 31 — Passport Photo Grid (A4)
  (function () {
    const fileIn = $('#inp-passport-grid-file');
    if (!fileIn) return;
    const canvas = $('#canvas-passport-grid');
    let srcImg = null;

    fileIn.addEventListener('change', async () => {
      try {
        const { img } = await getImage(fileIn);
        srcImg = img; drawTo(canvas, img);
      } catch (e) { toast(e.message, 'error'); }
    });

    $('#btn-passport-grid-run')?.addEventListener('click', () => {
      if (!srcImg) return toast('Upload a photo first.', 'error');
      const count = +( $('#sel-passport-grid-count')?.value || 4 );
      // A4 at 300dpi = 2480x3508; photo 35x45mm = 413x531
      const photoW = 413, photoH = 531;
      const cols = count === 8 ? 4 : count === 6 ? 3 : 2;
      const rows = Math.ceil(count / cols);
      canvas.width = 2480; canvas.height = 3508;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const gap = 40;
      const totalW = cols * photoW + (cols - 1) * gap;
      const totalH = rows * photoH + (rows - 1) * gap;
      const startX = (canvas.width - totalW) / 2;
      const startY = (canvas.height - totalH) / 2;
      let n = 0;
      for (let r = 0; r < rows && n < count; r++) {
        for (let c = 0; c < cols && n < count; c++) {
          // cover-fit photo
          const s = Math.max(photoW / srcImg.width, photoH / srcImg.height);
          const dw = srcImg.width * s, dh = srcImg.height * s;
          const dx = startX + c * (photoW + gap) + (photoW - dw) / 2;
          const dy = startY + r * (photoH + gap) + (photoH - dh) / 2;
          ctx.save();
          ctx.beginPath();
          ctx.rect(startX + c * (photoW + gap), startY + r * (photoH + gap), photoW, photoH);
          ctx.clip();
          ctx.drawImage(srcImg, dx, dy, dw, dh);
          ctx.restore();
          // border
          ctx.strokeStyle = '#ddd';
          ctx.strokeRect(startX + c * (photoW + gap), startY + r * (photoH + gap), photoW, photoH);
          n++;
        }
      }
      toast(`Grid of ${count} photos ready.`, 'success');
    });
    $('#btn-passport-grid-reset')?.addEventListener('click', () => {
      fileIn.value = ''; srcImg = null;
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
    $('#btn-passport-grid-download')?.addEventListener('click', () => {
      if (!srcImg || canvas.width === 0) return toast('Generate a grid first.', 'error');
      // Build a single-page PDF from the grid canvas
      try {
        if (!window.jspdf?.jsPDF) throw new Error('jsPDF not loaded.');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'px', format: [2480, 3508] });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 2480, 3508);
        download(pdf.output('blob'), 'passport-grid.pdf');
        toast('Downloaded.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
  })();

  // ═══════════════════════════════════════════════════════════
  // GROUP D — QR / BARCODE
  // ═══════════════════════════════════════════════════════════

  // 32 — QR Generator
  (function () {
    const typeSel = $('#sel-qr-gen-type');
    if (!typeSel) return;
    const textWrap = $('#qr-gen-text-wrap');
    const vcardWrap = $('#qr-gen-vcard-wrap');
    const wifiWrap = $('#qr-gen-wifi-wrap');
    const out = $('#out-qr-gen');
    let qrCanvas = null;

    function toggleWraps() {
      const t = typeSel.value;
      if (textWrap) textWrap.hidden = t !== 'text';
      if (vcardWrap) vcardWrap.hidden = t !== 'vcard';
      if (wifiWrap) wifiWrap.hidden = t !== 'wifi';
    }
    typeSel.addEventListener('change', toggleWraps);
    toggleWraps();

    function buildPayload() {
      const t = typeSel.value;
      if (t === 'text') return $('#inp-qr-gen-text')?.value.trim() || '';
      if (t === 'vcard') {
        const name = $('#inp-qr-gen-name')?.value.trim() || '';
        const org = $('#inp-qr-gen-org')?.value.trim() || '';
        const tel = $('#inp-qr-gen-tel')?.value.trim() || '';
        const email = $('#inp-qr-gen-email')?.value.trim() || '';
        return `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nORG:${org}\nTEL:${tel}\nEMAIL:${email}\nEND:VCARD`;
      }
      const ssid = $('#inp-qr-gen-ssid')?.value.trim() || '';
      const pass = $('#inp-qr-gen-pass')?.value || '';
      return `WIFI:T:WPA;S:${ssid};P:${pass};;`;
    }

    $('#btn-qr-gen-run')?.addEventListener('click', () => {
      try {
        const payload = buildPayload();
        if (!payload) throw new Error('Enter content to encode.');
        const size = Math.max(64, parseInt($('#inp-qr-gen-size')?.value || '256', 10));
        const fg = $('#inp-qr-gen-fg')?.value || '#000000';
        const bg = $('#inp-qr-gen-bg')?.value || '#ffffff';
        if (!out) return;
        out.innerHTML = '';
        qrCanvas = document.createElement('canvas');
        qrCanvas.width = size; qrCanvas.height = size;
        out.append(qrCanvas);
        if (!window.QRCode) throw new Error('QRCode.js not loaded.');
        // QRCode.js writes into a container; we use its canvas API
        const qr = new QRCode(out, {
          text: payload,
          width: size, height: size,
          colorDark: fg, colorLight: bg,
          correctLevel: QRCode.CorrectLevel.H,
        });
        qrCanvas = out.querySelector('canvas');
        toast('QR generated.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-qr-gen-reset')?.addEventListener('click', () => {
      if (out) out.innerHTML = '';
      qrCanvas = null;
    });
    $('#btn-qr-gen-download')?.addEventListener('click', () => {
      if (!qrCanvas) return toast('Generate a QR first.', 'error');
      qrCanvas.toBlob((b) => { if (b) { download(b, 'qr.png'); toast('Downloaded.', 'success'); } });
    });
  })();

  // Shared html5-qrcode scanner
  function initScanner(cfg) {
    const startBtn = $(cfg.startId);
    const stopBtn = $(cfg.stopId);
    const out = $(cfg.outId);
    const reader = $(cfg.readerId);
    if (!startBtn) return;
    let scanner = null;

    startBtn.addEventListener('click', async () => {
      try {
        if (!window.Html5Qrcode) throw new Error('html5-qrcode not loaded.');
        scanner = new Html5Qrcode(cfg.readerId, { verbose: false });
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 250 },
          (decodedText) => {
            if (out) out.value = decodedText;
            toast('Scanned successfully.', 'success');
          },
          () => { /* ignore per-frame failures */ }
        );
        toast('Camera started.', 'success');
      } catch (e) {
        toast(e.message || 'Camera failed.', 'error');
      }
    });
    stopBtn?.addEventListener('click', async () => {
      try {
        if (scanner) { await scanner.stop(); scanner.clear(); scanner = null; toast('Stopped.', 'info'); }
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  initScanner({ startId: '#btn-qr-scan-start', stopId: '#btn-qr-scan-stop',
                outId: '#out-qr-scan', readerId: 'reader-qr-scan' });
  initScanner({ startId: '#btn-barcode-scan-start', stopId: '#btn-barcode-scan-stop',
                outId: '#out-barcode-scan', readerId: 'reader-barcode-scan' });

  // 34 — Barcode Generator
  (function () {
    const valueIn = $('#inp-barcode-gen-value');
    if (!valueIn) return;
    const svg = $('#svg-barcode-gen');
    const fmtSel = $('#sel-barcode-gen-format');

    $('#btn-barcode-gen-run')?.addEventListener('click', () => {
      try {
        const value = valueIn.value.trim();
        if (!value) throw new Error('Enter a value to encode.');
        const fmt = fmtSel?.value || 'CODE128';
        if (!window.JsBarcode) throw new Error('JsBarcode not loaded.');
        JsBarcode(svg, value, {
          format: fmt,
          width: 2, height: 80,
          displayValue: true,
          margin: 10,
        });
        toast('Barcode generated.', 'success');
      } catch (e) { toast(e.message || 'Could not encode value.', 'error'); }
    });
    $('#btn-barcode-gen-reset')?.addEventListener('click', () => {
      valueIn.value = '';
      if (svg) svg.innerHTML = '';
    });
    $('#btn-barcode-gen-download')?.addEventListener('click', () => {
      if (!svg || !svg.childElementCount) return toast('Generate a barcode first.', 'error');
      // SVG → PNG via canvas
      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width || 400; c.height = img.height || 120;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        c.toBlob((b) => { if (b) { download(b, 'barcode.png'); toast('Downloaded.', 'success'); } });
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast('Export failed.', 'error'); };
      img.src = url;
    });
  })();
})();
/* ══════════════════════════════════════════════════════════════
   Part 4: Group E (Text) + Group F (Calculators) + Group G (Utilities)
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';
  const { $, el, debounce, downloadText, download, copyText, toast, readAsText, formatBytes } = window.AIT;

  // ═══════════════════════════════════════════════════════════
  // GROUP E — TEXT
  // ═══════════════════════════════════════════════════════════

  // 36 — Word Counter
  (function () {
    const ta = $('#inp-word-count');
    if (!ta) return;
    const w = $('#stat-word-count-words');
    const c = $('#stat-word-count-chars');
    const s = $('#stat-word-count-sentences');
    const p = $('#stat-word-count-paras');

    function update() {
      const v = ta.value;
      const words = v.trim() ? v.trim().split(/\s+/).length : 0;
      const sentences = v.trim() ? (v.match(/[.!?]+(?=\s|$)/g) || []).length || 1 : 0;
      const paras = v.trim() ? v.split(/\n\s*\n/).filter((x) => x.trim()).length : 0;
      if (w) w.textContent = String(words);
      if (c) c.textContent = String(v.length);
      if (s) s.textContent = String(sentences);
      if (p) p.textContent = String(paras);
    }
    ta.addEventListener('input', debounce(update, 120));
    $('#btn-word-count-reset')?.addEventListener('click', () => { ta.value = ''; update(); });
    update();
  })();

  // 37 — Character Counter
  (function () {
    const ta = $('#inp-char-count');
    if (!ta) return;
    const w = $('#stat-char-count-with');
    const wo = $('#stat-char-count-without');
    const b = $('#stat-char-count-bytes');

    function update() {
      const v = ta.value;
      if (w) w.textContent = String(v.length);
      if (wo) wo.textContent = String(v.replace(/\s/g, '').length);
      if (b) b.textContent = String(new Blob([v]).size);
    }
    ta.addEventListener('input', debounce(update, 120));
    $('#btn-char-count-reset')?.addEventListener('click', () => { ta.value = ''; update(); });
    update();
  })();

  // 38 — Case Converter
  (function () {
    const ta = $('#inp-case-text');
    if (!ta) return;
    const convert = (text, mode) => {
      switch (mode) {
        case 'upper': return text.toUpperCase();
        case 'lower': return text.toLowerCase();
        case 'title': return text.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
        case 'sentence': return text.replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ');
        case 'camel': return text.trim().replace(/(?:^\w|[A-Z]|\b\w)/g, (w, i) => i === 0 ? w.toLowerCase() : w.toUpperCase()).replace(/[\s_-]+/g, '');
        case 'snake': return text.trim().toLowerCase().replace(/[\s-]+/g, '_');
        default: return text;
      }
    };
    document.querySelectorAll('[data-case]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.case;
        ta.value = convert(ta.value, mode);
        toast(`Converted to ${mode}.`, 'success');
      });
    });
    $('#btn-case-copy')?.addEventListener('click', async () => {
      try { await copyText(ta.value); toast('Copied.', 'success'); }
      catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-case-reset')?.addEventListener('click', () => { ta.value = ''; });
  })();

  // 39 — Text to Speech
  (function () {
    const ta = $('#inp-tts-text');
    if (!ta || !('speechSynthesis' in window)) return;
    const voiceSel = $('#sel-tts-voice');
    const rate = $('#rng-tts-rate');
    const pitch = $('#rng-tts-pitch');
    const rv = $('#val-tts-rate');
    const pv = $('#val-tts-pitch');
    let voices = [];

    function loadVoices() {
      voices = speechSynthesis.getVoices();
      if (!voiceSel) return;
      voiceSel.innerHTML = '';
      voices.forEach((v, i) => voiceSel.append(el('option', { value: String(i) }, `${v.name} (${v.lang})`)));
    }
    speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();

    rate?.addEventListener('input', () => { if (rv) rv.textContent = (+rate.value).toFixed(1); });
    pitch?.addEventListener('input', () => { if (pv) pv.textContent = (+pitch.value).toFixed(1); });

    $('#btn-tts-speak')?.addEventListener('click', () => {
      try {
        const text = ta.value.trim();
        if (!text) throw new Error('Enter text to speak.');
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const idx = parseInt(voiceSel?.value || '0', 10);
        if (voices[idx]) u.voice = voices[idx];
        u.rate = +(rate?.value || 1);
        u.pitch = +(pitch?.value || 1);
        speechSynthesis.speak(u);
        toast('Speaking…', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-tts-stop')?.addEventListener('click', () => { speechSynthesis.cancel(); toast('Stopped.', 'info'); });
  })();

  // 40 — Speech to Text
  (function () {
    const startBtn = $('#btn-stt-start');
    if (!startBtn) return;
    const out = $('#out-stt');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      startBtn.addEventListener('click', () => toast('Speech recognition is not supported in this browser.', 'error'));
      return;
    }
    let rec = null;
    startBtn.addEventListener('click', () => {
      try {
        rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';
        let finalText = out.value;
        rec.onresult = (e) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) finalText += r[0].transcript + ' ';
            else interim += r[0].transcript;
          }
          out.value = finalText + interim;
        };
        rec.onerror = (e) => toast(`Recognition error: ${e.error}`, 'error');
        rec.start();
        toast('Listening…', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-stt-stop')?.addEventListener('click', () => { try { rec?.stop(); toast('Stopped.', 'info'); } catch { /* ignore */ } });
    $('#btn-stt-clear')?.addEventListener('click', () => { out.value = ''; });
    $('#btn-stt-download')?.addEventListener('click', () => {
      if (!out.value) return toast('Nothing to download.', 'error');
      downloadText(out.value, 'speech.txt'); toast('Downloaded.', 'success');
    });
  })();

  // 41 — Remove Duplicate Lines
  (function () {
    const inp = $('#inp-dedupe-text');
    if (!inp) return;
    const out = $('#out-dedupe');
    $('#btn-dedupe-run')?.addEventListener('click', () => {
      const caseSens = $('#chk-dedupe-case')?.checked;
      const seen = new Set();
      const lines = inp.value.split(/\r?\n/).filter((line) => {
        const k = caseSens ? line : line.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
      out.value = lines.join('\n');
      toast(`Removed ${inp.value.split(/\r?\n/).length - lines.length} duplicate(s).`, 'success');
    });
    $('#btn-dedupe-copy')?.addEventListener('click', async () => {
      try { await copyText(out.value); toast('Copied.', 'success'); } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-dedupe-reset')?.addEventListener('click', () => { inp.value = ''; out.value = ''; });
  })();

  // 42 — Base64 Text
  (function () {
    const inp = $('#inp-b64-text');
    if (!inp) return;
    const out = $('#out-b64-text');
    const enc = (s) => btoa(unescape(encodeURIComponent(s)));
    const dec = (s) => decodeURIComponent(escape(atob(s)));
    $('#btn-b64-text-encode')?.addEventListener('click', () => {
      try { out.value = enc(inp.value); toast('Encoded.', 'success'); }
      catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-b64-text-decode')?.addEventListener('click', () => {
      try { out.value = dec(inp.value.trim()); toast('Decoded.', 'success'); }
      catch { toast('Invalid base64.', 'error'); }
    });
    $('#btn-b64-text-copy')?.addEventListener('click', async () => {
      try { await copyText(out.value); toast('Copied.', 'success'); } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-b64-text-reset')?.addEventListener('click', () => { inp.value = ''; out.value = ''; });
  })();

  // 43 — URL Encode / Decode
  (function () {
    const inp = $('#inp-url-text');
    if (!inp) return;
    const out = $('#out-url');
    $('#btn-url-encode')?.addEventListener('click', () => {
      out.value = encodeURIComponent(inp.value); toast('Encoded.', 'success');
    });
    $('#btn-url-decode')?.addEventListener('click', () => {
      try { out.value = decodeURIComponent(inp.value); toast('Decoded.', 'success'); }
      catch { toast('Invalid URL-encoded text.', 'error'); }
    });
    $('#btn-url-copy')?.addEventListener('click', async () => {
      try { await copyText(out.value); toast('Copied.', 'success'); } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-url-reset')?.addEventListener('click', () => { inp.value = ''; out.value = ''; });
  })();

  // 44 — Lorem Ipsum
  (function () {
    const out = $('#out-lorem');
    if (!out) return;
    const words = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ' +
      'ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris ' +
      'nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum ' +
      'dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia ' +
      'deserunt mollit anim id est laborum').split(' ');

    const randWord = () => words[Math.floor(Math.random() * words.length)];
    const sentence = () => {
      const n = 6 + Math.floor(Math.random() * 10);
      const w = Array.from({ length: n }, randWord).join(' ');
      return w.charAt(0).toUpperCase() + w.slice(1) + '.';
    };
    const paragraph = () => Array.from({ length: 4 + Math.floor(Math.random() * 3) }, sentence).join(' ');

    $('#btn-lorem-run')?.addEventListener('click', () => {
      const unit = $('#sel-lorem-unit')?.value || 'paragraphs';
      const count = Math.max(1, parseInt($('#inp-lorem-count')?.value || '3', 10));
      let text = '';
      if (unit === 'paragraphs') text = Array.from({ length: count }, paragraph).join('\n\n');
      else if (unit === 'sentences') text = Array.from({ length: count }, sentence).join(' ');
      else text = Array.from({ length: count }, randWord).join(' ');
      out.value = text;
      toast('Generated.', 'success');
    });
    $('#btn-lorem-copy')?.addEventListener('click', async () => {
      try { await copyText(out.value); toast('Copied.', 'success'); } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-lorem-reset')?.addEventListener('click', () => { out.value = ''; });
  })();

  // 45 — Text Reverser / Sorter
  (function () {
    const inp = $('#inp-text-sort');
    if (!inp) return;
    const out = $('#out-text-sort');
    $('#btn-text-sort-asc')?.addEventListener('click', () => {
      out.value = inp.value.split(/\r?\n/).sort((a, b) => a.localeCompare(b)).join('\n');
    });
    $('#btn-text-sort-desc')?.addEventListener('click', () => {
      out.value = inp.value.split(/\r?\n/).sort((a, b) => b.localeCompare(a)).join('\n');
    });
    $('#btn-text-sort-reverse')?.addEventListener('click', () => {
      out.value = [...inp.value].reverse().join('');
    });
    $('#btn-text-sort-reset')?.addEventListener('click', () => { inp.value = ''; out.value = ''; });
  })();

  // ═══════════════════════════════════════════════════════════
  // GROUP F — CALCULATORS
  // ═══════════════════════════════════════════════════════════

  /** Render key/value rows into a kv-table container. */
  function renderKV(container, rows) {
    if (!container) return;
    container.innerHTML = '';
    rows.forEach(([k, v]) => {
      container.append(el('div', { class: 'k' }, k));
      container.append(el('div', { class: 'v' }, v));
    });
  }

  // 46 — Age
  (function () {
    const dob = $('#inp-age-dob');
    if (!dob) return;
    const out = $('#out-age');
    $('#btn-age-run')?.addEventListener('click', () => {
      try {
        if (!dob.value) throw new Error('Pick a date of birth.');
        const d = new Date(dob.value);
        const now = new Date();
        if (d > now) throw new Error('DOB cannot be in the future.');
        let years = now.getFullYear() - d.getFullYear();
        let months = now.getMonth() - d.getMonth();
        let days = now.getDate() - d.getDate();
        if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
        if (months < 0) { years--; months += 12; }
        const next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
        if (next < now) next.setFullYear(next.getFullYear() + 1);
        const untilNext = Math.ceil((next - now) / 86400000);
        const totalDays = Math.floor((now - d) / 86400000);
        renderKV(out, [
          ['Age', `${years} years, ${months} months, ${days} days`],
          ['Total days', String(totalDays)],
          ['Days to next birthday', String(untilNext)],
        ]);
        toast('Calculated.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-age-reset')?.addEventListener('click', () => { dob.value = ''; if (out) out.innerHTML = ''; });
  })();

  // 47 — BMI
  (function () {
    const unit = $('#sel-bmi-unit');
    if (!unit) return;
    const out = $('#out-bmi');
    $('#btn-bmi-run')?.addEventListener('click', () => {
      try {
        const w = parseFloat($('#inp-bmi-weight')?.value || '0');
        const h = parseFloat($('#inp-bmi-height')?.value || '0');
        if (w <= 0 || h <= 0) throw new Error('Enter weight and height.');
        let bmi;
        if (unit.value === 'metric') bmi = w / Math.pow(h / 100, 2);
        else bmi = (703 * w) / Math.pow(h, 2);
        let cat;
        if (bmi < 18.5) cat = 'Underweight';
        else if (bmi < 25) cat = 'Normal';
        else if (bmi < 30) cat = 'Overweight';
        else cat = 'Obese';
        renderKV(out, [['BMI', bmi.toFixed(2)], ['Category', cat]]);
        toast('Calculated.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-bmi-reset')?.addEventListener('click', () => {
      ['#inp-bmi-weight', '#inp-bmi-height'].forEach((s) => { const i = $(s); if (i) i.value = ''; });
      if (out) out.innerHTML = '';
    });
  })();

  // 48 — EMI
  (function () {
    const out = $('#out-emi');
    if (!out) return;
    $('#btn-emi-run')?.addEventListener('click', () => {
      try {
        const P = parseFloat($('#inp-emi-p')?.value || '0');
        const R = parseFloat($('#inp-emi-r')?.value || '0') / 1200;
        const N = parseInt($('#inp-emi-n')?.value || '0', 10);
        if (P <= 0 || N <= 0) throw new Error('Enter valid principal and tenure.');
        const emi = R === 0 ? P / N : (P * R * Math.pow(1 + R, N)) / (Math.pow(1 + R, N) - 1);
        const total = emi * N;
        const interest = total - P;
        renderKV(out, [
          ['Monthly EMI', emi.toFixed(2)],
          ['Total payment', total.toFixed(2)],
          ['Total interest', interest.toFixed(2)],
          ['Tenure (months)', String(N)],
        ]);
        toast('Calculated.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-emi-reset')?.addEventListener('click', () => {
      ['#inp-emi-p', '#inp-emi-r', '#inp-emi-n'].forEach((s) => { const i = $(s); if (i) i.value = ''; });
      if (out) out.innerHTML = '';
    });
  })();

  // 49 — Percentage
  (function () {
    const mode = $('#sel-percent-mode');
    if (!mode) return;
    const out = $('#out-percent');
    $('#btn-percent-run')?.addEventListener('click', () => {
      try {
        const x = parseFloat($('#inp-percent-x')?.value || '0');
        const y = parseFloat($('#inp-percent-y')?.value || '0');
        let rows;
        if (mode.value === 'of') rows = [['Result', `${x}% of ${y} = ${(x / 100 * y).toFixed(4)}`]];
        else if (mode.value === 'is') {
          if (y === 0) throw new Error('Y cannot be zero.');
          rows = [['Result', `${x} is ${(x / y * 100).toFixed(4)}% of ${y}`]];
        } else {
          if (x === 0) throw new Error('X cannot be zero.');
          const change = ((y - x) / Math.abs(x)) * 100;
          rows = [['Change', `${change.toFixed(4)}% ${change >= 0 ? 'increase' : 'decrease'}`]];
        }
        renderKV(out, rows);
        toast('Calculated.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-percent-reset')?.addEventListener('click', () => {
      ['#inp-percent-x', '#inp-percent-y'].forEach((s) => { const i = $(s); if (i) i.value = ''; });
      if (out) out.innerHTML = '';
    });
  })();

  // 50 — Currency
  (function () {
    const out = $('#out-currency');
    if (!out) return;
    $('#btn-currency-run')?.addEventListener('click', () => {
      try {
        const amt = parseFloat($('#inp-currency-amount')?.value || '0');
        const rate = parseFloat($('#inp-currency-rate')?.value || '0');
        if (!(rate > 0)) throw new Error('Enter a positive rate.');
        const from = $('#sel-currency-from')?.value || 'USD';
        const to = $('#sel-currency-to')?.value || 'EUR';
        const res = amt * rate;
        renderKV(out, [
          ['From', `${amt} ${from}`],
          ['To', `${res.toFixed(2)} ${to}`],
          ['Rate used', `1 ${from} = ${rate} ${to}`],
        ]);
        toast('Converted.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-currency-reset')?.addEventListener('click', () => {
      const a = $('#inp-currency-amount'); if (a) a.value = '';
      const r = $('#inp-currency-rate'); if (r) r.value = '';
      if (out) out.innerHTML = '';
    });
  })();

  // 51 — Unit Converter
  (function () {
    const cat = $('#sel-unit-cat');
    if (!cat) return;
    const fromSel = $('#sel-unit-from');
    const toSel = $('#sel-unit-to');
    const valInp = $('#inp-unit-value');
    const out = $('#out-unit');

    const UNITS = {
      length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 },
      weight: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.45359237, oz: 0.028349523125, t: 1000 },
      temp: { C: 1, F: 1, K: 1 }, // handled specially
      area: { m2: 1, km2: 1e6, cm2: 1e-4, ha: 10000, acre: 4046.8564224, ft2: 0.09290304 },
      volume: { L: 1, mL: 0.001, m3: 1000, gal: 3.785411784, qt: 0.946352946, cup: 0.2365882365 },
    };

    function populate() {
      const units = Object.keys(UNITS[cat.value]);
      [fromSel, toSel].forEach((sel) => {
        if (!sel) return;
        sel.innerHTML = '';
        units.forEach((u) => sel.append(el('option', { value: u }, u)));
      });
      if (toSel && units.length > 1) toSel.selectedIndex = 1;
    }
    cat.addEventListener('change', populate);
    populate();

    function toC(v, u) { return u === 'C' ? v : u === 'F' ? (v - 32) * 5 / 9 : v - 273.15; }
    function fromC(v, u) { return u === 'C' ? v : u === 'F' ? v * 9 / 5 + 32 : v + 273.15; }

    $('#btn-unit-run')?.addEventListener('click', () => {
      try {
        const v = parseFloat(valInp?.value || '');
        if (!Number.isFinite(v)) throw new Error('Enter a numeric value.');
        const from = fromSel?.value || 'm';
        const to = toSel?.value || 'km';
        let result;
        if (cat.value === 'temp') result = fromC(toC(v, from), to);
        else result = v * UNITS[cat.value][from] / UNITS[cat.value][to];
        renderKV(out, [
          ['From', `${v} ${from}`],
          ['To', `${result.toFixed(6)} ${to}`],
        ]);
        toast('Converted.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-unit-reset')?.addEventListener('click', () => {
      if (valInp) valInp.value = ''; if (out) out.innerHTML = '';
    });
  })();

  // 52 — Password Generator
  (function () {
    const out = $('#out-password');
    if (!out) return;
    const rng = $('#rng-password-len');
    const lv = $('#val-password-len');
    const strength = $('#out-password-strength');
    rng?.addEventListener('input', () => { if (lv) lv.textContent = rng.value; });

    const SETS = {
      upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lower: 'abcdefghijklmnopqrstuvwxyz',
      num: '0123456789',
      sym: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    };

    $('#btn-password-run')?.addEventListener('click', () => {
      try {
        const len = parseInt(rng?.value || '16', 10);
        let pool = '';
        if ($('#chk-password-upper')?.checked) pool += SETS.upper;
        if ($('#chk-password-lower')?.checked) pool += SETS.lower;
        if ($('#chk-password-num')?.checked) pool += SETS.num;
        if ($('#chk-password-sym')?.checked) pool += SETS.sym;
        if (!pool) throw new Error('Select at least one character set.');
        const arr = new Uint32Array(len);
        crypto.getRandomValues(arr);
        let pwd = '';
        for (let i = 0; i < len; i++) pwd += pool[arr[i] % pool.length];
        out.value = pwd;
        const entropy = len * Math.log2(pool.length);
        const label = entropy > 80 ? 'Very strong' : entropy > 60 ? 'Strong' : entropy > 40 ? 'Moderate' : 'Weak';
        if (strength) strength.textContent = `Strength: ${label} (~${entropy.toFixed(0)} bits)`;
        toast('Generated.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-password-copy')?.addEventListener('click', async () => {
      try { await copyText(out.value); toast('Copied.', 'success'); } catch (e) { toast(e.message, 'error'); }
    });
  })();

  // 53 — Random Numbers
  (function () {
    const out = $('#out-random');
    if (!out) return;
    $('#btn-random-run')?.addEventListener('click', () => {
      try {
        const min = parseInt($('#inp-random-min')?.value || '0', 10);
        const max = parseInt($('#inp-random-max')?.value || '100', 10);
        const count = Math.max(1, parseInt($('#inp-random-count')?.value || '5', 10));
        const noRep = $('#chk-random-norepeat')?.checked;
        if (min > max) throw new Error('Min must be ≤ max.');
        if (noRep && (max - min + 1) < count) throw new Error('Range too small for unique values.');
        const nums = [];
        if (noRep) {
          const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
          for (let i = 0; i < count; i++) {
            const j = Math.floor(Math.random() * pool.length);
            nums.push(pool.splice(j, 1)[0]);
          }
        } else {
          for (let i = 0; i < count; i++) nums.push(min + Math.floor(Math.random() * (max - min + 1)));
        }
        out.value = nums.join(', ');
        toast('Generated.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-random-reset')?.addEventListener('click', () => { out.value = ''; });
  })();

  // ═══════════════════════════════════════════════════════════
  // GROUP G — UTILITIES
  // ═══════════════════════════════════════════════════════════

  // 54 — Stopwatch
  (function () {
    const display = $('#out-stopwatch');
    if (!display) return;
    const laps = $('#out-stopwatch-laps');
    let start = 0, elapsed = 0, raf = null, running = false;

    function fmt(ms) {
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      const msec = ms % 1000;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(msec).padStart(3, '0')}`;
    }
    function tick() {
      display.textContent = fmt(elapsed + (running ? performance.now() - start : 0));
      if (running) raf = requestAnimationFrame(tick);
    }
    $('#btn-stopwatch-start')?.addEventListener('click', () => {
      if (running) return;
      running = true; start = performance.now();
      raf = requestAnimationFrame(tick);
    });
    $('#btn-stopwatch-pause')?.addEventListener('click', () => {
      if (!running) return;
      elapsed += performance.now() - start;
      running = false;
      cancelAnimationFrame(raf);
      display.textContent = fmt(elapsed);
    });
    $('#btn-stopwatch-lap')?.addEventListener('click', () => {
      const t = fmt(elapsed + (running ? performance.now() - start : 0));
      laps?.append(el('li', {}, t));
    });
    $('#btn-stopwatch-reset')?.addEventListener('click', () => {
      running = false; elapsed = 0; cancelAnimationFrame(raf);
      display.textContent = '00:00.000';
      if (laps) laps.innerHTML = '';
    });
  })();

  // 55 — Countdown Timer
  (function () {
    const display = $('#out-timer');
    if (!display) return;
    let totalMs = 60000, remaining = totalMs, deadline = 0, timer = null, running = false;

    function fmt(ms) {
      const t = Math.max(0, Math.floor(ms / 1000));
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      const s = t % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    function beep() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.15, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        o.start(); o.stop(ctx.currentTime + 0.5);
      } catch { /* ignore */ }
    }
    function tick() {
      const now = Date.now();
      remaining = Math.max(0, deadline - now);
      display.textContent = fmt(remaining);
      if (remaining <= 0) {
        clearInterval(timer); timer = null; running = false; beep();
        toast('Time up!', 'success');
      }
    }
    $('#btn-timer-start')?.addEventListener('click', () => {
      if (running) return;
      const h = parseInt($('#inp-timer-h')?.value || '0', 10);
      const m = parseInt($('#inp-timer-m')?.value || '0', 10);
      const s = parseInt($('#inp-timer-s')?.value || '0', 10);
      totalMs = ((h * 3600) + (m * 60) + s) * 1000;
      if (totalMs <= 0) return toast('Set a time > 0.', 'error');
      remaining = totalMs;
      deadline = Date.now() + remaining;
      running = true;
      display.textContent = fmt(remaining);
      timer = setInterval(tick, 200);
    });
    $('#btn-timer-pause')?.addEventListener('click', () => {
      if (!running) return;
      clearInterval(timer); timer = null; running = false;
      toast('Paused.', 'info');
    });
    $('#btn-timer-reset')?.addEventListener('click', () => {
      clearInterval(timer); timer = null; running = false;
      remaining = 0; display.textContent = '00:00:00';
    });
  })();

  // 56 — Notepad (localStorage autosave)
  (function () {
    const ta = $('#inp-notepad');
    if (!ta) return;
    const KEY = 'ait-notepad';
    try { ta.value = localStorage.getItem(KEY) || ''; } catch { /* ignore */ }
    const save = debounce(() => {
      try { localStorage.setItem(KEY, ta.value); } catch { /* ignore */ }
    }, 400);
    ta.addEventListener('input', save);
    $('#btn-notepad-clear')?.addEventListener('click', () => {
      ta.value = '';
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      toast('Cleared.', 'info');
    });
    $('#btn-notepad-download')?.addEventListener('click', () => {
      if (!ta.value) return toast('Nothing to export.', 'error');
      downloadText(ta.value, 'notes.txt'); toast('Downloaded.', 'success');
    });
  })();

  // 57 — To-Do List
  (function () {
    const list = $('#out-todo');
    if (!list) return;
    const input = $('#inp-todo');
    const KEY = 'ait-todos';
    let todos = [];
    try { todos = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { todos = []; }

    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(todos)); } catch { /* ignore */ }
    }
    function render() {
      list.innerHTML = '';
      todos.forEach((t, i) => {
        const li = el('li', { class: t.done ? 'done' : '' });
        const cb = el('input', { type: 'checkbox' });
        cb.checked = !!t.done;
        cb.addEventListener('change', () => { todos[i].done = cb.checked; save(); render(); });
        const span = el('span', { class: 'todo-text' }, t.text);
        const del = el('button', { class: 'todo-del', 'aria-label': 'Delete task' }, [el('i', { class: 'fa-solid fa-trash', 'aria-hidden': 'true' })]);
        del.addEventListener('click', () => { todos.splice(i, 1); save(); render(); });
        li.append(cb, span, del);
        list.append(li);
      });
    }
    function add() {
      const text = (input?.value || '').trim();
      if (!text) return toast('Enter a task.', 'error');
      todos.push({ text, done: false });
      input.value = '';
      save(); render();
    }
    $('#btn-todo-add')?.addEventListener('click', add);
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    render();
  })();

  // 58 — Color Palette
  (function () {
    const inp = $('#inp-palette-color');
    if (!inp) return;
    const out = $('#out-palette');

    function hexToRgb(hex) {
      const h = hex.replace('#', '');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    function rgbToHex([r, g, b]) {
      return '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
    }
    function lighten([r, g, b], amt) {
      return rgbToHex([r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt]);
    }
    function darken([r, g, b], amt) {
      return rgbToHex([r * (1 - amt), g * (1 - amt), b * (1 - amt)]);
    }

    function build() {
      if (!out) return;
      const base = hexToRgb(inp.value);
      const swatches = [
        ['Base', inp.value],
        ['Light 1', lighten(base, 0.25)],
        ['Light 2', lighten(base, 0.5)],
        ['Light 3', lighten(base, 0.75)],
        ['Dark 1', darken(base, 0.2)],
        ['Dark 2', darken(base, 0.4)],
        ['Dark 3', darken(base, 0.6)],
        ['Complement', rgbToHex([255 - base[0], 255 - base[1], 255 - base[2]])],
      ];
      out.innerHTML = '';
      swatches.forEach(([label, hex]) => {
        const s = el('div', { class: 'palette-swatch', style: `background:${hex}`, title: `Click to copy ${hex}` }, [
          el('span', {}, label),
          el('span', {}, hex),
        ]);
        s.addEventListener('click', async () => {
          try { await copyText(hex); toast(`Copied ${hex}`, 'success'); }
          catch { toast('Copy failed.', 'error'); }
        });
        out.append(s);
      });
    }
    $('#btn-palette-run')?.addEventListener('click', build);
    build();
  })();

  // 59 — Camera Capture
  (function () {
    const video = $('#video-camera');
    if (!video) return;
    const canvas = $('#canvas-camera');
    let stream = null;

    $('#btn-camera-start')?.addEventListener('click', async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API not supported.');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = stream;
        await video.play().catch(() => {});
        toast('Camera started.', 'success');
      } catch (e) { toast(e.message || 'Camera access denied.', 'error'); }
    });
    $('#btn-camera-capture')?.addEventListener('click', () => {
      if (!video.videoWidth) return toast('Camera is not ready.', 'error');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.hidden = false;
      toast('Captured.', 'success');
    });
    $('#btn-camera-stop')?.addEventListener('click', () => {
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; video.srcObject = null; toast('Stopped.', 'info'); }
    });
    $('#btn-camera-download')?.addEventListener('click', () => {
      if (canvas.hidden || !canvas.width) return toast('Capture first.', 'error');
      canvas.toBlob((b) => { if (b) { download(b, 'camera.png'); toast('Downloaded.', 'success'); } }, 'image/png');
    });
  })();

  // 60 — File Hash (CryptoJS)
  (function () {
    const fileIn = $('#inp-hash-file');
    if (!fileIn) return;
    const out = $('#out-hash');
    function render(rows) {
      if (!out) return;
      out.innerHTML = '';
      rows.forEach(([k, v]) => { out.append(el('div', { class: 'k' }, k)); out.append(el('div', { class: 'v' }, v)); });
    }
    $('#btn-hash-run')?.addEventListener('click', async () => {
      try {
        const f = fileIn.files?.[0];
        if (!f) throw new Error('Pick a file.');
        if (!window.CryptoJS) throw new Error('CryptoJS not loaded.');
        const words = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => {
            try {
              const wa = CryptoJS.lib.WordArray.create(r.result);
              resolve(wa);
            } catch (e) { reject(e); }
          };
          r.onerror = () => reject(r.error || new Error('Read failed'));
          r.readAsArrayBuffer(f);
        });
        const md5 = CryptoJS.MD5(words).toString();
        const sha1 = CryptoJS.SHA1(words).toString();
        const sha256 = CryptoJS.SHA256(words).toString();
        render([
          ['File', f.name],
          ['Size', formatBytes(f.size)],
          ['MD5', md5],
          ['SHA-1', sha1],
          ['SHA-256', sha256],
        ]);
        toast('Hashes computed.', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#btn-hash-reset')?.addEventListener('click', () => {
      fileIn.value = ''; if (out) out.innerHTML = '';
    });
  })();
})();
