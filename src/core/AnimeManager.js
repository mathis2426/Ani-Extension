import { StorageService } from "../services/StorageService.js";

/**
 * AnimeManager
 * Gère la logique métier autour de la liste d'animes.
 */
export class AnimeManager {
  static async saveAnime(anime) {
    const dataList = (await StorageService.get("popupDataList")) || [];

    // Vérifie si l’anime existe déjà
    const existingIndex = dataList.findIndex(a => a.name === anime.name);

    if (existingIndex !== -1) {
      anime.notif = dataList[existingIndex].notif;
      dataList.splice(existingIndex, 1);
    }

    // Ajoute en tête
    dataList.unshift({ ...anime });

    await StorageService.set("popupDataList", dataList);
  }
}
