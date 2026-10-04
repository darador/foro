import DOMPurify from 'isomorphic-dompurify';

/**
 * Robust, allowlist-based HTML sanitization for post and comment text.
 * Uses DOMPurify to strip all dangerous elements (script, iframe, object, embed, svg, math, style,
 * event handlers, javascript:, vbscript:, data: URIs) while permitting safe formatting tags for MVP.
 */

export function sanitizeHtml(input: string): string {
  if (!input) return '';

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['p', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'blockquote', 'br', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?):)/i,
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input'],
    FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload', 'onmouseover', 'onmouseout'],
  });
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // Separate accent marks
    .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
    .replace(/[^a-z0-9 -]/g, '') // Remove non-alphanumeric chars
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/-+/g, '-') // Replace multiple - with single -
    .substring(0, 80); // Limit length
}

export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_ -]/g, '')
    .replace(/\s+/g, '-');
}
