import { StorageService } from "../services/StorageService.js";

/**
 * AnimeManager
 * Manage the logic around the anime list.
 */
export class AnimeManager {
  static async saveAnime(anime) {
    const dataList = (await StorageService.get("popupDataList")) || [];

    const existingIndex = dataList.findIndex(a => a.name === anime.name);

    if (existingIndex !== -1) {
      // Conserver la notif et les éventuelles images déjà stockées
      anime.notif = dataList[existingIndex].notif;
      anime.anilistBanner = anime.anilistBanner || dataList[existingIndex].anilistBanner || null;
      anime.anilistImage = anime.anilistImage || dataList[existingIndex].anilistImage || null;
      dataList.splice(existingIndex, 1);
    }

    // Sauvegarder avec les infos d'images si présentes
    dataList.unshift({ ...anime });

    await StorageService.set("popupDataList", dataList);
  }
}
