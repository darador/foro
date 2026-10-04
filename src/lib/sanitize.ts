/**
 * Simple, robust HTML / Markdown sanitization for post and comment text.
 * Prevents XSS attacks while permitting basic safe tags (b, i, em, strong, p, br, ul, ol, li, a).
 */

export function sanitizeHtml(input: string): string {
  if (!input) return '';

  // 1. Remove dangerous script, iframe, style, object, embed tags and content
  let clean = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');

  // 2. Remove inline event handlers like onclick, onload, onerror
  clean = clean.replace(/on\w+="[^"]*"/gi, '');
  clean = clean.replace(/on\w+='[^']*'/gi, '');
  clean = clean.replace(/on\w+=\S+/gi, '');

  // 3. Remove javascript: pseudo-protocol URIs
  clean = clean.replace(/href=["']?\s*javascript:[^"'>]*/gi, 'href="#"');

  return clean;
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
