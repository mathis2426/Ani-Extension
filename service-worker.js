/**
 * File Name      : service-worker.js
 * Description    : Handles background message passing for the extension.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Date           : Last update 2025-11-02
 * Version        : 1.2.0
 */

import { AnimeManager } from "./src/core/AnimeManager.js";
import { OpenSubtitlesManager } from "./src/core/OpenSubtitlesManager.js";


/*
 * Background script for handling messages from content scripts
*/

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Handle anime data saving
  if (message.type === "animeData") {
    AnimeManager.saveAnime(message.data);
  }
  
  // Handle subtitle search request from content script
  if (message.type === "searchSubtitles") {
    OpenSubtitlesManager.SubtitleSearch(message.anime, sendResponse);
    return true; // Keep channel open for async response
  }
  
  // Handle subtitle download request
  if (message.type === "downloadSubtitle") {
    OpenSubtitlesManager.SubtitleDownload(message.subtitle, message.anime, message.offsetMs || 0, sendResponse);
    return true;
  }

});


/*
* Background setup on installation
*/

chrome.runtime.onInstalled.addListener(async () => {

  const RULE_ID = 1001;

  // Set up declarative net request rule to modify User-Agent for OpenSubtitles API
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