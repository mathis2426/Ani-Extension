// services/OpenSubtitlesService.js
// REST API v1: https://api.opensubtitles.com/api/v1
// Requires headers: Api-Key, User-Agent (custom), and Authorization: Bearer <token> after /login
import { StorageService } from "./StorageService.js";
import { generateSearchQueries, findBestMatch, deduplicateByFileId } from "../utils/subtitleSearchUtils.js";

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

    let res;
    try {
      // Attempt the fetch and capture low-level network errors for clearer diagnostics
      res = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      // Re-throw a more informative error including the request URL and original error
      const err = new Error(`Network error while fetching ${url.toString()}: ${networkErr?.message || networkErr}`);
      err.cause = networkErr;
      console.error(err);
      throw err;
    }

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

    // 1) If season provided -> try direct & classic strategies, return first matching subtitle
    if (providedSeason) {
      const queries = generateSearchQueries(showName, episodeNumber, providedSeason);
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
            const matched = findBestMatch(res.data, showName, episodeNumber);
            if (matched) {
              console.log(`  ✅ Trouvé avec: "${query}"`);
              return matched; // single object
            }
          }
        } catch (err) {
          console.warn(`  ❌ Échec pour "${query}":`, err);
        }
      }

      console.log("Aucun résultat convaincant pour la saison fournie.");
      return null;
    }

    // 2) If no season provided -> find matches across multiple seasons
    const baseQueries = generateSearchQueries(showName, episodeNumber, null);
    console.log("Stratégies (no-season quick):", baseQueries);

    const foundCandidates = [];

    // Quick sweep: try base queries first
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
          for (const r of res.data) {
            const match = findBestMatch([r], showName, episodeNumber);
            if (match) {
              foundCandidates.push({ item: match, method: "quickQuery", query: q });
            }
          }
        }
      } catch (e) {
        console.warn("quickQuery error for", q, e);
      }
    }

    // Deduplicate and return if we found multiple candidates
    let uniqCandidates = deduplicateByFileId(foundCandidates);
    if (uniqCandidates.length >= 2) {
      console.log("Quick sweep found multiple candidates:", uniqCandidates.length);
      return uniqCandidates.map(c => c.item);
    }

    console.log(`📦 Renvoi ${uniqCandidates.length} candidats pour "${showName}" Ep${episodeNumber}`);
    return uniqCandidates.map(c => c.item);
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

    let response;
    try {
      response = await fetch(downloadData.link);
    } catch (networkErr) {
      const err = new Error(`Network error while downloading subtitle from ${downloadData.link}: ${networkErr?.message || networkErr}`);
      err.cause = networkErr;
      console.error(err);
      throw err;
    }

    if (!response.ok) {
      throw new Error(`Failed to download subtitle: ${response.status}`);
    }

    return await response.text();
  }
}