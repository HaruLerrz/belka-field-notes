// Sanitized example: classify key status from explicit HTTP status.
// This is not production code.

function shouldMarkSearchKeyUnavailable(attempt = {}) {
  const status = Number(attempt.status || 0);

  // Successful responses can contain ordinary page text such as
  // "developer token" or "redir_token". That content must not burn a key.
  if (status >= 200 && status < 300) return false;

  // Only explicit auth, payment, permission, or rate-limit responses are
  // treated as key-level failures.
  return [401, 402, 403, 429].includes(status);
}

module.exports = { shouldMarkSearchKeyUnavailable };
