import { StorageService } from "../services/StorageService.js";

/**
 * AnimeManager
 * Manage the logic around the anime list.
 */
export class AnimeManager {
  static async saveAnime(anime) {
    const popupDataList =
      (await StorageService.getsync("popupDataList")) || {};

    const name = anime.name;

    popupDataList[name] ??= {
      notif: anime.notif ?? false,
      history: []
    };

    const { notif, ...animeWithoutNotif } = anime;

    const history = popupDataList[name].history;
    const now = Date.now();

    const index = history.findIndex(a => a.episode === anime.episode);

    if (index !== -1) {
      const lastUpdate = history[index].lastUpdate ?? 0;

      if (now - lastUpdate < 1000) {
        return;
      }

      const updatedAnime = {
        ...history[index],
        ...animeWithoutNotif,
        lastUpdate: now
      };

      history.splice(index, 1);
      history.unshift(updatedAnime);
    } else {
      history.unshift({
        ...animeWithoutNotif,
        lastUpdate: now
      });
    }

    await StorageService.setsync("popupDataList", popupDataList);
  }
}



