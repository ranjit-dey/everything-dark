# 🌒 Everything Dark - Universal Dark Theme Extension

A smart, high-performance browser extension (Manifest V3) that transforms any white or light-themed website into a comfortable, high-contrast dark theme.

Built around a **single, expertly calibrated master dark theme** (`#121316` slate charcoal) designed to maximize readability and eliminate eye strain without degrading brand identity or status pills.

---

## ✨ Key Features

- **🌙 Master Calibrated Dark Theme**:
  - Precision background (`#121316`), elevated surfaces (`#1a1c20`), and crisp high-contrast text (`#f3f4f6`).
  - Zero eye strain, zero OLED smearing, and pristine WCAG AAA contrast ratio.

- **🎯 Semantic Color & Pill Preservation**:
  - Preserves intentional brand and status colors (saturation &ge; 18%) such as yellow task pills (`K&A Chat Bot`), red alerts (`Stat (Hindi)`), orange badges (`Vikaram solar`), green statuses, and active indicators.
  - Automatically calculates luminance to guarantee readable text: dark text on light yellow backgrounds, white text on red/green backgrounds.

- **🛡️ URL Filter Modes & Site Whitelist**:
  - **All Websites (Blacklist Mode)**: Active everywhere by default with custom domain exclusions.
  - **Specific Sites Only (Whitelist Mode)**: Completely disabled by default everywhere, only turns on for domains you explicitly whitelist.
  - One-click site addition, wildcard support (`*.domain.com`), and domain cleaner.

- **📬 Complex Web App Support (Gmail & Google Chat)**:
  - Custom rules for Gmail (`mail.google.com`) and Google Chat (`chat.google.com`) handling top search bars, sidebars, message threads, mentions, code blocks, reaction chips, and avatars.

- **⚡ Flash-Free Loading (Zero White Flash)**:
  - Injected at `document_start` before the DOM is parsed, eliminating the blinding white screen between page transitions.

- **🛡️ Media & Artwork Protection**:
  - Automatically shields images (`img`), videos (`video`), canvases (`canvas`), vector graphics (`svg`), and avatars from being inverted or degraded into negative film.
  - Optional slider to dim glaring bright images slightly for night comfort.

- **🎛️ Dual Transformation Engines**:
  - **Smart Dynamic Recolor (Default)**: Intelligently recolors page elements, typography, tables, buttons, inputs, and borders with custom CSS properties.
  - **Invert Filter Mode**: Hardware-accelerated CSS filter inversion with smart media re-inversion.

- **🎚️ Fine-Tuning Sliders**:
  - Brightness (60% – 140%)
  - Contrast (60% – 140%)
  - Sepia Warmth (0% – 100%)
  - Grayscale (0% – 100%)
  - Dim Glaring Images (0% – 50%)

- **⏰ Automation & Scheduling**:
  - **Sync with OS**: Matches your operating system's light/dark mode preference.
  - **Time Schedule**: Automatically turns on at night (e.g., 8:00 PM to 7:00 AM).
  - **Always On**: Keeps dark mode active 24/7.

- **⌨️ Keyboard Shortcut**:
  - Press <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd> (or <kbd>Option</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd> on Mac) to toggle dark theme on the active site instantly.

- **💾 Backup & Export**:
  - Export your URL filter rules and display settings to a `.json` file and restore them across browsers.

---

## 🚀 How to Install & Load in Your Browser

This extension works directly on all Chromium-based browsers (**Google Chrome, Brave, Microsoft Edge, Opera, Vivaldi, Arc**) and Firefox supporting Manifest V3.

### Chrome / Brave / Edge / Arc:

1. Open your browser and navigate to the Extensions page:
   - **Chrome / Brave**: `chrome://extensions/`
   - **Microsoft Edge**: `edge://extensions/`
2. Enable **Developer Mode** (toggle switch in the top-right corner).
3. Click the **"Load unpacked"** button.
4. Select the `everything-dark` folder:
   ```
   /Users/ranjitdey/Dev/everything-dark
   ```
5. The **Everything Dark** icon (`🌒`) will now appear in your browser toolbar!
6. Click the extension icon in the toolbar (or pin it) to open the popup.

---

## 🧪 Testing the Extension

A sample demonstration page is included to test all features:
1. Open [`test/test-page.html`](file:///Users/ranjitdey/Dev/everything-dark/test/test-page.html) in your browser.
2. The page includes:
   - Status badge and task pill verification (yellow, red, orange, green)
   - Gmail search bar and message rows simulation
   - Google Chat message bubble, mention tags, and code blocks
   - Form inputs, textareas, dropdowns, and buttons
   - Data tables and responsive cards
   - In-page live theme test controls

---

## 📁 Project Structure

```
everything-dark/
├── manifest.json              # Manifest V3 extension configuration
├── icons/                     # Crisp icons (16, 32, 48, 128px + SVG)
├── content/
│   ├── themes-config.js       # Master single dark theme definition & default settings
│   ├── early-inject.js        # Instant flash-of-white cloak (document_start)
│   └── dark-engine.js         # Core smart recolor, pill preservation, & Gmail/Chat rules
├── background/
│   └── service-worker.js      # Background service worker (shortcuts, badges, menus)
├── popup/                     # Clean, compact popup UI (URL filter tabs & sliders)
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/                   # Settings dashboard (URL filters, display sliders, backup)
│   ├── options.html
│   ├── options.css
│   └── options.js
├── test/                      # Test suite and demo page
│   ├── test-page.html
│   └── test-style.css
├── prd.md                     # Product requirements document
└── README.md
```
