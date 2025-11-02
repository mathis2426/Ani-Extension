/**
 * File Name      : iframeUtils.js
 * Description    : Utility functions for iframe communication and message passing.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Last Updated   : 2025-11-02
 * Version        : 1.0.0
 */

import { waitVideoElement } from './videoUtils.js';
import { fetchAllAnimes } from './anilistUtils.js';

/**
 * Send the anime name to iframe when it's ready
 * @param {string} animeName - Name of the anime to send
 */
export function sendAnimeNameToIframe(animeName) {
  // Handshake: respond to the iframe when it is ready,
  // even if it arrives after (or before) us.
  const waitingChildren = new Set(); // keeps windows waiting if the name is not ready

  /**
   * Send the anime name to the specified window
   * @param {Window} targetWin - Target window to send message to
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
 * Send requests to find the anime name from the parent window
 * Used by iframes to request anime information from parent
 */
export async function sendRequestFindAnime() {
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
  if (!video) {
    video = await waitVideoElement();
  }

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
      
      if (!hasTriggered && currentTime >= TIME_TO_DETECT && animeNameFromParent) {
        hasTriggered = true;
        fetchAllAnimes(animeNameFromParent); // Fetch animes from Anilist
      }
    });
  }
}
