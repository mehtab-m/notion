/**
 * Shared helpers for poster/cover images stored either as
 * /uploads/... paths or external http(s) URLs.
 */

function isExternalUrl(value) {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim());
}

function isUploadPath(value) {
  return typeof value === 'string' && value.trim().startsWith('/uploads/');
}

/**
 * Resolve image from multer file and/or body fields.
 * File upload always wins over URL.
 * @returns {{ ok: true, value: string|undefined } | { ok: false, error: string }}
 */
function resolveImageField(body, file, { fileField, urlFields }) {
  if (file) {
    return { ok: true, value: '/uploads/' + file.filename };
  }

  const raw = urlFields
    .map((key) => (typeof body?.[key] === 'string' ? body[key].trim() : ''))
    .find(Boolean);

  if (!raw) return { ok: true, value: undefined };

  if (isExternalUrl(raw) || isUploadPath(raw)) {
    return { ok: true, value: raw };
  }

  return {
    ok: false,
    error: `${fileField} must be an http(s) URL or an uploaded image`,
  };
}

module.exports = { isExternalUrl, isUploadPath, resolveImageField };
