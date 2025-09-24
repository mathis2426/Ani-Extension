export async function fetchTwoWeeksSchedule() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diff);

  const sundayNext = new Date(monday);
  sundayNext.setDate(monday.getDate() + 13);
  sundayNext.setHours(23, 59, 59, 999);

  const startOfWeek = Math.floor(monday.getTime() / 1000);
  const endOfNextWeek = Math.floor(sundayNext.getTime() / 1000);

  const query = `
    query($page: Int!, $start: Int!, $end: Int!) {
      Page(page: $page, perPage: 50) {
        pageInfo { currentPage hasNextPage }
        airingSchedules(
          airingAt_greater: $start,
          airingAt_lesser: $end,
          sort: TIME
        ) {
          id
          airingAt
          episode
          media {
            id
            title { romaji }
            averageScore
            coverImage { large }
          }
        }
      }
    }
  `;

  let allSchedules = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { page, start: startOfWeek, end: endOfNextWeek } }),
    });

    const result = await response.json();
    const pageData = result.data.Page;
    allSchedules.push(...pageData.airingSchedules);
    hasNextPage = pageData.pageInfo.hasNextPage;
    page++;
  }

  return allSchedules.map((s) => {
    const dateObj = new Date(s.airingAt * 1000);
    return {
      title: s.media.title.romaji,
      date: dateObj.toLocaleDateString("fr-CA"),
      heure: dateObj.toTimeString().slice(0, 5),
      score: s.media.averageScore ?? null,
      poster: s.media.coverImage?.large ?? null,
      episode: s.episode,
    };
  });
}
