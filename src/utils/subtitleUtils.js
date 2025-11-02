/**
 * File Name      : subtitleUtils.js
 * Description    : Utility functions for subtitle management and text normalization.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Last Updated   : 2025-11-02
 * Version        : 1.0.0
 * 
 * Note: This is an ES6 module used by extension pages and other modules
 *       NOT loaded as content script
 */

/**
 * Normalize a title string by removing technical tags, years, punctuation, accents, etc.
 * Used for comparing subtitle titles with show names.
 * @param {string} raw - Raw title string
 * @returns {string} - Normalized title
 */
export function normalizeTitle(raw) {
  if (!raw) return "";
  
  // Remove technical tags, resolutions, codecs, languages, etc.
  const TECH_RE = /\b(1080p|2160p|720p|webrip|web|bluray|bdrip|dvdrip|hdrip|x264|x265|aac|ddp\.?5?\.?1?|dts|proper|repack|multi|vostfr|vf|vo|eng|sub|subs|internal)\b/gi;
  const BRACKETS = /\[(?:[^\]]+)\]|\((?:[^\)]+)\)|\{(?:[^\}]+)\}/g;

  let s = String(raw).toLowerCase();
  s = s.replace(BRACKETS, " ");
  s = s.replace(TECH_RE, " ");
  s = s.replace(/[-_.]+/g, " ");
  
  // Remove years (2021), tags like S01E01, but keep S01E01 if useful elsewhere
  s = s.replace(/\b\d{4}\b/g, " ");
  
  // Remove punctuation and accents
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[^\w\s]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  
  return s;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} - Edit distance
 */
export function levenshtein(a, b) {
  if (!a || !b) return (a === b) ? 0 : Math.max(a ? a.length : 0, b ? b.length : 0);
  
  const al = a.length, bl = b.length;
  const dp = Array.from({ length: al + 1 }, (_, i) => i);
  
  for (let j = 1; j <= bl; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= al; i++) {
      const cur = dp[i];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + cost);
      prev = cur;
    }
  }
  
  return dp[al];
}

/**
 * Calculate similarity ratio between two strings (0 to 1)
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} - Similarity ratio (1 = identical, 0 = completely different)
 */
export function similarityRatio(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  
  const dist = levenshtein(a, b);
  return 1 - (dist / Math.max(a.length, b.length));
}
