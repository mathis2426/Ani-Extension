import { AnimeProperties } from "../interfaces/calendar-interface.js";
import { fetchTwoWeeksSchedule } from "../api/anilist.js";

const CACHE_DURATION =  20 * 60 * 1000; // 20 min

export async function getAnimeScheduleWithCache() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("animeProperties", async (data) => {
      const cached = data.animeProperties;
      const now = Date.now();

      if (cached && cached.lastUpdate && now - cached.lastUpdate < CACHE_DURATION) {
        console.log("⏱ Données chargées depuis le cache");
        resolve(cached.animelist);
      } else {
        console.log("🔄 Cache expiré → récupération AniList");
        try {
          const mediaList = await fetchTwoWeeksSchedule();
          const animeProperties = new AnimeProperties();
          animeProperties.animelist = mediaList;
          animeProperties.lastUpdate = Date.now();
          chrome.storage.local.set({ animeProperties });
          resolve(mediaList);
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}
