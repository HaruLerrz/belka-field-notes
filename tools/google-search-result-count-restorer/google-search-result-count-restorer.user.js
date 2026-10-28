// ==UserScript==
// @name         Google 搜尋結果數量還原
// @namespace    https://haruz.art/
// @version      1.7.0
// @description  將 Google「工具」中的搜尋結果預估數量顯示回搜尋結果上方。
// @match        https://www.google.com/search*
// @match        https://www.google.com.tw/search*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const BANNER_ID = 'haruz-search-result-count';
  const STYLE_ID = 'haruz-search-result-count-style';
  const ACTIVE_CLASS = 'haruz-search-count-active';
  const RESULT_SELECTOR = '#result-stats';
  const NEAR_NAV_CLASS = 'haruz-result-count-near-nav';

  let trackedURL = '';
  let cachedResultText = '';
  let attemptedRevealURL = '';
  let scanTimer = 0;
  let revealTimer = 0;
  let scheduledRevealURL = '';
  let hiddenNativeContainer = null;
  let hiddenNativeDisplay = '';
  let hiddenNativePriority = '';
  let adjustedDivider = null;
  let dividerOriginal = null;

  function isStandardSearch() {
    const url = new URL(location.href);
    if (url.pathname !== '/search' || !url.searchParams.has('q')) return false;
    if (url.searchParams.has('tbm')) return false;
    const udm = url.searchParams.get('udm');
    return !udm || udm === '14';
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BANNER_ID} {
        display: block;
        box-sizing: border-box;
        color: #70757a;
        font-family: Arial, sans-serif;
        font-size: 13px;
        font-weight: 400;
        line-height: 20px;
        /* 以 AI 內容區塊後方為基準；靠近導覽列時另做小幅修正。 */
        margin: -24px 0 12px;
        padding: 0;
        max-width: 100%;
        overflow-wrap: anywhere;
      }
      /* 一般搜尋沒有 AI 區塊，校正導覽列與數字間的額外留白。 */
      #${BANNER_ID}.${NEAR_NAV_CLASS} {
        margin-top: -31px;
      }
      /* 原生數字本體仍隱藏，避免重複顯示。 */
      html.${ACTIVE_CLASS} #result-stats {
        display: none !important;
      }
      @media (prefers-color-scheme: dark) {
        #${BANNER_ID} { color: #bdc1c6; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function normalizeText(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  function findResultText() {
    const source = document.querySelector(RESULT_SELECTOR);
    if (!source) return '';
    const value = normalizeText(source.textContent || '');
    const resultPattern = /\d[\d\s,，.]*\s*(?:項結果|个结果|筆結果|results?|件の結果)/i;
    return resultPattern.test(value) ? value : '';
  }

  function restoreNativeContainer() {
    if (!hiddenNativeContainer) return;
    if (hiddenNativeContainer.isConnected) {
      hiddenNativeContainer.style.setProperty('display', hiddenNativeDisplay, hiddenNativePriority);
    }
    hiddenNativeContainer = null;
    hiddenNativeDisplay = '';
    hiddenNativePriority = '';
  }

  function restoreNativeDivider() {
    if (adjustedDivider && adjustedDivider.isConnected && dividerOriginal) {
      // 還原本頁面原本的行內樣式；不影響 Google 自己的樣式表。
      for (const [name, { value, priority }] of Object.entries(dividerOriginal)) {
        if (value) adjustedDivider.style.setProperty(name, value, priority);
        else adjustedDivider.style.removeProperty(name);
      }
    }
    adjustedDivider = null;
    dividerOriginal = null;
  }

  function syncNativeDividerAppearance() {
    if (!cachedResultText || !isStandardSearch()) {
      restoreNativeDivider();
      return;
    }

    const source = document.querySelector(RESULT_SELECTOR);
    // 以固定的 #result-stats 為錨點，定位緊鄰其父層前面的「空白分隔 div」。
    // Google 的混淆 class 可能隨時改變，這裡不依賴 btC0Fd / XYRUl。
    const previous = source?.parentElement?.previousElementSibling;
    const target = previous instanceof HTMLDivElement &&
                   !previous.children.length && !normalizeText(previous.textContent)
      ? previous
      : null;

    if (adjustedDivider && adjustedDivider !== target) restoreNativeDivider();
    if (!target) return;
    if (adjustedDivider !== target) {
      adjustedDivider = target;
      dividerOriginal = Object.fromEntries(['margin', 'border-top'].map((name) => [
        name,
        {
          value: target.style.getPropertyValue(name),
          priority: target.style.getPropertyPriority(name)
        }
      ]));
    }

    // 對應 Firefox 檢測器實測：同時取消 margin: 8px 0 與 border-top: 1px。
    // 保留該節點及選單其他樣式，避免產生隱藏整個容器的副作用。
    if (target.style.getPropertyValue('margin') !== '0px' ||
        target.style.getPropertyPriority('margin') !== 'important') {
      target.style.setProperty('margin', '0', 'important');
    }
    if (target.style.getPropertyValue('border-top') !== 'none' ||
        target.style.getPropertyPriority('border-top') !== 'important') {
      target.style.setProperty('border-top', 'none', 'important');
    }
  }

  function syncBannerSpacing(banner) {
    const toolsButton = findToolsButton();
    if (!toolsButton) {
      banner.classList.remove(NEAR_NAV_CLASS);
      return;
    }
    const navBottom = toolsButton.getBoundingClientRect().bottom;
    const bannerTop = banner.getBoundingClientRect().top;
    // 無 AI 區塊時，數字緊鄰搜尋導覽列；有 AI 區塊時距離大得多。
    // 以當前實際位置判斷，避免依賴 AI 摘要的文字或頻繁改動的 class。
    const nearNavigation = navBottom > 0 && (bannerTop - navBottom) < 65;
    banner.classList.toggle(NEAR_NAV_CLASS, nearNavigation);
  }

  function findNativeContainer(source) {
    if (!source || !source.isConnected) return null;
    const sourceText = normalizeText(source.textContent);
    if (!sourceText) return null;

    // 由內向外找「整個內容只有結果數量」的最外層容器。
    // v1.3 只藏第一個父層，導致分隔線及空白頁腳仍留在工具選單內。
    // 這次持續向上檢查，直到碰到其他選項、互動元素或整個選單為止。
    let candidate = source;
    let best = source;
    for (let depth = 0; candidate && candidate !== document.body && depth < 12; depth += 1) {
      if (candidate !== source && candidate.matches('#hdtbMenus, [role="menu"], g-menu')) break;
      if (normalizeText(candidate.textContent) !== sourceText) break;
      if (candidate.querySelector('button, a, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], g-menu-item')) break;
      const rect = candidate.getBoundingClientRect();
      if (rect.height > 110 || rect.width > 650) break;
      best = candidate;
      candidate = candidate.parentElement;
    }
    return best;
  }

  function syncNativeContainerVisibility() {
    if (!cachedResultText || !isStandardSearch()) {
      restoreNativeContainer();
      return;
    }

    const source = document.querySelector(RESULT_SELECTOR);
    if (!source) {
      restoreNativeContainer();
      return;
    }

    const target = findNativeContainer(source);
    if (!target) {
      restoreNativeContainer();
      return;
    }

    if (hiddenNativeContainer && hiddenNativeContainer !== target) {
      restoreNativeContainer();
    }

    if (hiddenNativeContainer !== target) {
      hiddenNativeContainer = target;
      hiddenNativeDisplay = target.style.getPropertyValue('display');
      hiddenNativePriority = target.style.getPropertyPriority('display');
    }

    if (target.style.getPropertyValue('display') !== 'none' ||
        target.style.getPropertyPriority('display') !== 'important') {
      target.style.setProperty('display', 'none', 'important');
    }
  }

  function renderBanner() {
    let banner = document.getElementById(BANNER_ID);
    if (!cachedResultText || !isStandardSearch()) {
      document.documentElement.classList.remove(ACTIVE_CLASS);
      restoreNativeContainer();
      restoreNativeDivider();
      if (banner) banner.remove();
      return;
    }

    const anchor = document.querySelector('#rso') ||
                   document.querySelector('#center_col') ||
                   document.querySelector('#search');
    if (!anchor) {
      document.documentElement.classList.remove(ACTIVE_CLASS);
      restoreNativeContainer();
      restoreNativeDivider();
      return;
    }

    if (!banner) {
      ensureStyle();
      banner = document.createElement('div');
      banner.id = BANNER_ID;
      banner.setAttribute('aria-label', 'Google 搜尋結果數量');
    }
    if (banner.textContent !== cachedResultText) banner.textContent = cachedResultText;

    if (anchor.id === 'rso' && anchor.parentNode) {
      if (banner.parentNode !== anchor.parentNode || banner.nextSibling !== anchor) {
        anchor.parentNode.insertBefore(banner, anchor);
      }
    } else if (banner.parentNode !== anchor || anchor.firstChild !== banner) {
      anchor.insertBefore(banner, anchor.firstChild);
    }

    document.documentElement.classList.add(ACTIVE_CLASS);
    syncNativeContainerVisibility();
    syncNativeDividerAppearance();
    syncBannerSpacing(banner);
  }

  function findToolsButton() {
    const known = document.getElementById('hdtb-tls');
    if (known) return known;
    return Array.from(document.querySelectorAll('button, [role="button"]'))
      .find((node) => {
        const label = (node.getAttribute('aria-label') || node.textContent || '').trim();
        return /^(?:工具|Tools)$/i.test(label) &&
          Boolean(node.closest('#hdtb, #appbar, #searchform, [role="navigation"]'));
      }) || null;
  }

  function autoRevealOnce(urlAtStart) {
    if (location.href !== urlAtStart || cachedResultText || !isStandardSearch()) return;
    if (attemptedRevealURL === urlAtStart) return;
    const button = findToolsButton();
    if (!button || !button.isConnected) return;
    attemptedRevealURL = urlAtStart;

    if (button.getAttribute('aria-expanded') === 'true') return;

    let userInteracted = false;
    function detectUserAction(event) {
      if (event.isTrusted && (event.target === button || button.contains(event.target))) {
        userInteracted = true;
      }
    }
    document.addEventListener('click', detectUserAction, true);
    button.click();

    window.setTimeout(() => {
      document.removeEventListener('click', detectUserAction, true);
      if (location.href !== urlAtStart) return;
      const result = findResultText();
      if (result) cachedResultText = result;
      renderBanner();
      if (!userInteracted && button.isConnected) {
        if (button.getAttribute('aria-expanded') === 'true') button.click();
      }
    }, 700);
  }

  function scan() {
    const currentURL = location.href;
    if (currentURL !== trackedURL) {
      trackedURL = currentURL;
      cachedResultText = '';
      attemptedRevealURL = '';
      restoreNativeContainer();
      restoreNativeDivider();
      if (revealTimer) window.clearTimeout(revealTimer);
      scheduledRevealURL = '';
    }
    const result = isStandardSearch() ? findResultText() : '';
    if (result) cachedResultText = result;
    renderBanner();

    if (isStandardSearch() && !cachedResultText &&
        attemptedRevealURL !== currentURL && scheduledRevealURL !== currentURL) {
      scheduledRevealURL = currentURL;
      revealTimer = window.setTimeout(() => {
        if (location.href !== currentURL) return;
        scheduledRevealURL = '';
        autoRevealOnce(currentURL);
      }, 1000);
    }
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = window.setTimeout(() => {
      scanTimer = 0;
      scan();
    }, 120);
  }

  scan();
  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
  window.addEventListener('popstate', scheduleScan);
  window.addEventListener('pageshow', scheduleScan);
})();
