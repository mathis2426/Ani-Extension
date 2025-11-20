/**
 * File Name      : anilistUtils.js
 * Description    : Utility functions for interacting with Anilist API.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Last Updated   : 2025-11-02
 * Version        : 1.0.0
 */

/**
 * Fetch all animes from Anilist API based on the anime title
 * @param {string} animeTitle - Title of the anime to search for
 * @returns {Promise<Array>} - Array of anime objects from Anilist
 */
async function fetchAllAnimes(animeTitle) {
  const query = `
    query ($search: String) {
      Page(page: 1, perPage: 10) {
        media(search: $search, type: ANIME) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            large
          }
          status
          startDate {
            year
            month
            day
          }
        }
      }
    }
  `;

  const variables = {
    search: animeTitle
  };
  
  try {
    // Proxy the request to the extension background to avoid CORS blocking in content scripts
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'ANILIST_REQUEST', query, variables }, (response) => {
        if (!response) return resolve(null);
        resolve(response);
      });
    });

    if (!result || !result.ok) {
      console.error('Erreur lors de la requête Anilist (proxy):', result?.error || result);
      return [];
    }

    const json = result.data;
    const animes = json?.data?.Page?.media || [];
    return animes;
  } catch (error) {
    console.error("Erreur lors de la requête Anilist :", error);
    return [];
  }
}
