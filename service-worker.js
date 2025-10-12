/**
 * File Name      : service-worker.js
 * Description    : Handles background message passing for the extension.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Date           : Last update 2025-10-07
 * Version        : 1.1.0
 */

import { AnimeManager } from "./src/core/AnimeManager.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "animeData") {
    AnimeManager.saveAnime(message.data);
  }
});
