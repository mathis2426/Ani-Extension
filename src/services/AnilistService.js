
/**
 * AnilistService (GraphQL only)
 * Lightweight client around AniList GraphQL API.
 */
export class AnilistService {
  static ENDPOINT = "https://graphql.anilist.co";

  /** Low-level GraphQL request */
  static async request(query, variables = {}) {
    const res = await fetch(this.ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors) {
      const msg = json.errors.map(e => e.message).join("; ");
      throw new Error(`AniList GraphQL error: ${msg}`);
    }
    return json.data;
  }

  /** Search anime by title */
  static async searchAnimes(title, perPage = 10) {
    const query = `
      query ($search: String, $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          media(search: $search, type: ANIME) {
            id
            title { romaji english native }
            coverImage { large }
            bannerImage
            status
            startDate { year month day }
          }
        }
      }
    `;
    const data = await this.request(query, { search: title, perPage });
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
   * Get total number of TV seasons for a franchise by anime title.
   * Approximates seasons by counting PREQUEL/SEQUEL chain entries with format TV (including self).
   * @param {string} title
   * @returns {Promise<number|null>} number of seasons or null if unknown
   */
  static async getSeasonsCountByTitle(title) {
    if (!title) return null;
    const query = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
          format
          relations {
            edges {
              relationType
              node { id type format }
            }
          }
        }
      }
    `;
    const data = await this.request(query, { search: title });
    const media = data?.Media;
    if (!media) return null;

    const nodes = [];
    // include self if TV
    if (media.format === 'TV') nodes.push({ id: media.id });
    const edges = media?.relations?.edges || [];
    edges.forEach(e => {
      if (!e || !e.node) return;
      const rel = e.relationType;
      const node = e.node;
      if ((rel === 'PREQUEL' || rel === 'SEQUEL') && node.type === 'ANIME' && node.format === 'TV') {
        nodes.push({ id: node.id });
      }
    });
    // dedupe by id
    const unique = new Set(nodes.map(n => n.id));
    return unique.size || null;
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