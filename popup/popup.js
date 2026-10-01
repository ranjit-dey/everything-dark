/**
 * Everything Dark - Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  let currentTab = null;
  let currentHost = '';
  let config = null;

  // UI Elements
  const masterToggle = document.getElementById('master-toggle');
  const btnFilterAll = document.getElementById('btn-filter-all');
  const btnFilterWhitelist = document.getElementById('btn-filter-whitelist');
  const currentHostEl = document.getElementById('current-host');
  const siteDot = document.getElementById('site-status-dot');
  const siteStateLabel = document.getElementById('site-state-label');
  const siteToggleBtn = document.getElementById('site-toggle-btn');
  const tabSmart = document.getElementById('tab-smart');
  const tabInvert = document.getElementById('tab-invert');
  const toggleRevertColor = document.getElementById('toggle-revert-color');
  const btnImgWithout = document.getElementById('btn-img-without');
  const btnImgWith = document.getElementById('btn-img-with');
  const imageModeBadge = document.getElementById('image-mode-badge');
  const selectSchedule = document.getElementById('select-schedule');
  const btnResetSliders = document.getElementById('btn-reset-sliders');
  const btnOpenOptions = document.getElementById('btn-open-options');

  // Sliders & Values
  const sliders = {
    brightness: {
      input: document.getElementById('range-brightness'),
      label: document.getElementById('val-brightness'),
      suffix: '%',
      default: 100
    },
    contrast: {
      input: document.getElementById('range-contrast'),
      label: document.getElementById('val-contrast'),
      suffix: '%',
      default: 100
    },
    sepia: {
      input: document.getElementById('range-sepia'),
      label: document.getElementById('val-sepia'),
      suffix: '%',
      default: 0
    },
    grayscale: {
      input: document.getElementById('range-grayscale'),
      label: document.getElementById('val-grayscale'),
      suffix: '%',
      default: 0
    },
    dimImages: {
      input: document.getElementById('range-dimImages'),
      label: document.getElementById('val-dimImages'),
      suffix: '%',
      default: 10
    }
  };

  /**
   * Get active tab and hostname
   */
  async function resolveActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
          currentTab = tabs[0];
          try {
            const url = new URL(currentTab.url);
            if (url.protocol.startsWith('http')) {
              currentHost = url.hostname.toLowerCase();
            } else if (url.protocol === 'file:') {
              currentHost = 'Local File';
            } else {
              currentHost = url.protocol.replace(':', '');
            }
          } catch (e) {
            currentHost = 'System Page';
          }
        } else {
          currentHost = 'Unknown';
        }
        resolve();
      });
    });
  }

  /**
   * Load stored settings
   */
  async function loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (stored) => {
        const defaults = (typeof ED_DEFAULT_CONFIG !== 'undefined' ? ED_DEFAULT_CONFIG : (window.ED_DEFAULT_CONFIG || globalThis.ED_DEFAULT_CONFIG || {}));
        config = Object.assign({}, defaults, stored);
        if (!config.siteRules) config.siteRules = {};
        resolve();
      });
    });
  }

  /**
   * Save config and broadcast to active tab
   */
  function saveConfig() {
    chrome.storage.local.set(config, () => {
      notifyActiveTab();
    });
  }

  /**
   * Send realtime message to active tab
   */
  function notifyActiveTab() {
    if (!currentTab || !currentTab.id) return;
    chrome.tabs.sendMessage(currentTab.id, {
      action: 'ED_UPDATE_SETTINGS',
      config
    }).catch(() => {
      // Ignored if tab cannot receive message
    });
  }

  /**
   * Safe lookup for host rule checking exact host, parent domains, and wildcards
   */
  function getRuleForHost(host) {
    if (!config || !config.siteRules) return null;
    const rules = config.siteRules;
    if (rules[host] !== undefined) return rules[host];

    const parts = host.split('.');
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(i).join('.');
      if (rules[parent] !== undefined) return rules[parent];
      const wildcard = '*.' + parent;
      if (rules[wildcard] !== undefined) return rules[wildcard];
    }
    return null;
  }

  /**
   * Update Filter Mode Tabs UI
   */
  function updateFilterTabs() {
    const mode = config.urlFilterMode || 'all';
    btnFilterAll.classList.toggle('active', mode === 'all');
    btnFilterWhitelist.classList.toggle('active', mode === 'whitelist');

    const badge = document.getElementById('filter-mode-badge');
    const hint = document.getElementById('filter-mode-hint');
    if (mode === 'whitelist') {
      if (badge) badge.textContent = 'Whitelist Only';
      if (hint) hint.innerHTML = '🛡️ Safe mode: Dark theme is <strong>OFF</strong> everywhere except whitelisted sites.';
    } else {
      if (badge) badge.textContent = 'All Websites';
      if (hint) hint.innerHTML = '🌐 Dark theme runs on <strong>all websites</strong> except excluded sites.';
    }
  }

  /**
   * Check if current site is enabled
   */
  function isCurrentSiteEnabled() {
    if (!config.enabled) return false;
    const filterMode = config.urlFilterMode || 'all';
    const rule = getRuleForHost(currentHost);

    if (filterMode === 'whitelist') {
      return rule ? !!rule.enabled : false;
    } else {
      return rule ? !!rule.enabled : true;
    }
  }

  /**
   * Update Site Card UI
   */
  function updateSiteCard() {
    currentHostEl.textContent = currentHost;

    const isInternal = currentHost === 'System Page' || currentHost.startsWith('chrome');
    if (isInternal) {
      siteDot.className = 'site-dot disabled';
      siteStateLabel.textContent = 'Protected Browser Page';
      siteToggleBtn.disabled = true;
      siteToggleBtn.style.opacity = '0.5';
      siteToggleBtn.textContent = 'Restricted';
      return;
    }

    const filterMode = config.urlFilterMode || 'all';
    const enabled = isCurrentSiteEnabled();

    if (filterMode === 'whitelist') {
      if (enabled) {
        siteDot.className = 'site-dot';
        siteStateLabel.textContent = 'Dark theme active (Whitelisted)';
        siteToggleBtn.textContent = 'Remove Site';
        siteToggleBtn.className = 'site-toggle-btn btn-disable';
      } else {
        siteDot.className = 'site-dot disabled';
        siteStateLabel.textContent = 'Light theme (Not in Whitelist)';
        siteToggleBtn.textContent = '+ Enable for this site';
        siteToggleBtn.className = 'site-toggle-btn btn-enable';
      }
    } else {
      if (enabled) {
        siteDot.className = 'site-dot';
        siteStateLabel.textContent = 'Active on all websites';
        siteToggleBtn.textContent = 'Exclude Site';
        siteToggleBtn.className = 'site-toggle-btn btn-disable';
      } else {
        siteDot.className = 'site-dot disabled';
        siteStateLabel.textContent = 'Excluded (Normal light theme)';
        siteToggleBtn.textContent = 'Enable Site';
        siteToggleBtn.className = 'site-toggle-btn btn-enable';
      }
    }
  }

  /**
   * Update Engine Mode Tabs UI
   */
  function updateEngineTabs() {
    const mode = config.engineMode || 'smart';
    tabSmart.classList.toggle('active', mode === 'smart');
    tabInvert.classList.toggle('active', mode === 'invert');
  }

  /**
   * Update Color Options UI (Revert Color & Image Mode)
   */
  function updateColorOptions() {
    if (toggleRevertColor) {
      toggleRevertColor.checked = !!config.revertColor;
    }
    const processImages = !!config.processImages;
    if (btnImgWithout) {
      btnImgWithout.classList.toggle('active', !processImages);
    }
    if (btnImgWith) {
      btnImgWith.classList.toggle('active', processImages);
    }
    if (imageModeBadge) {
      imageModeBadge.textContent = processImages ? 'With Images' : 'Without Images';
    }
  }

  /**
   * Update Sliders UI
   */
  function updateSliders() {
    Object.keys(sliders).forEach((key) => {
      const item = sliders[key];
      const val = config[key] !== undefined ? config[key] : item.default;
      item.input.value = val;
      item.label.textContent = `${val}${item.suffix}`;
    });
  }

  /**
   * Attach Event Listeners
   */
  function attachListeners() {
    // Master switch
    masterToggle.checked = !!config.enabled;
    masterToggle.addEventListener('change', () => {
      config.enabled = masterToggle.checked;
      updateSiteCard();
      saveConfig();
    });

    // Filter mode tabs
    btnFilterAll.addEventListener('click', () => {
      config.urlFilterMode = 'all';
      updateFilterTabs();
      updateSiteCard();
      saveConfig();
    });

    btnFilterWhitelist.addEventListener('click', () => {
      config.urlFilterMode = 'whitelist';
      updateFilterTabs();
      updateSiteCard();
      saveConfig();
    });

    // Site toggle
    siteToggleBtn.addEventListener('click', () => {
      if (currentHost === 'System Page' || currentHost.startsWith('chrome')) return;
      const currentState = isCurrentSiteEnabled();
      const nextState = !currentState;

      config.siteRules[currentHost] = {
        enabled: nextState
      };

      updateSiteCard();
      saveConfig();
    });

    // Mode tabs
    tabSmart.addEventListener('click', () => {
      config.engineMode = 'smart';
      updateEngineTabs();
      saveConfig();
    });

    tabInvert.addEventListener('click', () => {
      config.engineMode = 'invert';
      updateEngineTabs();
      saveConfig();
    });

    // Revert Color switch
    if (toggleRevertColor) {
      toggleRevertColor.addEventListener('change', () => {
        config.revertColor = toggleRevertColor.checked;
        saveConfig();
      });
    }

    // Image Mode tabs
    if (btnImgWithout) {
      btnImgWithout.addEventListener('click', () => {
        config.processImages = false;
        updateColorOptions();
        saveConfig();
      });
    }
    if (btnImgWith) {
      btnImgWith.addEventListener('click', () => {
        config.processImages = true;
        updateColorOptions();
        saveConfig();
      });
    }

    // Sliders
    Object.keys(sliders).forEach((key) => {
      const item = sliders[key];
      item.input.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        item.label.textContent = `${val}${item.suffix}`;
        config[key] = val;
        saveConfig();
      });
    });

    // Reset sliders
    btnResetSliders.addEventListener('click', () => {
      Object.keys(sliders).forEach((key) => {
        const item = sliders[key];
        config[key] = item.default;
      });
      updateSliders();
      saveConfig();
    });

    // Schedule
    selectSchedule.value = config.autoSchedule || 'off';
    selectSchedule.addEventListener('change', (e) => {
      config.autoSchedule = e.target.value;
      saveConfig();
    });

    // Options link
    btnOpenOptions.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // Direct link to URL Filters in Options
    const btnManageFilters = document.getElementById('btn-manage-filters');
    if (btnManageFilters) {
      btnManageFilters.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#sites') });
      });
    }
  }

  // Initialize
  await resolveActiveTab();
  await loadConfig();
  updateFilterTabs();
  updateEngineTabs();
  updateColorOptions();
  updateSliders();
  updateSiteCard();
  attachListeners();
});
