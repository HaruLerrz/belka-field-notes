// Sanitized example: publication decision based on source quality and review state.
// This is not production code.

function decidePublication({
  verdict,
  validSourceCount,
  minimumSourcesToPublish = 5,
  hasUnmappedCitations = false,
  aiMarkedNeedsReview = false
}) {
  if (hasUnmappedCitations) {
    return {
      state: 'draft',
      reason: 'AI cited sources that were not present in the source map.'
    };
  }

  if (validSourceCount < minimumSourcesToPublish) {
    return {
      state: 'draft',
      reason: 'Valid source count is below the publication threshold.'
    };
  }

  if (aiMarkedNeedsReview || verdict === 'needs_review') {
    return {
      state: 'needs_review',
      reason: 'The draft has enough sources but still needs manual review.'
    };
  }

  return {
    state: 'publishable',
    reason: 'Source threshold and citation mapping checks passed.'
  };
}

module.exports = { decidePublication };
