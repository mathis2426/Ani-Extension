chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "animeData") {
    const animeCarac = message.data;

    chrome.storage.local.get("popupDataList", (result) => {
      let dataList = result.popupDataList || [];

      const existingIndex = dataList.findIndex(anime =>
        anime.name === animeCarac.name
      );

      if (existingIndex !== -1) {
        animeCarac.notif = dataList[existingIndex].notif;
        dataList.splice(existingIndex, 1);
      }

      dataList.unshift({ ...animeCarac });

      chrome.storage.local.set({ popupDataList: dataList });
    });
  }
});

/** 
/**
 * File Name      : service-worker.js
 * Description    : Handles background message passing for the extension.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Date           : Last update 2025-10-07
 * Version        : 1.1.0
 

import { AnimeManager } from "./src/core/AnimeManager.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "animeData") {
    AnimeManager.saveAnime(message.data);
  }
});*/