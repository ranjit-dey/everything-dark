/**
 * Everything Dark - Options & Dashboard Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  let config = null;

  // DOM Elements
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const toast = document.getElementById('toast');

  // Site Management Elements
  const radioFilterAll = document.getElementById('opt-filter-all');
  const radioFilterWhitelist = document.getElementById('opt-filter-whitelist');
  const labelFilterAll = document.getElementById('label-filter-all');
  const labelFilterWhitelist = document.getElementById('label-filter-whitelist');
  const badgeCurrentMode = document.getElementById('badge-current-mode');
  const inputNewDomain = document.getElementById('input-new-domain');
  const selectNewAction = document.getElementById('select-new-action');
  const btnAddSite = document.getElementById('btn-add-site');
  const siteRulesList = document.getElementById('site-rules-list');
  const inputSearchSites = document.getElementById('input-search-sites');
  const rulesCountBadge = document.getElementById('rules-count-badge');
  const presetChips = document.querySelectorAll('.preset-chip');

  // Display Controls Elements
  const slidersOpt = {
    brightness: {
      input: document.getElementById('opt-range-brightness'),
      label: document.getElementById('opt-val-brightness'),
      suffix: '%',
      default: 100
    },
    contrast: {
      input: document.getElementById('opt-range-contrast'),
      label: document.getElementById('opt-val-contrast'),
      suffix: '%',
      default: 100
    },
    sepia: {
      input: document.getElementById('opt-range-sepia'),
      label: document.getElementById('opt-val-sepia'),
      suffix: '%',
      default: 0
    },
    grayscale: {
      input: document.getElementById('opt-range-grayscale'),
      label: document.getElementById('opt-val-grayscale'),
      suffix: '%',
      default: 0
    },
    dimImages: {
      input: document.getElementById('opt-range-dimImages'),
      label: document.getElementById('opt-val-dimImages'),
      suffix: '%',
      default: 10
    }
  };
  const btnResetSlidersOpt = document.getElementById('btn-reset-sliders-opt');

  // Automation Elements
  const radioSystem = document.getElementById('radio-system');
  const radioTime = document.getElementById('radio-time');
  const radioOff = document.getElementById('radio-off');
  const timePickerWrapper = document.getElementById('time-picker-wrapper');
  const inputTimeStart = document.getElementById('input-time-start');
  const inputTimeEnd = document.getElementById('input-time-end');
  const btnSaveSchedule = document.getElementById('btn-save-schedule');

  // Backup Elements
  const btnExportJson = document.getElementById('btn-export-json');
  const btnTriggerImport = document.getElementById('btn-trigger-import');
  const fileImportJson = document.getElementById('file-import-json');
  const btnResetAll = document.getElementById('btn-reset-all');

  /**
   * Show notification toast
   */
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  /**
   * Load storage config
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
   * Save config and broadcast immediately to all open tabs
   */
  function saveConfig(toastMsg = 'Settings saved successfully') {
    chrome.storage.local.set(config, () => {
      showToast(toastMsg);
      // Real-time broadcast to open tabs
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        chrome.tabs.query({}, (tabs) => {
          if (!tabs) return;
          tabs.forEach((tab) => {
            if (tab && tab.id) {
              chrome.tabs.sendMessage(tab.id, {
                action: 'ED_UPDATE_SETTINGS',
                config
              }).catch(() => {});
            }
          });
        });
      }
    });
  }

  /**
   * Navigation Tabs Handling & Hash Routing
   */
  function switchTab(tabId) {
    navItems.forEach((item) => item.classList.toggle('active', item.dataset.tab === tabId));
    tabPanes.forEach((pane) => pane.classList.toggle('active', pane.id === `tab-content-${tabId}`));
  }

  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Switch tab if URL contains hash (e.g. options.html#sites), default to 'sites'
  const initialHash = window.location.hash ? window.location.hash.replace('#', '') : 'sites';
  if (document.getElementById(`tab-content-${initialHash}`)) {
    switchTab(initialHash);
  }

  /**
   * Domain Input Cleaner - Handles wildcards (*.domain.com), subdomains, protocols, and paths
   */
  function cleanDomainInput(input) {
    if (!input) return '';
    let str = input.trim().toLowerCase();
    // Remove protocol
    str = str.replace(/^(https?:\/\/|\/\/)/, '');
    // Remove port
    str = str.replace(/:\d+$/, '');
    // Remove path and query string
    str = str.replace(/[/?#].*$/, '');
    // Remove trailing dots
    str = str.replace(/\.+$/, '');
    return str;
  }

  /**
   * Add a site rule
   */
  function handleAddSite(rawDomain, action) {
    const cleaned = cleanDomainInput(rawDomain);
    if (!cleaned) {
      showToast('Please enter a valid website domain or pattern');
      return;
    }

    const isEnable = action === 'enable';
    config.siteRules[cleaned] = { enabled: isEnable };
    inputNewDomain.value = '';

    saveConfig(`Saved rule for "${cleaned}" (${isEnable ? 'Dark' : 'Light'})`);
    renderSiteRules();
  }

  /**
   * Render Site Rules Table & Filter Mode
   */
  function renderSiteRules() {
    const filterMode = config.urlFilterMode || 'all';
    if (filterMode === 'whitelist') {
      radioFilterWhitelist.checked = true;
      if (badgeCurrentMode) badgeCurrentMode.textContent = 'Whitelist Only Mode';
    } else {
      radioFilterAll.checked = true;
      if (badgeCurrentMode) badgeCurrentMode.textContent = 'All Websites Mode';
    }

    if (labelFilterAll) labelFilterAll.classList.toggle('active', filterMode === 'all');
    if (labelFilterWhitelist) labelFilterWhitelist.classList.toggle('active', filterMode === 'whitelist');

    siteRulesList.innerHTML = '';
    const rules = config.siteRules || {};
    let hosts = Object.keys(rules);

    // Apply search filter if present
    const searchTerm = inputSearchSites ? inputSearchSites.value.trim().toLowerCase() : '';
    if (searchTerm) {
      hosts = hosts.filter((h) => h.toLowerCase().includes(searchTerm));
    }

    const totalRules = Object.keys(rules).length;
    if (rulesCountBadge) {
      rulesCountBadge.textContent = `${totalRules} rule${totalRules === 1 ? '' : 's'}${searchTerm ? ` (${hosts.length} matching)` : ''}`;
    }

    if (hosts.length === 0) {
      if (searchTerm) {
        siteRulesList.innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 13px;">
            No URL filter rules matched "${searchTerm}".
          </div>
        `;
      } else if (filterMode === 'whitelist') {
        siteRulesList.innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 13px;">
            No whitelisted websites added yet. In this mode, dark theme is <strong>OFF</strong> on all websites until you add them above!
          </div>
        `;
      } else {
        siteRulesList.innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 13px;">
            No custom exclusions added. Dark theme is currently active on all websites.
          </div>
        `;
      }
      return;
    }

    hosts.forEach((domain) => {
      const rule = rules[domain];
      const isEnabled = typeof rule === 'object' ? !!rule.enabled : !!rule;

      const row = document.createElement('div');
      row.className = 'site-table-row';
      row.innerHTML = `
        <span class="domain-name">${domain}</span>
        <div>
          <span class="status-badge ${isEnabled ? 'enabled' : 'disabled'}">
            ${isEnabled ? 'Whitelisted / Dark' : 'Excluded / Light'}
          </span>
        </div>
        <div class="row-actions">
          <button class="rule-toggle-btn ${isEnabled ? 'toggle-disable' : 'toggle-enable'}" data-domain="${domain}">
            ${isEnabled ? 'Exclude (Light)' : 'Enable (Dark)'}
          </button>
          <button class="del-btn" data-domain="${domain}">Delete</button>
        </div>
      `;

      // Toggle button
      row.querySelector('.rule-toggle-btn').addEventListener('click', () => {
        config.siteRules[domain] = { enabled: !isEnabled };
        saveConfig(`Updated ${domain} to ${!isEnabled ? 'Dark' : 'Light'}`);
        renderSiteRules();
      });

      // Delete button
      row.querySelector('.del-btn').addEventListener('click', () => {
        delete config.siteRules[domain];
        saveConfig(`Removed rule for ${domain}`);
        renderSiteRules();
      });

      siteRulesList.appendChild(row);
    });
  }

  // Filter mode radio listeners
  radioFilterAll.addEventListener('change', () => {
    if (radioFilterAll.checked) {
      config.urlFilterMode = 'all';
      saveConfig('Filter mode set to: All Websites (Blacklist mode)');
      renderSiteRules();
    }
  });

  radioFilterWhitelist.addEventListener('change', () => {
    if (radioFilterWhitelist.checked) {
      config.urlFilterMode = 'whitelist';
      saveConfig('Filter mode set to: Specific Websites Only (Whitelist mode)');
      renderSiteRules();
    }
  });

  // Add site button
  btnAddSite.addEventListener('click', () => {
    handleAddSite(inputNewDomain.value, selectNewAction.value);
  });

  // Enter key in domain input
  inputNewDomain.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSite(inputNewDomain.value, selectNewAction.value);
    }
  });

  // Search filter input listener
  if (inputSearchSites) {
    inputSearchSites.addEventListener('input', () => {
      renderSiteRules();
    });
  }

  // Preset chips
  presetChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const domain = chip.dataset.domain;
      if (domain) {
        handleAddSite(domain, 'enable');
      }
    });
  });

  /**
   * Display Controls Tab
   */
  function renderDisplayControls() {
    // Revert Color (Invert Mode)
    const optRevertColor = document.getElementById('opt-revert-color');
    if (optRevertColor) {
      optRevertColor.checked = !!config.revertColor;
      optRevertColor.addEventListener('change', () => {
        config.revertColor = optRevertColor.checked;
        saveConfig(`Revert Color ${config.revertColor ? 'enabled' : 'disabled'}`);
      });
    }

    // Image Handling Mode
    const optImgWithout = document.getElementById('opt-img-without');
    const optImgWith = document.getElementById('opt-img-with');
    function updateOptImageTabs() {
      const processImages = !!config.processImages;
      if (optImgWithout) optImgWithout.classList.toggle('active', !processImages);
      if (optImgWith) optImgWith.classList.toggle('active', processImages);
    }
    updateOptImageTabs();

    if (optImgWithout) {
      optImgWithout.addEventListener('click', () => {
        config.processImages = false;
        updateOptImageTabs();
        saveConfig('Image mode: Without Images (Default)');
      });
    }
    if (optImgWith) {
      optImgWith.addEventListener('click', () => {
        config.processImages = true;
        updateOptImageTabs();
        saveConfig('Image mode: With Images');
      });
    }

    Object.keys(slidersOpt).forEach((key) => {
      const item = slidersOpt[key];
      if (!item.input) return;
      const val = config[key] !== undefined ? config[key] : item.default;
      item.input.value = val;
      if (item.label) item.label.textContent = `${val}${item.suffix}`;

      item.input.addEventListener('input', (e) => {
        const newVal = parseInt(e.target.value, 10);
        if (item.label) item.label.textContent = `${newVal}${item.suffix}`;
        config[key] = newVal;
        saveConfig(`Updated ${key} to ${newVal}${item.suffix}`);
      });
    });

    if (btnResetSlidersOpt) {
      btnResetSlidersOpt.addEventListener('click', () => {
        Object.keys(slidersOpt).forEach((key) => {
          const item = slidersOpt[key];
          config[key] = item.default;
          if (item.input) item.input.value = item.default;
          if (item.label) item.label.textContent = `${item.default}${item.suffix}`;
        });
        saveConfig('Display settings reset to defaults');
      });
    }
  }

  /**
   * Schedule Settings
   */
  function renderSchedule() {
    const mode = config.autoSchedule || 'off';
    radioSystem.checked = mode === 'system';
    radioTime.checked = mode === 'time';
    radioOff.checked = mode === 'off';

    inputTimeStart.value = config.scheduleStart || '20:00';
    inputTimeEnd.value = config.scheduleEnd || '07:00';

    timePickerWrapper.style.opacity = mode === 'time' ? '1' : '0.4';
    timePickerWrapper.style.pointerEvents = mode === 'time' ? 'auto' : 'none';
  }

  document.querySelectorAll('input[name="schedule-mode"]').forEach((r) => {
    r.addEventListener('change', () => {
      timePickerWrapper.style.opacity = radioTime.checked ? '1' : '0.4';
      timePickerWrapper.style.pointerEvents = radioTime.checked ? 'auto' : 'none';
    });
  });

  btnSaveSchedule.addEventListener('click', () => {
    let selectedMode = 'off';
    if (radioSystem.checked) selectedMode = 'system';
    if (radioTime.checked) selectedMode = 'time';

    config.autoSchedule = selectedMode;
    config.scheduleStart = inputTimeStart.value;
    config.scheduleEnd = inputTimeEnd.value;

    saveConfig('Schedule preferences updated');
  });

  /**
   * Backup & Export
   */
  btnExportJson.addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(config, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `everything-dark-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Configuration exported');
  });

  btnTriggerImport.addEventListener('click', () => {
    fileImportJson.click();
  });

  fileImportJson.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (typeof parsed === 'object' && parsed !== null) {
          config = Object.assign({}, ED_DEFAULT_CONFIG, parsed);
          saveConfig('Settings successfully imported!');
          renderSiteRules();
          renderDisplayControls();
          renderSchedule();
        }
      } catch (err) {
        showToast('Invalid JSON file format');
      }
    };
    reader.readAsText(file);
  });

  btnResetAll.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all Everything Dark settings and site rules to initial defaults?')) {
      config = Object.assign({}, ED_DEFAULT_CONFIG);
      saveConfig('All settings reset to defaults');
      renderSiteRules();
      renderDisplayControls();
      renderSchedule();
    }
  });

  // Initialization
  await loadConfig();
  renderSiteRules();
  renderDisplayControls();
  renderSchedule();
});
