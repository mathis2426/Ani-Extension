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
  async _request(path, { method = "GET", body, auth = false, qs } = {}) {
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
      if (!this._tokenValid()) {
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

  /** Whether we still have a valid JWT (very rough check; API may not return exp) */
  _tokenValid() {
    if (!this._token) return false;
    // If we don't have exp, assume valid for this session:
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
    const data = await this._request("/login", {
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
      }
    } catch {
      this._tokenExp = 0;
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
   * @param {string} [params.imdb_id] - e.g., "1234567" (without 'tt')
   * @param {string} [params.tmdb_id]
   * @param {number} [params.season]
   * @param {number} [params.episode]
   * @param {string[]} [params.languages] - ISO639-1 or OS codes, e.g. ["fr","en"]
   * @param {number} [params.page]
   * @param {number} [params.per_page] - default 20, max 100 per docs
   * @param {string} [params.order_by] - e.g. "download_count" | "hearing_impaired" | "rating"
   */
  async searchSubtitles(params = {}) {
    // GET /subtitles with query params
    const qs = {
      query: params.query,
      imdb_id: params.imdb_id,     // docs say: remove 'tt' prefix if present
      tmdb_id: params.tmdb_id,
      season_number: params.season,
      episode_number: params.episode,
      languages: params.languages,
      page: params.page,
      per_page: params.per_page,
      order_by: params.order_by,
    };

    return await this._request("/subtitles", { qs, auth: true });
  }

  /**
   * Get download link / file token for a subtitle file
   * @param {number|string} file_id - subtitle "file_id" from search results
   * @returns {Promise<{link:string}|object>}
   */
  async downloadSubtitle(file_id) {
    if (!file_id) throw new Error("file_id is required");
    // POST /download { file_id }
    return await this._request("/download", {
      method: "POST",
      body: { file_id: Number(file_id) },
      auth: true,
    });
  }

  /**
   * Convenience: search by IMDB (movie) or SxxExx (episode)
   */
  async searchByImdbOrEpisode({ imdbId, season, episode, languages = ["fr","en"] }) {
    const imdb_id = (imdbId || "").replace(/^tt/i, "");
    return this.searchSubtitles({
      imdb_id,
      season,
      episode,
      languages,
      order_by: "download_count",
      per_page: 50,
    });
  }
}
