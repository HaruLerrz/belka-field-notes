// ==UserScript==
// @name         Gmail Hide Report Spam Button
// @name:zh-TW   Gmail 隱藏回報垃圾郵件按鈕
// @namespace    https://github.com/HaruLerrz
// @version      1.0.0
// @description  Hide Gmail's report spam button to reduce accidental clicks.
// @description:zh-TW  透過 CSS 隱藏 Gmail 的「回報垃圾郵件」按鈕，降低誤觸機會。
// @author       HaruLerrz
// @match        https://mail.google.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`
        [role="button"][act="9"] {
            display: none !important;
            visibility: hidden !important;
            width: 0 !important;
            height: 0 !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }
    `);

    console.log('Gmail「回報垃圾郵件」按鈕隱藏樣式已套用');
})();