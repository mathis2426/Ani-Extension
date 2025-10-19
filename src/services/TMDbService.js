/**
 * File Name      : TMDbService.js
 * Description    : Service to interact with The Movie Database (TMDb) API
 * Author         : Mathis Gramage, Mathis Cucherat
 * Last Updated   : 2025-10-17
 * Version        : 1.0.0
 * 
 * API Documentation: https://developer.themoviedb.org/reference/intro/getting-started
 */

export class TMDbService {
  /**
   * @param {string} apiKey - Your TMDb API key (v3 auth)
   */
  constructor(apiKey) {
    if (!apiKey) throw new Error("TMDbService: API key is required");
    this.apiKey = apiKey;
    this.baseUrl = "https://api.themoviedb.org/3";
    this.imageBaseUrl = "https://image.tmdb.org/t/p/w500";
  }

  /**
   * Internal fetch helper with unified error handling
   */
  async request(path, params = {}) {
    const url = new URL(this.baseUrl + path);
    url.searchParams.set("api_key", this.apiKey);
    
    // Add all other parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const res = await fetch(url.toString());
    
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`TMDb API Error (${res.status}): ${error}`);
    }

    return await res.json();
  }

  /**
   * Search for a TV show by name
   * @param {string} query - The name of the TV show
   * @param {string} [language="fr-FR"] - Language for results
   * @returns {Promise<object>} - Search results
   */
  async searchTVShow(query, language = "fr-FR") {
    if (!query) throw new Error("Query is required");
    
    return await this.request("/search/tv", {
      query,
      language,
      include_adult: false
    });
  }

  /**
   * Get TV show details including external IDs (IMDb, etc.)
   * @param {number} tvId - TMDb TV show ID
   * @param {string} [language="fr-FR"] - Language for results
   * @returns {Promise<object>} - TV show details
   */
  async getTVShowDetails(tvId, language = "fr-FR") {
    if (!tvId) throw new Error("TV show ID is required");
    
    return await this.request(`/tv/${tvId}`, { language });
  }

  /**
   * Get external IDs for a TV show (IMDb ID, etc.)
   * @param {number} tvId - TMDb TV show ID
   * @returns {Promise<object>} - External IDs including IMDb
   */
  async getTVShowExternalIds(tvId) {
    if (!tvId) throw new Error("TV show ID is required");
    
    return await this.request(`/tv/${tvId}/external_ids`);
  }

  /**
   * Get season details
   * @param {number} tvId - TMDb TV show ID
   * @param {number} seasonNumber - Season number
   * @param {string} [language="fr-FR"] - Language for results
   * @returns {Promise<object>} - Season details with all episodes
   */
  async getSeasonDetails(tvId, seasonNumber, language = "fr-FR") {
    if (!tvId) throw new Error("TV show ID is required");
    if (seasonNumber === undefined) throw new Error("Season number is required");
    
    return await this.request(`/tv/${tvId}/season/${seasonNumber}`, { language });
  }

  /**
   * Get episode details with title and external IDs
   * @param {number} tvId - TMDb TV show ID
   * @param {number} seasonNumber - Season number
   * @param {number} episodeNumber - Episode number
   * @param {string} [language="fr-FR"] - Language for results
   * @returns {Promise<object>} - Episode details including French title
   */
  async getEpisodeDetails(tvId, seasonNumber, episodeNumber, language = "fr-FR") {
    if (!tvId) throw new Error("TV show ID is required");
    if (seasonNumber === undefined) throw new Error("Season number is required");
    if (episodeNumber === undefined) throw new Error("Episode number is required");
    
    return await this.request(
      `/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`,
      { language }
    );
  }

  /**
   * Get episode external IDs (IMDb, TVDB, etc.)
   * @param {number} tvId - TMDb TV show ID
   * @param {number} seasonNumber - Season number
   * @param {number} episodeNumber - Episode number
   * @returns {Promise<object>} - External IDs for the episode
   */
  async getEpisodeExternalIds(tvId, seasonNumber, episodeNumber) {
    if (!tvId) throw new Error("TV show ID is required");
    if (seasonNumber === undefined) throw new Error("Season number is required");
    if (episodeNumber === undefined) throw new Error("Episode number is required");
    
    return await this.request(
      `/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}/external_ids`
    );
  }

  /**
   * Complete search: Find TV show, get episode details with French title and IMDb ID
   * @param {object} params
   * @param {string} params.showName - Name of the TV show
   * @param {number} params.seasonNumber - Season number
   * @param {number} params.episodeNumber - Episode number
   * @param {string} [params.language="fr-FR"] - Language for episode title
   * @returns {Promise<object>} - Complete episode information
   */
  async searchEpisodeInfo({ showName, seasonNumber, episodeNumber, language = "fr-FR" }) {
    try {
      // 1. Search for the TV show
      const searchResults = await this.searchTVShow(showName, language);
      
      if (!searchResults.results || searchResults.results.length === 0) {
        throw new Error(`No TV show found for: ${showName}`);
      }

      // Take the first result (most relevant)
      const tvShow = searchResults.results[0];
      const tvId = tvShow.id;

      // 2. Get TV show external IDs (for show-level IMDb ID)
      const showExternalIds = await this.getTVShowExternalIds(tvId);

      // 3. Get episode details (with French title)
      const episodeDetails = await this.getEpisodeDetails(
        tvId,
        seasonNumber,
        episodeNumber,
        language
      );

      // 4. Get episode external IDs (for episode-level IMDb ID if available)
      const episodeExternalIds = await this.getEpisodeExternalIds(
        tvId,
        seasonNumber,
        episodeNumber
      );

      // Return comprehensive information
      return {
        success: true,
        tvShow: {
          id: tvId,
          name: tvShow.name,
          originalName: tvShow.original_name,
          imdbId: showExternalIds.imdb_id,
          overview: tvShow.overview
        },
        episode: {
          id: episodeDetails.id,
          name: episodeDetails.name, // French title if language=fr-FR
          episodeNumber: episodeDetails.episode_number,
          seasonNumber: episodeDetails.season_number,
          overview: episodeDetails.overview,
          airDate: episodeDetails.air_date,
          imdbId: episodeExternalIds.imdb_id, // Episode-specific IMDb ID
          tvdbId: episodeExternalIds.tvdb_id
        },
        // Useful for OpenSubtitles search
        searchParams: {
          episodeTitle: episodeDetails.name,
          showImdbId: showExternalIds.imdb_id?.replace(/^tt/i, ""),
          episodeImdbId: episodeExternalIds.imdb_id?.replace(/^tt/i, ""),
          tmdbId: tvId,
          season: seasonNumber,
          episode: episodeNumber
        }
      };
    } catch (error) {
      console.error("TMDb search error:", error);
      return {
        success: false,
        error: error.message,
        searchParams: {
          season: seasonNumber,
          episode: episodeNumber
        }
      };
    }
  }

  /**
   * Convenience method: Search multiple potential show names
   * Useful when anime names might vary (English vs Japanese vs French)
   * @param {object} params
   * @param {string[]} params.showNames - Array of potential show names to try
   * @param {number} params.seasonNumber
   * @param {number} params.episodeNumber
   * @param {string} [params.language="fr-FR"]
   * @returns {Promise<object>} - First successful result
   */
  async searchEpisodeInfoMultiple({ showNames, seasonNumber, episodeNumber, language = "fr-FR" }) {
    for (const showName of showNames) {
      const result = await this.searchEpisodeInfo({
        showName,
        seasonNumber,
        episodeNumber,
        language
      });

      if (result.success) {
        return result;
      }
    }

    // If no results found for any name
    return {
      success: false,
      error: `No results found for any of: ${showNames.join(", ")}`,
      searchParams: {
        season: seasonNumber,
        episode: episodeNumber
      }
    };
  }

  /**
   * Search episode by title instead of number
   * More reliable when episode numbers vary between sources
   * @param {object} params
   * @param {string} params.showName - Name of the TV show
   * @param {string} params.episodeTitle - Title of the episode to search for
   * @param {number} [params.seasonNumber] - Optional season hint for faster search
   * @param {string} [params.language="fr-FR"] - Language for results
   * @returns {Promise<object>} - Episode information if found
   */
  async searchEpisodeByTitle({ showName, episodeTitle, seasonNumber, language = "fr-FR" }) {
    try {
      // 1. Search for the TV show
      const searchResults = await this.searchTVShow(showName, language);
      
      if (!searchResults.results || searchResults.results.length === 0) {
        throw new Error(`No TV show found for: ${showName}`);
      }

      const tvShow = searchResults.results[0];
      const tvId = tvShow.id;

      // 2. Get TV show external IDs
      const showExternalIds = await this.getTVShowExternalIds(tvId);

      // 3. Get TV show details to know number of seasons
      const showDetails = await this.getTVShowDetails(tvId, language);
      const numberOfSeasons = showDetails.number_of_seasons || 10; // Default to 10 if not available

      // 4. Search through seasons for matching episode title
      const seasonsToSearch = seasonNumber 
        ? [seasonNumber] // If season hint provided, search only that season
        : Array.from({ length: numberOfSeasons }, (_, i) => i + 1); // Search all seasons

      for (const season of seasonsToSearch) {
        try {
          const seasonDetails = await this.getSeasonDetails(tvId, season, language);
          
          if (!seasonDetails.episodes) continue;

          // Search for episode with matching title (case insensitive, partial match)
          const normalizedSearchTitle = episodeTitle.toLowerCase().trim();
          const matchedEpisode = seasonDetails.episodes.find(ep => {
            const epTitle = ep.name.toLowerCase().trim();
            // Try exact match first, then partial match
            return epTitle === normalizedSearchTitle || 
                   epTitle.includes(normalizedSearchTitle) ||
                   normalizedSearchTitle.includes(epTitle);
          });

          if (matchedEpisode) {
            // Found the episode! Get its external IDs
            const episodeExternalIds = await this.getEpisodeExternalIds(
              tvId,
              season,
              matchedEpisode.episode_number
            );

            return {
              success: true,
              matchType: matchedEpisode.name.toLowerCase() === normalizedSearchTitle ? 'exact' : 'partial',
              tvShow: {
                id: tvId,
                name: tvShow.name,
                originalName: tvShow.original_name,
                imdbId: showExternalIds.imdb_id,
                overview: tvShow.overview
              },
              episode: {
                id: matchedEpisode.id,
                name: matchedEpisode.name,
                episodeNumber: matchedEpisode.episode_number,
                seasonNumber: season,
                overview: matchedEpisode.overview,
                airDate: matchedEpisode.air_date,
                imdbId: episodeExternalIds.imdb_id,
                tvdbId: episodeExternalIds.tvdb_id
              },
              searchParams: {
                episodeTitle: matchedEpisode.name,
                showImdbId: showExternalIds.imdb_id?.replace(/^tt/i, ""),
                episodeImdbId: episodeExternalIds.imdb_id?.replace(/^tt/i, ""),
                tmdbId: tvId,
                season: season,
                episode: matchedEpisode.episode_number
              }
            };
          }
        } catch (error) {
          console.warn(`Could not search season ${season}:`, error.message);
          continue;
        }
      }

      // Episode not found in any season
      return {
        success: false,
        error: `Episode with title "${episodeTitle}" not found in ${showName}`,
        searchParams: {}
      };

    } catch (error) {
      console.error("TMDb searchEpisodeByTitle error:", error);
      return {
        success: false,
        error: error.message,
        searchParams: {}
      };
    }
  }

  /**
   * Search episode by title with multiple show name attempts
   * @param {object} params
   * @param {string[]} params.showNames - Array of potential show names
   * @param {string} params.episodeTitle - Title of the episode
   * @param {number} [params.seasonNumber] - Optional season hint
   * @param {string} [params.language="fr-FR"]
   * @returns {Promise<object>} - First successful result
   */
  async searchEpisodeByTitleMultiple({ showNames, episodeTitle, seasonNumber, language = "fr-FR" }) {
    for (const showName of showNames) {
      const result = await this.searchEpisodeByTitle({
        showName,
        episodeTitle,
        seasonNumber,
        language
      });

      if (result.success) {
        return result;
      }
    }

    return {
      success: false,
      error: `No episode found with title "${episodeTitle}" for any of: ${showNames.join(", ")}`,
      searchParams: {}
    };
  }
}
