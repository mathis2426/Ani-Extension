// services/OpenSubtitlesService.js
// REST API v1: https://api.opensubtitles.com/api/v1
// Requires headers: Api-Key, User-Agent (custom), and Authorization: Bearer <token> after /login
import { StorageService } from "./StorageService.js";

export class OpenSubtitlesService {

  /**
   * @param {string} apiKey - Your OpenSubtitles Api-Key (app key)
   */
  constructor(apiKey) {
    if (!apiKey) throw new Error("OpenSubtitlesService: Api-Key is required");
    this.apiKey = apiKey;
    this.baseUrl = "https://api.opensubtitles.com/api/v1";
    this._token = null;         // JWT (user session)
    this._tokenExp = 0;         // epoch seconds
  }

  /** Internal fetch helper with unified headers / errors */
  async request(path, { method = "GET", body, auth = false, qs } = {}) {
    const url = new URL(this.baseUrl + path);
    if (qs && typeof qs === "object") {
      Object.entries(qs).forEach(([k, v]) => {
        if (v === undefined || v === null || v === "") return;
        url.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
      });
    }

    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Api-Key": this.apiKey,
    };

    if (auth) {
      if (!this.tokenValid()) {
        throw new Error("Not authenticated or token expired. Call login() again.");
      }
      headers["Authorization"] = `Bearer ${this._token}`;
    }

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

    if (!res.ok) {
      const msg = data?.message || data?.error || res.statusText || "Request failed";
      if (res.status === 429) {
        const retry = res.headers.get("Retry-After");
        throw new Error(`Rate limited by OpenSubtitles (429). Retry-After: ${retry ?? "unknown"}s. ${msg}`);
      }
      throw new Error(`${res.status} ${msg}`);
    }

