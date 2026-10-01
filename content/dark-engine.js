/**
 * Everything Dark - Core Content Engine (Advanced Dynamic Recoloring)
 * Injected into all webpages to intelligently transform light mode to dark mode.
 */

(function () {
  'use strict';

  // Prevent double injection
  if (window.__everythingDarkInitialized) {
    return;
  }
  window.__everythingDarkInitialized = true;

  const STYLE_ID = 'everything-dark-theme-styles';
  const EARLY_CLOAK_ID = 'everything-dark-early-cloak';

  let currentConfig = null;
  let activeThemeData = null;
  let isCurrentlyActive = false;
  let domObserver = null;
  let scanRafId = null;

  const currentHost = (function() {
    try {
      if (window.location && window.location.hostname) {
        return window.location.hostname.toLowerCase();
      }
    } catch (e) {}
    try {
      if (window.top && window.top.location && window.top.location.hostname) {
        return window.top.location.hostname.toLowerCase();
      }
    } catch (e) {}
    return '';
  })();

  /**
   * Safe getter for master dark theme data
   */
  function getThemeData() {
    if (typeof ED_DARK_THEME !== 'undefined' && ED_DARK_THEME) return ED_DARK_THEME;
    if (typeof window !== 'undefined' && window.ED_DARK_THEME) return window.ED_DARK_THEME;
    if (typeof globalThis !== 'undefined' && globalThis.ED_DARK_THEME) return globalThis.ED_DARK_THEME;
    const themesList = (typeof ED_THEMES !== 'undefined' ? ED_THEMES : (window.ED_THEMES || globalThis.ED_THEMES || []));
    return themesList[0] || {
      id: 'dark',
      name: 'Everything Dark',
      bg: '#121316',
      bgElevated: '#1a1c20',
      bgSurface: '#22252b',
      text: '#f3f4f6',
      textMuted: '#9ca3af',
      border: '#2e323b',
      accent: '#3b82f6',
      link: '#60a5fa',
      scrollbar: '#3f4450',
      codeBg: '#181a1f',
      inputBg: '#16181d'
    };
  }

  /**
   * Determine whether dark mode should be enabled right now on this page
   */
  function shouldEnableDarkMode(config) {
    if (!config || !config.enabled) {
      return false;
    }

    const filterMode = config.urlFilterMode || 'all'; // 'all' (blacklist mode) | 'whitelist' (whitelist mode)
    let explicitRule = undefined;

    // Check site-specific rule
    if (config.siteRules && typeof config.siteRules === 'object') {
      if (config.siteRules[currentHost] !== undefined) {
        explicitRule = config.siteRules[currentHost];
      } else {
        // Check wildcard or parent domain (e.g. management.kalolwala.com -> kalolwala.com or *.kalolwala.com)
        const parts = currentHost.split('.');
        for (let i = 1; i < parts.length; i++) {
          const parentDomain = parts.slice(i).join('.');
          if (config.siteRules[parentDomain] !== undefined) {
            explicitRule = config.siteRules[parentDomain];
            break;
          }
          const wildcard = '*.' + parentDomain;
          if (config.siteRules[wildcard] !== undefined) {
            explicitRule = config.siteRules[wildcard];
            break;
          }
        }
      }
    }

    // Evaluate based on filter mode
    if (filterMode === 'whitelist') {
      // WHITELIST MODE: Only convert websites that are explicitly enabled in siteRules!
      // If not on the whitelist, DO NOT convert!
      if (!explicitRule || !explicitRule.enabled) {
        return false;
      }
    } else {
      // ALL WEBSITES (Blacklist) MODE: Convert all websites, UNLESS explicitly excluded
      if (explicitRule && !explicitRule.enabled) {
        return false;
      }
    }

    // Check auto schedule
    if (config.autoSchedule === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (config.autoSchedule === 'time') {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [startH, startM] = (config.scheduleStart || '20:00').split(':').map(Number);
      const [endH, endM] = (config.scheduleEnd || '07:00').split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
    }

    return true;
  }

  /**
   * Helper: Parse rgb, rgba, or hex color string to {r, g, b, a}
   */
  function parseRgba(str) {
    if (!str || str === 'transparent' || str === 'inherit' || str === 'initial') return null;
    const m = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
    if (m) {
      return {
        r: parseInt(m[1], 10),
        g: parseInt(m[2], 10),
        b: parseInt(m[3], 10),
        a: m[4] !== undefined ? parseFloat(m[4]) : 1.0
      };
    }
    // Check hex
    if (str.startsWith('#')) {
      let hex = str.slice(1);
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: 1.0
        };
      }
    }
    return null;
  }

  /**
   * Helper: Calculate relative luminance of RGB (0 to 1)
   */
  function getLuminance(r, g, b) {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  /**
   * Helper: Calculate color saturation (0 to 1)
   */
  function getSaturation(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === 0) return 0;
    return (max - min) / max;
  }

  /**
   * Helper: Convert RGB (0-255) to HSL (h: 0-1, s: 0-1, l: 0-1)
   */
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h, s, l };
  }

  /**
   * Helper: Convert HSL back to RGB (0-255)
   */
  function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  /**
   * Boost color lightness for optimal contrast against dark backgrounds while preserving original hue
   */
  function boostColorForDarkBg(r, g, b, minLum = 0.55) {
    const hsl = rgbToHsl(r, g, b);
    if (hsl.l < minLum) {
      hsl.l = minLum;
      return hslToRgb(hsl.h, hsl.s, hsl.l);
    }
    return { r, g, b };
  }

  /**
   * Determine the effective background color of an element by traversing up the DOM
   */
  function getEffectiveBackgroundColor(el) {
    let curr = el;
    while (curr && curr !== document.documentElement && curr !== document.body) {
      try {
        const bg = parseRgba(window.getComputedStyle(curr).backgroundColor);
        if (bg && bg.a > 0.4) {
          return bg;
        }
      } catch (e) {
        break;
      }
      curr = curr.parentElement;
    }
    return activeThemeData ? parseRgba(activeThemeData.bg) : { r: 24, g: 25, b: 28, a: 1 };
  }

  /**
   * Generate CSS rules for Smart Dynamic Recolor Engine
   */
  function generateSmartCss(theme, config) {
    const brightnessVal = (config.brightness || 100) / 100;
    const contrastVal = (config.contrast || 100) / 100;
    const sepiaVal = (config.sepia || 0) / 100;
    const grayscaleVal = (config.grayscale || 0) / 100;
    const imgDim = (config.dimImages || 0) / 100;

    const hasFilter = brightnessVal !== 1 || contrastVal !== 1 || sepiaVal !== 0 || grayscaleVal !== 0;
    const filterCss = hasFilter
      ? `html { filter: brightness(${brightnessVal}) contrast(${contrastVal}) sepia(${sepiaVal}) grayscale(${grayscaleVal}) !important; }`
      : '';

    return `
      ${filterCss}

      :root {
        --ed-bg: ${theme.bg} !important;
        --ed-bg-elevated: ${theme.bgElevated} !important;
        --ed-bg-surface: ${theme.bgSurface} !important;
        --ed-bg-surface-hover: #292d36 !important;
        --ed-text: ${theme.text} !important;
        --ed-text-muted: ${theme.textMuted} !important;
        --ed-border: ${theme.border} !important;
        --ed-border-hover: #4b5563 !important;
        --ed-accent: ${theme.accent} !important;
        --ed-link: ${theme.link} !important;
        --ed-link-hover: #93c5fd !important;
        --ed-scrollbar: ${theme.scrollbar} !important;
        --ed-code-bg: ${theme.codeBg || '#1e2025'} !important;
        --ed-input-bg: ${theme.inputBg || '#18191c'} !important;
        --ed-input-hover-bg: #1c1e24 !important;
        --ed-input-focus-bg: #16181d !important;

        /* Framework CSS variables overrides (Tailwind, shadcn, Next, Bootstrap, MUI) */
        --background: ${theme.bg} !important;
        --bg: ${theme.bg} !important;
        --bg-color: ${theme.bg} !important;
        --bg-body: ${theme.bg} !important;
        --surface: ${theme.bgElevated} !important;
        --surface-ground: ${theme.bg} !important;
        --surface-section: ${theme.bg} !important;
        --surface-card: ${theme.bgElevated} !important;
        --card: ${theme.bgElevated} !important;
        --card-background: ${theme.bgElevated} !important;
        --popover: ${theme.bgElevated} !important;
        --muted: ${theme.bgSurface} !important;
        --border: ${theme.border} !important;
        --border-color: ${theme.border} !important;
        --input: ${theme.inputBg || '#18191c'} !important;
        --text: ${theme.text} !important;
        --text-color: ${theme.text} !important;
        --foreground: ${theme.text} !important;
        --table-bg: ${theme.bg} !important;
        --table-hover-bg: ${theme.bgElevated} !important;
        --table-striped-bg: ${theme.bgSurface} !important;
        --tw-bg-opacity: 1 !important;

        /* Google Workspace & Material Design 3 tokens */
        --gm3-sys-color-surface: ${theme.bg} !important;
        --gm3-sys-color-surface-dim: ${theme.bg} !important;
        --gm3-sys-color-surface-bright: ${theme.bgElevated} !important;
        --gm3-sys-color-surface-container-lowest: ${theme.bg} !important;
        --gm3-sys-color-surface-container-low: ${theme.bgElevated} !important;
        --gm3-sys-color-surface-container: ${theme.bgElevated} !important;
        --gm3-sys-color-surface-container-high: ${theme.bgSurface} !important;
        --gm3-sys-color-surface-container-highest: #292d36 !important;
        --gm3-sys-color-on-surface: ${theme.text} !important;
        --gm3-sys-color-on-surface-variant: ${theme.textMuted} !important;
        --gm3-sys-color-outline: ${theme.border} !important;
        --gm3-sys-color-outline-variant: #252830 !important;
        --gm3-sys-color-primary: ${theme.accent} !important;
        --gm3-sys-color-on-primary: #ffffff !important;
        --gm3-sys-color-primary-container: #1e3a8a !important;
        --gm3-sys-color-on-primary-container: #dbeafe !important;
        --gm3-sys-color-secondary-container: #22252b !important;
        --gm3-sys-color-on-secondary-container: #ffffff !important;
        --mdc-filled-button-container-color: #2563eb !important;
        --mdc-filled-button-label-text-color: #ffffff !important;
        --mdc-theme-primary: ${theme.accent} !important;
        --mdc-theme-surface: ${theme.bgElevated} !important;
        --mdc-theme-on-surface: ${theme.text} !important;
        --mdc-theme-on-primary: #ffffff !important;
      }

      /* Root page backgrounds */
      html, body, #root, #app, #__next, #__nuxt,
      [id*="root"], [id*="app"], [id*="layout"], [id*="main"],
      .layout, .container, .wrapper, .content, .page, .view, .main, .dashboard {
        background-color: var(--ed-bg) !important;
        color: var(--ed-text) !important;
      }

      /* UNIVERSAL BORDER & OUTLINE OVERRIDE - Eradicates glaring white strokes */
      *, *::before, *::after {
        border-color: var(--ed-border) !important;
        outline-color: var(--ed-border) !important;
      }

      /* Neutralize bright inset/ring box-shadows acting as white borders */
      [class*="border"], [class*="ring"], [class*="shadow"] {
        box-shadow: none !important;
      }

      /* Text selection highlight */
      ::selection {
        background-color: #2563eb !important;
        color: #ffffff !important;
      }
      ::-moz-selection {
        background-color: #2563eb !important;
        color: #ffffff !important;
      }

      /* SOLID OPAQUE NAVBAR & STICKY/FIXED HEADERS - Eliminates transparency & bleed-through */
      header, nav, [role="banner"], [role="navigation"],
      .header, .navbar, .topbar, .top-nav, .app-header, .site-header,
      [class*="header"], [class*="navbar"], [class*="topbar"], [class*="top-nav"],
      [class*="sticky"], [class*="fixed"],
      [style*="position: fixed"], [style*="position: sticky"],
      [style*="position:fixed"], [style*="position:sticky"] {
        background-color: var(--ed-bg-elevated) !important;
        background-image: none !important;
        opacity: 1 !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        border-color: var(--ed-border) !important;
      }

      /* UNIVERSAL MODALS, POPOVERS, DIALOGS, DROPDOWNS, TOOLTIPS, SHEETS & DRAWERS */
      dialog, [role="dialog"], [role="alertdialog"], [role="popover"], [popover],
      [role="tooltip"], [role="menu"], [role="listbox"],
      .modal, .modal-content, .modal-dialog, .popover, .tooltip, .dropdown-menu,
      .drawer, .sheet, .popup, .dialog,
      [class*="modal-content"], [class*="modal-dialog"], [class*="popover-content"],
      [class*="dropdown-menu"], [class*="dialog-content"], [class*="tooltip-content"],
      [data-radix-popper-content-wrapper], [data-floating-ui-portal] > div,
      [class*="floating-ui"], [class*="tippy-box"], [class*="MuiPopover-paper"],
      [class*="MuiDialog-paper"], [class*="MuiMenu-paper"], [class*="MuiDrawer-paper"],
      [class*="ant-modal-content"], [class*="ant-dropdown-menu"], [class*="ant-drawer-content"],
      [class*="chakra-modal__content"], [class*="chakra-popover__content"], [class*="chakra-menu__menu-list"],
      .swal2-popup, .swal2-modal {
        background-color: var(--ed-bg-elevated) !important;
        color: var(--ed-text) !important;
        border: 1px solid var(--ed-border) !important;
        box-shadow: 0 20px 45px rgba(0, 0, 0, 0.75), 0 4px 14px rgba(0, 0, 0, 0.5) !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        opacity: 1 !important;
      }

      /* Modal Header, Footer, and Body seamless integration */
      .modal-header, .modal-footer, .modal-body,
      .popover-header, .popover-body,
      [class*="modal-header"], [class*="modal-footer"], [class*="modal-body"],
      [class*="dialog-header"], [class*="dialog-footer"], [class*="dialog-body"],
      [class*="card-header"], [class*="card-footer"] {
        background-color: var(--ed-bg-elevated) !important;
        color: var(--ed-text) !important;
        border-color: var(--ed-border) !important;
      }

      /* Modal Backdrops & Overlays */
      ::backdrop, .modal-backdrop, [class*="backdrop"], [class*="overlay"],
      [class*="MuiBackdrop-root"], [class*="ant-modal-mask"], [class*="chakra-modal__overlay"] {
        background-color: rgba(0, 0, 0, 0.75) !important;
        backdrop-filter: blur(4px) !important;
        -webkit-backdrop-filter: blur(4px) !important;
      }

      /* Tooltips */
      [role="tooltip"], .tooltip, .tooltip-inner, [class*="tooltip"]:not(body),
      .tippy-box, .tippy-content {
        background-color: #141519 !important;
        color: #ffffff !important;
        border: 1px solid #333842 !important;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.6) !important;
        font-size: 12px !important;
        border-radius: 6px !important;
        z-index: 999999 !important;
      }

      /* Opaque structural components */
      aside, .sidebar, .drawer, .menu,
      .card, .panel {
        background-color: var(--ed-bg-elevated) !important;
        color: var(--ed-text) !important;
        border-color: var(--ed-border) !important;
      }

      /* TABLES, ROWS & CELLS - Deep Recolor & Striping */
      table, thead, tbody, tfoot,
      [role="table"], [role="rowgroup"], [role="grid"] {
        background-color: var(--ed-bg) !important;
        color: var(--ed-text) !important;
        border-color: var(--ed-border) !important;
      }

      tr, td, [role="row"], [role="cell"], [role="gridcell"] {
        background-color: var(--ed-bg) !important;
        border-color: var(--ed-border) !important;
      }

      th, thead th, thead tr, [role="columnheader"] {
        background-color: var(--ed-bg-elevated) !important;
        color: var(--ed-text) !important;
        border-color: var(--ed-border) !important;
      }

      tr:nth-child(even), tr:nth-child(even) > td,
      [role="row"]:nth-child(even), [role="row"]:nth-child(even) > [role="cell"] {
        background-color: var(--ed-bg-surface) !important;
      }

      /* INTERACTIVE ELEMENT HOVER EFFECTS */
      tr:hover, tr:hover > td, [role="row"]:hover, [role="row"]:hover > [role="cell"], [role="gridcell"]:hover {
        background-color: var(--ed-bg-surface-hover) !important;
        transition: background-color 0.15s ease !important;
      }

      [role="menuitem"]:hover, [role="option"]:hover, [role="tab"]:hover,
      .dropdown-item:hover, .menu-item:hover, .nav-item:hover,
      [class*="menu-item"]:hover, [class*="dropdown-item"]:hover,
      .select2-results__option--highlighted {
        background-color: var(--ed-bg-surface-hover) !important;
        color: #ffffff !important;
      }

      button:hover:not([data-ed-colored="true"]):not([disabled]),
      [role="button"]:hover:not([data-ed-colored="true"]):not([disabled]),
      .btn:hover:not([data-ed-colored="true"]):not([disabled]),
      [data-ed-neutral-btn="true"]:hover {
        background-color: var(--ed-bg-surface-hover) !important;
        border-color: var(--ed-border-hover) !important;
        color: #ffffff !important;
      }

      li:hover:not([data-ed-colored="true"]):not([data-ed-dark-text="true"]),
      .list-group-item:hover,
      [role="treeitem"]:hover,
      [role="listitem"]:hover {
        background-color: rgba(255, 255, 255, 0.04) !important;
      }

      a:hover:not([data-ed-colored="true"]):not([data-ed-dark-text="true"]) {
        color: var(--ed-link-hover) !important;
        text-decoration: underline !important;
      }

      .card:hover, .panel:hover, [class*="card"]:hover:not(body) {
        border-color: #3e4452 !important;
      }

      summary {
        cursor: pointer !important;
        outline: none !important;
        transition: background-color 0.15s ease, color 0.15s ease !important;
      }
      summary:hover {
        background-color: rgba(255, 255, 255, 0.05) !important;
        color: #ffffff !important;
      }
      summary:focus-visible {
        outline: 2px solid var(--ed-accent) !important;
        outline-offset: 2px !important;
      }
      details[open] > summary {
        border-bottom: 1px solid var(--ed-border) !important;
        margin-bottom: 8px !important;
      }

      /* Form Controls, Inputs, Textareas, Searchboxes & Filters */
      input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]),
      textarea, select,
      [contenteditable="true"], [role="textbox"], [role="searchbox"], [role="combobox"],
      .form-control, .input, [class*="form-control"], [class*="input-field"] {
        background-color: var(--ed-input-bg) !important;
        color: var(--ed-text) !important;
        border: 1px solid var(--ed-border) !important;
        border-radius: 6px !important;
        caret-color: var(--ed-accent) !important;
        outline: none !important;
        transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease !important;
      }

      /* Input Hover Effect */
      input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):hover:not(:disabled):not([readonly]),
      textarea:hover:not(:disabled):not([readonly]),
      select:hover:not(:disabled):not([readonly]),
      [contenteditable="true"]:hover:not([aria-disabled="true"]),
      [role="textbox"]:hover:not([aria-disabled="true"]),
      [role="searchbox"]:hover:not([aria-disabled="true"]),
      [role="combobox"]:hover:not([aria-disabled="true"]) {
        border-color: var(--ed-border-hover) !important;
        background-color: var(--ed-input-hover-bg) !important;
      }

      /* Input Focus Effect */
      input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):focus,
      textarea:focus, select:focus,
      [contenteditable="true"]:focus, [role="textbox"]:focus, [role="searchbox"]:focus, [role="combobox"]:focus,
      input:focus-visible, textarea:focus-visible, select:focus-visible {
        border-color: var(--ed-accent) !important;
        background-color: var(--ed-input-focus-bg) !important;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3) !important;
        outline: none !important;
        color: #ffffff !important;
      }

      /* Input Disabled & Readonly */
      input:disabled, textarea:disabled, select:disabled,
      input[readonly], textarea[readonly],
      [aria-disabled="true"] {
        background-color: #121316 !important;
        color: var(--ed-text-muted) !important;
        border-color: #23252b !important;
        cursor: not-allowed !important;
        opacity: 0.68 !important;
      }

      /* Input Placeholder */
      input::placeholder, textarea::placeholder,
      input::-webkit-input-placeholder, textarea::-webkit-input-placeholder,
      input::-moz-placeholder, textarea::-moz-placeholder {
        color: var(--ed-text-muted) !important;
        opacity: 0.8 !important;
      }

      /* Browser Autofill Fix (Eradicates Chrome's glaring yellow/white background) */
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active,
      textarea:-webkit-autofill,
      select:-webkit-autofill {
        -webkit-box-shadow: 0 0 0 1000px #181a20 inset !important;
        -webkit-text-fill-color: #f0f2f5 !important;
        caret-color: var(--ed-accent) !important;
        transition: background-color 5000s ease-in-out 0s !important;
      }

      select {
        cursor: pointer !important;
      }
      select option, select optgroup {
        background-color: var(--ed-bg-elevated) !important;
        color: var(--ed-text) !important;
      }

      input[type="checkbox"], input[type="radio"] {
        accent-color: var(--ed-accent) !important;
        cursor: pointer !important;
      }

      input[type="range"] {
        accent-color: var(--ed-accent) !important;
      }

      /* File selector button */
      input[type="file"]::file-selector-button,
      input[type="file"]::-webkit-file-upload-button {
        background-color: var(--ed-bg-surface) !important;
        color: var(--ed-text) !important;
        border: 1px solid var(--ed-border) !important;
        border-radius: 4px !important;
        padding: 5px 12px !important;
        cursor: pointer !important;
        transition: background-color 0.15s ease !important;
      }
      input[type="file"]::file-selector-button:hover,
      input[type="file"]::-webkit-file-upload-button:hover {
        background-color: var(--ed-bg-surface-hover) !important;
        color: #ffffff !important;
      }

      /* Framework background utility classes */
      [class*="bg-white"], [class*="bg-light"], [class*="bg-gray-50"], [class*="bg-gray-100"],
      [class*="bg-slate-50"], [class*="bg-slate-100"], [class*="bg-neutral-50"], [class*="bg-stone-50"],
      [class*="table-"], [class*="ant-table"], [class*="mat-table"], [class*="datatable"],
      [class*="row-"], [class*="cell-"] {
        background-color: var(--ed-bg) !important;
        border-color: var(--ed-border) !important;
      }

      /* Elements flagged by dynamic scanner as having light background */
      [data-ed-light-bg="true"] {
        background-color: var(--ed-bg-elevated) !important;
        border-color: var(--ed-border) !important;
      }
      [data-ed-light-bg="true"]:hover:not([data-ed-colored="true"]):not(body):not(html) {
        border-color: var(--ed-border-hover) !important;
      }

      /* Neutral Buttons flagged by dynamic scanner */
      [data-ed-neutral-btn="true"] {
        background-color: var(--ed-bg-surface) !important;
        color: var(--ed-text) !important;
        border-color: var(--ed-border) !important;
      }
      [data-ed-neutral-btn="true"]:hover {
        background-color: var(--ed-bg-surface-hover) !important;
        border-color: var(--ed-border-hover) !important;
        color: #ffffff !important;
      }

      /* PRESERVED INTENTIONAL COLOR BADGES, CHIPS & PILLS */
      [data-ed-colored="true"] {
        /* Intentionally colored elements retain their saturated background */
      }
      [data-ed-dark-text="true"],
      [data-ed-dark-text="true"] *,
      [data-ed-pill-yellow="true"],
      [data-ed-pill-yellow="true"] * {
        color: #111827 !important;
        stroke: #111827 !important;
      }
      [data-ed-light-text="true"],
      [data-ed-light-text="true"] * {
        color: #ffffff !important;
        stroke: #ffffff !important;
      }

      /* UNIVERSAL HIGH-CONTRAST TYPOGRAPHY (Exempt colored elements and preserved colored text) */
      h1:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      h2:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      h3:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      h4:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      h5:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      h6:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      p:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      span:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      li:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      dt:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      dd:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      blockquote:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      label:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      strong:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      em:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      b:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      i:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      th, td:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *) {
        color: var(--ed-text) !important;
        border-color: var(--ed-border) !important;
      }

      /* Secondary text, timestamps, and muted labels */
      small:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      .text-muted:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      [class*="muted"]:not([data-ed-preserve-text-color="true"]):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *),
      [class*="timestamp"], [class*="date"], [class*="time"], [class*="sub"] {
        color: var(--ed-text-muted) !important;
      }

      /* Anchor links - exempt elements with intentional colors or dark text */
      a:not([data-ed-colored="true"]):not([data-ed-colored="true"] *):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *):not([data-ed-preserve-text-color="true"]),
      a:link:not([data-ed-colored="true"]):not([data-ed-colored="true"] *):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *):not([data-ed-preserve-text-color="true"]),
      a:visited:not([data-ed-colored="true"]):not([data-ed-colored="true"] *):not([data-ed-dark-text="true"]):not([data-ed-dark-text="true"] *):not([data-ed-preserve-text-color="true"]) {
        color: var(--ed-link) !important;
      }

      /* Additional HTML Elements: mark, kbd, del, ins */
      mark {
        background-color: #854d0e !important;
        color: #fef08a !important;
        padding: 2px 5px !important;
        border-radius: 3px !important;
      }
      del, s {
        color: var(--ed-text-muted) !important;
        text-decoration: line-through !important;
      }
      ins {
        color: #4ade80 !important;
        text-decoration: underline !important;
      }

      /* NEUTRAL & SECONDARY BUTTONS ONLY (Preserve vibrant colored CTA buttons like yellow Schedule Call) */
      button:not([class*="warning"]):not([class*="success"]):not([class*="danger"]):not([class*="primary"]):not([class*="yellow"]):not([class*="amber"]):not([class*="gold"]):not([class*="green"]):not([class*="blue"]):not([class*="purple"]):not([class*="accent"]):not([class*="cta"]):not([style*="background"]):not([style*="background-color"]),
      input[type="button"]:not([style*="background"]),
      input[type="submit"]:not([style*="background"]),
      input[type="reset"] {
        border-color: var(--ed-border) !important;
      }

      /* Code and Preformatted blocks */
      pre, code, kbd, samp {
        background-color: var(--ed-code-bg) !important;
        color: var(--ed-text) !important;
        border-color: var(--ed-border) !important;
      }

      hr {
        background-color: var(--ed-border) !important;
        border-color: var(--ed-border) !important;
      }

      /* Scrollbars */
      ::-webkit-scrollbar {
        width: 10px !important;
        height: 10px !important;
        background-color: var(--ed-bg) !important;
      }

      ::-webkit-scrollbar-track {
        background: var(--ed-bg) !important;
      }

      ::-webkit-scrollbar-thumb {
        background-color: var(--ed-scrollbar) !important;
        border-radius: 5px !important;
        border: 2px solid var(--ed-bg) !important;
      }

      ::-webkit-scrollbar-thumb:hover {
        background-color: var(--ed-accent) !important;
      }

      /* =======================================================
         GMAIL SPECIFIC RULES (mail.google.com)
         ======================================================= */
      /* Gmail Main Layout Containers */
      body.aAU, body.a1c, .nH, .aeF, .AO, .aeH, .aeJ, .adP, .bkK,
      div[role="main"], div[role="navigation"], .bkK, .wT {
        background-color: var(--ed-bg) !important;
        color: var(--ed-text) !important;
      }

      /* Gmail Top Search & App Bar */
      header.gb_Fa, form[role="search"], .gb_Ld, .gb_Fd, .gb_Qe, .gb_Te {
        background-color: var(--ed-bg-elevated) !important;
        border-color: var(--ed-border) !important;
      }
      header form[role="search"] input, .gb_Ie {
        background-color: var(--ed-bg-surface) !important;
        color: var(--ed-text) !important;
        caret-color: #ffffff !important;
        border: 1px solid var(--ed-border) !important;
        border-radius: 24px !important;
      }
      header form[role="search"] input::placeholder {
        color: var(--ed-text-muted) !important;
      }

      /* Gmail Logo Visibility */
      header.gb_Fa [aria-label="Gmail"],
      header.gb_Fa a[title="Gmail"],
      header.gb_Fa a[title="Gmail"] *,
      header.gb_Fa [aria-label="Gmail"] *,
      header.gb_Fa .gb_0d, header.gb_Fa .gb_1d,
      header.gb_Fa .gb_8c, header.gb_Fa .gb_7c,
      header.gb_Fa [class*="logo"], header.gb_Fa [class*="logo"] * {
        color: #ffffff !important;
        fill: #ffffff !important;
        opacity: 1 !important;
      }

      /* Left App Rail (Mail, Chat, Meet icons) */
      div[aria-label*="Google apps"],
      .aAU, .a1c > div[role="navigation"] {
        background-color: var(--ed-bg-elevated) !important;
        border-right: 1px solid var(--ed-border) !important;
      }
      div[aria-label*="Google apps"] [aria-selected="true"],
      .aAU [aria-selected="true"],
      div[aria-label*="Google apps"] [data-active="true"] {
        background-color: rgba(37, 99, 235, 0.25) !important;
        border-radius: 16px !important;
      }
      div[aria-label*="Google apps"] [aria-selected="true"] *,
      .aAU [aria-selected="true"] * {
        color: #ffffff !important;
        fill: #ffffff !important;
      }

      /* Gmail Left Sidebar Folder Navigation & Active Tabs */
      .TO, .CL, .wT {
        color: var(--ed-text) !important;
      }
      .TO:hover, .CL:hover, [role="navigation"] [role="treeitem"]:hover {
        background-color: var(--ed-bg-surface) !important;
        border-radius: 16px !important;
      }
      .nZ,
      [role="navigation"] [aria-selected="true"],
      [role="navigation"] [data-active="true"],
      [role="navigation"] .nZ,
      div[role="navigation"] [role="treeitem"][aria-selected="true"],
      div[role="navigation"] [role="tab"][aria-selected="true"],
      .TO.nZ {
        background-color: rgba(37, 99, 235, 0.22) !important;
        background: rgba(37, 99, 235, 0.22) !important;
        color: #ffffff !important;
        border-radius: 16px !important;
      }
      .nZ *,
      [role="navigation"] [aria-selected="true"] *,
      [role="navigation"] [data-active="true"] *,
      [role="navigation"] .nZ * {
        color: #ffffff !important;
      }

      /* Gmail Compose Container & Wrappers - Eradicate the white box */
      .z0, .aic, .bGI, .akh, .bkK, .aj9, .pp, .aeN, .wT, .b9, .oy8Mbf,
      div[role="navigation"] div.z0, div[role="navigation"] .aic,
      .G-atb, .aeH, .nH.oy8Mbf, .a1c, .wT > .bGI {
        background-color: transparent !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      /* Gmail Compose & Google Chat "New chat" Floating Pill Button */
      div[role="button"][gh="cm"],
      div[role="button"][aria-label*="New chat"],
      div[role="button"][aria-label*="Compose"],
      .T-I.T-I-KE.L3,
      [data-action="new-chat"],
      .wT div[role="button"][class*="T-I"] {
        background-color: #2563eb !important;
        background: #2563eb !important;
        color: #ffffff !important;
        border-radius: 16px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
        border: none !important;
      }
      div[role="button"][gh="cm"] *,
      div[role="button"][aria-label*="New chat"] *,
      div[role="button"][aria-label*="Compose"] *,
      .T-I.T-I-KE.L3 * {
        color: #ffffff !important;
        fill: #ffffff !important;
        stroke: #ffffff !important;
        font-weight: 600 !important;
      }

      /* Top "Upgrade" Button in Gmail Header */
      button[aria-label*="Upgrade"],
      a[aria-label*="Upgrade"],
      [class*="upgrade"] {
        background-color: #2563eb !important;
        background: #2563eb !important;
        color: #ffffff !important;
        border: none !important;
        border-radius: 18px !important;
      }
      button[aria-label*="Upgrade"] *,
      a[aria-label*="Upgrade"] * {
        color: #ffffff !important;
      }

      /* Gmail Email List Rows */
      table.F.cf.zt, tr.zA {
        border-bottom: 1px solid var(--ed-border) !important;
      }
      tr.zA.yO {
        background-color: var(--ed-bg) !important;
        color: var(--ed-text-muted) !important;
      }
      tr.zA.zE {
        background-color: var(--ed-bg-elevated) !important;
        color: var(--ed-text) !important;
        font-weight: 600 !important;
      }
      tr.zA:hover {
        background-color: var(--ed-bg-surface) !important;
      }
      tr.zA .y6 {
        color: var(--ed-text) !important;
      }
      tr.zA .y2 {
        color: var(--ed-text-muted) !important;
      }

      /* Gmail Star Icon */
      .T-KT[aria-label*="Starred"], .T-KT[class*="rated"] {
        color: #facc15 !important;
        fill: #facc15 !important;
      }

      /* Gmail Email Reading View */
      .a3s.aiL, .ii.gt, .adn.ads {
        background-color: var(--ed-bg) !important;
        color: var(--ed-text) !important;
      }
      .a3s.aiL *, .ii.gt * {
        color: var(--ed-text) !important;
      }
      .a3s.aiL a, .ii.gt a {
        color: var(--ed-link) !important;
      }
      .gmail_quote, blockquote {
        border-left: 3px solid var(--ed-border) !important;
        color: var(--ed-text-muted) !important;
      }

      /* Gmail Compose Dialog */
      div[role="dialog"][aria-label*="Compose"], .AD, .inboxsdk__compose {
        background-color: var(--ed-bg-elevated) !important;
        color: var(--ed-text) !important;
        border: 1px solid var(--ed-border) !important;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6) !important;
        border-radius: 8px 8px 0 0 !important;
      }
      .AD .aYF, .AD .Hp {
        background-color: var(--ed-bg-surface) !important;
        color: #ffffff !important;
      }
      div[role="textbox"][contenteditable="true"], .Am.Al.editable {
        background-color: var(--ed-bg) !important;
        color: var(--ed-text) !important;
        caret-color: #ffffff !important;
      }
      div[role="textbox"][contenteditable="true"] * {
        color: inherit !important;
      }

      /* =======================================================
         GOOGLE CHAT SPECIFIC RULES (chat.google.com / Workspace)
         ======================================================= */
      /* Google Chat Containers & Panels */
      c-wiz, [role="main"][aria-label*="Chat"], [role="log"], [data-message-id] {
        background-color: var(--ed-bg) !important;
        color: var(--ed-text) !important;
      }
      [data-message-id] [role="heading"], [data-message-id] span[style*="font-weight"] {
        color: var(--ed-text) !important;
      }

      /* Google Chat Left Sidebar (DMs & Spaces) */
      div[role="navigation"][aria-label*="Conversations"],
      div[role="navigation"][aria-label*="Chat"],
      div[role="navigation"][aria-label*="Spaces"] {
        background-color: var(--ed-bg-elevated) !important;
        border-right: 1px solid var(--ed-border) !important;
      }

      /* Google Chat Space Header & Action Icons */
      c-wiz [role="heading"],
      [data-space-id], [data-topic-id],
      div[role="region"][aria-label*="Ctrl Alt Elite"],
      div[aria-label*="Space actions"] {
        color: var(--ed-text) !important;
      }
      [role="banner"] [role="button"], [role="toolbar"] [role="button"] {
        border-color: var(--ed-border) !important;
      }

      /* Google Chat Message Composer Region & Border Divider */
      div[role="region"][aria-label*="Message input"],
      div[role="region"][aria-label*="Chat"],
      div[role="region"][aria-label*="composer"],
      div[role="separator"],
      .dSO0Ce, [jsname="r4nke"] {
        background-color: var(--ed-bg) !important;
        border-color: var(--ed-border) !important;
        border-top: 1px solid var(--ed-border) !important;
        box-shadow: none !important;
      }

      /* Google Chat Plus (+) Button */
      div[role="region"] button[aria-label*="Add"],
      div[role="region"] button[aria-label*="Insert"],
      div[role="region"] [data-tooltip*="Add"],
      div[role="region"] [data-tooltip*="Insert"],
      div[role="region"] [aria-label*="Action"],
      div[role="region"] .VfPpkd-Bz112c-LgbsSe {
        background-color: var(--ed-bg-surface) !important;
        background: var(--ed-bg-surface) !important;
        color: #93c5fd !important;
        border-radius: 50% !important;
        border: 1px solid var(--ed-border) !important;
      }
      div[role="region"] button[aria-label*="Add"] *,
      div[role="region"] button[aria-label*="Insert"] * {
        color: #93c5fd !important;
        fill: #93c5fd !important;
        stroke: #93c5fd !important;
      }

      /* Google Chat Message Input Field */
      div[role="textbox"][contenteditable="true"].notranslate,
      textarea.editable,
      div[role="region"] div[role="textbox"][contenteditable="true"] {
        background-color: var(--ed-bg-surface) !important;
        color: var(--ed-text) !important;
        caret-color: #ffffff !important;
        border: 1px solid var(--ed-border) !important;
        border-radius: 20px !important;
      }
      div[role="textbox"][contenteditable="true"].notranslate *,
      div[role="region"] div[role="textbox"][contenteditable="true"] * {
        color: inherit !important;
      }

      /* Formatting toolbar icons (A, emoji, gif, upload) */
      div[role="region"] [role="toolbar"] [role="button"],
      div[role="region"] [role="toolbar"] button {
        color: var(--ed-text-muted) !important;
        fill: var(--ed-text-muted) !important;
      }
      div[role="region"] [role="toolbar"] [role="button"]:hover,
      div[role="region"] [role="toolbar"] button:hover {
        background-color: var(--ed-bg-surface-hover) !important;
        color: #ffffff !important;
        fill: #ffffff !important;
      }

      /* Send Button */
      button[aria-label*="Send"],
      div[role="button"][aria-label*="Send"] {
        background-color: #2563eb !important;
        background: #2563eb !important;
        color: #ffffff !important;
        fill: #ffffff !important;
        border-radius: 50% !important;
      }
      button[aria-label*="Send"] *,
      div[role="button"][aria-label*="Send"] * {
        color: #ffffff !important;
        fill: #ffffff !important;
      }

      /* Google Chat Mention Tags & Emoji Reactions */
      [data-user-id], [class*="mention"], [class*="chip"] {
        border-radius: 4px;
      }
      [role="button"][data-emoji], [class*="reaction"] {
        background-color: var(--ed-bg-surface) !important;
        border: 1px solid var(--ed-border) !important;
        color: var(--ed-text) !important;
        border-radius: 12px !important;
      }

      /* Google Chat Code Snippets */
      pre, code, [data-syntax] {
        background-color: var(--ed-code-bg) !important;
        color: var(--ed-text) !important;
        border: 1px solid var(--ed-border) !important;
      }

      /* Universal Avatar Protection */
      img[alt*="avatar"], img[class*="avatar"], img[class*="profile"], img[src*="googleusercontent"] {
        filter: none !important;
        border-radius: 50%;
      }

      /* IMAGE HANDLING OPTION: With Images vs Without Images (Default) */
      ${config.processImages ? `
        /* With Images: Media elements inverted to dark style */
        img:not([class*="logo"]):not([src*="googlelogo"]), video, [style*="background-image"]:not([class*="avatar"]) {
          filter: invert(90%) hue-rotate(180deg) !important;
        }
      ` : `
        /* Without Images (Default): Photos, avatars, media 100% protected in natural colors */
        img, video, canvas, [role="img"], picture, embed, object {
          filter: brightness(${1 - imgDim * 0.4}) contrast(${contrastVal}) !important;
          background-color: transparent !important;
        }
        [class*="avatar"], [id*="avatar"], [class*="profile-pic"], [class*="thumb"], [class*="logo"] {
          background-color: transparent !important;
        }
      `}

      /* SVG & ICON PROTECTION: Preserve fill="none" and stroke rendering */
      svg[fill="none"], svg [fill="none"] {
        fill: none !important;
      }
      svg circle[fill="none"], svg path[fill="none"], svg rect[fill="none"] {
        fill: none !important;
      }
      svg:not([fill]) {
        fill: none;
      }
    `;
  }

  /**
   * Generate CSS rules for CSS Inversion Filter Mode (Revert Color Mode)
   */
  function generateInvertCss(theme, config) {
    const brightnessVal = (config.brightness || 100) / 100;
    const contrastVal = (config.contrast || 100) / 100;
    const sepiaVal = (config.sepia || 0) / 100;
    const grayscaleVal = (config.grayscale || 0) / 100;
    const withImages = !!config.processImages; // false: without images (default) | true: with images

    // When without images (default): counter-invert media so photos, graphics & avatars remain authentic!
    const mediaCounterInvert = !withImages ? `
      img, video, canvas, picture, embed, object, iframe,
      [style*="background-image"], [role="img"], svg,
      [class*="avatar"], [id*="avatar"] {
        filter: invert(100%) hue-rotate(180deg) !important;
      }
    ` : `
      /* With images: media is inverted with the rest of the page */
    `;

    return `
      html {
        filter: invert(90%) hue-rotate(180deg) brightness(${brightnessVal}) contrast(${contrastVal}) sepia(${sepiaVal}) grayscale(${grayscaleVal}) !important;
        background-color: #121316 !important;
      }

      body {
        background-color: inherit !important;
      }

      ${mediaCounterInvert}
    `;
  }

  /**
   * Advanced Dynamic DOM Scanner:
   * 1. Detects elements with white/near-white backgrounds and recolors them to dark.
   * 2. Detects sticky/fixed navbars and ensures 100% opaque solid dark background (no transparent bleeds).
   * 3. Calculates effective background luminance for all text:
   *    - If background is bright (e.g. Yellow / Light Gold pills): forces DEEP DARK text (#111827).
   *    - If background is dark (e.g. Table rows, Dark cards): forces LIGHT text (var(--ed-text)).
   * 4. Eradicates bright white border strokes and inset box-shadows.
   */
  function scanAndRecolorElements(root = document.body) {
    if (!root || !isCurrentlyActive) return;
    if (currentConfig && currentConfig.engineMode === 'invert') return;

    const selector = 'div, section, article, table, tr, td, th, li, aside, p, span, form, header, nav, button, a';
    const elements = root.matches && root.matches(selector) ? [root] : [];
    if (root.querySelectorAll) {
      elements.push(...root.querySelectorAll(selector));
    }

    const len = elements.length;
    for (let i = 0; i < len; i++) {
      const el = elements[i];

      // Skip media & svg
      const tag = el.tagName.toLowerCase();
      if (tag === 'img' || tag === 'video' || tag === 'canvas' || tag === 'svg') continue;

      const comp = window.getComputedStyle(el);

      // 1. STICKY / FIXED NAVBAR PROTECTION (Ensure 100% opaque solid background)
      const pos = comp.position;
      if (pos === 'sticky' || pos === 'fixed') {
        const topVal = parseInt(comp.top, 10);
        if (isNaN(topVal) || topVal <= 20) {
          el.style.setProperty('background-color', 'var(--ed-bg-elevated)', 'important');
          el.style.setProperty('backdrop-filter', 'none', 'important');
          el.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
          el.style.setProperty('opacity', '1', 'important');
          el.style.setProperty('border-color', 'var(--ed-border)', 'important');
        }
      }

      // 2. ERADICATE WHITE BOX SHADOWS & STROKES
      if (comp.boxShadow && comp.boxShadow !== 'none') {
        const shadowStr = comp.boxShadow.toLowerCase();
        if (
          shadowStr.includes('rgb(255') ||
          shadowStr.includes('rgba(255') ||
          shadowStr.includes('rgb(243') ||
          shadowStr.includes('rgb(229') ||
          shadowStr.includes('inset')
        ) {
          el.style.setProperty('box-shadow', 'none', 'important');
        }
      }

      // 3. PRESERVE & BOOST INTENTIONALLY COLORED TEXT (Green 'Active', Red 'Busy', Gold stars, etc.)
      const fg = parseRgba(comp.color);
      if (fg) {
        const fgSat = getSaturation(fg.r, fg.g, fg.b);
        const fgLum = getLuminance(fg.r, fg.g, fg.b);
        if (fgSat >= 0.18) {
          el.setAttribute('data-ed-preserve-text-color', 'true');
          // If the text is dark (e.g. dark green, dark red, navy text designed for white background),
          // boost its lightness so it stands out with high contrast on dark backgrounds:
          if (fgLum < 0.40) {
            const boosted = boostColorForDarkBg(fg.r, fg.g, fg.b, 0.60);
            el.style.setProperty('color', `rgb(${boosted.r}, ${boosted.g}, ${boosted.b})`, 'important');
          } else {
            el.style.setProperty('color', comp.color, 'important');
          }
        }
      }

      // 4. BACKGROUND RECOLORING & INTENTIONAL COLOR PRESERVATION
      const bg = parseRgba(comp.backgroundColor);
      if (bg && bg.a > 0.15) {
        const lum = getLuminance(bg.r, bg.g, bg.b);
        const sat = getSaturation(bg.r, bg.g, bg.b);

        // A. INTENTIONALLY COLORED ELEMENTS (Vibrant brand/status colors):
        // Yellow task pills, Red pills ("Stat (Hindi)"), Orange pills ("Vikaram solar"),
        // Green status badges ("Available"), Red status badges ("Busy"),
        // Yellow sidebar active icons, CTA buttons, Gmail colored label tags,
        // GChat mention chips & reactions, status indicators, etc.
        // NOTE: Distinguish true vibrant badges from light-mode pastel UI tints (#c2e7ff, #e8f0fe, #d3e3fd):
        // If bright (lum > 0.65), it MUST have high saturation (sat >= 0.48) to be a badge (e.g. yellow, orange).
        // If medium/dark (lum <= 0.65), sat >= 0.22 is an intentional color (e.g. green, red, blue, purple).
        const isVibrantColor = (lum <= 0.65 && sat >= 0.22) || (lum > 0.65 && sat >= 0.48);
        if (isVibrantColor) {
          el.setAttribute('data-ed-colored', 'true');
          el.style.setProperty('background-color', comp.backgroundColor, 'important');

          if (lum > 0.50) {
            // Bright / light background (Yellow, gold, peach, coral, light green, pastel blue)
            // -> High-contrast DARK text & dark SVG stroke (#111827)
            el.setAttribute('data-ed-dark-text', 'true');
            el.style.setProperty('color', '#111827', 'important');
            el.querySelectorAll('*').forEach((child) => {
              child.style.setProperty('color', '#111827', 'important');
              if (child.tagName && child.tagName.toLowerCase() === 'svg') {
                child.style.setProperty('color', '#111827', 'important');
                child.style.setProperty('stroke', '#111827', 'important');
              }
            });
          } else {
            // Saturated dark/medium background (Dark red, solid green, navy, purple)
            // -> High-contrast WHITE text (#ffffff)
            el.setAttribute('data-ed-light-text', 'true');
            el.style.setProperty('color', '#ffffff', 'important');
            el.querySelectorAll('*').forEach((child) => {
              child.style.setProperty('color', '#ffffff', 'important');
              if (child.tagName && child.tagName.toLowerCase() === 'svg') {
                child.style.setProperty('color', '#ffffff', 'important');
                child.style.setProperty('stroke', '#ffffff', 'important');
              }
            });
          }
          continue;
        }

        // B. NEUTRAL LIGHT BACKGROUNDS (White, off-white, light gray: sat < 0.18 && lum > 0.40)
        if (lum > 0.40) {
          // If this is a neutral inner element inside a table cell (avoid isolated dark boxes)
          const inTableCell = el.closest('td, th');
          if (inTableCell && el !== inTableCell && !el.classList.contains('card') && !el.classList.contains('btn') && tag !== 'button' && tag !== 'input') {
            el.style.setProperty('background-color', 'transparent', 'important');
            continue;
          }

          // Neutral Buttons (e.g. "New Portal")
          if (tag === 'button' || el.getAttribute('role') === 'button' || (el.className && typeof el.className === 'string' && el.className.includes('btn'))) {
            el.setAttribute('data-ed-neutral-btn', 'true');
            continue;
          }

          // Neutral cards, containers, sections, headers, panels
          el.setAttribute('data-ed-light-bg', 'true');
          // For interactive elements (a, li, tr), avoid inline background so CSS :hover fires cleanly
          if (tag !== 'a' && tag !== 'li' && tag !== 'tr' && tag !== 'td') {
            el.style.setProperty('background-color', 'var(--ed-bg-elevated)', 'important');
            el.style.setProperty('border-color', 'var(--ed-border)', 'important');
          }
        }
      }
    }
  }

  function scheduleScan(root) {
    if (scanRafId) cancelAnimationFrame(scanRafId);
    scanRafId = requestAnimationFrame(() => {
      scanAndRecolorElements(root || document.body);
    });
  }

  function startDomObserver() {
    if (domObserver) return;
    domObserver = new MutationObserver((mutations) => {
      if (!isCurrentlyActive) return;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          scheduleScan(document.body);
          break;
        }
      }
    });
    domObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function cleanupScannedElements() {
    const elements = document.querySelectorAll('[data-ed-light-bg], [data-ed-text-mode], [data-ed-pill-yellow], [data-ed-neutral-btn], [data-ed-colored], [data-ed-dark-text], [data-ed-light-text], [data-ed-preserve-text-color]');
    elements.forEach((el) => {
      el.removeAttribute('data-ed-light-bg');
      el.removeAttribute('data-ed-text-mode');
      el.removeAttribute('data-ed-pill-yellow');
      el.removeAttribute('data-ed-neutral-btn');
      el.removeAttribute('data-ed-colored');
      el.removeAttribute('data-ed-dark-text');
      el.removeAttribute('data-ed-light-text');
      el.removeAttribute('data-ed-preserve-text-color');
      el.style.removeProperty('color');
      el.style.removeProperty('background-color');
      el.style.removeProperty('border-color');
      el.style.removeProperty('box-shadow');
      el.style.removeProperty('backdrop-filter');
      el.style.removeProperty('stroke');
    });
  }

  function stopDomObserver() {
    if (domObserver) {
      domObserver.disconnect();
      domObserver = null;
    }
    cleanupScannedElements();
  }

  /**
   * Apply theme stylesheet to document
   */
  function applyTheme() {
    if (!currentConfig) return;

    const enabled = shouldEnableDarkMode(currentConfig);
    isCurrentlyActive = enabled;

    let styleEl = document.getElementById(STYLE_ID);

    if (!enabled) {
      if (styleEl) {
        styleEl.remove();
      }
      stopDomObserver();
      removeEarlyCloak();
      cleanupScannedElements();
      document.documentElement.removeAttribute('data-everything-dark');
      return;
    }

    // Resolve active engine mode (smart vs invert)
    let engineMode = currentConfig.engineMode || 'smart';
    if (currentConfig.siteRules && currentConfig.siteRules[currentHost] && currentConfig.siteRules[currentHost].engineMode) {
      engineMode = currentConfig.siteRules[currentHost].engineMode;
    }
    // Revert Color option forces Inversion mode
    if (currentConfig.revertColor) {
      engineMode = 'invert';
    }

    activeThemeData = getThemeData();

    let css = '';
    if (engineMode === 'invert') {
      css = generateInvertCss(activeThemeData, currentConfig);
      stopDomObserver();
    } else {
      css = generateSmartCss(activeThemeData, currentConfig);
      startDomObserver();
      scheduleScan(document.body);
    }

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(styleEl);
    }

    styleEl.textContent = css;
    document.documentElement.setAttribute('data-everything-dark', 'true');

    // Remove early cloak smoothly once real theme has attached
    removeEarlyCloak();
  }

  function removeEarlyCloak() {
    const cloak = document.getElementById(EARLY_CLOAK_ID);
    if (cloak) {
      cloak.remove();
    }
  }

  /**
   * Load stored settings
   */
  function init() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(null, (stored) => {
        const defaults = (typeof ED_DEFAULT_CONFIG !== 'undefined' ? ED_DEFAULT_CONFIG : (window.ED_DEFAULT_CONFIG || globalThis.ED_DEFAULT_CONFIG || {}));
        currentConfig = Object.assign({}, defaults, stored);
        applyTheme();
      });
    } else {
      currentConfig = (typeof ED_DEFAULT_CONFIG !== 'undefined' ? ED_DEFAULT_CONFIG : (window.ED_DEFAULT_CONFIG || globalThis.ED_DEFAULT_CONFIG || {}));
      applyTheme();
    }

    // System dark mode listener for auto-schedule
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (currentConfig && currentConfig.autoSchedule === 'system') {
          applyTheme();
        }
      });
    }
  }

  /**
   * Listen for messages from popup or background service worker
   */
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'ED_UPDATE_SETTINGS') {
        currentConfig = request.config;
        applyTheme();
        sendResponse({ success: true, isCurrentlyActive });
        return true;
      }

      if (request.action === 'ED_GET_STATUS') {
        sendResponse({
          success: true,
          isCurrentlyActive,
          currentHost,
          config: currentConfig
        });
        return true;
      }

      if (request.action === 'ED_TOGGLE_SITE') {
        if (!currentConfig) currentConfig = window.ED_DEFAULT_CONFIG || {};
        if (!currentConfig.siteRules) currentConfig.siteRules = {};

        // Invert current active state
        const currentlyActive = shouldEnableDarkMode(currentConfig);
        const nextState = !currentlyActive;

        currentConfig.siteRules[currentHost] = {
          enabled: nextState
        };

        // Persist
        chrome.storage.local.set({ siteRules: currentConfig.siteRules }, () => {
          applyTheme();
          sendResponse({ success: true, enabled: nextState, currentHost });
        });
        return true;
      }
    });
  }

  // Storage listener for instant cross-tab settings sync
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        chrome.storage.local.get(null, (updatedConfig) => {
          if (!updatedConfig) return;
          currentConfig = updatedConfig;
          applyTheme();
        });
      }
    });
  }

  // Run initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
