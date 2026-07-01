// ==UserScript==
// @name         ChatGPT Hide Codex Promo Card SAFE
// @namespace    https://haruz.art/
// @version      0.3.0
// @description  Hide the full "認識 Codex" promo card in ChatGPT web UI.
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const DISABLE_KEY = 'haruz_codex_promo_hider_disabled';

  // 緊急停止：Ctrl + Alt + C
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'c') {
      localStorage.setItem(DISABLE_KEY, '1');
      location.reload();
    }
  });

  if (localStorage.getItem(DISABLE_KEY) === '1') return;

  const TITLE = '認識 Codex';

  const EXTRA_KEYWORDS = [
    'Codex 幫你找出問題',
    '下載應用程式',
    '深入瞭解'
  ];

  function getText(el) {
    return (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function isDangerousElement(el) {
    if (!el || el.nodeType !== 1) return true;

    const tag = el.tagName?.toLowerCase();

    if (
      tag === 'html' ||
      tag === 'body' ||
      tag === 'main' ||
      tag === 'form'
    ) {
      return true;
    }

    if (
      el.id === '__next' ||
      el.id === 'root'
    ) {
      return true;
    }

    if (
      el.querySelector('textarea') ||
      el.querySelector('[contenteditable="true"]') ||
      el.querySelector('input:not([type="button"]):not([type="submit"])')
    ) {
      return true;
    }

    return false;
  }

  function looksLikePromoCard(el) {
    if (isDangerousElement(el)) return false;

    const text = getText(el);
    if (!text.includes(TITLE)) return false;

    const hitCount = EXTRA_KEYWORDS.filter((k) => text.includes(k)).length;
    if (hitCount < 2) return false;

    const rect = el.getBoundingClientRect();

    // 放寬高度，讓它能抓到完整外框；仍避開整個對話區
    if (rect.width < 280 || rect.width > 1000) return false;
    if (rect.height < 50 || rect.height > 260) return false;

    return true;
  }

  function hideCardFromTextNode(textNode) {
    let el = textNode.parentElement;
    const candidates = [];

    for (let depth = 0; el && depth < 12; depth += 1, el = el.parentElement) {
      if (looksLikePromoCard(el)) {
        candidates.push(el);
      }
    }

    if (candidates.length === 0) return false;

    // 這次選最大的安全候選，避免只藏內容層、留下白色外框
    candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (br.width * br.height) - (ar.width * ar.height);
    });

    const card = candidates[0];

    card.setAttribute('data-haruz-hidden-codex-promo', 'true');
    card.style.setProperty('display', 'none', 'important');
    card.style.setProperty('visibility', 'hidden', 'important');
    card.style.setProperty('height', '0', 'important');
    card.style.setProperty('min-height', '0', 'important');
    card.style.setProperty('margin', '0', 'important');
    card.style.setProperty('padding', '0', 'important');
    card.style.setProperty('overflow', 'hidden', 'important');

    return true;
  }

  function hideCodexPromo() {
    if (!document.body) return;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          return node.nodeValue && node.nodeValue.includes(TITLE)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    let node;
    let hiddenCount = 0;

    while ((node = walker.nextNode()) && hiddenCount < 5) {
      if (hideCardFromTextNode(node)) {
        hiddenCount += 1;
      }
    }
  }

  let scheduled = false;

  function scheduleHide() {
    if (scheduled) return;

    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      hideCodexPromo();
    });
  }

  hideCodexPromo();

  const observer = new MutationObserver(scheduleHide);

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  setInterval(hideCodexPromo, 1500);
})();
