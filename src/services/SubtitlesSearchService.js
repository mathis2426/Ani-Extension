/**
 * File Name      : SubtitlesSearchService.js
 * Description    : Intelligent subtitle search combining TMDb and OpenSubtitles
 * Author         : Mathis Gramage, Mathis Cucherat
 * Last Updated   : 2025-10-17
 * Version        : 1.0.0
 * 
 * This service provides a robust way to search for subtitles by:
 * 1. Using TMDb to get accurate episode information and IDs
 * 2. Searching OpenSubtitles with episode title (French) and proper IDs
 * 3. Falling back to basic search if TMDb fails
 */

import { TMDbService } from "./TMDbService.js";
import { OpenSubtitlesService } from "./OpenSubtitlesService.js";

export class SubtitlesSearchService {
  /**
   * @param {TMDbService} tmdbService - Initialized TMDb service
   * @param {OpenSubtitlesService} openSubtitlesService - Initialized OpenSubtitles service
   */
  constructor(tmdbService, openSubtitlesService) {
    if (!tmdbService) throw new Error("TMDbService is required");
    if (!openSubtitlesService) throw new Error("OpenSubtitlesService is required");
    
    this.tmdb = tmdbService;
    this.openSubtitles = openSubtitlesService;
  }

  /**
   * Search for subtitles using intelligent multi-step approach
   * @param {object} params
   * @param {string} params.showName - Name of the TV show/anime
   * @param {number} [params.seasonNumber] - Season number (optional, used as hint)
   * @param {number} [params.episodeNumber] - Episode number (optional, less reliable)
   * @param {string} [params.episodeTitle] - Episode title (RECOMMENDED - most reliable)
   * @param {string[]} [params.languages=["fr"]] - Preferred subtitle languages
   * @param {string} [params.targetLanguage="fr-FR"] - Language for episode title from TMDb
   * @param {string[]} [params.alternativeNames] - Alternative names to try if first search fails
   * @returns {Promise<object>} - Search results with subtitles and metadata
   */
  async searchSubtitles({
    showName,
    seasonNumber,
    episodeNumber,
    episodeTitle,
    languages = ["fr"],
    targetLanguage = "fr-FR",
    alternativeNames = []
  }) {
    const result = {
      success: false,
      tmdbInfo: null,
      subtitles: [],
      searchMethod: null,
      error: null
    };

    try {
      const namesToTry = [showName, ...alternativeNames];
      let tmdbResult;

      // Step 1: Try to get episode info from TMDb
      // Prioritize title-based search if episode title is provided
      if (episodeTitle) {
        console.log(`[SubtitlesSearch] Searching TMDb by title: "${episodeTitle}" for ${showName}`);
        tmdbResult = await this.tmdb.searchEpisodeByTitleMultiple({
          showNames: namesToTry,
          episodeTitle,
          seasonNumber, // Optional hint to speed up search
          language: targetLanguage
        });
      } else if (seasonNumber && episodeNumber) {
        console.log(`[SubtitlesSearch] Searching TMDb by number: ${showName} S${seasonNumber}E${episodeNumber}`);
        tmdbResult = await this.tmdb.searchEpisodeInfoMultiple({
          showNames: namesToTry,
          seasonNumber,
          episodeNumber,
          language: targetLanguage
        });
      } else {
        // Not enough info to search TMDb
        console.log("[SubtitlesSearch] Insufficient info for TMDb search, using basic search");
        const basicSubtitles = await this._basicSearch(
          showName,
          seasonNumber,
          episodeNumber,
          languages
        );

        if (basicSubtitles && basicSubtitles.length > 0) {
          result.success = true;
          result.subtitles = basicSubtitles;
          result.searchMethod = "basic";
          return result;
        }

        result.error = "Insufficient information for TMDb search and no basic results found";
        return result;
      }

      if (tmdbResult.success) {
        result.tmdbInfo = tmdbResult;
        console.log(`[SubtitlesSearch] TMDb found: ${tmdbResult.episode.name} (S${tmdbResult.episode.seasonNumber}E${tmdbResult.episode.episodeNumber})`);
        if (tmdbResult.matchType) {
          console.log(`[SubtitlesSearch] Match type: ${tmdbResult.matchType}`);
        }

        // Step 2: Search OpenSubtitles with multiple strategies
        const subtitles = await this._searchWithMultipleStrategies(
          tmdbResult,
          tmdbResult.episode.seasonNumber,
          tmdbResult.episode.episodeNumber,
          languages
        );

        if (subtitles && subtitles.length > 0) {
          result.success = true;
          result.subtitles = subtitles;
          result.searchMethod = episodeTitle ? "tmdb_title_enhanced" : "tmdb_number_enhanced";
          return result;
        }
      } else {
        console.log(`[SubtitlesSearch] TMDb search failed: ${tmdbResult.error}`);
      }

      // Step 3: Fallback to basic search with show name
      console.log("[SubtitlesSearch] Falling back to basic search");
      const basicSubtitles = await this._basicSearch(
        showName,
        seasonNumber || (tmdbResult?.episode?.seasonNumber),
        episodeNumber || (tmdbResult?.episode?.episodeNumber),
        languages
      );

      if (basicSubtitles && basicSubtitles.length > 0) {
        result.success = true;
        result.subtitles = basicSubtitles;
        result.searchMethod = "basic";
        return result;
      }

      // No results found
      result.error = "No subtitles found with any search method";
      return result;

    } catch (error) {
      console.error("[SubtitlesSearch] Error:", error);
      result.error = error.message;
      return result;
    }
  }

