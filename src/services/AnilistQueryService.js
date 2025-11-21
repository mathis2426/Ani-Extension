
/**
 * fetchAllAnimesQuery
 * Description: - Fetch all animes from Anilist API based on the anime title
 * @param {any} animeTitle
 * @return Promise
 */
export async function fetchAllAnimesQuery(animeTitle) {
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