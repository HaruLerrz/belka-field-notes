// ==UserScript==
// @name         ChatGPT Hide Promo Cards SAFE
// @namespace    https://haruz.art/
// @version      0.5.2
// @description  Hide Codex, Pro, and plugin information promo cards in ChatGPT web UI.
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const DISABLE_KEY = 'belka_chatgpt_promo_hider_disabled';

  // 緊急停止：Ctrl + Alt + C
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'c') {
      localStorage.setItem(DISABLE_KEY, '1');
      location.reload();
    }
  });

  if (localStorage.getItem(DISABLE_KEY) === '1') return;

  const PROMOS = [
    {
      name: 'codex',
      anchors: [
        '認識 Codex',
        '重要工作，試試 Codex',
        '重要工作，試用 Codex',
        '試試 Codex',
        '試用 Codex',
        'Codex'
      ],
      requiredAny: [
        'Codex'
      ],
      supporting: [
        'Codex 幫你找出問題',
        'Codex 能將一次性任務',
        '工作流程',
        '精修過的輸出',
        '幫助你推進真正的工作',
        '已包含在你的方案中',
        '下載應用程式',
        '深入瞭解',
        '試用 Codex'
      ],
      minSupportingHits: 1
    },
    {
      name: 'pro',
      anchors: [
        '提升複雜程式碼編寫的準確性',
        '取得 Pro',
        '升級您的方案'
      ],
      requiredAny: [
        '提升複雜程式碼編寫的準確性',
        '取得 Pro',
        '升級您的方案'
      ],
      supporting: [
        '使用最先進的 Pro 推理模型',
        '更深入的驗證',
        '偵錯複雜系統',
        '升級您的方案',
        '取得 Pro'
      ],
      minSupportingHits: 1
    },
    {
      name: 'plugins-info',
      anchors: [
        '外掛程式提供更有幫助的結果',
        '你可以選擇 ChatGPT 何時要徵求使用外掛程式的權限'
      ],
      requiredAny: [
        '外掛程式提供更有幫助的結果'
      ],
      supporting: [
        '使用外掛程式時，ChatGPT 現在可以提供你對話和記憶中的相關詳細資訊',
        '協助處理你的要求',
        '你可以選擇 ChatGPT 何時要徵求使用外掛程式的權限',
        '了解更多',
        '知道了',
        '管理'
      ],
      minSupportingHits: 2
    }
  ];

  function getText(el) {
    return (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function hasAny(text, keywords) {
    return keywords.some((keyword) => text.includes(keyword));
  }

  function countHits(text, keywords) {
    return keywords.filter((keyword) => text.includes(keyword)).length;
  }

  function matchesAnyPromoText(text) {
    return PROMOS.some((promo) => {
      if (!hasAny(text, promo.requiredAny)) return false;
      return countHits(text, promo.supporting) >= promo.minSupportingHits;
    });
  }

  function textNodeLooksRelevant(text) {
    return PROMOS.some((promo) => hasAny(text, promo.anchors));
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

    // 避免誤砍輸入區、整個 composer、或包含可編輯區的大外框
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
    if (!matchesAnyPromoText(text)) return false;

    const rect = el.getBoundingClientRect();

    // 這裡排除你剛剛抓到的 1536px 主容器
    // 也排除過小的單一文字節點外框
    if (rect.width < 300 || rect.width > 1150) return false;
    if (rect.height < 45 || rect.height > 260) return false;

    // 防止吃到整頁或一大段對話
    if (text.length < 8 || text.length > 520) return false;

    return true;
  }

  function hideCardFromTextNode(textNode) {
    let el = textNode.parentElement;
    const candidates = [];

    for (let depth = 0; el && depth < 16; depth += 1, el = el.parentElement) {
      if (looksLikePromoCard(el)) {
        candidates.push(el);
      }
    }

    if (candidates.length === 0) return false;

    // 選最大的安全候選，避免只藏內容層、留下白色外框
    candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (br.width * br.height) - (ar.width * ar.height);
    });

    const card = candidates[0];

    card.setAttribute('data-belka-hidden-chatgpt-promo', 'true');
    card.style.setProperty('display', 'none', 'important');
    card.style.setProperty('visibility', 'hidden', 'important');
    card.style.setProperty('height', '0', 'important');
    card.style.setProperty('min-height', '0', 'important');
    card.style.setProperty('margin', '0', 'important');
    card.style.setProperty('padding', '0', 'important');
    card.style.setProperty('overflow', 'hidden', 'important');

    return true;
  }

  function hidePromos() {
    if (!document.body) return;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const value = node.nodeValue || '';
          return textNodeLooksRelevant(value)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    let node;
    let hiddenCount = 0;

    while ((node = walker.nextNode()) && hiddenCount < 10) {
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
      hidePromos();
    });
  }

  hidePromos();

  const observer = new MutationObserver(scheduleHide);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  setInterval(hidePromos, 1200);
})();
