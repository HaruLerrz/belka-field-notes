// ==UserScript==
// @name         ChatGPT Usage Analytics Exporter（繁體中文）
// @namespace    https://haruz.art/
// @version      1.1.0
// @description  單次匯出 ChatGPT 用量分析各分類、Token、Credits、工具活動及額度資訊（JSON/CSV）。
// @author       Haruz & ChatGPT
// @match        https://chatgpt.com/settings/usage*
// @match        https://chatgpt.com/codex/cloud/settings/analytics*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // 安全設計：使用者點擊時才連到 chatgpt.com 的同源 API。
  // 僅輸出白名單允許的統計欄位；不輸出授權、帳號、聊天標題／內容或 thread ID。
  const DAYS = 45;
  const PREFIX = '/backend-api/wham';
  const MAX_ROWS = 20000;
  const MAX_DEPTH = 8;
  const METRIC_NAMES = new Set([
    'credits', 'estimated_credits', 'on_demand_credits', 'used_credits',
    'turns', 'threads', 'messages', 'users', 'count', 'total', 'value',
    'percent', 'percentage', 'share', 'rate', 'balance', 'remaining', 'used', 'limit',
    'uncached_text_input_tokens', 'cached_text_input_tokens', 'text_output_tokens',
    'text_total_tokens', 'input_tokens', 'output_tokens', 'total_tokens',
    'reasoning_tokens', 'cached_input_tokens', 'uncached_input_tokens',
    'premium_tokens', 'usage', 'token_count', 'turn_count',
  ]);
  const DIMENSIONS = new Set([
    'model', 'model_id', 'client', 'client_id', 'feature', 'mode', 'surface',
    'product_surface', 'reasoning_effort', 'reasoning', 'effort', 'speed',
    'thread_source', 'turn_trigger', 'source', 'token_type', 'category',
    'plugin', 'plugin_name', 'skill', 'skill_name', 'tool', 'tool_name',
    'date', 'start_date', 'end_date',
  ]);
  const CONTAINERS = new Set([
    'data', 'totals', 'clients', 'models', 'groups', 'dimensions', 'attribution',
    'product_surface_usage_values', 'model_usage_values', 'client_usage_values',
    'reasoning_effort_usage_values', 'speed_usage_values', 'mode_usage_values',
    'premium_usage_values', 'feature_usage_values', 'thread_source_usage_values',
    'turn_trigger_usage_values', 'tokens', 'metrics', 'breakdown', 'breakdowns',
  ]);
  const PROHIBITED = /auth|token[._-]?id|access[._-]?token|bearer|session|cookie|secret|password|\bemail\b|\bphone\b|account|organization|profile|conversation|thread[._-]?id|message[._-]?id|user[._-]?id|prompt|content|title|url|ip[._-]?address/i;
  const dateRE = /^\d{4}-\d{2}-\d{2}$/;
  const mapKeyRE = /^[\p{L}\p{N}_.: /+\-]{1,100}$/u;

  const pad2 = (n) => String(n).padStart(2, '0');
  const localDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const stamp = (d) => `${localDay(d)}_${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}`;
  function shiftDay(d, count) {
    const n = new Date(d);
    n.setDate(n.getDate() + count);
    return n;
  }
  function numericField(key) {
    return METRIC_NAMES.has(key) || /(?:_tokens|_credits|_counts|_percent|_percentage|_total|_turns|_usage|_micros|_count)$/.test(key);
  }
  function nestedField(key) {
    return CONTAINERS.has(key) || /(?:_usage_values|_by_surface|_by_model|_by_client|_by_reasoning|_by_effort|_by_speed|_by_feature|_by_mode|_by_source|_breakdown|_breakdowns)$/.test(key);
  }
  function validString(key, str) {
    if (!DIMENSIONS.has(key) || typeof str !== 'string' || str.length > 160) return false;
    return key === 'date' || key === 'start_date' || key === 'end_date' ? dateRE.test(str) : true;
  }
  // 只有 API 中的統計容器才容許「分類名稱 -> 數值」的動態 key。
  // 對其他欄位堅持允許清單，避免將個資或敏感識別碼放入輸出。
  function clean(value, depth = 0, inNumericMap = false) {
    if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return undefined;
    if (Array.isArray(value)) {
      return value.slice(0, MAX_ROWS).map((item) => clean(item, depth + 1, false)).filter((x) => x !== undefined);
    }
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (PROHIBITED.test(key)) continue;
      if (typeof item === 'number' && Number.isFinite(item)) {
        if (numericField(key) || (inNumericMap && mapKeyRE.test(key))) result[key] = item;
      } else if (validString(key, item)) {
        result[key] = item;
      } else if (item && typeof item === 'object' && nestedField(key)) {
        const child = clean(item, depth + 1, !Array.isArray(item));
        if (child !== undefined) result[key] = child;
      } else if (inNumericMap && item && typeof item === 'object' && mapKeyRE.test(key)) {
        const child = clean(item, depth + 1, true);
        if (child !== undefined) result[key] = child;
      }
    }
    return result;
  }
  function cleanDays(source) {
    if (!Array.isArray(source?.data)) return [];
    return source.data.filter((x) => dateRE.test(x?.date || ''))
      .slice(0, MAX_ROWS).map((day) => ({ date: day.date, ...clean(day) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  function quotas(source) {
    const windows = [];
    const seen = new WeakSet();
    const fields = ['limit_window_seconds', 'reset_at', 'used_percent', 'remaining_percent', 'limit', 'used', 'remaining'];
    function visit(node, path, depth) {
      if (!node || typeof node !== 'object' || depth > 7 || seen.has(node)) return;
      seen.add(node);
      if (!Array.isArray(node) && Number.isFinite(node.limit_window_seconds) && Number.isFinite(node.reset_at)) {
        const w = { path };
        for (const field of fields) if (Number.isFinite(node[field])) w[field] = node[field];
        if (Number.isFinite(w.reset_at)) w.reset_at_iso = new Date(w.reset_at * 1000).toISOString();
        windows.push(w);
      }
      for (const [key, child] of Object.entries(node)) {
        if (PROHIBITED.test(key)) continue;
        if (/^\d+$/.test(key) || /rate|limit|primary|secondary|weekly|window|additional|codex|spark|usage/i.test(key)) {
          visit(child, `${path}.${key}`, depth + 1);
        }
      }
    }
    visit(source?.rate_limit || {}, 'rate_limit', 0);
    visit(source?.additional_rate_limits || {}, 'additional_rate_limits', 0);
    return windows;
  }
  function flatten(report) {
    const rows = [];
    const sources = [
      ['daily_usage', report.daily_usage],
      ['daily_model_tokens', report.daily_model_tokens],
      ['daily_category_shares', report.daily_category_shares],
      ['daily_plugin_activity', report.daily_plugin_activity],
      ['daily_skill_activity', report.daily_skill_activity],
    ];
    function add(source, date, path, category, metric, value) {
      if (rows.length < MAX_ROWS && typeof value === 'number' && Number.isFinite(value)) {
        rows.push({ date, source, dimension: path, category: category || '(all)', metric, value });
      }
    }
    function traverse(obj, ctx, depth = 0) {
      if (depth > MAX_DEPTH || rows.length >= MAX_ROWS || !obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        for (const [i, item] of obj.entries()) {
          if (typeof item !== 'object' || item === null) continue;
          const categoryParts = [];
          for (const name of DIMENSIONS) {
            if (name !== 'date' && name !== 'start_date' && name !== 'end_date' && typeof item[name] === 'string') {
              categoryParts.push(`${name}=${item[name]}`);
            }
          }
          if (item.dimensions && typeof item.dimensions === 'object') {
            for (const [key, value] of Object.entries(item.dimensions)) {
              if (typeof value === 'string') categoryParts.push(`${key}=${value}`);
            }
          }
          traverse(item, { ...ctx, category: categoryParts.join(' | ') || `${ctx.category || ctx.path}[${i}]` }, depth + 1);
        }
        return;
      }
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'date') continue;
        if (typeof value === 'number') {
          if (ctx.numericMap && !numericField(key)) add(ctx.source, ctx.date, ctx.path, key, 'value', value);
          else add(ctx.source, ctx.date, ctx.path, ctx.category, key, value);
        } else if (value && typeof value === 'object' && key !== 'dimensions') {
          traverse(value, { ...ctx, path: ctx.path ? `${ctx.path}.${key}` : key, numericMap: nestedField(key) && !Array.isArray(value) }, depth + 1);
        }
      }
    }
    for (const [source, days] of sources) {
      for (const day of days) {
        traverse(day, { date: day.date, source, path: '', category: '', numericMap: false });
      }
    }
    return rows;
  }
  function getToken() {
    const raw = document.getElementById('client-bootstrap')?.textContent || '';
    return raw.match(/[\w-]{30,}\.[\w-]{30,}\.[\w-]{30,}/)?.[0] || null;
  }
  async function readEndpoint(path) {
    const token = getToken();
    const options = { method: 'GET', credentials: 'include', cache: 'no-store', headers: {} };
    if (token) options.headers.Authorization = `Bearer ${token}`;
    const response = await fetch(path, options);
    if (!response.ok) throw new Error(`HTTP ${response.status} (${path.split('?')[0]})`);
    return response.json();
  }
  async function collect() {
    if (location.hostname !== 'chatgpt.com') throw new Error('請在官方 ChatGPT 網站操作。');
    const now = new Date();
    const first = localDay(shiftDay(now, -(DAYS - 1)));
    const exclusive = localDay(shiftDay(now, 1));
    const dates = `start_date=${first}&end_date=${exclusive}&group_by=day`;
    const endpoints = [
      ['quota', `${PREFIX}/usage`],
      ['counts', `${PREFIX}/analytics/daily-workspace-usage-counts?${dates}`],
      ['model_token_details', `${PREFIX}/usage/daily-workspace-user-token-usage-breakdown?${dates}`],
      ['category_shares', `${PREFIX}/usage/daily-token-usage-breakdown?${dates}&units=percent`],
      ['plugin_activity', `${PREFIX}/analytics/daily-plugin-usage-metrics?${dates}&workspace_user=true&top_plugin_limit=100`],
      ['skill_activity', `${PREFIX}/analytics/daily-skill-usage-metrics?${dates}&workspace_user=true&top_skill_limit=100`],
    ];
    const received = {};
    const errors = [];
    for (const [name, path] of endpoints) {
      setStatus(`讀取 ${name}（${Object.keys(received).length + errors.length + 1}/${endpoints.length}）…`);
      try {
        received[name] = await readEndpoint(path);
      } catch (e) {
        errors.push(`${name}: ${e.message}`);
      }
    }
    if (!received.counts && !received.model_token_details && !received.category_shares && !received.quota) {
      throw new Error(`所有用量 API 都無法存取：${errors.join('；')}`);
    }
    const report = {
      schema: 'haruz.chatgpt-usage-export.v2',
      exported_at_iso: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
      requested_range: { start_date: first, end_date_exclusive: exclusive, days: DAYS },
      quota_windows: quotas(received.quota),
      daily_usage: cleanDays(received.counts),
      daily_model_tokens: cleanDays(received.model_token_details),
      daily_category_shares: cleanDays(received.category_shares),
      daily_plugin_activity: cleanDays(received.plugin_activity),
      daily_skill_activity: cleanDays(received.skill_activity),
      rows: [],
      diagnostics: { successful_sources: Object.keys(received), failed_sources: errors },
      notes: [
        '不需切換官方頁面選單。JSON 同時包含 API 提供的所有允許分類欄位。',
        '分類占比不等於該分類實際扣除的 Credits；不可直接以占比乘上購買額度推算帳單。',
        '來源 API 的空值/缺值表示未提供，並不代表零用量。',
        '五小時和每週歷史窗口若 API 未回傳，無法靠日彙總資料還原。',
        '匯出檔案未包含登入憑證、對話文字與帳號識別資訊。',
      ],
    };
    report.rows = flatten(report);
    report.diagnostics.dimensions_in_export = Array.from(new Set(report.rows.map((r) => r.dimension))).sort();
    report.diagnostics.truncated_rows = report.rows.length >= MAX_ROWS;
    return report;
  }
  function csvCell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
  function csvFromReport(report) {
    const head = ['date', 'source', 'dimension', 'category', 'metric', 'value'];
    const data = [head, ...report.rows.map((r) => head.map((key) => r[key]))];
    // Excel 開啟 CSV 時辨識繁體中文；腳本本身仍為 UTF-8 無 BOM。
    return '\ufeff' + data.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }
  function download(text, name, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
  let panel;
  let status;
  let working = false;
  function setStatus(message) { if (status) status.textContent = message; }
  async function exportReport(format) {
    if (working) return;
    working = true;
    for (const b of panel.querySelectorAll('button')) b.disabled = true;
    try {
      const report = await collect();
      const name = `ChatGPT_Usage_All_Dimensions_${stamp(new Date())}`;
      if (format === 'csv') download(csvFromReport(report), `${name}.csv`, 'text/csv;charset=utf-8');
      else download(JSON.stringify(report, null, 2) + '\n', `${name}.json`, 'application/json;charset=utf-8');
      setStatus(`完成：${report.daily_usage.length} 日／${report.rows.length} 筆分類數值${report.diagnostics.failed_sources.length ? '；部分來源不可用' : ''}`);
    } catch (error) {
      setStatus(`失敗：${error.message}`);
      console.warn('[ChatGPT Usage Exporter]', error.message);
    } finally {
      working = false;
      for (const b of panel.querySelectorAll('button')) b.disabled = false;
    }
  }
  function makeButton(label, format) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = 'padding:6px 9px;border-radius:7px;cursor:pointer;color:white;background:#167a68;border:1px solid #167a68;font-size:12px;';
    b.addEventListener('click', () => exportReport(format));
    return b;
  }
  function mount() {
    if (document.getElementById('haruz-usage-exporter')) return;
    panel = document.createElement('div');
    panel.id = 'haruz-usage-exporter';
    panel.style.cssText = 'position:fixed;bottom:12px;left:14px;z-index:2147483640;background:#fff;color:#222;padding:10px 12px;border:1px solid #ccc;border-radius:11px;box-shadow:0 4px 18px #0003;font-family:system-ui,sans-serif;font-size:12px;max-width:320px;';
    const title = document.createElement('div');
    title.textContent = `用量全分類匯出｜最近 ${DAYS} 天`;
    title.style.cssText = 'font-weight:650;margin-bottom:7px;';
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:7px;';
    buttons.append(makeButton('全分類 JSON', 'json'), makeButton('分類明細 CSV', 'csv'));
    status = document.createElement('div');
    status.textContent = '不用切選單；僅按下按鈕時取得資料';
    status.style.cssText = 'color:#666;margin-top:7px;font-size:11px;line-height:1.45;';
    panel.append(title, buttons, status);
    document.body.appendChild(panel);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
