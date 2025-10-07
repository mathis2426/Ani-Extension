
/**
 * sendAnimeNameToIframe
 * Description: - Send the anime name to the iframe when it's ready
 * @param {string} animeName 
 */
function sendAnimeNameToIframe(animeName) {

  // Handshake: respond to the iframe when it is ready,
  // even if it arrives after (or before) us.
  const waitingChildren = new Set(); // keeps windows waiting if the name is not ready

  /**
   * Send the anime name to the specified window
   * @param {*} targetWin 
   */
  function sendAnimeNameTo(targetWin) {
    try {
      targetWin.postMessage({ type: "AnimeName", data: animeName }, "*");
    } catch (e) {
      console.warn("postMessage to iframe failed:", e);
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

    const TIME_TO_DETECT = 180; // Time in seconds to trigger the fetch
    let hasTriggered = false;
    video.addEventListener("timeupdate", () => {
      let currentTime = Math.floor(video.currentTime);
      window.top.postMessage(
        { type: "Time", data: currentTime },
        "*"
      );
      if (!hasTriggered && currentTime >= TIME_TO_DETECT && animeNameFromParent) { // Time subject to change
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

    return animes;

  } catch (error) {
    console.error("Erreur lors de la requête Anilist :", error);
    return [];
  }
}


/**
 * SPADetectChange
 * Description: - Detects changes in the URL and calls the callback function for Single Page Applications (SPA)
 * @param {void} callback 
 */
function SPADetectChange(callback) {
  callback();
  let currentUrl = location.href;

  function handleEpisodeChange() {
    if (location.href !== currentUrl && location.href.includes('/watch/')) {
      currentUrl = location.href;
      callback();

    }
  }

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    setTimeout(handleEpisodeChange, 100);
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    setTimeout(handleEpisodeChange, 100);
  };

  const observer = new MutationObserver(() => {
    handleEpisodeChange();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  handleEpisodeChange();
};