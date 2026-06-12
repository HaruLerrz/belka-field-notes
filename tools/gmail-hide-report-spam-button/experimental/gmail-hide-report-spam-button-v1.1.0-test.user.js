// ==UserScript==
// @name         Gmail Hide Report Spam Button (Experimental)
// @name:zh-TW   Gmail 隱藏回報垃圾郵件按鈕（實驗版：封存／刪除分隔線）
// @namespace    https://github.com/HaruLerrz
// @version      1.1.0-test
// @description  Experimental variant that hides Gmail's report spam button and adds a clearer separator between archive and delete.
// @description:zh-TW  實驗版本：隱藏 Gmail 的「回報垃圾郵件」按鈕，並在封存與刪除按鈕之間加入分隔線。
// @author       HaruLerrz
// @license      MIT
// @match        https://mail.google.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

/*
 * Repository designation: v1.1.0-test
 * Experimental development artifact; not the recommended public release.
 * Retained to document the trade-off between a small visual adjustment
 * and the added DOM observation, node movement, and maintenance cost.
 */

(function () {
'use strict';

/*
 * 隱藏 Gmail 的「回報垃圾郵件」按鈕。
 *
 * Gmail 目前以 act="9" 標記該按鈕。
 * 除了 display: none 以外，仍保留其他隱藏屬性，
 * 避免按鈕殘留尺寸、焦點或點擊區域。
 */
GM_addStyle([
    '[role="button"][act="9"] {',
    '    display: none !important;',
    '    visibility: hidden !important;',
    '    width: 0 !important;',
    '    height: 0 !important;',
    '    opacity: 0 !important;',
    '    pointer-events: none !important;',
    '}'
].join('\n'));

/*
 * 用來識別由本腳本建立的刪除按鈕獨立群組。
 * Gmail 原生 class 可能相同，因此另外加入自訂 class，
 * 避免同一個按鈕被重複移動。
 */
var DELETE_GROUP_CLASS = 'belka-delete-toolbar-group';

/*
 * 防止 MutationObserver 在短時間內連續觸發大量更新。
 * 同一個畫面更新週期只安排一次處理。
 */
var updateScheduled = false;

/*
 * 找出頁面中的所有刪除按鈕，
 * 並將它們從原本與封存共用的群組，
 * 移到單獨建立的工具列群組中。
 */
function separateDeleteButtons() {
    var deleteButtons = document.querySelectorAll(
        '[role="button"][act="10"]'
    );

    for (var i = 0; i < deleteButtons.length; i += 1) {
        var deleteButton = deleteButtons[i];
        var currentGroup = deleteButton.parentElement;

        /*
         * 只處理 Gmail 工具列中的 .G-Ni 群組。
         * 已經位於自訂群組中的按鈕不再重複處理。
         */
        if (
            !currentGroup ||
            !currentGroup.classList.contains('G-Ni') ||
            currentGroup.classList.contains(DELETE_GROUP_CLASS)
        ) {
            continue;
        }

        var toolbar = currentGroup.parentElement;

        if (!toolbar) {
            continue;
        }

        /*
         * 檢查目前工具列是否已經建立刪除按鈕群組。
         * 同一個工具列只建立一個自訂群組。
         */
        var deleteGroup = toolbar.querySelector(
            '.' + DELETE_GROUP_CLASS
        );

        if (!deleteGroup) {
            var nextNativeGroup = currentGroup.nextElementSibling;

            deleteGroup = document.createElement('div');

            /*
             * 優先沿用下一個 Gmail 原生群組的 class，
             * 讓新群組盡量保持 Gmail 原本的間距與樣式。
             */
            if (nextNativeGroup) {
                deleteGroup.className =
                    nextNativeGroup.className +
                    ' ' +
                    DELETE_GROUP_CLASS;
            } else {
                /*
                 * 找不到下一個原生群組時，
                 * 使用目前已知的基本 Gmail 群組 class。
                 */
                deleteGroup.className =
                    'G-Ni J-J5-Ji ' +
                    DELETE_GROUP_CLASS;
            }

            /*
             * 將新群組插入原群組之後，
             * 保持「封存 → 刪除 → 其他操作」的順序。
             */
            toolbar.insertBefore(
                deleteGroup,
                currentGroup.nextSibling
            );
        }

        /*
         * 將刪除按鈕移入獨立群組。
         * appendChild 會移動既有節點，不會複製按鈕。
         */
        deleteGroup.appendChild(deleteButton);
    }
}

/*
 * 將實際處理延後到下一個畫面更新週期，
 * 合併 Gmail 動態載入期間的多次 DOM 變動。
 */
function scheduleUpdate() {
    if (updateScheduled) {
        return;
    }

    updateScheduled = true;

    window.requestAnimationFrame(function () {
        updateScheduled = false;
        separateDeleteButtons();
    });
}

/*
 * 頁面初次載入時先執行一次。
 */
scheduleUpdate();

/*
 * Gmail 會在切換郵件、勾選郵件或返回列表時重建工具列。
 * 監控頁面節點變動，工具列重建後再重新處理。
 */
var observer = new MutationObserver(scheduleUpdate);

observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log('Gmail 工具列防誤觸調整已套用');

})();
