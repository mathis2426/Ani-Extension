let editorExtensionId = "olggkeglcmmolkpmnpffffcpcpdlonpk";

// Loader paresseux pour le module de filtre
let _AnimeFilter;

async function useAnimeFilter() {
  if (!_AnimeFilter) {
    const mod = await import(chrome.runtime.getURL("assets/AnimeFilter.js"));
    _AnimeFilter = mod.AnimeFilter;
  }
  return _AnimeFilter();
}

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
  //case "w9gw7oou.com": // lecteur MOON
  case "voe.sx": // lecteur voe
  //case "sandratableother.com": // lecteur MOON
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

//function getAnimeCarac() {
//  console.log("getAnimeCarac");
//
//  let link = location.href;
//}

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
    console.log("Host not supported");
  }
}

/**
 * waitVideoElement
 * Description: - Get information about the anime currently playing on Voiranime
 * @param animeClass
 * @param callback
 * @return void
 */
async function voiranime(animeClass, callback) {
  window.addEventListener("message", (event) => {
    if (!event.data) return;

    if (event.data.type === "Duration") {
      animeCarac.duration = event.data.data;
    }

    if (event.data.type === "Time") {
      animeCarac.currentTime = event.data.data;
    }

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

    animeClass.name = titleAnime;
    animeClass.episode = episode;
    animeClass.link = link;
    animeClass.notif = false;

    sendAnimeNameToIframe(animeClass.name);
  }

  if (
    location.hostname == "vidmoly.net" || // lecteur myTV
    //location.hostname == "w9gw7oou.com" || // lecteur MOON
    //location.hostname == "sandratableother.com" || // lecteur MOON
    location.hostname == "voe.sx" || // lecteur voe
    location.hostname == "my.mail.ru" // lecteur FHD1
  ) {
    sendRequestFindAnime(); // test
  }
}

//

function sendAnimeNameToIframe(animeName) {

  // 2) Handshake : répondre à l'iframe quand elle est prête,
  //    même si elle arrive après (ou avant) nous.
  const waitingChildren = new Set(); // garde les fenêtres en attente si nom pas prêt

  function sendAnimeNameTo(targetWin) {
    try {
      targetWin.postMessage({ type: "AnimeName", data: animeName }, "*");
    } catch (e) {
      console.warn("postMessage vers l'iframe a échoué :", e);
    }
  }

  // Si plus tard on met à jour le nom, on peut relivrer à tous en attente
  function flushWaiting() {
    waitingChildren.forEach((w) => sendAnimeNameTo(w));
    waitingChildren.clear();
  }

  // Le parent écoute les signaux de l'iframe
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || (msg.type !== "ChildReady" && msg.type !== "RequestAnimeName")) return;

    // Répond directement à l'iframe source
    if (animeName) {
      sendAnimeNameTo(event.source);
    } else {
      waitingChildren.add(event.source);
    }
  });

  flushWaiting();
}


//---------------------------------------- Gestion des envois de requetes ----------------------------------------//

async function sendRequestFindAnime() {
  let animeNameFromParent = null;

  // 1) Dès le départ : annoncer qu'on est prêt
  //    + redemander toutes les 1s jusqu'à réception.
  window.top.postMessage({ type: "ChildReady" }, "*");
  let askInterval = setInterval(() => {
    if (!animeNameFromParent) {
      window.top.postMessage({ type: "RequestAnimeName" }, "*");
    } else {
      clearInterval(askInterval);
    }
  }, 1000);

  // 2) Recevoir le nom
  window.addEventListener("message", (event) => {
    if (event.data?.type === "AnimeName" && event.data.data) {
      animeNameFromParent = event.data.data;
      console.log("Nom anime reçu du parent :", animeNameFromParent);
    }
  });

  // 3) Gestion de la vidéo + déclenchement à 180s
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
      console.log("Current time:", currentTime);
      window.top.postMessage(
        { type: "Time", data: currentTime },
        "*"
      );
      console.log("animeNameFromParent : ", animeNameFromParent);
      if (!hasTriggered && currentTime >= 180 && animeNameFromParent) {
        hasTriggered = true;

        console.log("animetitle : ", animeNameFromParent);

        // Appel du filtre juste avant la requête
        useAnimeFilter().catch(console.error);

        fetchAllAnimes(animeNameFromParent);
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
    // 1) Vérifier si la vidéo existe déjà
    const existing = document.getElementsByTagName("video")[0];
    if (existing) return resolve(existing);

    // 2) Observer les changements
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




//---------------------------------------- test Anilist-API filter ----------------------------------------//

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
      body: JSON.stringify({ query, variables }), // ← ici `variables` doit être défini juste avant
    });

    const result = await response.json();
    const animes = result.data.Page.media;

    console.log("Animes fetched from Anilist:", animes);
    return animes;

  } catch (error) {
    console.error("Erreur lors de la requête Anilist :", error);
    return [];
  }
}