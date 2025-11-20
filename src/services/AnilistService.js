
/**
 * AnilistService (GraphQL only)
 * Lightweight client around AniList GraphQL API.
 */
export class AnilistService {
  static ENDPOINT = "https://graphql.anilist.co";

  /** Low-level GraphQL request */
  static async request(query, variables = {}) {
    // Try direct fetch with a couple of retries for 5xx errors/network issues
    const maxRetries = 2;
    let attempt = 0;
    let lastError = null;
    while (attempt <= maxRetries) {
      try {
        const res = await fetch(this.ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ query, variables }),
        });

        // If server error, throw to trigger retry logic
        if (!res.ok) {
          const text = await res.text().catch(() => null);
          const errMsg = `HTTP ${res.status} ${res.statusText} - ${text}`;
          lastError = new Error(`AniList GraphQL error: ${errMsg}`);
          // Retry only on 5xx
          if (res.status >= 500 && attempt < maxRetries) {
            const wait = 200 * Math.pow(2, attempt);
            await new Promise(r => setTimeout(r, wait));
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
          const wait = 200 * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, wait));
          attempt++;
          continue;
        }

        // Attempt proxy through extension background
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            const response = await new Promise((resolve) => {
              chrome.runtime.sendMessage({ type: 'ANILIST_REQUEST', query, variables }, (resp) => resolve(resp));
            });
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
      format_in: filters.formats?.length > 0 ? filters.formats : null,
      status_in: filters.statuses?.length > 0 ? filters.statuses : null,
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

  const allowedFormats = new Set(options.allowedFormats || ['TV','MOVIE']); // autorise TV_SHORT, ONA si tu veux
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

    // compatibilité : this.request peut retourner { data: { Media: ... } } ou directement { Media: ... }
    const m = (res && res.data && res.data.Media) ? res.data.Media : (res && res.Media) ? res.Media : null;
    if (!m) continue;

    // garde les nodes selon format autorisé
    if (allowedFormats.has(m.format)) {
      tvNodes.set(m.id, {
        id: m.id,
        title: this.bestTitle ? this.bestTitle(m.title) : (m.title?.romaji || m.title?.english || '(no title)'),
        episodes: (typeof m.episodes === 'number') ? m.episodes : null,
        season: m.season || null,
        seasonYear: m.seasonYear || null,
        format: m.format,
        siteUrl: m.siteUrl || null,
      });
    }

    const edges = m.relations?.edges || [];
    for (const e of edges) {
      if (!e || !e.node) continue;
      const rel = e.relationType;
      const node = e.node;
      // suivre uniquement PREQUEL / SEQUEL (ajoute d'autres types si besoin)
      if ((rel === 'PREQUEL' || rel === 'SEQUEL') && node.type === 'ANIME') {
        if (!seen.has(node.id)) {
          stack.push({ id: node.id, depth: cur.depth + 1 });
        }
      }
    }
  }

  // transforme en tableau, trie et calcule totaux
  const nodes = Array.from(tvNodes.values()).sort((a, b) => {
    // tri : seasonYear asc, season asc, fallback id
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