    return data;
  }

  tokenValid() {
    if (!this._token) return false;
    if (!this._tokenExp) return true;
    return Math.floor(Date.now() / 1000) < this._tokenExp - 30;
  }

  /**
   * Login to get a user JWT. Use *username* (not email) per API docs.
   * @param {string} username
   * @param {string} password
   */
  async login(username, password) {
    if (!username || !password) throw new Error("Username and password are required");

    // POST /login { username, password }
    const data = await this.request("/login", {
      method: "POST",
      body: { username, password },
      auth: false,
    });

    if (!data?.token) {
      throw new Error("Login failed: missing token in response");
    }
    this._token = data.token;
    try {
      const payload = JSON.parse(atob(data.token.split(".")[1]));
      if (payload?.exp) {
        this._tokenExp = payload.exp;
        console.log("Token expiration set to:", this._tokenExp);
      }
    } catch {
      this._tokenExp = 0;
      console.warn("Failed to parse token expiration");
    }
    return true;
  }

  /** Log out (local only) */
  logout() {
    this._token = null;
    this._tokenExp = 0;
  }


  /**
   * Search subtitles
   * @param {object} params
   * @param {string} [params.query] - Free text
   * @param {string} [params.imdbid] - e.g., "1234567" (without 'tt')
   * @param {string} [params.tmdb_id]
   * @param {number} [params.season]
   * @param {number} [params.episode]
   * @param {string[]} [params.languages] - ISO639-1 or OS codes, e.g. ["fr","en"]
   * @param {number} [params.page]
   * @param {number} [params.per_page] - default 20, max 100 per docs
   * @param {string} [params.order_by] - e.g. "download_count" | "hearing_impaired" | "rating"
   */
  async searchSubtitles(params = {}) {
    // Normalize aliases and values
    let imdbRaw = params.imdb_id ?? params.imdbid ?? params.imdbId ?? params.imdb;
    if (imdbRaw !== undefined && imdbRaw !== null) {
      if (typeof imdbRaw !== "string") imdbRaw = String(imdbRaw);
      imdbRaw = imdbRaw.trim();
      if (imdbRaw.startsWith("tt")) imdbRaw = imdbRaw.slice(2);
      if (!/^\d+$/.test(imdbRaw)) imdbRaw = undefined; // drop invalid imdb
    }

    // Support parent_imdb_id for TV series searches
    let parentImdbRaw = params.parent_imdb_id ?? params.parentImdbId ?? params.parent_imdbid ?? params.parent;
    if (parentImdbRaw !== undefined && parentImdbRaw !== null) {
      if (typeof parentImdbRaw !== "string") parentImdbRaw = String(parentImdbRaw);
      parentImdbRaw = parentImdbRaw.trim();
      if (parentImdbRaw.startsWith("tt")) parentImdbRaw = parentImdbRaw.slice(2);
      if (!/^\d+$/.test(parentImdbRaw)) parentImdbRaw = undefined;
    }

    const season_number = params.season_number ?? params.season;
    const episode_number = params.episode_number ?? params.episode;
    const languages = params.languages; // arrays will be joined in request()
    const order_by = params.order_by;
    const per_page = params.per_page;
    const page = params.page;
    const tmdb_id = params.tmdb_id;
    const hearing_impaired = params.hearing_impaired;
    const type = params.type; // movie|episode|all

    // GET /subtitles with query params
    const qs = {
      query: params.query,
      imdb_id: imdbRaw,
      parent_imdb_id: parentImdbRaw,
      tmdb_id,
      season_number,
      episode_number,
      languages,
      hearing_impaired,
      type,
      page,
      per_page,
      order_by,
    };

    return await this.request("/subtitles", { qs, auth: true });
  }

  /**
   * Get download link / file token for a subtitle file
   * @param {number|string} file_id - subtitle "file_id" from search results
   * @returns {Promise<{link:string}|object>}
   */
  async downloadSubtitle(file_id) {
    if (!file_id) throw new Error("file_id is required");
    // POST /download { file_id }
    return await this.request("/download", {
      method: "POST",
      body: { file_id: Number(file_id) },
      auth: true,
    });
  }

  /**
   * Convenience: search by IMDB (movie) or SxxExx (episode)
   */
  async searchByImdbOrEpisode({ imdbId, season, episode, languages }) {
    return this.searchSubtitles({
      imdbid: imdbId,
      season,
      episode,
      languages,
      order_by: "download_count",
      per_page: 50,
    });
  }

  /**
   * Search subtitles for an episode using multiple query strategies
   * @param {string} showName - Name of the show
   * @param {number} episodeNumber - Episode number
   * @param {string[]} languages - Languages to search for (default: ["fr"])
   * @returns {Promise<object|null>} - First matching subtitle or null
   */
  /**
 * Search subtitles for an episode using multiple query strategies.
 * If providedSeason is given -> return single best match (or null).
 * If providedSeason is NOT given -> return an array of candidate matches across inferred seasons (may be empty).
 *
 * @param {string} showName
 * @param {number} episodeNumber
 * @param {string[]} languages
 * @param {number|null} providedSeason  // optional: when provided, search only that season
 * @returns {Promise<object|null|object[]>} - single match if season provided, otherwise array of matches
 */
  async searchEpisodeSubtitle(showName, episodeNumber, languages = ["fr"], providedSeason = null) {
    console.log(`🔍 Recherche sous-titres pour: "${showName}" Episode ${episodeNumber} (season: ${providedSeason ?? "auto"})`);

    // 1) If season provided -> try direct & classic strategies, return first matching subtitle (existing behavior)
    if (providedSeason) {
      const queries = await this.generateSearchQueries(showName, episodeNumber, providedSeason);
      console.log("Stratégies (season provided):", queries);

      for (const query of queries) {
        try {
          console.log(`  → Essai: "${query}"`);
          const res = await this.searchSubtitles({
            query,
            type: "episode",
            languages,
            page: 1,
            per_page: 40
          });

          if (res && Array.isArray(res.data) && res.data.length > 0) {
            const matched = await this.findBestMatch(res.data, showName, episodeNumber);
            if (matched) {
              console.log(`  ✅ Trouvé avec: "${query}"`);
              return matched; // single object
            }
          }
        } catch (err) {
          console.warn(`  ❌ Échec pour "${query}":`, err);
        }
      }

      // fallback: try searching by parent_imdb_id/tmdb if available (not implemented here)
      console.log("Aucun résultat convaincant pour la saison fournie.");
      return null;
    }

    // 2) If no season provided -> we want to find matches across multiple seasons
    // First, generate lighter queries (no season) to try quick matches
    const baseQueries = await this.generateSearchQueries(showName, episodeNumber, null);
    console.log("Stratégies (no-season quick):", baseQueries);

    const foundCandidates = []; // will hold { item, score, method, seasonGuess }

    // Quick sweep: try base queries first (may already return S1E1, S2E1, etc.)
    for (const q of baseQueries) {
      try {
        const res = await this.searchSubtitles({
          query: q,
          type: "episode",
          languages,
          page: 1,
          per_page: 40
        });
        if (res && Array.isArray(res.data) && res.data.length > 0) {
          // evaluate each result with findBestMatch logic (we need score, so reuse findBestMatch by wrapping)
          for (const r of res.data) {
            const match = await this.findBestMatch([r], showName, episodeNumber);
            if (match) {
              foundCandidates.push({ item: match, method: "quickQuery", query: q });
            }
          }
        }
      } catch (e) {
        console.warn("quickQuery error for", q, e);
      }
    }

    // If we already have multiple seasons in foundCandidates, return them (dedup by file id)
    const uniqByFile = (arr) => {
      const seen = new Set();
      return arr.filter(c => {
        const fileId = c.item?.attributes?.files?.[0]?.file_id ?? c.item?.attributes?.file_id ?? c.item?.id;
        if (!fileId) return true;
        if (seen.has(fileId)) return false;
        seen.add(fileId);
        return true;
      });
    };
    let uniqCandidates = uniqByFile(foundCandidates);
    if (uniqCandidates.length >= 2) {
      console.log("Quick sweep found multiple candidates:", uniqCandidates.length);
      return uniqCandidates.map(c => c.item);
    }

    // 3) If quick sweep didn't find multiple seasons, infer seasons from show name
    const seasonInfo = await inferSeasonCountsFromShowName.call(this, showName, languages);
    console.log("seasonCountsInfo:", seasonInfo);

    if (!seasonInfo || !Array.isArray(seasonInfo.seasons) || seasonInfo.seasons.length === 0) {
      // No season info -> return whatever quick sweep found (maybe empty)
      console.log("Aucune saison inférée, renvoi des résultats rapides (éventuels).");
      return uniqCandidates.map(c => c.item);
    }

    // Limit number of seasons to probe (avoid too many requests)
    const SEASON_LIMIT = 6;
    const seasonsToTry = seasonInfo.seasons.slice(0, SEASON_LIMIT);

    // For each season, try to fetch season episodes (dédié) and pick episodeNumber entries
    for (const s of seasonsToTry) {
      try {
        const seasonEps = await fetchSeasonEpisodesByShowName.call(this, showName, Number(s), languages);
        if (seasonEps && seasonEps.length > 0) {
          // find item(s) with that episodeNumber
          for (const it of seasonEps) {
            const feat = (it.attributes || {}).feature_details || {};
            const epNum = Number(feat.episode_number);
            if (!isNaN(epNum) && epNum === Number(episodeNumber)) {
              // push candidate
              foundCandidates.push({ item: it, method: "seasonFetch", season: s });
            }
          }
        } else {
          // if no full objects, do a targeted /subtitles query with season_number
          try {
            const res = await this.searchSubtitles({
              query: showName,
              season_number: s,
              episode_number: episodeNumber,
              type: "episode",
              languages,
              per_page: 50,
              page: 1,
              order_by: "download_count"
            });
            if (res && Array.isArray(res.data) && res.data.length > 0) {
              for (const it of res.data) {
                foundCandidates.push({ item: it, method: "seasonQuery", season: s });
              }
            }
          } catch (e) {
            console.warn("season-specific query error:", e);
          }
        }
      } catch (e) {
        console.warn("fetchSeasonEpisodesByShowName error for season", s, e);
      }
    }

    // Deduplicate candidates by obvious ids and sort by confidence using findBestMatch scoring
    const deduped = [];
    const seenIds = new Set();
    for (const c of foundCandidates) {
      const idKey = (c.item?.attributes?.files?.[0]?.file_id) ?? c.item?.id ?? JSON.stringify(c.item?.attributes || {});
      if (seenIds.has(idKey)) continue;
      seenIds.add(idKey);
      deduped.push(c.item);
    }

    if (deduped.length === 0) {
      console.log("Aucun candidat trouvé après inférence de saisons.");
      return [];
    }

    // Score each candidate via findBestMatch-like scoring (we call findBestMatch with single-item arrays to trigger logs)
    const scored = [];
    for (const it of deduped) {
      const match = await this.findBestMatch([it], showName, episodeNumber);
      // findBestMatch returns the item if good enough, otherwise null — compute a fallback score if null
      if (match) {
        scored.push({ item: match, score: 10 }); // high score because findBestMatch accepted it
      } else {
        // compute a lightweight score: prefer same episode number + keyword overlap
        const feat = (it.attributes || {}).feature_details || {};
        const epNum = Number(feat.episode_number);
        const episodeScore = (epNum && epNum === Number(episodeNumber)) ? 3 : 0;
        scored.push({ item: it, score: episodeScore });
      }
    }

    // sort desc by score
    scored.sort((a, b) => b.score - a.score);

    console.log(`📦 Renvoi ${scored.length} candidats (triés) pour "${showName}" Ep${episodeNumber}:`, scored.map(s => ({ id: s.item?.id, score: s.score })));
    return scored.map(s => s.item);
  }



  // Levenshtein (garde sync, pas besoin d'async ici)
  levenshtein(a, b) {
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

  similarityRatio(a, b) {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    const dist = this.levenshtein(a, b);
    return 1 - (dist / Math.max(a.length, b.length));
  }

  normalizeTitle(raw) {
    if (!raw) return "";
    const TECH_RE = /\b(1080p|2160p|720p|webrip|web|bluray|bdrip|dvdrip|hdrip|x264|x265|aac|ddp\.?5?\.?1?|dts|proper|repack|multi|vostfr|vf|vo|eng|sub|subs|internal)\b/gi;
    const BRACKETS = /\[(?:[^\]]+)\]|\((?:[^\)]+)\)|\{(?:[^\}]+)\}/g;

    let s = String(raw).toLowerCase();
    s = s.replace(BRACKETS, " ");
    s = s.replace(TECH_RE, " ");
    s = s.replace(/[-_.]+/g, " ");
    s = s.replace(/\b\d{4}\b/g, " ");
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    s = s.replace(/[^\w\s]/g, " ");
    s = s.replace(/\s+/g, " ").trim();
    return s;
  }

  async findBestMatch(results, showName, episodeNumber) {
    const normalizedShow = this.normalizeTitle(showName);
    const showWords = normalizedShow.split(/\s+/).filter(Boolean);
    const stop = new Set(['the', 'a', 'an', 'and', 'of', 'in', 'to', 'for', 'with', 'season', 'part']);
    const keyWords = showWords.filter(w => !stop.has(w)).slice(0, 6);

    let best = null;
    let bestScore = -1;

    for (const result of results) {
      const attrs = result.attributes || {};
      const feat = attrs.feature_details || {};
      const rawTitle = (feat.title || feat.movie_name || attrs.release || (attrs.files && attrs.files[0] && attrs.files[0].file_name) || "").toString();
      const resultTitleNorm = this.normalizeTitle(rawTitle);
      const resultEpisode = feat.episode_number ? Number(feat.episode_number) : null;

      const episodeMatch = (resultEpisode && !isNaN(resultEpisode) && Number(resultEpisode) === Number(episodeNumber)) ? 1 : 0;

      let keywordMatches = 0;
      for (const k of keyWords) if (k && resultTitleNorm.includes(k)) keywordMatches++;
      const keywordRatio = keyWords.length ? (keywordMatches / keyWords.length) : 0;

      const sim = this.similarityRatio(resultTitleNorm, normalizedShow);
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
   * Generate search query variations for better matching
   * @param {string} showName - Original show name
   * @param {number} episodeNumber - Episode number
   * @returns {string[]} - Array of query variations
   */
  async generateSearchQueries(showName, episodeNumber, providedSeason = null) {
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

    // Common patterns
    queries.push(`${cleanName} ${episodeNumber}`);
    queries.push(`${cleanName} Ep${episodeNumber}`);
    queries.push(`${cleanName} Episode ${episodeNumber}`);
    queries.push(`${cleanName} E${epPadded}`);

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
   * Download subtitle content from file_id
   * @param {number|string} file_id - Subtitle file ID
   * @returns {Promise<string>} - Subtitle file content
   */
  async downloadSubtitleContent(file_id) {
    const downloadData = await this.downloadSubtitle(file_id);

    if (!downloadData || !downloadData.link) {
      throw new Error("Unable to get download link");
    }

    const response = await fetch(downloadData.link);
    if (!response.ok) {
      throw new Error(`Failed to download subtitle: ${response.status}`);
    }

    return await response.text();
  }
}




