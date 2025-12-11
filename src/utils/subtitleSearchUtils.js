/**
 * File Name      : subtitleSearchUtils.js
 * Description    : Advanced utility functions for subtitle search and matching.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Last Updated   : 2025-11-02
 * Version        : 1.0.0
 * 
 * Note: This is an ES6 module used by extension pages (popup, settings, services)
 *       NOT loaded as content script
 */

import { normalizeTitle, similarityRatio } from './subtitleUtils.js';

/**
 * Generate search query variations for better subtitle matching
 * @param {string} showName - Original show name
 * @param {number} episodeNumber - Episode number
 * @param {number|null} providedSeason - Season number (optional)
 * @returns {string[]} - Array of query variations
 */
export function generateSearchQueries(showName, episodeNumber, providedSeason = null, episodeTitle = null) {
  const queries = [];
  let cleanName = showName.replace(/\s+Season\s+\d+/gi, "").replace(/\s+\(\d{4}\)/g, "").trim();
  const epPadded = String(episodeNumber).padStart(2, "0");



  // If season known, push SxxExx patterns
  if (providedSeason) {
    const sP = String(providedSeason).padStart(2, "0");
    queries.push(`${cleanName} S${sP}E${epPadded}`);
    queries.push(`${cleanName} S${providedSeason}E${episodeNumber}`);
    queries.push(`${cleanName} ${providedSeason}x${episodeNumber}`);
  }

  if (episodeTitle && providedSeason == null && episodeNumber == "") {
    queries.push(`${episodeTitle}`);
    queries.push(`${cleanName} ${episodeTitle}`);
    return [...new Set(queries)];
  }
  else {
    if (episodeTitle) {
      queries.push(`${cleanName} ${episodeTitle}`);
      queries.push(`${episodeTitle}`);
      queries.push(`${cleanName} Ep${episodeNumber} ${episodeTitle}`);
    }
    queries.push(`${cleanName} ${episodeNumber}`);
    queries.push(`${cleanName} Ep${episodeNumber}`);
    queries.push(`${cleanName} Episode ${episodeNumber}`);
    queries.push(`${cleanName} E${epPadded}`);
  }


  // short name (first 4 words) + ep
  const words = cleanName.split(/\s+/);
  if (words.length > 3) {
    const shortName = words.slice(0, 4).join(' ');
    queries.push(`${shortName} ${episodeNumber}`);
    queries.push(`${shortName} E${epPadded}`);
  }

  // remove duplicates
  return [...new Set(queries)];
}

/**
 * Find the best matching subtitle from search results
 * @param {Array} results - Array of subtitle search results
 * @param {string} showName - Show name to match against
 * @param {number} episodeNumber - Episode number to match
 * @returns {object|null} - Best matching subtitle or null
 */
export function findBestMatch(results, showName, episodeNumber) {
  const normalizedShow = normalizeTitle(showName);
  const showWords = normalizedShow.split(/\s+/).filter(Boolean);
  const stop = new Set(['the', 'a', 'an', 'and', 'of', 'in', 'to', 'for', 'with', 'season', 'part']);
  const keyWords = showWords.filter(w => !stop.has(w)).slice(0, 6);

  let best = null;
  let bestScore = -1;

  for (const result of results) {
    const attrs = result.attributes || {};
    const feat = attrs.feature_details || {};
    const rawTitle = (feat.title || feat.movie_name || attrs.release || (attrs.files && attrs.files[0] && attrs.files[0].file_name) || "").toString();
    const resultTitleNorm = normalizeTitle(rawTitle);
    const resultEpisode = feat.episode_number ? Number(feat.episode_number) : null;

    const episodeMatch = (resultEpisode && !isNaN(resultEpisode) && Number(resultEpisode) === Number(episodeNumber)) ? 1 : 0;

    let keywordMatches = 0;
    for (const k of keyWords) if (k && resultTitleNorm.includes(k)) keywordMatches++;
    const keywordRatio = keyWords.length ? (keywordMatches / keyWords.length) : 0;

    const sim = similarityRatio(resultTitleNorm, normalizedShow);
    const epStringPresent = (/\bE(?:pisode)?\s*0*?(\d{1,3})\b/i.test(rawTitle) || new RegExp(`\\b${episodeNumber}\\b`).test(rawTitle)) ? 1 : 0;

    const score =
      (episodeMatch ? 4.0 : 0) +
      (keywordRatio * 2.0) +
      (sim * 2.0) +
      (epStringPresent ? 0.5 : 0);

    const dc = Number(attrs.download_count || 0);
    const finalScore = score + (Math.log10(Math.max(1, dc)) * 0.05);

    if (finalScore > bestScore) {
      bestScore = finalScore;
      best = { result, score: finalScore, details: { episodeMatch, keywordRatio, sim, dc, rawTitle } };
    }
  }

  if (!best) return null;
  if (best.score >= 2.0 || (best.details.episodeMatch && best.details.sim >= 0.25)) {
    console.log("findBestMatch: selected", best);
    return best.result;
  }

  console.log("findBestMatch: no sufficiently good match (best:)", best);
  return null;
}

/**
 * Deduplicate subtitle results by file ID
 * @param {Array} candidates - Array of subtitle candidates
 * @returns {Array} - Deduplicated array
 */
export function deduplicateByFileId(candidates) {
  const seen = new Set();
  return candidates.filter(c => {
    const fileId = c.item?.attributes?.files?.[0]?.file_id ?? c.item?.attributes?.file_id ?? c.item?.id;
    if (!fileId) return true;
    if (seen.has(fileId)) return false;
    seen.add(fileId);
    return true;
  });
}

/**
 * Extract season and episode information from a subtitle item
 * @param {object} item - Subtitle item from API
 * @returns {object} - {season, episode, title}
 */
export function extractSeasonEpisodeInfo(item) {
  const attrs = item?.attributes || {};
  const feat = attrs.feature_details || {};

  let season = feat.season_number ?? null;
  let episode = feat.episode_number ?? null;
  let title = feat.title || feat.movie_name || attrs.release ||
    (attrs.files && attrs.files[0] && attrs.files[0].file_name) || "";

  // Fallback: parse filename if season/episode missing
  if ((season === null || episode === null) && attrs.files && attrs.files.length > 0) {
    const fname = attrs.files[0].file_name || attrs.release || "";

    // Patterns: S01E02, S1E2, 01x02, 1x2
    const m = fname.match(/S?(\d{1,2})[ ._xX-]?(?:E|e|x)(\d{1,3})/);
    if (m) {
      season = season ?? parseInt(m[1], 10);
      episode = episode ?? parseInt(m[2], 10);
    } else {
      // Try 102 format (season 1 episode 02)
      const m2 = fname.match(/(?:^|[^\d])(\d)(\d{2})(?:[^\d]|$)/);
      if (m2) {
        season = season ?? parseInt(m2[1], 10);
        episode = episode ?? parseInt(m2[2], 10);
      }
    }

    if (!title) title = fname;
  }

  return {
    season: (season !== null && !isNaN(season)) ? Number(season) : null,
    episode: (episode !== null && !isNaN(episode)) ? Number(episode) : null,
    title
  };
}
