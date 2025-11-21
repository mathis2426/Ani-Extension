/**
 * File Name      : anilistUtils.js
 * Description    : Utility functions for Anilist operations.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Last Updated   : 2025-11-07
 * Version        : 1.0.0
 */

/**
 * fetchAllAnimes
 * Description: - Fetch all animes from Anilist API based on the anime title
 * @param {any} animeTitle
 * @return Promise
 */
async function fetchAllAnimes(animeTitle) {
  const query = `
query ($search: String) {
  Page(page: 1, perPage: 50) {
    pageInfo {
      currentPage
      hasNextPage
    }
    media(search: $search, status_in: [RELEASING, NOT_YET_RELEASED], type: ANIME, sort: POPULARITY_DESC) {
      id
      title {
        romaji
        english
        native
      }
      genres
      nextAiringEpisode {
        airingAt
        episode
      }
      episodes
      season
      seasonYear
      averageScore
      coverImage {
        large
      }
      duration
      status
      updatedAt
    }
  }
}
  `;

  const variables = {
    search: animeTitle
  };
  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();
    const animes = result.data.Page.media;

    return animes;

  } catch (error) {
    console.error("Erreur lors de la requête Anilist :", error);
    return [];
  }
}

/**
 * animeFilter
 * Description: - Filter anime list to get the best match (placeholder for now)
 * @param {Array} animeList - List of animes from Anilist
 * @param {string} animeTitle - The anime title to match
 * @return {Object} - First anime object with all its information
 */
function animeFilter(animeList, animeTitle) { // finction to update in case of more complex filtering
    if (animeList && animeList.length > 0) {
        return animeList[0];
    }
    return null;
}