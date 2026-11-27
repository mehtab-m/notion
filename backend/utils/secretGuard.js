/* Project workspace stores secret *references* only. Reject text that looks like
   a real secret: private keys, credential URLs, well-known token prefixes, AWS keys, JWTs. */
const PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /[a-z][a-z0-9+.-]*:\/\/[^\s/?#@:]*:[^\s/?#@]+@/i,
  /(sk_live_|rk_live_|sk_test_|ghp_|gho_|ghs_|ghr_|github_pat_|glpat-|xox[abposr]-|sb_secret_|sbp_)[A-Za-z0-9_-]{8,}/,
  /AKIA[0-9A-Z]{16}/,
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
];

function looksSecret(value) {
  if (value == null) return false;
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return PATTERNS.some((re) => re.test(s));
}

/** Throws a 400-friendly error naming the first field that holds secret material. */
function assertNoSecrets(data) {
  for (const [key, val] of Object.entries(data || {})) {
    if (looksSecret(val)) {
      const err = new Error(`"${key}" looks like it contains a secret. Store where the secret lives (vault path / $VAR), not the value.`);
      err.status = 400;
      err.field = key;
      throw err;
    }
  }
}

module.exports = { looksSecret, assertNoSecrets };