  /**
   * Try multiple search strategies with TMDb information
   * @private
   */
  async _searchWithMultipleStrategies(tmdbInfo, season, episode, languages) {
    const strategies = [
      // Strategy 1: Episode IMDb ID (most specific)
      async () => {
        if (tmdbInfo.searchParams.episodeImdbId) {
          console.log("[SubtitlesSearch] Strategy 1: Episode IMDb ID");
          return await this.openSubtitles.searchSubtitles({
            imdb_id: tmdbInfo.searchParams.episodeImdbId,
            languages,
            order_by: "download_count",
            per_page: 50
          });
        }
        return null;
      },

      // Strategy 2: Show IMDb ID + Season/Episode
      async () => {
        if (tmdbInfo.searchParams.showImdbId) {
          console.log("[SubtitlesSearch] Strategy 2: Show IMDb ID + S/E");
          return await this.openSubtitles.searchSubtitles({
            imdb_id: tmdbInfo.searchParams.showImdbId,
            season_number: season,
            episode_number: episode,
            languages,
            order_by: "download_count",
            per_page: 50
          });
        }
        return null;
      },

      // Strategy 3: Episode title (French) as query
      async () => {
        if (tmdbInfo.searchParams.episodeTitle) {
          console.log("[SubtitlesSearch] Strategy 3: Episode title");
          return await this.openSubtitles.searchSubtitles({
            query: tmdbInfo.searchParams.episodeTitle,
            season_number: season,
            episode_number: episode,
            languages,
            order_by: "download_count",
            per_page: 50
          });
        }
        return null;
      },

      // Strategy 4: Show name + Episode title
      async () => {
        if (tmdbInfo.tvShow.name && tmdbInfo.searchParams.episodeTitle) {
          console.log("[SubtitlesSearch] Strategy 4: Show + Episode title");
          const query = `${tmdbInfo.tvShow.name} ${tmdbInfo.searchParams.episodeTitle}`;
          return await this.openSubtitles.searchSubtitles({
            query,
            season_number: season,
            episode_number: episode,
            languages,
            order_by: "download_count",
            per_page: 50
          });
        }
        return null;
      },

      // Strategy 5: TMDb ID + Season/Episode
      async () => {
        if (tmdbInfo.searchParams.tmdbId) {
          console.log("[SubtitlesSearch] Strategy 5: TMDb ID");
          return await this.openSubtitles.searchSubtitles({
            tmdb_id: tmdbInfo.searchParams.tmdbId,
            season_number: season,
            episode_number: episode,
            languages,
            order_by: "download_count",
            per_page: 50
          });
        }
        return null;
      }
    ];

    // Try each strategy until we get results
    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result && result.data && result.data.length > 0) {
          console.log(`[SubtitlesSearch] Found ${result.data.length} subtitles`);
          return result.data;
        }
      } catch (error) {
        console.warn("[SubtitlesSearch] Strategy failed:", error);
        continue;
      }
    }

    return [];
  }

  /**
   * Basic search fallback without TMDb
   * @private
   */
  async _basicSearch(showName, season, episode, languages) {
    console.log("[SubtitlesSearch] Basic search with show name");
    try {
      const result = await this.openSubtitles.searchSubtitles({
        query: showName,
        season_number: season,
        episode_number: episode,
        languages,
        order_by: "download_count",
        per_page: 50
      });

      return result && result.data ? result.data : [];
    } catch (error) {
      console.error("[SubtitlesSearch] Basic search failed:", error);
      return [];
    }
  }

  /**
   * Download a subtitle file
   * @param {number|string} fileId - OpenSubtitles file ID
   * @returns {Promise<object>} - Download link
   */
  async downloadSubtitle(fileId) {
    return await this.openSubtitles.downloadSubtitle(fileId);
  }

  /**
   * Get enhanced episode information for an anime
   * Updates the anime object with TMDb data
   * @param {object} anime - Anime object to enhance
   * @param {string[]} [alternativeNames] - Alternative names to try
   * @param {boolean} [useTitle=true] - Use episode title for search (more reliable)
   * @returns {Promise<object>} - Enhanced anime with TMDb info
   */
  async enhanceAnimeWithTMDb(anime, alternativeNames = [], useTitle = true) {
    try {
      const season = anime.saison || 1;
      const episode = parseInt(anime.episode);
      const episodeTitle = anime.title; // Get the title from anime object

      if (!anime.name) {
        throw new Error("Invalid anime data: name is required");
      }

      const namesToTry = [anime.name, ...alternativeNames];
      let tmdbResult;

      // Prefer title-based search if available and enabled
      if (useTitle && episodeTitle) {
        console.log(`[SubtitlesSearch] Enhancing with title: "${episodeTitle}"`);
        tmdbResult = await this.tmdb.searchEpisodeByTitleMultiple({
          showNames: namesToTry,
          episodeTitle,
          seasonNumber: season, // Use as hint
          language: "fr-FR"
        });
      } else if (!isNaN(episode)) {
        console.log(`[SubtitlesSearch] Enhancing with episode number: ${episode}`);
        tmdbResult = await this.tmdb.searchEpisodeInfoMultiple({
          showNames: namesToTry,
          seasonNumber: season,
          episodeNumber: episode,
          language: "fr-FR"
        });
      } else {
        throw new Error("Invalid anime data: either title or valid episode number is required");
      }

      if (tmdbResult.success) {
        // Update anime object with TMDb information
        anime.tmdbId = tmdbResult.tvShow.id;
        anime.imdbId = tmdbResult.searchParams.episodeImdbId || tmdbResult.searchParams.showImdbId;
        anime.episodeTitle = tmdbResult.episode.name;
        anime.episodeTmdbId = tmdbResult.episode.id;
        anime.tvdbId = tmdbResult.episode.tvdbId;
        anime.saison = tmdbResult.episode.seasonNumber; // Update with correct season
        anime.episode = tmdbResult.episode.episodeNumber.toString(); // Update with correct episode

        console.log(`[SubtitlesSearch] Anime enhanced: ${anime.episodeTitle} (S${anime.saison}E${anime.episode})`);
        return {
          success: true,
          anime,
          tmdbInfo: tmdbResult
        };
      }

      return {
        success: false,
        anime,
        error: tmdbResult.error
      };
    } catch (error) {
      console.error("[SubtitlesSearch] Error enhancing anime:", error);
      return {
        success: false,
        anime,
        error: error.message
      };
    }
  }
}
