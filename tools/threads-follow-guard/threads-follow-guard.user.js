// ==UserScript==
// @name         Threads 追蹤防誤觸（Follow Guard）
// @namespace    https://haruz.art/
// @version      0.2.0
// @description  追蹤需再次親自點擊同一按鈕；8 秒逾時、Esc／點擊外部取消，支援隱藏模式；保留原生取消追蹤流程。
// @author       Haruz & ChatGPT
// @match        https://www.threads.com/*
// @match        https://threads.com/*
// @match        https://www.threads.net/*
// @match        https://threads.net/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @noframes
// ==/UserScript==

(() => {
  'use strict';

  const KEY = 'tfg-mode-v1'; // 沿用舊版設定，更新後無須重新設定。
  const MODES = Object.freeze({ CONFIRM: 'confirm', HIDE: 'hide', OFF: 'off' });
  const DURATION_MS = 8000;
  const MIN_SECOND_CLICK_MS = 500; // 連續雙擊不應立即視為確認。
  const CONTROL_SELECTOR = 'button, [role="button"], [role="menuitem"]';
  const HIDE_ATTRIBUTE = 'data-threads-follow-guard-hide';
  const ARMED_ATTRIBUTE = 'data-threads-follow-guard-armed';

  const FOLLOW_LABELS = [
    /^追蹤$/i, /^追蹤對方$/i, /^回追$/i,
    /^关注$/i, /^回关$/i,
    /^follow$/i, /^follow\s+back$/i,
    /^follow\s+@[a-z0-9._]+$/i,
    /^フォロー$/i, /^フォローする$/i,
  ];
  const FOLLOWING_LABELS = [
    /^追蹤中$/i, /^已追蹤$/i, /^正在追蹤$/i,
    /^已关注$/i, /^正在关注$/i,
    /^following$/i, /^following\s+@[a-z0-9._]+$/i,
    /^フォロー中$/i,
    /^取消追蹤$/i, /^停止追蹤$/i,
    /^取消关注$/i, /^unfollow$/i,
  ];

  let mode = readMode();
  let pending = null;
  let blockedGesture = null;
  let approvedGesture = null;
  let keyboardBlocked = false;
  let keyboardApproved = null;
  let hideObserver = null;
  let hideRaf = 0;
  let hideStyle = null;
  let armedStyle = null;

  function readMode() {
    try {
      const saved = GM_getValue(KEY, MODES.CONFIRM);
      return Object.values(MODES).includes(saved) ? saved : MODES.CONFIRM;
    } catch (_) {
      return MODES.CONFIRM;
    }
  }

  function normalized(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function actionKind(el) {
    if (!(el instanceof Element) || el.closest('#tfg-confirm-hint')) return null;
    if (el.matches('[disabled], [aria-disabled="true"]')) return null;
    if (el.closest('nav, [role="navigation"], [role="tablist"], [role="tab"]')) return null;

    const labels = [
      el.getAttribute('aria-label'), el.getAttribute('title'),
      el.innerText, el.textContent,
    ].map(normalized).filter(Boolean);
    if (labels.some(label => FOLLOW_LABELS.some(pattern => pattern.test(label)))) return 'follow';
    if (labels.some(label => FOLLOWING_LABELS.some(pattern => pattern.test(label)))) return 'following';
    return null;
  }

  function getAction(event) {
    const node = event.target;
    if (!(node instanceof Element)) return null;
    const el = node.closest(CONTROL_SELECTOR);
    return el?.isConnected && actionKind(el) ? el : null;
  }

  function consume(event) {
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }

  function ensureArmedStyle() {
    if (armedStyle?.isConnected) return;
    armedStyle = document.createElement('style');
    armedStyle.textContent = `[${ARMED_ATTRIBUTE}="1"] { outline: 2px solid #f59e0b !important; outline-offset: 3px !important; }`;
    (document.head || document.documentElement).appendChild(armedStyle);
  }

  function closeConfirm() {
    if (!pending) return;
    const { target, host, timeout } = pending;
    pending = null;
    clearTimeout(timeout);
    if (target.isConnected) target.removeAttribute(ARMED_ATTRIBUTE);
    host.remove();
  }

  function openConfirm(target) {
    closeConfirm();
    ensureArmedStyle();
    target.setAttribute(ARMED_ATTRIBUTE, '1');
    const host = document.createElement('div');
    host.id = 'tfg-confirm-hint';
    host.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:none;max-width:calc(100vw - 32px);';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      *,*::before,*::after { box-sizing:border-box; }
      .hint { width:max-content;max-width:100%;background:#222;color:#fff;border:1px solid #555;
        border-radius:12px;padding:12px 16px;box-shadow:0 8px 28px rgba(0,0,0,.35);
        font:600 14px/1.5 system-ui,-apple-system,sans-serif;text-align:center; }
      small { display:block;color:#ddd;font-weight:400;font-size:12px;margin-top:2px; }
    </style><div class="hint" role="status" aria-live="polite">
      已攔截追蹤！再次點擊<em>同一個追蹤按鈕</em>即可確認。
      <small>8 秒內有效；按 Esc 或點擊其他位置取消。</small>
    </div>`;
    (document.body || document.documentElement).appendChild(host);
    pending = { target, host, started: performance.now(), timeout: setTimeout(closeConfirm, DURATION_MS) };
  }

  function samePending(target) {
    return pending && pending.target === target && target.isConnected && actionKind(target) === 'follow';
  }

  function canConfirm(target) {
    return samePending(target) && performance.now() - pending.started >= MIN_SECOND_CLICK_MS;
  }

  // 第一個手勢從 pointerdown 即攔截，避免網站在 mousedown 或 pointerdown 追蹤。
  // 第二個手勢完全留給瀏覽器與 Threads：不呼叫 element.click()。
  function startPointerGesture(event) {
    if (event.button !== undefined && event.button !== 0) return;
    if (mode === MODES.OFF) return;
    const target = getAction(event);
    if (!target) {
      if (pending) closeConfirm();
      return;
    }
    if (mode === MODES.HIDE) {
      consume(event);
      return;
    }
    if (actionKind(target) !== 'follow') {
      if (pending) closeConfirm();
      return;
    }
    // 開始新的實體手勢；舊手勢若因拖曳而未產生 click，不應影響新手勢。
    blockedGesture = null;
    approvedGesture = null;
    if (canConfirm(target) && event.isTrusted) {
      approvedGesture = target;
      closeConfirm();
      return;
    }
    if (!samePending(target)) openConfirm(target);
    blockedGesture = target;
    consume(event);
  }

  function handlePointerDown(event) { startPointerGesture(event); }
  function handleMouseDown(event) {
    if (mode === MODES.OFF) return;
    if (blockedGesture) { consume(event); return; }
    if (approvedGesture) return;
    // 舊版瀏覽器或輔助輸入設備：若沒有 pointerdown，就在 mousedown 防護。
    startPointerGesture(event);
  }
  function handlePointerUp(event) {
    if (mode === MODES.HIDE && getAction(event)) { consume(event); return; }
    if (blockedGesture) consume(event);
  }
  function handleMouseUp(event) {
    if (mode === MODES.HIDE && getAction(event)) { consume(event); return; }
    if (blockedGesture) {
      const gesture = blockedGesture;
      consume(event);
      // 通常 click 緊接在 mouseup 之後；沒有 click 時避免狀態永久殘留。
      setTimeout(() => { if (blockedGesture === gesture) blockedGesture = null; }, 200);
    }
  }

  function handleClick(event) {
    if (mode === MODES.OFF) return;
    if (blockedGesture) {
      blockedGesture = null;
      consume(event);
      return;
    }
    if (approvedGesture) {
      approvedGesture = null;
      // 第二次真正的滑鼠／觸控點擊原樣交給 Threads。
      return;
    }
    const target = getAction(event);
    if (mode === MODES.HIDE) {
      if (target) consume(event);
      return;
    }
    if (!target || actionKind(target) !== 'follow') {
      if (pending) closeConfirm();
      return;
    }
    // 處理鍵盤原生 click，或沒有 pointerdown 的其他 click 來源。
    if (keyboardApproved === target && event.isTrusted) {
      keyboardApproved = null;
      return;
    }
    keyboardApproved = null;
    if (canConfirm(target) && event.isTrusted) {
      closeConfirm();
      return;
    }
    if (!samePending(target)) openConfirm(target);
    consume(event);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && pending) {
      closeConfirm();
      consume(event);
      return;
    }
    if (mode === MODES.OFF || (event.key !== 'Enter' && event.key !== ' ')) return;
    const target = getAction(event);
    if (!target) return;
    if (mode === MODES.HIDE) { consume(event); return; }
    if (actionKind(target) !== 'follow') return;
    if (event.repeat) { consume(event); return; }
    if (canConfirm(target) && event.isTrusted) {
      keyboardApproved = target;
      closeConfirm();
      return; // 讓瀏覽器在 Enter／Space 產生原生的可信任 click。
    }
    if (!samePending(target)) openConfirm(target);
    keyboardBlocked = true;
    consume(event);
  }
  function handleKeyUp(event) {
    if (mode === MODES.HIDE && (event.key === 'Enter' || event.key === ' ') && getAction(event)) {
      consume(event);
      return;
    }
    if (keyboardBlocked && (event.key === 'Enter' || event.key === ' ')) {
      keyboardBlocked = false;
      consume(event);
    }
  }

  function ensureHideStyle() {
    if (hideStyle?.isConnected) return;
    hideStyle = document.createElement('style');
    hideStyle.textContent = `[${HIDE_ATTRIBUTE}="1"] { display:none !important; }`;
    (document.head || document.documentElement).appendChild(hideStyle);
  }
  function updateHidden() {
    hideRaf = 0;
    if (mode !== MODES.HIDE) return;
    ensureHideStyle();
    document.querySelectorAll(CONTROL_SELECTOR).forEach(el => {
      const kind = actionKind(el);
      if (kind === 'follow' || kind === 'following') el.setAttribute(HIDE_ATTRIBUTE, '1');
      else el.removeAttribute(HIDE_ATTRIBUTE);
    });
  }
  function scheduleHiddenUpdate() {
    if (!hideRaf) hideRaf = requestAnimationFrame(updateHidden);
  }
  function stopHiddenMode() {
    hideObserver?.disconnect();
    hideObserver = null;
    if (hideRaf) cancelAnimationFrame(hideRaf);
    hideRaf = 0;
    document.querySelectorAll(`[${HIDE_ATTRIBUTE}]`).forEach(el => el.removeAttribute(HIDE_ATTRIBUTE));
    hideStyle?.remove();
    hideStyle = null;
  }
  function startHiddenMode() {
    if (!document.documentElement) {
      document.addEventListener('DOMContentLoaded', () => {
        if (mode === MODES.HIDE && !hideObserver) startHiddenMode();
      }, { once: true });
      return;
    }
    if (hideObserver) return;
    hideObserver = new MutationObserver(scheduleHiddenUpdate);
    hideObserver.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['aria-label', 'title', 'disabled', 'aria-disabled'],
    });
    scheduleHiddenUpdate();
  }
  function setMode(newMode) {
    if (!Object.values(MODES).includes(newMode)) return;
    closeConfirm();
    blockedGesture = null;
    approvedGesture = null;
    keyboardBlocked = false;
    keyboardApproved = null;
    stopHiddenMode();
    mode = newMode;
    try { GM_setValue(KEY, mode); } catch (_) { /* 僅本次生效 */ }
    if (mode === MODES.HIDE) startHiddenMode();
    console.info('[Threads Follow Guard] Mode:', mode);
  }

  GM_registerMenuCommand('✅ 二次實體點擊確認（預設）', () => setMode(MODES.CONFIRM));
  GM_registerMenuCommand('🙈 隱藏追蹤／取消追蹤按鈕', () => setMode(MODES.HIDE));
  GM_registerMenuCommand('⏸ 暫時停用保護', () => setMode(MODES.OFF));

  // 使用 capture 階段，避免首次手勢抵達 Threads 自身的事件處理器。
  window.addEventListener('pointerdown', handlePointerDown, true);
  window.addEventListener('mousedown', handleMouseDown, true);
  window.addEventListener('pointerup', handlePointerUp, true);
  window.addEventListener('mouseup', handleMouseUp, true);
  window.addEventListener('click', handleClick, true);
  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keyup', handleKeyUp, true);
  if (mode === MODES.HIDE) startHiddenMode();
})();
