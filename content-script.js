/**
 * File Name      : content-script.js
 * Description    : This file manages the extraction, processing, and sending of anime information for the extension.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Date           : Last update 2025-09-29
 * Version        : 1.0.0
 */

let animeClass = new anime();

// --- ton switch hostname existant (inchangé) ---
switch (location.hostname) {
  case "v6.voiranime.com":
  case "vidmoly.net": // lecteur myTV
  case "voe.sx": // lecteur voe
  case "my.mail.ru": // lecteur FHD1
    voiranime(animeClass, () => {
        chrome.runtime.sendMessage({ type: "animeData", data: animeClass });
    });
    break;

  case "www.crunchyroll.com":
  case "static.crunchyroll.com":
    SPADetectChange(() => {
      crunchyroll(animeClass, location, () => {
          chrome.runtime.sendMessage({ type: "animeData", data: animeClass });
      });
    });
    break;
  
  case "www.netflix.com":
      netflix(animeClass, () => {
        chrome.runtime.sendMessage({ type: "animeData", data: animeClass });
      });
    break;
  
  default:
    break;
}

// Listen for subtitle application messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "applySubtitle") {
    (async () => {
      try {
        await applySubtitleToVideo(message.subtitleContent, message.subtitleInfo, Number(message.offsetMs || 0));
        sendResponse({ success: true });
      } catch (error) {
        console.error("Erreur application sous-titres:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async response
  }
});