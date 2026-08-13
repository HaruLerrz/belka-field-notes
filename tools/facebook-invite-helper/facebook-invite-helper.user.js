// ==UserScript==
// @name         Facebook 一鍵邀請助手（保守版）
// @namespace    https://haruz.art/
// @version      2026-08-08-01
// @description  在 Facebook 反應名單／按讚名單彈窗中，手動啟動後，慢速批次點擊目前已載入的「邀請」按鈕。不自動捲動。
// @match        https://www.facebook.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const STORAGE_KEY = 'tm_fb_invite_helper_cfg_v1';
  const ROOT_ID = 'tm-fb-invite-helper-root';

  const defaultCfg = {
    batchLimit: 20,
    minDelay: 1600,
    maxDelay: 2400
  };

  let cfg = loadCfg();
  let running = false;
  let stopRequested = false;

  let refs = null;
  let collapsed = true;
  let scrolling = false;
  let stopScrollRequested = false;

  function loadCfg() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaultCfg };
      const parsed = JSON.parse(raw);
      return {
        batchLimit: numberOr(parsed.batchLimit, defaultCfg.batchLimit),
        minDelay: numberOr(parsed.minDelay, defaultCfg.minDelay),
        maxDelay: numberOr(parsed.maxDelay, defaultCfg.maxDelay)
      };
    } catch {
      return { ...defaultCfg };
    }
  }

  function saveCfg(nextCfg) {
    cfg = { ...cfg, ...nextCfg };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  function numberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function randInt(min, max) {
    const a = Math.min(min, max);
    const b = Math.max(min, max);
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  function normText(str) {
    return String(str || '').replace(/\s+/g, '').trim();
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getArea(el) {
    const r = el.getBoundingClientRect();
    return Math.max(0, r.width) * Math.max(0, r.height);
  }

  function getText(el) {
    return normText(el.innerText || el.textContent || el.getAttribute('aria-label') || '');
  }

  function isDisabled(el) {
    if (!el) return true;
    if (el.disabled) return true;
    if (el.getAttribute('aria-disabled') === 'true') return true;
    if (el.closest('[aria-disabled="true"]')) return true;
    return false;
  }

  function isInviteLabel(text) {
    return text === '邀請' || text === 'Invite';
  }

  function isAlreadyInvitedLabel(text) {
    return text === '已邀請' || text === 'Invited';
  }

  function getVisibleDialogs() {
    return Array.from(document.querySelectorAll('[role="dialog"]')).filter(isVisible);
  }

function pickMainDialog() {
  const dialogs = getVisibleDialogs();

  // 優先尋找實際包含「邀請 / 已邀請」按鈕的 dialog
  const candidates = dialogs
    .map(dialog => {
      const buttons = getClickableButtonsInDialog(dialog);

      const inviteCount = buttons.filter(el =>
        !isDisabled(el) &&
        isInviteLabel(getText(el))
      ).length;

      const invitedCount = buttons.filter(el =>
        isAlreadyInvitedLabel(getText(el))
      ).length;

      return {
        dialog,
        inviteCount,
        invitedCount,
        score: (inviteCount * 100) + invitedCount
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (candidates.length) {
    return candidates[0].dialog;
  }

  // 備援：直接從整個頁面尋找「邀請」按鈕，
  // 再反查它所屬的 dialog
  const allButtons = Array.from(
    document.querySelectorAll(
      'button, div[role="button"], a[role="button"]'
    )
  );

  const inviteButton = allButtons.find(el =>
    isVisible(el) &&
    !isDisabled(el) &&
    isInviteLabel(getText(el))
  );

  if (inviteButton) {
    return inviteButton.closest('[role="dialog"]');
  }

  return null;
}

  function getClickableButtonsInDialog(dialog) {
    if (!dialog) return [];
    const sel = 'button, div[role="button"], a[role="button"]';
    return Array.from(dialog.querySelectorAll(sel)).filter(isVisible);
  }

  function getInviteButtons(dialog) {
    return getClickableButtonsInDialog(dialog)
      .filter(el => !isDisabled(el))
      .filter(el => isInviteLabel(getText(el)))
      .filter(el => !el.dataset.tmInviteHelperProcessed);
  }

  function countAlreadyInvited(dialog) {
    return getClickableButtonsInDialog(dialog)
      .filter(el => isAlreadyInvitedLabel(getText(el))).length;
  }

  function findBlockingMessage() {
    const phrases = [
      '稍後再試',
      '暫時無法',
      '你現在無法執行此操作',
      '你暫時無法執行此操作',
      '操作太頻繁',
      'Try again later',
      'temporarily blocked',
      'You can’t do that right now'
    ];

    const candidates = Array.from(document.querySelectorAll('[role="dialog"], [aria-live="polite"], [aria-live="assertive"], body'));
    for (const el of candidates) {
      if (!isVisible(el) && el !== document.body) continue;
      const text = el.innerText || el.textContent || '';
      for (const phrase of phrases) {
        if (text.includes(phrase)) {
          return phrase;
        }
      }
    }
    return null;
  }

  function setStatus(text) {
    if (refs?.status) {
      refs.status.textContent = text;
    }

    if (refs?.compactState) {
      if (running) {
        refs.compactState.textContent = '邀請中';
      } else if (scrolling) {
        refs.compactState.textContent = '捲動中';
      } else {
        refs.compactState.textContent = '待命';
      }
    }
  }

  function syncInputValues() {
    if (!refs) return;
    refs.batchLimit.value = String(cfg.batchLimit);
    refs.minDelay.value = String(cfg.minDelay);
    refs.maxDelay.value = String(cfg.maxDelay);
  }

  function getCurrentCfgFromUI() {
    const next = {
      batchLimit: clampInt(refs.batchLimit.value, 1, 100, defaultCfg.batchLimit),
      minDelay: clampInt(refs.minDelay.value, 300, 60000, defaultCfg.minDelay),
      maxDelay: clampInt(refs.maxDelay.value, 300, 60000, defaultCfg.maxDelay)
    };

    if (next.maxDelay < next.minDelay) {
      next.maxDelay = next.minDelay;
    }

    saveCfg(next);
    syncInputValues();
    return next;
  }

  function clampInt(value, min, max, fallback) {
    let n = parseInt(value, 10);
    if (!Number.isFinite(n)) n = fallback;
    if (n < min) n = min;
    if (n > max) n = max;
    return n;
  }

  function updateButtonState() {
    if (!refs) return;

    refs.start.disabled = running || scrolling;
    refs.stop.disabled = !running;
    refs.scrollBottom.disabled = running;
    refs.scrollBottom.textContent = scrolling ? '停止捲動' : '捲到底';

    if (refs.compactState) {
      if (running) {
        refs.compactState.textContent = '邀請中';
      } else if (scrolling) {
        refs.compactState.textContent = '捲動中';
      } else {
        refs.compactState.textContent = '待命';
      }
    }
  }

  function setCollapsed(nextCollapsed) {
    collapsed = Boolean(nextCollapsed);
    if (!refs) return;

    refs.panel.hidden = collapsed;
    refs.compact.hidden = !collapsed;
  }

  function findScrollableList(dialog) {
    if (!dialog) return null;

    const candidates = [dialog, ...Array.from(dialog.querySelectorAll('*'))]
      .filter(el => {
        if (!isVisible(el)) return false;

        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const canScroll = overflowY === 'auto' || overflowY === 'scroll';

        return canScroll && el.scrollHeight > el.clientHeight + 40;
      })
      .map(el => ({
        el,
        range: el.scrollHeight - el.clientHeight,
        height: el.clientHeight
      }))
      .sort((a, b) => {
        if (b.range !== a.range) return b.range - a.range;
        return b.height - a.height;
      });

    return candidates.length ? candidates[0].el : null;
  }

  async function scrollReactionListToBottom() {
    if (running) {
      setStatus('邀請正在執行中，請先停止邀請再使用「捲到底」。');
      return;
    }

    if (scrolling) {
      stopScrollRequested = true;
      setStatus('正在停止捲動……');
      return;
    }

    const dialog = pickMainDialog();
    if (!dialog) {
      setStatus('找不到反應名單／邀請彈窗。請先打開名單視窗。');
      return;
    }

    const scroller = findScrollableList(dialog);
    if (!scroller) {
      setStatus('找不到反應名單的可捲動區域。');
      return;
    }

    scrolling = true;
    stopScrollRequested = false;
    updateButtonState();

    let stableRounds = 0;
    let lastHeight = scroller.scrollHeight;
    let rounds = 0;

    try {
      setStatus('正在純粹捲到底：只捲動名單，不會按任何「邀請」按鈕。');

      while (!stopScrollRequested) {
        rounds += 1;

        scroller.scrollTop = scroller.scrollHeight;
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }));

        await sleep(randInt(700, 1000));

        const currentHeight = scroller.scrollHeight;
        const atBottom =
          Math.abs(scroller.scrollTop + scroller.clientHeight - scroller.scrollHeight) <= 8;

        if (currentHeight > lastHeight + 8) {
          stableRounds = 0;
          lastHeight = currentHeight;
          setStatus(`捲動中：Facebook 載入了更多名單（第 ${rounds} 輪）。`);
          continue;
        }

        if (atBottom) {
          stableRounds += 1;
        } else {
          stableRounds = 0;
        }

        if (stableRounds >= 4) {
          setStatus('已捲到底。這個功能只負責捲動，沒有執行任何邀請。');
          break;
        }

        if (rounds >= 240) {
          setStatus('捲動已達安全輪數上限並停止；目前可能已到底，或 Facebook 沒有繼續載入。');
          break;
        }
      }

      if (stopScrollRequested) {
        setStatus('已手動停止捲動。');
      }
    } catch (err) {
      console.error('[FB 邀請助手] 捲到底發生錯誤：', err);
      setStatus(`捲動發生錯誤，已停止：${err?.message || err}`);
    } finally {
      scrolling = false;
      stopScrollRequested = false;
      updateButtonState();
    }
  }

  async function clickInviteButton(btn) {
    btn.dataset.tmInviteHelperProcessed = '1';
    try {
      btn.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
    } catch {}
    await sleep(randInt(120, 260));

    // 偏向使用原生 click，避免送出過多事件
    btn.click();
    return true;
  }

  async function runBatch() {
    if (running) return;

    const currentCfg = getCurrentCfgFromUI();
    running = true;
    stopRequested = false;
    updateButtonState();

    let clicked = 0;
    let skippedAlready = 0;

    try {
      const firstDialog = pickMainDialog();
      if (!firstDialog) {
        setStatus('找不到反應名單／邀請彈窗。請先打開名單視窗。');
        return;
      }

      skippedAlready = countAlreadyInvited(firstDialog);
      setStatus(`準備開始。這批最多 ${currentCfg.batchLimit} 人，不自動捲動。`);

      while (!stopRequested && clicked < currentCfg.batchLimit) {
        const blockMsg = findBlockingMessage();
        if (blockMsg) {
          setStatus(`已自動停止：偵測到「${blockMsg}」`);
          break;
        }

        const dialog = pickMainDialog();
        if (!dialog) {
          setStatus('彈窗已關閉，已停止。');
          break;
        }

        const inviteButtons = getInviteButtons(dialog);
        if (!inviteButtons.length) {
          setStatus(`本批完成：已點 ${clicked} 人；目前畫面可見「已邀請」約 ${skippedAlready} 人；沒有更多已載入的「邀請」按鈕。`);
          break;
        }

        const btn = inviteButtons[0];
        const ok = await clickInviteButton(btn);

        if (ok) {
          clicked += 1;
          setStatus(`進行中：已點 ${clicked}/${currentCfg.batchLimit}，延遲中……`);
        }

        const delay = randInt(currentCfg.minDelay, currentCfg.maxDelay);
        await sleep(delay);
      }

      if (stopRequested) {
        setStatus(`已手動停止。已點 ${clicked} 人。`);
      } else if (clicked >= currentCfg.batchLimit) {
        setStatus(`本批完成：已點 ${clicked} 人。若要繼續，請手動捲動載入下一批後再按開始。`);
      }
    } catch (err) {
      console.error('[FB 邀請助手] 發生錯誤：', err);
      setStatus(`發生錯誤，已停止：${err?.message || err}`);
    } finally {
      running = false;
      stopRequested = false;
      updateButtonState();
    }
  }

  function stopBatch() {
    stopRequested = true;
    setStatus('正在停止……');
  }

  function createUI() {
    if (document.getElementById(ROOT_ID)) return;

    const host = document.createElement('div');
    host.id = ROOT_ID;
    host.style.position = 'fixed';
    host.style.right = '16px';
    host.style.bottom = '16px';
    host.style.zIndex = '2147483647';
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
        }
        [hidden] {
          display: none !important;
        }
        .compact {
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: Arial, "Microsoft JhengHei", sans-serif;
          font-size: 13px;
          color: #111;
          background: rgba(255,255,255,0.98);
          border: 1px solid #cfd5dc;
          border-radius: 999px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.18);
          padding: 8px 12px;
          cursor: pointer;
          user-select: none;
        }
        .compact:hover {
          background: #f7f9fb;
        }
        .compact-title {
          font-weight: 700;
        }
        .compact-state {
          color: #66717d;
          font-size: 12px;
        }
        .compact-arrow {
          color: #66717d;
          font-size: 12px;
        }
        .panel {
          width: 300px;
          box-sizing: border-box;
          font-family: Arial, "Microsoft JhengHei", sans-serif;
          font-size: 13px;
          color: #111;
          background: rgba(255,255,255,0.98);
          border: 1px solid #cfd5dc;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          padding: 12px;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }
        .title {
          font-size: 14px;
          font-weight: 700;
        }
        .collapse-btn {
          appearance: none;
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #c6ced7;
          border-radius: 9px;
          padding: 0;
          background: #f5f7fa;
          cursor: pointer;
          font-size: 18px;
          font-weight: 400;
          line-height: 1;
          color: #4c5663;
        }
        .collapse-btn:hover {
          background: #edf1f5;
        }
        .desc {
          font-size: 12px;
          color: #444;
          line-height: 1.45;
          margin-bottom: 10px;
        }
        .row {
          display: grid;
          grid-template-columns: 1fr 92px;
          gap: 8px;
          align-items: center;
          margin-bottom: 8px;
        }
        .row label {
          color: #222;
        }
        .row input {
          width: 100%;
          box-sizing: border-box;
          padding: 6px 8px;
          border: 1px solid #bcc5cf;
          border-radius: 8px;
          font-size: 13px;
        }
        .btns {
          display: flex;
          gap: 8px;
          margin-top: 10px;
          margin-bottom: 10px;
        }
        button {
          appearance: none;
          border: 1px solid #b8c0ca;
          border-radius: 10px;
          padding: 8px 10px;
          background: #f5f7fa;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
        }
        button.primary {
          background: #1877f2;
          color: #fff;
          border-color: #1877f2;
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .status {
          min-height: 38px;
          background: #f7f9fb;
          border: 1px solid #d7dee6;
          border-radius: 10px;
          padding: 8px;
          line-height: 1.45;
          color: #23303f;
          white-space: pre-wrap;
        }
        .foot {
          margin-top: 8px;
          font-size: 11px;
          color: #666;
          line-height: 1.4;
        }
      </style>

      <div id="compact" class="compact" title="展開 Facebook 一鍵邀請助手">
        <span class="compact-title">FB 邀請助手</span>
        <span id="compactState" class="compact-state">待命</span>
        <span class="compact-arrow">▲</span>
      </div>

      <div id="panel" class="panel" hidden>
        <div class="header">
          <div class="title">Facebook 一鍵邀請助手（保守版）</div>
          <button id="collapse" class="collapse-btn" type="button" title="縮小">−</button>
        </div>

        <div class="desc">
          「開始邀請」只處理目前已載入的邀請按鈕，不會自動捲動。<br>
          「捲到底」只會把反應名單載入並捲到最底，不會執行邀請。
        </div>

        <div class="row">
          <label>每批上限</label>
          <input id="batchLimit" type="number" min="1" max="100">
        </div>

        <div class="row">
          <label>最小延遲（ms）</label>
          <input id="minDelay" type="number" min="300" max="60000">
        </div>

        <div class="row">
          <label>最大延遲（ms）</label>
          <input id="maxDelay" type="number" min="300" max="60000">
        </div>

        <div class="btns">
          <button id="start" class="primary">開始邀請</button>
          <button id="stop">停止</button>
          <button id="scrollBottom">捲到底</button>
        </div>

        <div id="status" class="status">待命中。請先打開 Facebook 的邀請名單彈窗。</div>
        <div class="foot">
          建議邀請先用 5～10 人測試。<br>
          「捲到底」與邀請互相獨立。完整停用請從 Tampermonkey 關閉此腳本。
        </div>
      </div>
    `;

    refs = {
      compact: shadow.getElementById('compact'),
      compactState: shadow.getElementById('compactState'),
      panel: shadow.getElementById('panel'),
      collapse: shadow.getElementById('collapse'),
      batchLimit: shadow.getElementById('batchLimit'),
      minDelay: shadow.getElementById('minDelay'),
      maxDelay: shadow.getElementById('maxDelay'),
      start: shadow.getElementById('start'),
      stop: shadow.getElementById('stop'),
      scrollBottom: shadow.getElementById('scrollBottom'),
      status: shadow.getElementById('status')
    };

    syncInputValues();
    updateButtonState();
    setCollapsed(true);

    refs.compact.addEventListener('click', () => setCollapsed(false));
    refs.collapse.addEventListener('click', () => setCollapsed(true));

    refs.start.addEventListener('click', runBatch);
    refs.stop.addEventListener('click', stopBatch);
    refs.scrollBottom.addEventListener('click', scrollReactionListToBottom);

    refs.batchLimit.addEventListener('change', () => getCurrentCfgFromUI());
    refs.minDelay.addEventListener('change', () => getCurrentCfgFromUI());
    refs.maxDelay.addEventListener('change', () => getCurrentCfgFromUI());
  }

  function boot() {
    createUI();
  }

  boot();
})();
