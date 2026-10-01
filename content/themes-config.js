/**
 * Everything Dark - Master Single Dark Theme Configuration
 * Designed to provide the optimal contrast, eye protection, and visual elegance across all websites.
 */

var ED_DARK_THEME = {
  id: 'dark',
  name: 'Everything Dark',
  bg: '#121316',          // Deep, soothing neutral charcoal (WCAG AAA contrast, zero OLED smearing)
  bgElevated: '#1a1c20',  // Elevated cards, panels, modals, dialogs, headers
  bgSurface: '#22252b',   // Hovered table rows, secondary buttons, input fields
  text: '#f3f4f6',        // High-contrast crisp off-white primary text
  textMuted: '#9ca3af',   // Secondary metadata, muted labels, timestamps
  border: '#2e323b',      // Refined dark border
  accent: '#3b82f6',      // Royal blue accent
  link: '#60a5fa',        // High-contrast readable hyperlink color
  scrollbar: '#3f4450',   // Subtle scrollbar thumb
  codeBg: '#181a1f',      // Syntax & code block background
  inputBg: '#16181d'      // Inputs & textareas
};

var ED_THEMES = [ED_DARK_THEME];

var ED_DEFAULT_CONFIG = {
  enabled: true,
  urlFilterMode: 'all',  // 'all' (all websites except excluded) | 'whitelist' (specific sites only)
  engineMode: 'smart',   // 'smart' (CSS recolor engine) | 'invert' (high-compatibility filter)
  revertColor: false,    // false: standard master dark theme | true: revert/invert color scheme
  processImages: false,  // false: without images (default, media protected) | true: with images (media processed)
  brightness: 100,       // 60% to 140%
  contrast: 100,         // 60% to 140%
  sepia: 0,              // 0% to 100%
  grayscale: 0,          // 0% to 100%
  protectImages: true,   // Never invert or ruin photos, videos, canvas, SVG icons
  dimImages: 10,         // Dim glaring media slightly (0 - 50%)
  autoSchedule: 'off',   // 'off' | 'system' | 'time'
  scheduleStart: '20:00',
  scheduleEnd: '07:00',
  siteRules: {}          // Domain rules: { "domain.com": { enabled: boolean } }
};

// Export to all global scopes (works in Window, ServiceWorker/self, globalThis, and CommonJS)
if (typeof globalThis !== 'undefined') {
  globalThis.ED_DARK_THEME = ED_DARK_THEME;
  globalThis.ED_THEMES = ED_THEMES;
  globalThis.ED_DEFAULT_CONFIG = ED_DEFAULT_CONFIG;
}
if (typeof self !== 'undefined') {
  self.ED_DARK_THEME = ED_DARK_THEME;
  self.ED_THEMES = ED_THEMES;
  self.ED_DEFAULT_CONFIG = ED_DEFAULT_CONFIG;
}
if (typeof window !== 'undefined') {
  window.ED_DARK_THEME = ED_DARK_THEME;
  window.ED_THEMES = ED_THEMES;
  window.ED_DEFAULT_CONFIG = ED_DEFAULT_CONFIG;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ED_DARK_THEME, ED_THEMES, ED_DEFAULT_CONFIG, DEFAULT_CONFIG: ED_DEFAULT_CONFIG };
}
