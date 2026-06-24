// Sanitized example: check whether AI-cited source IDs exist in a known source map.
// This is not production code.

function validateCitedSources({ citedIds = [], sourceMap = [] }) {
  const known = new Map(
    sourceMap.map(source => [String(source.sourceId || source.source_id || '').toUpperCase(), source])
  );

  const valid = [];
  const missing = [];

  for (const rawId of citedIds) {
    const id = String(rawId || '').trim().toUpperCase();
    if (!id) continue;

    if (known.has(id)) {
      valid.push({ id, source: known.get(id) });
    } else {
      missing.push(id);
    }
  }

  return {
    validCount: valid.length,
    missingCount: missing.length,
    valid,
    missing,
    allMapped: missing.length === 0
  };
}

module.exports = { validateCitedSources };
