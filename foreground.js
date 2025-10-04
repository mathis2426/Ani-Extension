/**
 * File Name      : foreground.js
 * Description    : This file manages the extraction, processing, and sending of anime information for the extension.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Date           : Last update 2025-09-29
 * Version        : 1.0.0
 */

let editorExtensionId = "olggkeglcmmolkpmnpffffcpcpdlonpk";

class anime {
  constructor() {
    this.name = "";
    this.title = "";
    this.episode = "";
    this.link = "";
    this.duration = 0;
    this.currentTime = 0;
    this.notif = false;
  }
}

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
    crunchyroll(animeCarac, location, () => {
      if (chrome.runtime?.id) { // Check if the extension is connected
        chrome.runtime.sendMessage({ type: "animeData", data: animeCarac });
      }
    });
    break;

  default:
    break;
}

/**
 * crunchyroll
 * Description :
 *  - Get information about the anime currently playing on Crunchyroll
 * @param {animeCarac} animeClass 
 * @param {string} location 
 * @param {function} callback 
 */
function crunchyroll(animeClass, location, callback) {

  // Listener for messages from the iframe
  window.addEventListener("message", (event) => {
    if (!event.data) return;

    // Duration is the total duration of the video
    if (event.data.type === "Duration") {
      animeCarac.duration = event.data.data;
    }

    // Time is the current time of the video
    if (event.data.type === "Time") {
      animeCarac.currentTime = event.data.data;
    }

    if (animeCarac.title) {
      callback(); // Send the data to the background script
    }
  });

  // Check if the current page is a Crunchyroll page
  if (location.hostname === "www.crunchyroll.com") {
    let targetNode = document.getElementById("content");
    let config = { childList: true, subtree: true };

    // Observer to watch for changes in the DOM
    let observerCallback = function (mutationsList, observer) {
      for (let mutation of mutationsList) {
        if (mutation.type === "childList") {
          let titleNode = document.querySelector("h1");
          let animenode = document.querySelector("a.show-title-link");
          if (titleNode) {
            const h1 = titleNode.textContent.split(" - ");
            animeClass.episode = h1[0].substring(1); // Episode number
            animeClass.title = h1[1]; // Title of the anime
            animeClass.link = location.href; // Link to the anime
          }
          if (animenode) {
            animeClass.name = animenode.querySelector("h4").textContent; // Name of the anime
            sendAnimeNameToIframe(animeClass.name);
          }

          if (titleNode && animenode) {
            callback();
            observer.disconnect();
            break;
          }
        }
      }
    };

    let observer = new MutationObserver(observerCallback);
    observer.observe(targetNode, config);
  } else if (location.hostname == "static.crunchyroll.com") { // If the page is an iframe

    sendRequestFindAnime();
  } else {
    console.log("Hôte non pris en charge");
  }
}

/**
 * voiranime
 * Description: - Get information about the anime currently playing on Voiranime
 * @param {animeCarac} animeClass
 * @param {function} callback
 * @return void
 */
async function voiranime(animeClass, callback) {

  // Listener for messages from the iframe
  window.addEventListener("message", (event) => {
    if (!event.data) return;

    // Duration is the total duration of the video
    if (event.data.type === "Duration") {
      animeCarac.duration = event.data.data;
    }

    // Time is the current time of the video
    if (event.data.type === "Time") {
      animeCarac.currentTime = event.data.data;
    }

    // Trigger the callback when we receive Duration or Time updates
    if (event.data.type === "Duration" || event.data.type === "Time") {
      callback();
    }
  });

  if (location.hostname == "v6.voiranime.com") {

    let link = location.href;
    let titleAnime = link.split("/")[4].split("-").join(" ");
    titleAnime = titleAnime.charAt(0).toUpperCase() + titleAnime.slice(1);
    let episodeLink = link.split("/")[5];
    let episode = episodeLink.substring(0, episodeLink.lastIndexOf("-")).split("-").pop();

    animeClass.name = titleAnime; // Name of the anime
    animeClass.episode = episode; // Episode number
    animeClass.link = link; // Link to the anime
    animeClass.notif = false;

    sendAnimeNameToIframe(animeClass.name);
  }

  if (
    location.hostname == "vidmoly.net" || // myTV player
    location.hostname == "voe.sx" || // voe player
    location.hostname == "my.mail.ru" // FHD1 player
  ) {
    sendRequestFindAnime();
  }
}

