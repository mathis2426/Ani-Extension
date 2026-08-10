/**
 * File Name      : netflix.js
 * Description    : Netflix streaming website integration.
 * Author         : (toi)
 * Last Updated   : 2025-10-13
 * Version        : 1.0.1
 */

import { createSubtitleButton } from "./features/subtitle-btn.js";

/**
 * netflix
 * Description :
 *  - Get information about the anime currently playing on Netflix
 * @param {animeClass} animeClass 
 * @param {function} callback 
 */
export function netflix(animeClass, callback) {
    createSubtitleButton();
    let targetNode = document.body;
    let config = { childList: true, subtree: true };
    let currentVideoElement = null; // Track current video element
    let currentUrl = location.href; // Track current URL to detect episode changes
    let autoSkipIntro = chrome.storage.sync.get(["settings"], (result) => {
        return result.netflixSettings?.autoSkip || false;
    });
    let autoPlayNext = chrome.storage.sync.get(["settings"], (result) => {
        return result.netflixSettings?.autoPlayNext || false;
    });

    // Observer to watch for changes in the DOM
    let observerCallback = function (mutationsList, observer) {
        for (let mutation of mutationsList) {
            if (mutation.type === "childList") {
                let videoTitleElement = document.querySelector("[data-uia='video-title']");
                let videoElement = document.querySelector("video");

                // Detect episode change by URL or video element change
                const urlChanged = location.href !== currentUrl;
                const videoChanged = videoElement && videoElement !== currentVideoElement;
                
                if (urlChanged) {
                    currentUrl = location.href;
                    currentVideoElement = null; // Reset video tracking on URL change
                }

                if (videoTitleElement) {
                    let h4Element = videoTitleElement.querySelector("h4");
                    if (h4Element) {
                        animeClass.name = h4Element.innerText; // Name of the anime
                    }

                    let spans = videoTitleElement.querySelectorAll("span");
                    if (spans.length >= 2) {
                        const episodeText = spans[0].innerText;
                        const episodeMatch = episodeText.match(/\d+/);
                        animeClass.episode = episodeMatch ? parseInt(episodeMatch[0]) : episodeText;
                        animeClass.title = spans[1].innerText; // Title of the episode
                    }
                    else if (spans.length === 0) {
                        if (!h4Element) {
                            try {
                                const titleParts = videoTitleElement.innerText.split(":");
                                animeClass.name = titleParts[0];
                                animeClass.title = titleParts[1] ? titleParts[1].trim() : "";
                                animeClass.episode = "";
                            } catch (error) {
                                animeClass.name = videoTitleElement.innerText;
                                animeClass.title = "";
                            }
                        }
                    }

                    animeClass.link = location.href;
                    animeClass.lastUpdate = Date.now();
                }

                // Add listeners to new video element (or if episode changed)
                if (videoElement && (videoChanged || urlChanged)) {
                    createSubtitleButton();
                    currentVideoElement = videoElement;
                    animeClass.duration = videoElement.duration;
                    animeClass.currentTime = videoElement.currentTime;
                    animeClass.lastUpdate = Date.now();

                    // Listen to time updates for continuous tracking
                    videoElement.addEventListener("timeupdate", () => {
                        if(videoElement.currentTime == 0) return;
                        animeClass.currentTime = Math.floor(videoElement.currentTime);
                        animeClass.lastUpdate = Date.now();
                        if (animeClass.title) {
                            callback(); // Send updates to background script
                        }
                    });

                    // Update duration when metadata is loaded
                    videoElement.addEventListener("loadedmetadata", () => {
                        animeClass.duration = videoElement.duration;
                        animeClass.lastUpdate = Date.now();
                        if (animeClass.title) {
                            callback();
                        }
                    });

                    // Send callback when new episode detected
                    if (animeClass.name && animeClass.title && animeClass.episode) {
                        callback();
                    }
                    console.log(animeClass);
                }
            }
        }
    };

    let observer = new MutationObserver(observerCallback);
    observer.observe(targetNode, config);
}