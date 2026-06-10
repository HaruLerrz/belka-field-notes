// Name        : Belka Firefox Add-on Order Helper
// Type        : Firefox about:addons console hack
// Version     : 0.1.5
// Forked from : firefox-v109-change-order-under-extensions-button.js
// Original    : icpantsparti2/browser-bits
// Original URL: https://github.com/icpantsparti2/browser-bits/blob/main/javascript/firefox-v109-change-order-under-extensions-button.js
// License     : MIT
//
// This fork keeps the original console-based workflow and adds small
// quality-of-life changes:
//   - Traditional Chinese UI with English fallback
//   - JSON-based preference editing instead of regex string replacement
//   - optional Firefox widget ID display, hidden by default
//   - move up / move down buttons
//   - backup / restore helper output in the console and clipboard
//   - restore backup dialog that accepts the copied backup block
//
// Use with care at your own risk.
//
// How to run:
//   1. Open about:addons in Firefox.
//   2. Open Web Console: Ctrl+Shift+K or F12.
//   3. Paste this whole file and run it.
//   4. Arrange the list, click Apply, then restart Firefox.

(function () {
  "use strict";

  const APP_NAME = "Belka Firefox Add-on Order Helper";
  const VERSION = "0.1.5";
  const PREF_NAME = "browser.uiCustomization.state";
  const AREA_NAME = "unified-extensions-area";
  const ROOT_ID = "bfaoh-root";
  const STYLE_ID = "bfaoh-style";

  const I18N = {
    "zh-TW": {
      title: "Firefox 擴充套件排序小幫手",
      subtitle: "about:addons console hack｜修改 unified extensions menu 順序",
      apply: "套用排序",
      getCurrent: "讀取目前順序",
      sortAZ: "A-Z",
      sortZA: "Z-A",
      backup: "輸出備份",
      restoreBackup: "恢復備份",
      toggleIds: "顯示／隱藏 ID",
      close: "關閉",
      moveUp: "上移",
      moveDown: "下移",
      idLabel: "ID",
      areaLabel: "位置",
      areaMenu: "選單",
      areaNavbar: "工具列",
      areaTabsToolbar: "分頁列",
      areaOther: "其他",
      areaUnknown: "未知",
      statusReady: "已載入。拖曳項目或使用上移／下移調整順序。",
      statusCurrent: "已依目前 Firefox 設定重新排列清單。",
      statusSortedAZ: "已依名稱 A-Z 排序。",
      statusSortedZA: "已依名稱 Z-A 排序。",
      statusBackup: "已在 console 輸出目前設定備份。",
      statusBackupCopied: "已將復原指令複製到剪貼簿，並已在 console 輸出完整備份。",
      statusBackupCopyFailed: "無法寫入剪貼簿；完整備份已輸出到 console，請手動複製復原指令。",
      statusRestoreOpened: "請貼上先前複製的備份區塊、復原指令或完整偏好值。",
      statusRestored: "已恢復備份。請重新啟動 Firefox 後確認結果。",
      restoreDialogTitle: "恢復備份",
      restoreDialogText: "貼上「輸出備份」或「套用排序」時複製到剪貼簿的內容。也可以貼上完整的 browser.uiCustomization.state JSON。",
      restorePastePlaceholder: "貼上備份區塊、Services.prefs.setStringPref(...) 指令、user_pref(...) 行，或完整 JSON 偏好值。",
      restoreApply: "恢復",
      restoreCancel: "取消",
      restoreEmpty: "沒有貼上任何備份內容。",
      restoreParseError: "無法辨識備份內容。請貼上本工具輸出的備份區塊、復原指令或完整偏好值。",
      restoreWrongPref: "備份內容不是 browser.uiCustomization.state。為了安全起見，未做任何修改。",
      statusAppliedCopied: "排序已寫入，復原指令已複製到剪貼簿。請重新啟動 Firefox 後確認結果。",
      statusAppliedCopyFailed: "排序已寫入，但無法寫入剪貼簿；復原資訊已輸出到 console。請重新啟動 Firefox。",
      copiedButton: "已複製",
      copyFailedButton: "複製失敗",
      statusApplied: "排序已寫入。請重新啟動 Firefox 後確認結果。",
      statusNoChange: "排序沒有變更，未寫入新的設定。",
      noAddons: "沒有找到可排序的使用者擴充套件。",
      envError: "請在 Firefox 的 about:addons 頁面開啟 Web Console 後執行。",
      prefError: "無法讀取或解析 browser.uiCustomization.state。為了安全起見，未做任何修改。",
      missingArea: "找不到 unified-extensions-area。為了安全起見，未做任何修改。",
      backupIntro: "備份與復原資訊",
      oldValue: "舊設定",
      newValue: "新設定",
      restoreCommand: "復原指令",
      userJsRestore: "user.js 復原行",
      copyHint: "可在 console 對物件使用 Copy Object，或複製上方字串保存。",
      restartHint: "注意：修改後通常需要重新啟動 Firefox 才會反映在擴充套件選單。",
      closeHint: "關閉只會移除這個臨時介面；已套用的 Firefox 設定不會因此復原。"
    },
    en: {
      title: "Firefox Add-on Order Helper",
      subtitle: "about:addons console hack | reorder unified extensions menu items",
      apply: "Apply order",
      getCurrent: "Get current order",
      sortAZ: "A-Z",
      sortZA: "Z-A",
      backup: "Print backup",
      restoreBackup: "Restore backup",
      toggleIds: "Show / hide IDs",
      close: "Close",
      moveUp: "Move up",
      moveDown: "Move down",
      idLabel: "ID",
      areaLabel: "Area",
      areaMenu: "Menu",
      areaNavbar: "Toolbar",
      areaTabsToolbar: "Tabs toolbar",
      areaOther: "Other",
      areaUnknown: "Unknown",
      statusReady: "Loaded. Drag items or use Move up / Move down to adjust the order.",
      statusCurrent: "List reordered from the current Firefox preference.",
      statusSortedAZ: "Sorted by name A-Z.",
      statusSortedZA: "Sorted by name Z-A.",
      statusBackup: "Current preference backup printed to the console.",
      statusBackupCopied: "Restore command copied to the clipboard. Full backup also printed to the console.",
      statusBackupCopyFailed: "Could not write to the clipboard. Full backup printed to the console; please copy the restore command manually.",
      statusRestoreOpened: "Paste a previously copied backup block, restore command, or full preference value.",
      statusRestored: "Backup restored. Please restart Firefox to check the result.",
      restoreDialogTitle: "Restore backup",
      restoreDialogText: "Paste the content copied by Print backup or Apply order. You can also paste the full browser.uiCustomization.state JSON.",
      restorePastePlaceholder: "Paste a backup block, Services.prefs.setStringPref(...) command, user_pref(...) line, or full JSON preference value.",
      restoreApply: "Restore",
      restoreCancel: "Cancel",
      restoreEmpty: "No backup content was pasted.",
      restoreParseError: "Could not recognize the backup content. Paste a backup block, restore command, or full preference value generated by this tool.",
      restoreWrongPref: "The pasted backup is not for browser.uiCustomization.state. No changes were made.",
      statusAppliedCopied: "Order saved and restore command copied to the clipboard. Please restart Firefox to check the result.",
      statusAppliedCopyFailed: "Order saved, but clipboard copy failed. Restore information was printed to the console. Please restart Firefox.",
      copiedButton: "Copied",
      copyFailedButton: "Copy failed",
      statusApplied: "Order saved. Please restart Firefox to check the result.",
      statusNoChange: "No ordering changes detected. Preference not written.",
      noAddons: "No user extensions found for ordering.",
      envError: "Please run this in Firefox Web Console on about:addons.",
      prefError: "Could not read or parse browser.uiCustomization.state. No changes were made.",
      missingArea: "unified-extensions-area was not found. No changes were made.",
      backupIntro: "Backup and restore information",
      oldValue: "Old value",
      newValue: "New value",
      restoreCommand: "Restore command",
      userJsRestore: "user.js restore line",
      copyHint: "Use Copy Object in the console, or copy the strings above and save them.",
      restartHint: "Note: You usually need to restart Firefox before the extension menu reflects the change.",
      closeHint: "Close only removes this temporary UI. Already-applied Firefox preferences will not be restored."
    }
  };

  function getLocale() {
    const langs = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language || "en"];
    return langs.some((lang) => /^zh-(TW|Hant|HK|MO)/i.test(lang)) ? "zh-TW" : "en";
  }

  const LOCALE = getLocale();

  function t(key) {
    return (I18N[LOCALE] && I18N[LOCALE][key]) || I18N.en[key] || key;
  }

  function fail(message) {
    console.error(`[${APP_NAME}] ${message}`);
    alert(`${APP_NAME}\n\n${message}`);
  }

  function checkEnvironment() {
    return !(typeof Services === "undefined" ||
      typeof AddonManager === "undefined" ||
      typeof AddonManager.getAddonsByTypes === "undefined");
  }

  function readCustomizationState() {
    const raw = Services.prefs.getStringPref(PREF_NAME);
    let state;

    try {
      state = JSON.parse(raw);
    } catch (error) {
      throw new Error(`${t("prefError")}\n${error.message}`);
    }

    if (!state || typeof state !== "object" || !state.placements || typeof state.placements !== "object") {
      throw new Error(t("prefError"));
    }

    if (!Array.isArray(state.placements[AREA_NAME])) {
      throw new Error(t("missingArea"));
    }

    return { raw, state };
  }

  function writeCustomizationState(state) {
    const newRaw = JSON.stringify(state);
    Services.prefs.setStringPref(PREF_NAME, newRaw);
    return newRaw;
  }

  function widgetIdFromAddon(addon) {
    return `${String(addon.id).toLowerCase().replace(/[{}@.]/g, "_")}-browser-action`;
  }

  function isUserExtension(addon) {
    return addon && !(addon.isBuiltin || addon.isSystem);
  }

  function compareByName(direction) {
    const factor = direction === "desc" ? -1 : 1;
    return function (a, b) {
      return factor * String(a.name).localeCompare(String(b.name), LOCALE, {
        sensitivity: "base",
        numeric: true
      });
    };
  }

  function areaKeyForWidget(state, widgetId) {
    const placements = state.placements || {};
    for (const [area, widgets] of Object.entries(placements)) {
      if (Array.isArray(widgets) && widgets.includes(widgetId)) {
        return area;
      }
    }
    return "";
  }

  function areaLabel(area) {
    if (area === AREA_NAME) return t("areaMenu");
    if (area === "nav-bar") return t("areaNavbar");
    if (area === "TabsToolbar") return t("areaTabsToolbar");
    if (area) return `${t("areaOther")}: ${area}`;
    return t("areaUnknown");
  }

  function escapeForJsString(value) {
    return JSON.stringify(String(value));
  }

  function makeRestoreCommand(value) {
    return `Services.prefs.setStringPref(${escapeForJsString(PREF_NAME)}, ${escapeForJsString(value)});`;
  }

  function makeUserJsLine(value) {
    return `user_pref(${escapeForJsString(PREF_NAME)}, ${escapeForJsString(value)});`;
  }

  function makeBackupClipboardText(backup) {
    const lines = [
      `/* ${APP_NAME} backup`,
      `Version: ${backup.version}`,
      `Created: ${backup.createdAt}`,
      `Preference: ${backup.preference}`,
      ``,
      `This whole block can be pasted into Firefox Web Console to restore`,
      `the previous value. It can also be pasted into this tool's Restore Backup dialog.`,
      ``,
      `user.js restore line, kept here as a comment for manual profile use:`,
      backup.oldUserJsRestoreLine,
      ``
    ];

    if (typeof backup.newApplyCommand === "string") {
      lines.push(
        `New value apply command, for reference only:`,
        backup.newApplyCommand,
        ``
      );
    }

    lines.push(`*/`, backup.oldRestoreCommand);
    return lines.join("\n");
  }

  function validatePreferenceRaw(raw) {
    if (typeof raw !== "string") {
      throw new Error(t("restoreParseError"));
    }

    let state;
    try {
      state = JSON.parse(raw);
    } catch (_error) {
      throw new Error(t("restoreParseError"));
    }

    if (!state || typeof state !== "object" || !state.placements || typeof state.placements !== "object") {
      throw new Error(t("restoreParseError"));
    }

    if (!Array.isArray(state.placements[AREA_NAME])) {
      throw new Error(t("missingArea"));
    }

    return raw;
  }

  function readCommandMatches(text, commandPattern) {
    const matches = [];
    let match;
    while ((match = commandPattern.exec(text)) !== null) {
      matches.push(match);
    }
    return matches;
  }

  function parseRestoreBackupText(text) {
    const input = String(text || "").trim();
    if (!input) throw new Error(t("restoreEmpty"));

    const setPrefPattern = /Services\.prefs\.setStringPref\(\s*("(?:\\.|[^"\\])*")\s*,\s*("(?:\\.|[^"\\])*")\s*\)\s*;?/g;
    const userPrefPattern = /user_pref\(\s*("(?:\\.|[^"\\])*")\s*,\s*("(?:\\.|[^"\\])*")\s*\)\s*;?/g;
    const setPrefMatches = readCommandMatches(input, setPrefPattern);
    const commandMatch = setPrefMatches.length
      ? setPrefMatches[setPrefMatches.length - 1]
      : readCommandMatches(input, userPrefPattern)[0];

    if (commandMatch) {
      let prefName;
      let rawValue;
      try {
        prefName = JSON.parse(commandMatch[1]);
        rawValue = JSON.parse(commandMatch[2]);
      } catch (_error) {
        throw new Error(t("restoreParseError"));
      }

      if (prefName !== PREF_NAME) throw new Error(t("restoreWrongPref"));
      return validatePreferenceRaw(rawValue);
    }

    try {
      const parsed = JSON.parse(input);
      if (typeof parsed === "string") {
        return validatePreferenceRaw(parsed);
      }
      if (parsed && typeof parsed.oldValue === "string") {
        return validatePreferenceRaw(parsed.oldValue);
      }
      if (parsed && typeof parsed.value === "string") {
        return validatePreferenceRaw(parsed.value);
      }
      if (parsed && typeof parsed === "object" && parsed.placements) {
        return validatePreferenceRaw(JSON.stringify(parsed));
      }
    } catch (error) {
      if (error && error.message && error.message !== t("restoreParseError")) {
        throw error;
      }
    }

    throw new Error(t("restoreParseError"));
  }

  async function copyTextToClipboard(text) {
    let clipboardError = null;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      clipboardError = error;
    }

    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "fixed";
      textArea.style.top = "-9999px";
      textArea.style.left = "-9999px";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const copied = document.execCommand("copy");
      textArea.remove();
      if (copied) return true;
      clipboardError = new Error("document.execCommand('copy') returned false");
    } catch (error) {
      clipboardError = error;
    }

    console.warn(`[${APP_NAME}] Clipboard copy failed.`, clipboardError);
    return false;
  }

  function setTemporaryButtonText(button, text, durationMs) {
    const original = button.textContent;
    button.textContent = text;
    setTimeout(() => {
      if (button.isConnected) button.textContent = original;
    }, durationMs || 1500);
  }

  function printBackup(label, oldRaw, newRaw) {
    const backup = {
      app: APP_NAME,
      version: VERSION,
      createdAt: new Date().toISOString(),
      preference: PREF_NAME,
      oldValue: oldRaw,
      oldRestoreCommand: makeRestoreCommand(oldRaw),
      oldUserJsRestoreLine: makeUserJsLine(oldRaw)
    };

    if (typeof newRaw === "string") {
      backup.newValue = newRaw;
      backup.newApplyCommand = makeRestoreCommand(newRaw);
      backup.newUserJsLine = makeUserJsLine(newRaw);
    }

    console.group(`[${APP_NAME}] ${label || t("backupIntro")}`);
    console.log(backup);
    console.log(`// ${t("restoreCommand")}\n${backup.oldRestoreCommand}`);
    console.log(`// ${t("userJsRestore")}\n${backup.oldUserJsRestoreLine}`);
    if (typeof newRaw === "string") {
      console.log(`// ${t("newValue")}\n${backup.newApplyCommand}`);
    }
    console.log(`// ${t("copyHint")}`);
    console.groupEnd();

    return backup;
  }

  function removeExistingUI() {
    const oldRoot = document.getElementById(ROOT_ID);
    if (oldRoot) oldRoot.remove();
    const oldStyle = document.getElementById(STYLE_ID);
    if (oldStyle) oldStyle.remove();
  }

  function createButton(text, title) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    if (title) button.title = title;
    return button;
  }

  function buildStyle() {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(0, 0, 0, 0.45);
        font: menu;
      }
      #${ROOT_ID} * { box-sizing: border-box; }
      #${ROOT_ID} .bfaoh-panel {
        width: min(900px, 94vw);
        max-height: 88vh;
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        gap: 10px;
        padding: 14px;
        border-radius: 12px;
        background: Canvas;
        color: CanvasText;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.45);
        border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
      }
      #${ROOT_ID} .bfaoh-title {
        margin: 0;
        font-size: 17px;
        font-weight: 700;
      }
      #${ROOT_ID} .bfaoh-subtitle {
        margin-top: 3px;
        opacity: 0.72;
        font-size: 12px;
      }
      #${ROOT_ID} .bfaoh-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      #${ROOT_ID} button {
        padding: 5px 9px;
        border-radius: 7px;
        border: 1px solid color-mix(in srgb, CanvasText 25%, transparent);
        background: ButtonFace;
        color: ButtonText;
        cursor: pointer;
      }
      #${ROOT_ID} button:hover { filter: brightness(1.08); }
      #${ROOT_ID} .bfaoh-primary {
        font-weight: 700;
      }
      #${ROOT_ID} .bfaoh-list-wrap {
        min-height: 0;
        overflow: auto;
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
        background: color-mix(in srgb, Canvas 94%, CanvasText 6%);
      }
      #${ROOT_ID} ol {
        margin: 0;
        padding: 8px 8px 8px 34px;
      }
      #${ROOT_ID} li {
        margin: 6px 0;
        padding: 8px;
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, CanvasText 15%, transparent);
        background: Canvas;
      }
      #${ROOT_ID} li[draggable="true"] { cursor: grab; }
      #${ROOT_ID} li.bfaoh-dragging { opacity: 0.45; }
      #${ROOT_ID} .bfaoh-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        align-items: center;
      }
      #${ROOT_ID} .bfaoh-name {
        font-weight: 650;
      }
      #${ROOT_ID} .bfaoh-meta {
        margin-top: 3px;
        opacity: 0.72;
        font-size: 11px;
        line-height: 1.45;
        word-break: break-all;
      }
      #${ROOT_ID}.bfaoh-hide-ids .bfaoh-id-line { display: none; }
      #${ROOT_ID} .bfaoh-item-buttons {
        display: flex;
        gap: 4px;
      }
      #${ROOT_ID} .bfaoh-item-buttons button {
        padding: 3px 7px;
        font-size: 12px;
      }
      #${ROOT_ID} .bfaoh-status {
        min-height: 1.4em;
        font-size: 12px;
        opacity: 0.84;
      }
      #${ROOT_ID} .bfaoh-restore-backdrop {
        position: absolute;
        inset: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(0, 0, 0, 0.5);
      }
      #${ROOT_ID} .bfaoh-dialog {
        width: min(760px, 92vw);
        max-height: 82vh;
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        gap: 10px;
        padding: 14px;
        border-radius: 12px;
        background: Canvas;
        color: CanvasText;
        border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45);
      }
      #${ROOT_ID} .bfaoh-dialog h3 {
        margin: 0;
        font-size: 16px;
      }
      #${ROOT_ID} .bfaoh-dialog p {
        margin: 0;
        font-size: 12px;
        line-height: 1.5;
        opacity: 0.78;
      }
      #${ROOT_ID} .bfaoh-dialog textarea {
        width: 100%;
        min-height: 220px;
        resize: vertical;
        padding: 9px;
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
        background: Canvas;
        color: CanvasText;
        font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
        font-size: 12px;
        line-height: 1.45;
      }
      #${ROOT_ID} .bfaoh-dialog-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
      }
      #${ROOT_ID} .bfaoh-warning {
        font-size: 11px;
        opacity: 0.72;
      }
    `;
    document.head.appendChild(style);
  }

  function orderItemsByWidgetIds(items, widgetIds) {
    const byId = new Map(items.map((item) => [item.widgetId, item]));
    const used = new Set();
    const ordered = [];

    widgetIds.forEach((id) => {
      if (byId.has(id) && !used.has(id)) {
        ordered.push(byId.get(id));
        used.add(id);
      }
    });

    items.forEach((item) => {
      if (!used.has(item.widgetId)) ordered.push(item);
    });

    return ordered;
  }

  function initApi() {
    const existing = window.BelkaFirefoxAddonOrderHelper || {};
    window.BelkaFirefoxAddonOrderHelper = Object.assign(existing, {
      app: APP_NAME,
      version: VERSION,
      preference: PREF_NAME,
      area: AREA_NAME,
      lastBackup: existing.lastBackup || null,
      restoreLastBackup() {
        if (!this.lastBackup || typeof this.lastBackup.oldValue !== "string") {
          console.warn(`[${APP_NAME}] No in-session backup is available.`);
          return false;
        }
        Services.prefs.setStringPref(PREF_NAME, this.lastBackup.oldValue);
        console.log(`[${APP_NAME}] Restored previous ${PREF_NAME}. Restart Firefox to check the result.`);
        return true;
      },
      printCurrentBackup() {
        const raw = Services.prefs.getStringPref(PREF_NAME);
        return printBackup(t("backupIntro"), raw);
      },
      close() {
        removeExistingUI();
      }
    });
  }

  async function main() {
    if (!checkEnvironment()) {
      fail(t("envError"));
      return;
    }

    let readResult;
    try {
      readResult = readCustomizationState();
    } catch (error) {
      fail(error.message || t("prefError"));
      return;
    }

    const addons = (await AddonManager.getAddonsByTypes(["extension"]))
      .filter(isUserExtension)
      .map((addon) => ({
        addon,
        name: addon.name || addon.id,
        widgetId: widgetIdFromAddon(addon),
        area: areaKeyForWidget(readResult.state, widgetIdFromAddon(addon))
      }))
      .sort(compareByName("asc"));

    if (!addons.length) {
      fail(t("noAddons"));
      return;
    }

    initApi();
    removeExistingUI();
    buildStyle();

    let items = addons.slice();
    let showIds = false;
    let dragItem = null;

    const root = document.createElement("div");
    root.id = ROOT_ID;
    document.body.appendChild(root);

    const panel = document.createElement("section");
    panel.className = "bfaoh-panel";
    root.appendChild(panel);

    const header = document.createElement("header");
    header.innerHTML = `<h2 class="bfaoh-title"></h2><div class="bfaoh-subtitle"></div>`;
    header.querySelector(".bfaoh-title").textContent = `${t("title")} v${VERSION}`;
    header.querySelector(".bfaoh-subtitle").textContent = t("subtitle");
    panel.appendChild(header);

    const buttonBar = document.createElement("div");
    buttonBar.className = "bfaoh-buttons";
    panel.appendChild(buttonBar);

    const applyBtn = createButton(t("apply"));
    applyBtn.className = "bfaoh-primary";
    const currentBtn = createButton(t("getCurrent"));
    const azBtn = createButton(t("sortAZ"));
    const zaBtn = createButton(t("sortZA"));
    const idBtn = createButton(t("toggleIds"));
    const backupBtn = createButton(t("backup"));
    const restoreBtn = createButton(t("restoreBackup"));
    const closeBtn = createButton(t("close"), t("closeHint"));

    [applyBtn, currentBtn, azBtn, zaBtn, idBtn, backupBtn, restoreBtn, closeBtn].forEach((button) => buttonBar.appendChild(button));

    const listWrap = document.createElement("div");
    listWrap.className = "bfaoh-list-wrap";
    const ol = document.createElement("ol");
    listWrap.appendChild(ol);
    panel.appendChild(listWrap);

    const footer = document.createElement("footer");
    const status = document.createElement("div");
    status.className = "bfaoh-status";
    status.textContent = t("statusReady");
    const warning = document.createElement("div");
    warning.className = "bfaoh-warning";
    warning.textContent = t("restartHint");
    footer.appendChild(status);
    footer.appendChild(warning);
    panel.appendChild(footer);

    function setStatus(message) {
      status.textContent = message;
    }

    function currentDomOrder() {
      return [...ol.querySelectorAll("li[data-widget-id]")].map((li) => li.dataset.widgetId);
    }

    function syncItemsFromDom() {
      const byId = new Map(items.map((item) => [item.widgetId, item]));
      items = currentDomOrder().map((id) => byId.get(id)).filter(Boolean);
    }

    function refreshAreaLabels() {
      let fresh;
      try {
        fresh = readCustomizationState().state;
      } catch (_error) {
        return;
      }
      items = items.map((item) => Object.assign({}, item, {
        area: areaKeyForWidget(fresh, item.widgetId)
      }));
    }

    function render() {
      ol.textContent = "";
      root.classList.toggle("bfaoh-hide-ids", !showIds);

      items.forEach((item) => {
        const li = document.createElement("li");
        li.draggable = true;
        li.dataset.widgetId = item.widgetId;

        const row = document.createElement("div");
        row.className = "bfaoh-row";
        li.appendChild(row);

        const text = document.createElement("div");
        row.appendChild(text);

        const name = document.createElement("div");
        name.className = "bfaoh-name";
        name.textContent = item.name;
        text.appendChild(name);

        const meta = document.createElement("div");
        meta.className = "bfaoh-meta";
        text.appendChild(meta);

        const area = document.createElement("div");
        area.textContent = `${t("areaLabel")}: ${areaLabel(item.area)}`;
        meta.appendChild(area);

        const idLine = document.createElement("div");
        idLine.className = "bfaoh-id-line";
        idLine.textContent = `${t("idLabel")}: ${item.widgetId}`;
        meta.appendChild(idLine);

        const itemButtons = document.createElement("div");
        itemButtons.className = "bfaoh-item-buttons";
        row.appendChild(itemButtons);

        const up = createButton("↑", t("moveUp"));
        const down = createButton("↓", t("moveDown"));
        itemButtons.appendChild(up);
        itemButtons.appendChild(down);

        up.addEventListener("click", (event) => {
          event.stopPropagation();
          const previous = li.previousElementSibling;
          if (previous) {
            previous.before(li);
            syncItemsFromDom();
          }
        });

        down.addEventListener("click", (event) => {
          event.stopPropagation();
          const next = li.nextElementSibling;
          if (next) {
            next.after(li);
            syncItemsFromDom();
          }
        });

        ol.appendChild(li);
      });
    }


    function openRestoreDialog() {
      const oldDialog = root.querySelector(".bfaoh-restore-backdrop");
      if (oldDialog) oldDialog.remove();

      const backdrop = document.createElement("div");
      backdrop.className = "bfaoh-restore-backdrop";
      root.appendChild(backdrop);

      const dialog = document.createElement("section");
      dialog.className = "bfaoh-dialog";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      backdrop.appendChild(dialog);

      const title = document.createElement("h3");
      title.textContent = t("restoreDialogTitle");
      dialog.appendChild(title);

      const description = document.createElement("p");
      description.textContent = t("restoreDialogText");
      dialog.appendChild(description);

      const textarea = document.createElement("textarea");
      textarea.placeholder = t("restorePastePlaceholder");
      textarea.spellcheck = false;
      dialog.appendChild(textarea);

      const dialogButtons = document.createElement("div");
      dialogButtons.className = "bfaoh-dialog-buttons";
      dialog.appendChild(dialogButtons);

      const restoreApplyBtn = createButton(t("restoreApply"));
      restoreApplyBtn.className = "bfaoh-primary";
      const restoreCancelBtn = createButton(t("restoreCancel"));
      dialogButtons.appendChild(restoreCancelBtn);
      dialogButtons.appendChild(restoreApplyBtn);

      function closeDialog() {
        backdrop.remove();
      }

      restoreCancelBtn.addEventListener("click", closeDialog);
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) closeDialog();
      });

      restoreApplyBtn.addEventListener("click", () => {
        try {
          const restoreRaw = parseRestoreBackupText(textarea.value);
          const currentRaw = Services.prefs.getStringPref(PREF_NAME);
          const backup = printBackup(t("backupIntro"), currentRaw, restoreRaw);
          Services.prefs.setStringPref(PREF_NAME, restoreRaw);
          window.BelkaFirefoxAddonOrderHelper.lastBackup = backup;

          const { state } = readCustomizationState();
          items = orderItemsByWidgetIds(items, state.placements[AREA_NAME]);
          refreshAreaLabels();
          render();
          setStatus(t("statusRestored"));
          closeDialog();
        } catch (error) {
          setStatus(error.message || t("restoreParseError"));
          textarea.focus();
        }
      });

      setStatus(t("statusRestoreOpened"));
      setTimeout(() => textarea.focus(), 0);
    }

    ol.addEventListener("dragstart", (event) => {
      const li = event.target.closest("li[data-widget-id]");
      if (!li) return;
      dragItem = li;
      li.classList.add("bfaoh-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", li.dataset.widgetId);
    });

    ol.addEventListener("dragover", (event) => {
      if (!dragItem) return;
      event.preventDefault();
      const target = event.target.closest("li[data-widget-id]");
      if (!target || target === dragItem) return;

      const rect = target.getBoundingClientRect();
      const insertAfter = event.clientY > rect.top + rect.height / 2;
      if (insertAfter) {
        target.after(dragItem);
      } else {
        target.before(dragItem);
      }
    });

    ol.addEventListener("dragend", () => {
      if (dragItem) dragItem.classList.remove("bfaoh-dragging");
      dragItem = null;
      syncItemsFromDom();
    });

    currentBtn.addEventListener("click", () => {
      try {
        const { state } = readCustomizationState();
        const currentOrder = state.placements[AREA_NAME];
        items = orderItemsByWidgetIds(items, currentOrder);
        refreshAreaLabels();
        render();
        setStatus(t("statusCurrent"));
      } catch (error) {
        fail(error.message || t("prefError"));
      }
    });

    azBtn.addEventListener("click", () => {
      items.sort(compareByName("asc"));
      render();
      setStatus(t("statusSortedAZ"));
    });

    zaBtn.addEventListener("click", () => {
      items.sort(compareByName("desc"));
      render();
      setStatus(t("statusSortedZA"));
    });

    idBtn.addEventListener("click", () => {
      showIds = !showIds;
      root.classList.toggle("bfaoh-hide-ids", !showIds);
    });

    backupBtn.addEventListener("click", async () => {
      const raw = Services.prefs.getStringPref(PREF_NAME);
      const backup = printBackup(t("backupIntro"), raw);
      const copied = await copyTextToClipboard(makeBackupClipboardText(backup));
      if (copied) {
        setTemporaryButtonText(backupBtn, t("copiedButton"));
        setStatus(t("statusBackupCopied"));
      } else {
        setTemporaryButtonText(backupBtn, t("copyFailedButton"), 2000);
        setStatus(t("statusBackupCopyFailed"));
      }
    });

    restoreBtn.addEventListener("click", openRestoreDialog);

    closeBtn.addEventListener("click", () => removeExistingUI());

    applyBtn.addEventListener("click", async () => {
      try {
        syncItemsFromDom();
        const { raw: oldRaw, state } = readCustomizationState();
        const newOrder = items.map((item) => item.widgetId);
        state.placements[AREA_NAME] = newOrder;
        const newRaw = JSON.stringify(state);

        if (oldRaw === newRaw) {
          printBackup(t("backupIntro"), oldRaw);
          setStatus(t("statusNoChange"));
          return;
        }

        Services.prefs.setStringPref(PREF_NAME, newRaw);
        const backup = printBackup(t("backupIntro"), oldRaw, newRaw);
        window.BelkaFirefoxAddonOrderHelper.lastBackup = backup;
        const copied = await copyTextToClipboard(makeBackupClipboardText(backup));
        refreshAreaLabels();
        render();
        setStatus(copied ? t("statusAppliedCopied") : t("statusAppliedCopyFailed"));
      } catch (error) {
        fail(error.message || t("prefError"));
      }
    });

    render();

    console.log(`[${APP_NAME}] v${VERSION} loaded.`, {
      preference: PREF_NAME,
      area: AREA_NAME,
      locale: LOCALE,
      addons: addons.length,
      api: "window.BelkaFirefoxAddonOrderHelper"
    });
  }

  main().catch((error) => fail(error && error.message ? error.message : String(error)));
})();
