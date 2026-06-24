// Sanitized example: source selection and prompt-slot balancing.
// This is not production code.

function uniqueByUrl(sources) {
  const seen = new Set();
  const out = [];

  for (const source of sources) {
    const url = normalizeUrl(source.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ ...source, url });
  }

  return out;
}

function choosePromptSources({ submitted = [], discovered = [], totalLimit = 8, submittedCap = 4 }) {
  const submittedClean = uniqueByUrl(submitted).slice(0, submittedCap);
  const remaining = Math.max(0, totalLimit - submittedClean.length);

  const submittedUrls = new Set(submittedClean.map(item => item.url));
  const discoveredClean = uniqueByUrl(discovered)
    .filter(item => !submittedUrls.has(item.url))
    .slice(0, remaining);

  return [...submittedClean, ...discoveredClean].map((source, index) => ({
    ...source,
    sourceId: `S${String(index + 1).padStart(2, '0')}`
  }));
}

function normalizeUrl(input) {
  try {
    const parsed = new URL(String(input || '').trim());
    parsed.hash = '';

    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid']) {
      parsed.searchParams.delete(key);
    }

    return parsed.toString();
  } catch (_) {
    return '';
  }
}

module.exports = { choosePromptSources };
