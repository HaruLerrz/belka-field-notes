const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
const SORT_STORAGE_KEY = 'belka-3d-home-sort';
const VALID_SORT_ORDERS = new Set(['newest-first', 'oldest-first']);

const titleEl = document.querySelector('#showcase-title');
const subtitleEl = document.querySelector('#showcase-subtitle');
const footerEl = document.querySelector('#site-footer');
const gridEl = document.querySelector('#works-grid');
const countEl = document.querySelector('#works-count');
const sortEl = document.querySelector('#works-sort');

let publishedWorks = [];

const PREFETCHED_ASSETS = new Set();
const HOVER_PREFETCH_DELAY = 550;
const VIEWER_BUNDLE_URL = `shared/viewer.bundle.min.js?v=20260616002458`;
const VIEWER_CSS_URL = `shared/viewer.css?v=20260616002458`;

function mayPrefetchLargeAssets() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection?.saveData) return false;
  return !['slow-2g', '2g'].includes(connection?.effectiveType);
}

function prefetchAsset(href, as = 'fetch') {
  if (!href || PREFETCHED_ASSETS.has(href)) return;
  PREFETCHED_ASSETS.add(href);

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  if (as) link.as = as;
  document.head.append(link);
}

function prefetchViewerRuntime() {
  prefetchAsset(VIEWER_BUNDLE_URL, 'script');
  prefetchAsset(VIEWER_CSS_URL, 'style');
}

function preferredModelUrl(work) {
  if (work.model) return work.model;
  const base = work.legacyBase || `works/${work.id}`;
  return work.legacyBase
    ? `${base}/models/model.glb`
    : `${base}/model.glb`;
}

function attachCardPrefetch(card, work) {
  if (!mayPrefetchLargeAssets()) return;

  let timer = null;
  const start = () => {
    clearTimeout(timer);
    timer = setTimeout(() => prefetchAsset(preferredModelUrl(work), 'fetch'), HOVER_PREFETCH_DELAY);
  };
  const cancel = () => clearTimeout(timer);

  card.addEventListener('pointerenter', start, { passive: true });
  card.addEventListener('pointerleave', cancel, { passive: true });
  card.addEventListener('pointerdown', () => prefetchAsset(preferredModelUrl(work), 'fetch'), { passive: true });
}

function scheduleViewerPrefetch() {
  const run = () => prefetchViewerRuntime();
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1600 });
  else setTimeout(run, 900);
}


function assetCandidates(work, kind) {
  if (kind === 'image') {
    if (work.image) return [work.image];
    const base = work.legacyBase || `works/${work.id}`;
    const prefix = work.legacyBase ? `${base}/images/original` : `${base}/original`;
    return IMAGE_EXTENSIONS.map((ext) => `${prefix}${ext}`);
  }

  if (work.model) return [work.model];
  const base = work.legacyBase || `works/${work.id}`;
  const prefix = work.legacyBase ? `${base}/models/model` : `${base}/model`;
  return ['.glb', '.obj', '.stl', '.ply'].map((ext) => `${prefix}${ext}`);
}

function tryImages(img, fallback, urls, index = 0) {
  if (index >= urls.length) {
    img.hidden = true;
    fallback.hidden = false;
    return;
  }

  img.onload = () => {
    img.hidden = false;
    fallback.hidden = true;
  };
  img.onerror = () => tryImages(img, fallback, urls, index + 1);
  img.src = urls[index];
}

function makeCard(work) {
  const card = document.createElement('a');
  card.className = 'work-card';
  card.href = work.page || `viewer/?id=${encodeURIComponent(work.id)}`;
  card.style.setProperty('--card-accent', work.accentColor || '#9d78ff');
  card.dataset.workId = work.id;

  const media = document.createElement('div');
  media.className = 'card-media';

  const image = document.createElement('img');
  image.alt = `${work.title}原始參考圖`;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.fetchPriority = 'low';
  image.hidden = true;

  const fallback = document.createElement('div');
  fallback.className = 'card-fallback';
  fallback.innerHTML = '<span>◇</span><small>尚未放入原圖</small>';

  media.append(image, fallback);

  const body = document.createElement('div');
  body.className = 'card-body';

  const heading = document.createElement('h2');
  heading.textContent = work.title;

  const description = document.createElement('p');
  description.textContent = work.description || '';

  const action = document.createElement('span');
  action.className = 'card-action';
  action.textContent = '查看 3D 模型 →';

  body.append(heading, description, action);
  card.append(media, body);
  tryImages(image, fallback, assetCandidates(work, 'image'));
  attachCardPrefetch(card, work);
  return card;
}

function readStoredSortOrder() {
  try {
    const saved = localStorage.getItem(SORT_STORAGE_KEY);
    return VALID_SORT_ORDERS.has(saved) ? saved : 'newest-first';
  } catch {
    return 'newest-first';
  }
}

function saveSortOrder(value) {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, value);
  } catch {
  }
}

function sortedWorks(order) {
  const copy = [...publishedWorks];
  return order === 'newest-first' ? copy.reverse() : copy;
}

function renderWorks() {
  const order = VALID_SORT_ORDERS.has(sortEl.value)
    ? sortEl.value
    : 'newest-first';

  const works = sortedWorks(order);
  countEl.textContent = `${works.length} 件作品`;

  if (!works.length) {
    gridEl.innerHTML = '<p class="empty-list">尚未設定展示作品。</p>';
    return;
  }

  gridEl.replaceChildren(...works.map(makeCard));
}

async function boot() {
  try {
    sortEl.value = readStoredSortOrder();

    const response = await fetch('works.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    document.title = data.site?.title || '3D Model Showcase';
    titleEl.textContent = data.site?.title || '3D Model Showcase';
    subtitleEl.textContent = data.site?.subtitle || '';
    footerEl.textContent = data.site?.footer || '';

    publishedWorks = (data.works || []).filter((work) => work.published !== false);
    renderWorks();
    scheduleViewerPrefetch();
  } catch (error) {
    console.error(error);
    subtitleEl.textContent = '作品清單載入失敗';
    countEl.textContent = '載入失敗';
    gridEl.innerHTML = `<div class="error-card">無法讀取 works.json：${String(error.message || error)}</div>`;
  }
}

sortEl.addEventListener('change', () => {
  saveSortOrder(sortEl.value);
  renderWorks();
});

boot();
