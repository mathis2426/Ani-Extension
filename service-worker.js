/**
 * File Name      : service-worker.js
 * Description    : Handles background message passing and storage for the extension.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Date           : Last update 2025-09-29
 * Version        : 1.0.0
 */

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
