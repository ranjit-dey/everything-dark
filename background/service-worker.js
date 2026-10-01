/**
 * Everything Dark - Background Service Worker (Manifest V3)
 */

importScripts('../content/themes-config.js');

// Safely resolve default configuration in any worker scope
function getDefaultConfig() {
  if (typeof ED_DEFAULT_CONFIG !== 'undefined') return ED_DEFAULT_CONFIG;
  if (typeof self !== 'undefined' && self.ED_DEFAULT_CONFIG) return self.ED_DEFAULT_CONFIG;
  if (typeof globalThis !== 'undefined' && globalThis.ED_DEFAULT_CONFIG) return globalThis.ED_DEFAULT_CONFIG;
  return {
    enabled: true,
    theme: 'classic',
    engineMode: 'smart',
    brightness: 100,
    contrast: 100,
    sepia: 0,
    grayscale: 0,
    dimImages: 10,
    protectImages: true,
    autoSchedule: 'off',
    siteRules: {}
  };
}

// Initialize settings on installation
chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.get(null, (existing) => {
    const config = Object.assign({}, getDefaultConfig(), existing);
    chrome.storage.local.set(config, () => {
      updateBadge(config.enabled);
    });
  });

  // Create context menus
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'ed-toggle-site',
      title: 'Toggle Dark Theme for this site',
      contexts: ['page', 'action']
    });
    chrome.contextMenus.create({
      id: 'ed-open-options',
      title: 'Theme & Site Settings...',
      contexts: ['action']
    });
  });
});

// Update badge state
function updateBadge(enabled) {
  if (enabled) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#6b7280' });
  }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ed-open-options') {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (info.menuItemId === 'ed-toggle-site' && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'ED_TOGGLE_SITE' }, (response) => {
      if (chrome.runtime.lastError) {
        // Tab might not have script injected (e.g. chrome://)
        return;
      }
    });
  }
});

// Handle keyboard shortcuts (e.g. Alt+Shift+D)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-dark-mode') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id) return;

      chrome.tabs.sendMessage(activeTab.id, { action: 'ED_TOGGLE_SITE' }, (res) => {
        if (chrome.runtime.lastError) {
          // If content script not responding, toggle global setting
          chrome.storage.local.get(['enabled'], (data) => {
            const next = !data.enabled;
            chrome.storage.local.set({ enabled: next }, () => {
              updateBadge(next);
            });
          });
        }
      });
    });
  }
});

// Listen to storage changes and notify all tabs
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    chrome.storage.local.get(null, (fullConfig) => {
      if (changes.enabled) {
        updateBadge(fullConfig.enabled);
      }
      // Broadcast update to all tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'ED_UPDATE_SETTINGS',
              config: fullConfig
            }).catch(() => {
              // Ignore tabs without content script
            });
          }
        });
      });
    });
  }
});
