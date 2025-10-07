/**
 * File Name      : foreground.js
 * Description    : This file manages the extraction, processing, and sending of anime information for the extension.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Date           : Last update 2025-09-29
 * Version        : 1.0.0
 */

let animeCarac = new anime();

switch (location.hostname) {
  case "v6.voiranime.com":
  case "vidmoly.net": // lecteur myTV
  case "voe.sx": // lecteur voe
  case "my.mail.ru": // lecteur FHD1
    voiranime(animeCarac, () => {
      if (chrome.runtime?.id) { // Check if the extension is connected
        chrome.runtime.sendMessage({ type: "animeData", data: animeCarac });
      }
    });
    break;

  case "www.crunchyroll.com":
  case "static.crunchyroll.com":
    SPADetectChange(() => {
      crunchyroll(animeCarac, location, () => {
        if (chrome.runtime?.id) { 
          chrome.runtime.sendMessage({ type: "animeData", data: animeCarac });
        }
      });
    });
    break;

  default:
    break;
}