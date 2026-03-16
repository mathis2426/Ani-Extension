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
      anime.notif = dataList[existingIndex].notif;
      dataList.splice(existingIndex, 1);
    }

    dataList.unshift({ ...anime });

    await StorageService.set("popupDataList", dataList);
  }
}