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

const RULE_ID = 1001;

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: [{
      id: RULE_ID,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: "User-Agent", operation: "set", value: "AniExtension/1.0 (+https://example.com)" }
        ]
      },
      condition: {
        urlFilter: "||api.opensubtitles.com",
        resourceTypes: ["xmlhttprequest", "sub_frame", "main_frame", "script", "object"]
      }
    }]
  });
});