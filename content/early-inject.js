/**
 * Everything Dark - Early Inject (Flash-of-White-Prevention)
 * Runs at document_start before DOM is parsed.
 */
(function() {
  if (window.top === window && !document.documentElement) {
    return;
  }

  const hostname = window.location.hostname.toLowerCase();
  // Don't inject on internal browser pages
  if (!hostname || hostname === '' || window.location.protocol === 'chrome-extension:' || window.location.protocol === 'chrome:') {
    return;
  }

  // Create temporary cloak style to suppress blinding white background during navigation
  const earlyStyle = document.createElement('style');
  earlyStyle.id = 'everything-dark-early-cloak';
  earlyStyle.textContent = `
    html {
      background-color: #121316 !important;
      color: #e2e4e9 !important;
    }
  `;

  // Try appending to documentElement as early as physically possible
  const target = document.head || document.documentElement;
  if (target) {
    target.appendChild(earlyStyle);
  } else {
    const observer = new MutationObserver(() => {
      const el = document.head || document.documentElement;
      if (el) {
        el.appendChild(earlyStyle);
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true });
  }

  // Check URL filter mode & site rules as early as possible
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['enabled', 'urlFilterMode', 'siteRules'], (data) => {
      if (!data) return;
      if (data.enabled === false) {
        earlyStyle.remove();
        return;
      }
      if (data.urlFilterMode === 'whitelist') {
        const rules = data.siteRules || {};
        let whitelisted = false;
        if (rules[hostname] && rules[hostname].enabled) whitelisted = true;
        if (!whitelisted) {
          const parts = hostname.split('.');
          for (let i = 1; i < parts.length; i++) {
            const p = parts.slice(i).join('.');
            if ((rules[p] && rules[p].enabled) || (rules['*.' + p] && rules['*.' + p].enabled)) {
              whitelisted = true;
              break;
            }
          }
        }
        if (!whitelisted) {
          earlyStyle.remove();
        }
      } else if (data.siteRules) {
        const rules = data.siteRules || {};
        let excluded = false;
        if (rules[hostname] && rules[hostname].enabled === false) {
          excluded = true;
        } else {
          const parts = hostname.split('.');
          for (let i = 1; i < parts.length; i++) {
            const p = parts.slice(i).join('.');
            if ((rules[p] && rules[p].enabled === false) || (rules['*.' + p] && rules['*.' + p].enabled === false)) {
              excluded = true;
              break;
            }
          }
        }
        if (excluded) {
          earlyStyle.remove();
        }
      }
    });
  }
})();