/**
 * sendAnimeNameToIframe
 * Description: - Send the anime name to the iframe when it's ready
 * @param {string} animeName 
 */
function sendAnimeNameToIframe(animeName) {

  // Handshake: respond to the iframe when it is ready,
  // even if it arrives after (or before) us.
  const waitingChildren = new Set(); // garde les fenêtres en attente si nom pas prêt

  /**
   * Send the anime name to the specified window
   * @param {*} targetWin 
   */
  function sendAnimeNameTo(targetWin) {
    try {
      targetWin.postMessage({ type: "AnimeName", data: animeName }, "*");
    } catch (e) {
      console.warn("postMessage vers l'iframe a échoué :", e);
    }
  }

  /**
   * If later we update the name, we can deliver it again to all waiting
   * @return void 
   */
  function flushWaiting() {
    waitingChildren.forEach((w) => sendAnimeNameTo(w));
    waitingChildren.clear();
  }

  // The parent listens for signals from the iframe
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || (msg.type !== "ChildReady" && msg.type !== "RequestAnimeName")) return;

    // Respond directly to the iframe source
    if (animeName) {
      sendAnimeNameTo(event.source);
    } else {
      waitingChildren.add(event.source);
    }
  });
  flushWaiting();
}

/**
 * sendRequestFindAnime
 * Description: - Send requests to find the anime name from the parent window
 * @return void
 */
async function sendRequestFindAnime() {
  let animeNameFromParent = null;

  // At the start: announce that we're ready and keep requesting every 1s until we get a response.
  window.top.postMessage({ type: "ChildReady" }, "*");
  let askInterval = setInterval(() => {
    if (!animeNameFromParent) {
      window.top.postMessage({ type: "RequestAnimeName" }, "*");
    } else {
      clearInterval(askInterval);
    }
  }, 1000);

  // Receive the name
  window.addEventListener("message", (event) => {
    if (event.data?.type === "AnimeName" && event.data.data) {
      animeNameFromParent = event.data.data;
    }
  });

  // Video management + trigger at 180s
  let video = document.querySelector("video");
  if (!video)
    video = await waitVideoElement();

  if (video) {
    video.addEventListener("loadedmetadata", () => {
      window.top.postMessage(
        { type: "Duration", data: video.duration },
        "*"
      );
    });

    let hasTriggered = false;
    video.addEventListener("timeupdate", () => {
      let currentTime = Math.floor(video.currentTime);
      window.top.postMessage(
        { type: "Time", data: currentTime },
        "*"
      );
      if (!hasTriggered && currentTime >= 180 && animeNameFromParent) { // Time subject to change
        hasTriggered = true;

        fetchAllAnimes(animeNameFromParent); // Fetch animes from Anilist
      }
    });
  }
}

/**
 * waitVideoElement
 * Description: - Wait for the video element to be loaded in the DOM
 * @return Promise
 */
async function waitVideoElement() {
  return new Promise((resolve) => {
    // Check if the video already exists
    const existing = document.getElementsByTagName("video")[0];
    if (existing) return resolve(existing);

    // Observe changes
    let observer = new MutationObserver(() => {
      const video = document.getElementsByTagName("video")[0];
      if (video) {
        resolve(video);
        observer.disconnect();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });
}


/**
 * fetchAllAnimes
 * Description: - Fetch all animes from Anilist API based on the anime title
 * @param {any} animeTitle
 * @return Promise
 */
async function fetchAllAnimes(animeTitle) {
  const query = `
    query ($search: String) {
      Page(page: 1, perPage: 10) {
        media(search: $search, type: ANIME) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            large
          }
          status
          startDate {
            year
            month
            day
          }
        }
      }
    }
  `;

  const variables = {
    search: animeTitle
  };
  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();
    const animes = result.data.Page.media;

    console.log("Animes récupérés depuis Anilist :", animes);
    return animes;

  } catch (error) {
    console.error("Erreur lors de la requête Anilist :", error);
    return [];
  }
}