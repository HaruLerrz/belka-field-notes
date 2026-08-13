// ==UserScript==
// @name         ChatGPT Hide Promo Cards SAFE
// @namespace    https://haruz.art/
// @version      0.6.0
// @description  Hide ChatGPT promo cards with known-text rules and safe composer-adjacent structural detection.
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const DISABLE_KEY = 'belka_chatgpt_promo_hider_disabled';
  const HIDDEN_ATTR = 'data-belka-hidden-chatgpt-promo';
  const REASON_ATTR = 'data-belka-promo-reason';

  // 緊急停止：Ctrl + Alt + C
  window.addEventListener('keydown', (event) => {
    if (
      event.ctrlKey &&
      event.altKey &&
      event.key.toLowerCase() === 'c'
    ) {
      localStorage.setItem(DISABLE_KEY, '1');
      location.reload();
    }
  });

  if (localStorage.getItem(DISABLE_KEY) === '1') {
    return;
  }

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
    },
    {
      name: 'chatgpt-work',
      anchors: [
        '在 ChatGPT Work 繼續深入',
        '試用工作',
        'ChatGPT Work'
      ],
      requiredAny: [
        '在 ChatGPT Work 繼續深入',
        'ChatGPT Work'
      ],
      supporting: [
        '將你的工作成果變成精美的文件',
        '簡報',
        '試算表',
        '報告或網站',
        '試用工作'
      ],
      minSupportingHits: 1
    }
  ];

  const PROMO_SIGNAL_PATTERN =
    /(Codex|ChatGPT\s*Work|\bPro\b|外掛程式|升級|方案|試用|取得|下載|深入|體驗|新功能|更有幫助|開始使用|啟用|前往|查看|瞭解|了解|管理|知道了)/i;

  function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function getText(element) {
    return normalizeText(element?.innerText || element?.textContent);
  }

  function hasAny(text, keywords) {
    return keywords.some((keyword) => text.includes(keyword));
  }

  function countHits(text, keywords) {
    return keywords.filter((keyword) => text.includes(keyword)).length;
  }

  function isVisible(element) {
    if (!element || element.nodeType !== 1) {
      return false;
    }

    const rect = element.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    const style = getComputedStyle(element);

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity || 1) !== 0
    );
  }

  function isDangerousElement(element) {
    if (!element || element.nodeType !== 1) {
      return true;
    }

    const tag = element.tagName?.toLowerCase();

    if (
      tag === 'html' ||
      tag === 'body' ||
      tag === 'main' ||
      tag === 'form'
    ) {
      return true;
    }

    if (
      element.id === '__next' ||
      element.id === 'root'
    ) {
      return true;
    }

    // 絕不隱藏輸入區、整個 composer，或含一般輸入欄位的大容器。
    if (
      element.matches(
        'textarea, [contenteditable="true"], ' +
        'input:not([type="button"]):not([type="submit"])'
      ) ||
      element.querySelector(
        'textarea, [contenteditable="true"], ' +
        'input:not([type="button"]):not([type="submit"])'
      )
    ) {
      return true;
    }

    return false;
  }

  function findMatchedPromo(text) {
    return PROMOS.find((promo) => {
      if (!hasAny(text, promo.requiredAny)) {
        return false;
      }

      return (
        countHits(text, promo.supporting) >= promo.minSupportingHits
      );
    }) || null;
  }

  function textNodeLooksRelevant(text) {
    return PROMOS.some((promo) => hasAny(text, promo.anchors));
  }

  function looksLikeKnownPromoCard(element) {
    if (
      isDangerousElement(element) ||
      !isVisible(element)
    ) {
      return null;
    }

    const text = getText(element);
    const matchedPromo = findMatchedPromo(text);

    if (!matchedPromo) {
      return null;
    }

    const rect = element.getBoundingClientRect();

    if (rect.width < 300 || rect.width > 1150) {
      return null;
    }

    if (rect.height < 45 || rect.height > 260) {
      return null;
    }

    if (text.length < 8 || text.length > 520) {
      return null;
    }

    return matchedPromo.name;
  }

  function looksLikeCloseControl(control) {
    if (!isVisible(control)) {
      return false;
    }

    const rect = control.getBoundingClientRect();

    if (
      rect.width < 18 ||
      rect.width > 64 ||
      rect.height < 18 ||
      rect.height > 64
    ) {
      return false;
    }

    const accessibleText = normalizeText([
      control.getAttribute('aria-label'),
      control.getAttribute('title'),
      control.getAttribute('data-testid'),
      control.textContent
    ].filter(Boolean).join(' '));

    if (
      /(關閉|关闭|close|dismiss|取消|×|✕|✖)/i.test(
        accessibleText
      )
    ) {
      return true;
    }

    // ChatGPT 的 X 常是沒有文字與 aria-label 的純 SVG 按鈕。
    return (
      accessibleText === '' &&
      Boolean(control.querySelector('svg')) &&
      Math.abs(rect.width - rect.height) <= 18
    );
  }

  function horizontalOverlapRatio(firstRect, secondRect) {
    const overlap = Math.max(
      0,
      Math.min(firstRect.right, secondRect.right) -
      Math.max(firstRect.left, secondRect.left)
    );

    return overlap / Math.max(
      1,
      Math.min(firstRect.width, secondRect.width)
    );
  }

  function findVisibleComposerEditor() {
    const editors = Array.from(
      document.querySelectorAll(
        'textarea, [contenteditable="true"]'
      )
    ).filter((element) => {
      if (!isVisible(element)) {
        return false;
      }

      const rect = element.getBoundingClientRect();

      return (
        rect.width >= 180 &&
        rect.bottom >= window.innerHeight * 0.45
      );
    });

    editors.sort((first, second) => {
      return (
        second.getBoundingClientRect().bottom -
        first.getBoundingClientRect().bottom
      );
    });

    return editors[0] || null;
  }

  function getActionControls(card, closeControl) {
    return Array.from(
      card.querySelectorAll(
        'button, a, [role="button"]'
      )
    ).filter((control) => {
      if (
        control === closeControl ||
        !isVisible(control)
      ) {
        return false;
      }

      return normalizeText([
        control.textContent,
        control.getAttribute('aria-label'),
        control.getAttribute('title')
      ].filter(Boolean).join(' ')).length > 0;
    });
  }

  function looksLikeComposerAdjacentPromo(
    element,
    editorRect,
    closeControl
  ) {
    if (
      isDangerousElement(element) ||
      !isVisible(element)
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const text = getText(element);

    if (rect.width < 300 || rect.width > 1150) {
      return false;
    }

    if (rect.height < 45 || rect.height > 240) {
      return false;
    }

    if (text.length < 8 || text.length > 520) {
      return false;
    }

    // 卡片必須緊貼輸入框上方，並和輸入框有足夠的水平重疊。
    if (
      rect.bottom > editorRect.top + 36 ||
      rect.bottom < editorRect.top - 280
    ) {
      return false;
    }

    if (horizontalOverlapRatio(rect, editorRect) < 0.68) {
      return false;
    }

    const widthRatio = rect.width / Math.max(1, editorRect.width);

    if (widthRatio < 0.72 || widthRatio > 1.45) {
      return false;
    }

    const actionControls = getActionControls(
      element,
      closeControl
    );

    if (actionControls.length === 0) {
      return false;
    }

    const actionText = actionControls
      .map((control) => normalizeText([
        control.textContent,
        control.getAttribute('aria-label'),
        control.getAttribute('title')
      ].filter(Boolean).join(' ')))
      .join(' ');

    // 結構辨識仍要求促銷／導覽訊號，避免誤藏錯誤或重要系統通知。
    return PROMO_SIGNAL_PATTERN.test(
      `${text} ${actionText}`
    );
  }

  function hideCard(card, reason) {
    if (
      !card ||
      card.getAttribute(HIDDEN_ATTR) === 'true'
    ) {
      return false;
    }

    card.setAttribute(HIDDEN_ATTR, 'true');
    card.setAttribute(REASON_ATTR, reason);
    card.style.setProperty('display', 'none', 'important');
    card.style.setProperty('visibility', 'hidden', 'important');
    card.style.setProperty('height', '0', 'important');
    card.style.setProperty('min-height', '0', 'important');
    card.style.setProperty('margin', '0', 'important');
    card.style.setProperty('padding', '0', 'important');
    card.style.setProperty('overflow', 'hidden', 'important');

    console.debug(
      `[Belka Promo Hider] hidden: ${reason}`,
      card
    );

    return true;
  }

  function hideKnownTextPromos() {
    if (!document.body) {
      return 0;
    }

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

    while (
      (node = walker.nextNode()) &&
      hiddenCount < 10
    ) {
      let element = node.parentElement;
      const candidates = [];

      for (
        let depth = 0;
        element && depth < 16;
        depth += 1, element = element.parentElement
      ) {
        const reason = looksLikeKnownPromoCard(element);

        if (reason) {
          candidates.push({
            element,
            reason
          });
        }
      }

      if (candidates.length === 0) {
        continue;
      }

      candidates.sort((first, second) => {
        const firstRect =
          first.element.getBoundingClientRect();
        const secondRect =
          second.element.getBoundingClientRect();

        return (
          secondRect.width * secondRect.height -
          firstRect.width * firstRect.height
        );
      });

      if (
        hideCard(
          candidates[0].element,
          `text:${candidates[0].reason}`
        )
      ) {
        hiddenCount += 1;
      }
    }

    return hiddenCount;
  }

  function hideComposerAdjacentPromos() {
    const editor = findVisibleComposerEditor();

    if (!editor) {
      return 0;
    }

    const editorRect = editor.getBoundingClientRect();
    const closeControls = Array.from(
      document.querySelectorAll(
        'button, [role="button"]'
      )
    ).filter((control) => {
      if (!looksLikeCloseControl(control)) {
        return false;
      }

      const rect = control.getBoundingClientRect();

      return (
        rect.bottom >= editorRect.top - 280 &&
        rect.top <= editorRect.top + 36 &&
        horizontalOverlapRatio(rect, editorRect) > 0
      );
    });

    const candidates = [];

    for (const closeControl of closeControls) {
      let element = closeControl.parentElement;

      for (
        let depth = 0;
        element && depth < 12;
        depth += 1, element = element.parentElement
      ) {
        if (
          looksLikeComposerAdjacentPromo(
            element,
            editorRect,
            closeControl
          )
        ) {
          candidates.push(element);
        }
      }
    }

    const uniqueCandidates = Array.from(
      new Set(candidates)
    );

    uniqueCandidates.sort((first, second) => {
      const firstRect = first.getBoundingClientRect();
      const secondRect = second.getBoundingClientRect();

      return (
        secondRect.width * secondRect.height -
        firstRect.width * firstRect.height
      );
    });

    if (uniqueCandidates.length === 0) {
      return 0;
    }

    return hideCard(
      uniqueCandidates[0],
      'structure:composer-adjacent'
    ) ? 1 : 0;
  }

  function hidePromos() {
    hideKnownTextPromos();
    hideComposerAdjacentPromos();
  }

  let scheduled = false;

  function scheduleHide() {
    if (scheduled) {
      return;
    }

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
