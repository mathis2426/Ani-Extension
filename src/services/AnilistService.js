/**
 * AnilistService (GraphQL only)
 * Lightweight client around AniList GraphQL API.
 */
export class AnilistService {
  static ENDPOINT = "https://graphql.anilist.co";
  static MIN_REQUEST_INTERVAL_MS = 2300;
  static RETRY_DELAY_MS = 5000;
  static MAX_RATE_LIMIT_WAIT_MS = 60000;
  static queue = Promise.resolve();
  static nextRequestAt = 0;

  /** Low-level GraphQL request */
  static async request(query, variables = {}) {
    return this.enqueueRequest(() => this.executeRequest(query, variables));
  }

  static enqueueRequest(task) {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => {});
    return run;
  }

  static async waitForRateLimitSlot() {
    const now = Date.now();
    const wait = Math.min(Math.max(0, this.nextRequestAt - now), this.MAX_RATE_LIMIT_WAIT_MS);
    if (wait > 0) {
      await this.sleep(wait);
    }
    this.nextRequestAt = Date.now() + this.MIN_REQUEST_INTERVAL_MS;
  }

  static updateRateLimitFromHeaders(headers) {
    if (!headers) return;

    const retryAfter = Number(headers.get?.("Retry-After") || 0);
    if (retryAfter > 0) {
      this.nextRequestAt = Math.max(this.nextRequestAt, Date.now() + this.clampRateLimitWait(retryAfter * 1000));
      return;
    }

    const remaining = Number(headers.get?.("X-RateLimit-Remaining"));
    const reset = Number(headers.get?.("X-RateLimit-Reset"));
    if (remaining === 0 && reset > 0) {
      this.nextRequestAt = Math.max(this.nextRequestAt, Date.now() + this.clampRateLimitWait(reset * 1000 - Date.now()));
    }
  }

  static async executeRequest(query, variables = {}) {
    const maxRetries = 1;
    let attempt = 0;
    let lastError = null;
    while (attempt <= maxRetries) {
      try {
        await this.waitForRateLimitSlot();
        const res = await fetch(this.ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ query, variables }),
        });
        this.updateRateLimitFromHeaders(res.headers);

        // If server error, throw to trigger retry logic
        if (!res.ok) {
          const text = await res.text().catch(() => null);
          const errMsg = `HTTP ${res.status} ${res.statusText} - ${text}`;
          lastError = new Error(`AniList GraphQL error: ${errMsg}`);
          if (res.status === 429 || (res.status >= 500 && attempt < maxRetries)) {
            const wait = res.status === 429
              ? Math.max(0, this.nextRequestAt - Date.now())
              : this.RETRY_DELAY_MS * (attempt + 1);
            await this.sleep(wait);
            attempt++;
            continue;
          } else {
            throw lastError;
          }
        }

        const json = await res.json();
        if (json.errors) {
          const msg = json.errors.map(e => e.message).join("; ");
          throw new Error(`AniList GraphQL error: ${msg}`);
        }
        return json.data;
      } catch (err) {
        lastError = err;
        // If fetch/network error or server error, try proxying via background as a fallback
        // but only after exhausting direct retries
        if (attempt < maxRetries) {
          await this.sleep(this.RETRY_DELAY_MS * (attempt + 1));
          attempt++;
          continue;
        }

        // Attempt proxy through extension background
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            const response = await new Promise((resolve) => {
              chrome.runtime.sendMessage({ type: 'ANILIST_REQUEST', query, variables }, (resp) => resolve(resp));
            });
            this.updateRateLimitFromProxy(response?.rateLimit);
            if (response && response.ok && response.data) {
              const proxyJson = response.data;
              if (proxyJson.errors) {
                const msg = proxyJson.errors.map(e => e.message).join("; ");
                throw new Error(`AniList GraphQL error (proxy): ${msg}`);
              }
              return proxyJson.data;
            } else {
              // include status/body if provided by the worker
              const proxyErr = response?.error || `proxy-no-response status:${response?.status}`;
              throw new Error(`AniList proxy error: ${proxyErr}`);
            }
          }
        } catch (proxErr) {
          console.warn('AniList proxy attempt failed', proxErr);
          // Fall through to throw lastError
        }

        throw lastError;
      }
    }
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
  }

  static clampRateLimitWait(ms) {
    return Math.min(Math.max(0, Number(ms) || 0), this.MAX_RATE_LIMIT_WAIT_MS);
  }

  static getRateLimitStatus() {
    return {
      nextRequestAt: this.nextRequestAt,
      waitMs: Math.max(0, this.nextRequestAt - Date.now()),
      minIntervalMs: this.MIN_REQUEST_INTERVAL_MS,
    };
  }

  static updateRateLimitFromProxy(rateLimit) {
    if (!rateLimit) return;

    const retryAfter = Number(rateLimit.retryAfter || 0);
    if (retryAfter > 0) {
      this.nextRequestAt = Math.max(this.nextRequestAt, Date.now() + this.clampRateLimitWait(retryAfter * 1000));
      return;
    }

    const remaining = Number(rateLimit.remaining);
    const reset = Number(rateLimit.reset);
    if (remaining === 0 && reset > 0) {
      this.nextRequestAt = Math.max(this.nextRequestAt, Date.now() + this.clampRateLimitWait(reset * 1000 - Date.now()));
    }
  }

  /** Search anime by title */
  static async searchAnimes(title, perPage = 10, filters = {}) {
    const query = `
      query ($search: String, $perPage: Int, $format_in: [MediaFormat], $status_in: [MediaStatus], $sort: [MediaSort]) {
        Page(page: 1, perPage: $perPage) {
          media(search: $search, type: ANIME, format_in: $format_in, status_in: $status_in, sort: $sort) {
            id
            title { romaji english native }
            coverImage { large }
            bannerImage
            status
            format
            startDate { year month day }
          }
        }
      }
    `;
    const variables = { 
      search: title, 
      perPage,
      format_in: filters.formats?.length > 0 ? filters.formats : undefined,
      status_in: filters.statuses?.length > 0 ? filters.statuses : undefined,
      sort: filters.sort ? [filters.sort] : ['SEARCH_MATCH']
    };
    const data = await this.request(query, variables);
    const items = data?.Page?.media || [];
    return items.map(m => this.mapMediaBasic(m)).filter(Boolean);
  }

  /** Get details by media id */
  static async getAnimeById(id) {
    const query = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          title { romaji english native }
          description(asHtml: false)
          episodes
          season
          seasonYear
          format
          genres
          averageScore
          coverImage { extraLarge large }
          bannerImage
          nextAiringEpisode { episode timeUntilAiring }
        }
      }
    `;
    const data = await this.request(query, { id: Number(id) });
    const m = data?.Media;
    if (!m) return null;
    return this.mapMediaDetails(m);
  }

  /**
   * Get banner URL by AniList media id
   * @param {number|string} id
   * @returns {Promise<string|null>} banner url or null
   */
  static async getBannerById(id) {
    const query = `
      query ($id: Int) { Media(id: $id, type: ANIME) { id bannerImage } }
    `;
    const data = await this.request(query, { id: Number(id) });
    return data?.Media?.bannerImage || null;
  }

  /**
   * Get banner URL by anime title (best AniList match)
   * @param {string} title
   * @returns {Promise<string|null>} banner url or null
   */
  static async getBannerByTitle(title) {
    const result = await this.getBannerAndImageByTitle(title);
    return result?.banner || null;
  }

  /**
   * Get cover image URL by anime title (best AniList match)
   * @param {string} title
   * @returns {Promise<string|null>} image url or null
   */
  static async getImageByTitle(title) {
    const result = await this.getBannerAndImageByTitle(title);
    return result?.image || null;
  }

  /**
   * Traverse PREQUEL/SEQUEL relations starting from a media id and aggregate TV entries.
   * Returns an object with nodes info, seasonsCount and totalEpisodes.
   * Uses a simple DFS/BFS with a maxDepth to avoid runaway recursion.
   * @param {number} id AniList media id
   * @param {number} maxDepth max recursion depth (default 6)
   */
static async getFranchiseInfoById(id, maxDepth = 6, options = {}) {
  if (!id) return null;
  const seen = new Set();
  const tvNodes = new Map();

  // Ajoute les films dans la chronologie ou comme alternatives
  const allowedFormats = new Set(options.allowedFormats || ['TV']);
  const query = `
    query ($id: Int!) {
      Media(id: $id, type: ANIME) {
        id
        title { romaji english native }
        format
        episodes
        season
        seasonYear
        siteUrl
        relations { 
          edges { 
            relationType
            node { 
              id
              type
              format
              episodes
              season
              seasonYear
              title { romaji english native }
              siteUrl
            } 
          } 
        }
      }
    }
  `;

  const stack = [{ id: Number(id), depth: 0 }];

  while (stack.length) {
    const cur = stack.pop();
    if (!cur || seen.has(cur.id) || cur.depth > maxDepth) continue;
    seen.add(cur.id);

    let res;
    try {
      res = await this.request(query, { id: Number(cur.id) });
    } catch (err) {
      console.warn('AniList franchise fetch error for id', cur.id, err);
      continue;
    }

    const m = (res && res.data && res.data.Media) ? res.data.Media : (res && res.Media) ? res.Media : null;
    if (!m) continue;

    // Ajoute le node TV
    if (allowedFormats.has(m.format)) {
      if (!tvNodes.has(m.id)) {
        tvNodes.set(m.id, {
          id: m.id,
          title: this.bestTitle ? this.bestTitle(m.title) : (m.title?.romaji || m.title?.english || '(no title)'),
          episodes: (typeof m.episodes === 'number') ? m.episodes : null,
          season: m.season || null,
          seasonYear: m.seasonYear || null,
          format: m.format,
          siteUrl: m.siteUrl || null,
          alternatives: [] // pour les films alternatifs
        });
      }
    }

    const edges = m.relations?.edges || [];
    for (const e of edges) {
      if (!e || !e.node || e.node.type !== 'ANIME') continue;
      const rel = e.relationType;
      const node = e.node;
      const nodeData = {
        id: node.id,
        title: this.bestTitle ? this.bestTitle(node.title) : (node.title?.romaji || node.title?.english || '(no title)'),
        episodes: (typeof node.episodes === 'number') ? node.episodes : null,
        season: node.season || null,
        seasonYear: node.seasonYear || null,
        format: node.format,
        siteUrl: node.siteUrl || null,
        relationType: rel,
      };

      if ((rel === 'PREQUEL' || rel === 'SEQUEL') && allowedFormats.has(node.format)) {
        if (!tvNodes.has(node.id)) {
          tvNodes.set(node.id, { ...nodeData, alternatives: [] });
        }
        if (!seen.has(node.id)) {
          stack.push({ id: node.id, depth: cur.depth + 1 });
        }
        continue;
      }

      if (allowedFormats.has(m.format) && tvNodes.has(m.id) && allowedFormats.has(node.format)) {
        const parent = tvNodes.get(m.id);
        const alreadyLinked = parent.alternatives.some((alt) => alt.id === node.id && alt.relationType === rel);
        if (!alreadyLinked) {
          parent.alternatives.push(nodeData);
        }
      }
    }
  }

  // Remove any nodes that are present only as alternatives (e.g. movies attached as alternatives)
  // Collect alternative ids
  const alternativeIds = new Set();
  for (const n of tvNodes.values()) {
    if (Array.isArray(n.alternatives)) {
      for (const alt of n.alternatives) {
        if (alt && alt.id) alternativeIds.add(alt.id);
      }
    }
  }

  // If an alternative id exists as a main node AND it's a MOVIE, remove it from main chronology
  for (const altId of alternativeIds) {
    const main = tvNodes.get(altId);
    if (main && main.format === 'MOVIE') {
      tvNodes.delete(altId);
    }
  }

  // transforme en tableau, trie et calcule totaux
  const nodes = Array.from(tvNodes.values()).sort((a, b) => {
    const ay = a.seasonYear || Infinity;
    const by = b.seasonYear || Infinity;
    if (ay !== by) return ay - by;
    const as = a.season || '';
    const bs = b.season || '';
    if (as !== bs) return as.localeCompare(bs);
    return a.id - b.id;
  });

  const seasonsCount = nodes.length || 0;
  const knownEpisodeSum = nodes.reduce((acc, n) => {
    return acc + (Number.isFinite(n.episodes) ? n.episodes : 0);
  }, 0);
  const totalEpisodes = knownEpisodeSum > 0 ? knownEpisodeSum : null;

  return { nodes, seasonsCount, totalEpisodes };
}




  /**
   * Get banner and image by anime title in a single GraphQL request
   * @param {string} title
   * @returns {Promise<{ banner: string|null, image: string|null }|null>}
   */
  static async getBannerAndImageByTitle(title) {
    const query = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
          bannerImage
          coverImage { large extraLarge }
        }
      }
    `;
    const data = await this.request(query, { search: title });
    if (!data?.Media) return null;
    return {
      banner: data.Media.bannerImage || null,
      image: data.Media.coverImage?.large || data.Media.coverImage?.extraLarge || null,
    };
  }

  // -------- mappers --------
  static mapMediaBasic(m) {
    if (!m) return null;
    return {
      id: m.id,
      title: this.bestTitle(m.title),
      titles: m.title || {},
      cover: m?.coverImage?.large || null,
      banner: m?.bannerImage || null,
      status: m?.status || null,
      startDate: m?.startDate || null,
    };
  }

  static mapMediaDetails(m) {
    return {
      id: m.id,
      title: this.bestTitle(m?.title),
      titles: m.title,
      description: m?.description || null,
      episodes: m?.episodes || null,
      season: m?.season || null,
      seasonYear: m?.seasonYear || null,
      format: m?.format || null,
      genres: m?.genres || [],
      averageScore: m?.averageScore || null,
      cover: m?.coverImage?.extraLarge || m?.coverImage?.large || null,
      banner: m?.bannerImage || null,
      nextAiringEpisode: m?.nextAiringEpisode || null,
    };
  }

  static bestTitle(titles) {
    if (!titles) return null;
    return titles.english || titles.romaji || titles.native || null;
  }
}
