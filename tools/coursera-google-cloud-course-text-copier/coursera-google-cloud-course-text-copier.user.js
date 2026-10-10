// ==UserScript==
// @name         Coursera Google Cloud 教材一鍵擷取
// @namespace    https://haruz.art/
// @version      1.0.0
// @description  在 Coursera 課程頁或 Google Cloud 教材頁，一鍵複製目前教材（含已載入的隱藏卡片、輪播及摺疊文字）。
// @match        https://www.coursera.org/*
// @match        https://coursera.org/*
// @match        https://storage.googleapis.com/cloud-training/cls-html5-courses/*
// @run-at       document-idle
// @grant        GM_setClipboard
// ==/UserScript==

(() => {
  'use strict';

  const CHANNEL = 'haruz-cloud-course-copier-v1';
  const BUTTON_ID = 'haruz-cloud-course-copy-button';
  const GOOGLE_ORIGIN = 'https://storage.googleapis.com';
  const GOOGLE_PATH = '/cloud-training/cls-html5-courses/';
  const COURSERA_ORIGINS = new Set([
    'https://www.coursera.org',
    'https://coursera.org',
  ]);

  const isGoogleLesson = location.origin === GOOGLE_ORIGIN &&
    location.pathname.startsWith(GOOGLE_PATH);
  const isCoursera = COURSERA_ORIGINS.has(location.origin);

  if (!isGoogleLesson && !(isCoursera && window === window.top)) return;

  // 從實際 DOM 抽取文字；不使用 innerText，以保留已載入但尚未顯示的卡片內容。
  function extractLesson() {
    const excluded = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CANVAS', 'TEMPLATE']);
    const blocks = new Set([
      'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER',
      'P', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'BLOCKQUOTE', 'TR', 'DT', 'DD',
    ]);
    const parts = [];

    function visit(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.nodeValue.replace(/\s+/g, ' '));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.id === BUTTON_ID || excluded.has(node.tagName)) return;
      if (node.tagName === 'BR') {
        parts.push('\n');
        return;
      }
      const block = blocks.has(node.tagName);
      if (block) parts.push('\n');
      for (const child of node.childNodes) visit(child);
      if (block) parts.push('\n');
    }

    visit(document.body);
    const text = parts.join('')
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!text) throw new Error('本頁沒有可擷取的文字');

    return `教材網址：${location.href}\n\n${text}`;
  }

  // iframe 內的 Google 教材：只回應 Coursera 頁面送來的擷取要求。
  if (isGoogleLesson && window !== window.top) {
    window.addEventListener('message', (event) => {
      if (event.source !== window.parent || !COURSERA_ORIGINS.has(event.origin)) return;
      const message = event.data;
      if (!message || message.channel !== CHANNEL || message.type !== 'request') return;
      try {
        window.parent.postMessage({
          channel: CHANNEL,
          type: 'result',
          id: message.id,
          text: extractLesson(),
        }, event.origin);
      } catch (error) {
        window.parent.postMessage({
          channel: CHANNEL,
          type: 'result',
          id: message.id,
          error: String(error.message || error),
        }, event.origin);
      }
    });
    return;
  }

  let button;
  let resetTimer;
  let pending = null;

  function showStatus(label, isError = false) {
    if (!button) return;
    button.textContent = label;
    button.style.background = isError ? '#a32e31' : '#174ea6';
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      if (button) {
        button.textContent = '📋 複製整頁教材';
        button.style.background = '#174ea6';
      }
    }, 3200);
  }

  function copyLesson(text) {
    GM_setClipboard(text, 'text');
    showStatus(`✅ 已複製（${text.length.toLocaleString()} 字）`);
  }

  function findGoogleFrames() {
    return [...document.querySelectorAll('iframe')].filter((frame) => {
      try {
        const url = new URL(frame.src, location.href);
        return url.origin === GOOGLE_ORIGIN && url.pathname.startsWith(GOOGLE_PATH);
      } catch (_) {
        return false;
      }
    });
  }

  function handleClick() {
    if (pending) return;
    if (isGoogleLesson) {
      try {
        copyLesson(extractLesson());
      } catch (error) {
        showStatus(`⚠️ ${error.message || error}`, true);
      }
      return;
    }

    const frames = findGoogleFrames();
    const frame = frames.find((item) => item.getClientRects().length > 0) || frames[0];
    if (!frame?.contentWindow) {
      showStatus('⚠️ 找不到 Google 教材 iframe', true);
      return;
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    showStatus('⏳ 正在讀取教材…');
    pending = {
      id,
      frame,
      timer: setTimeout(() => {
        pending = null;
        showStatus('⚠️ 無回應：請確認 iframe 內腳本已啟用', true);
      }, 9000),
    };
    try {
      frame.contentWindow.postMessage({ channel: CHANNEL, type: 'request', id }, GOOGLE_ORIGIN);
    } catch (error) {
      clearTimeout(pending.timer);
      pending = null;
      showStatus(`⚠️ ${error.message || error}`, true);
    }
  }

  if (isCoursera) {
    window.addEventListener('message', (event) => {
      if (event.origin !== GOOGLE_ORIGIN || !pending) return;
      if (event.source !== pending.frame.contentWindow) return;
      const message = event.data;
      if (!message || message.channel !== CHANNEL || message.type !== 'result' || message.id !== pending.id) return;

      clearTimeout(pending.timer);
      pending = null;
      if (message.error) {
        showStatus(`⚠️ ${message.error}`, true);
      } else {
        try {
          copyLesson(message.text);
        } catch (error) {
          showStatus(`⚠️ 複製失敗：${error.message || error}`, true);
        }
      }
    });
  }

  function ensureButton() {
    if (!document.body) return;
    if (!button || !button.isConnected) {
      button = document.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      button.textContent = '📋 複製整頁教材';
      button.title = '複製本頁已載入的全部教材文字（含未展開卡片）';
      button.setAttribute('aria-label', '複製 Google Cloud 教材文字');
      Object.assign(button.style, {
        position: 'fixed',
        right: '20px',
        bottom: '76px',
        zIndex: '2147483647',
        padding: '10px 15px',
        border: '0',
        borderRadius: '999px',
        background: '#174ea6',
        color: '#fff',
        font: '600 13px/1.5 system-ui, sans-serif',
        boxShadow: '0 3px 12px #0005',
        cursor: 'pointer',
      });
      button.addEventListener('click', handleClick);
      document.body.appendChild(button);
    }
    button.style.display = isGoogleLesson || findGoogleFrames().length > 0 ? 'block' : 'none';
  }

  ensureButton();
  if (isCoursera) {
    // Coursera 是單頁應用程式，切換課程項目時 iframe 可能重新建立。
    const observer = new MutationObserver(() => ensureButton());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });
  }
})();
