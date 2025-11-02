/**
 * File Name      : netflix.js
 * Description    : Netflix streaming website integration.
 * Author         : (toi)
 * Last Updated   : 2025-10-13
 * Version        : 1.0.1
 */

/**
 * netflix
 * Description :
 *  - Get information about the anime currently playing on Netflix
 * @param {animeClass} animeClass 
 * @param {function} callback 
 */
function netflix(animeClass, callback) {
    createSubtitleButton();
    let targetNode = document.body;
    let config = { childList: true, subtree: true };
    let videoListenersAdded = false; // Flag to ensure listeners are added only once

    // Observer to watch for changes in the DOM
    let observerCallback = function (mutationsList, observer) {
        for (let mutation of mutationsList) {
            if (mutation.type === "childList") {
                let videoTitleElement = document.querySelector("[data-uia='video-title']");
                let videoElement = document.querySelector("video");

                if (videoTitleElement) {
                    let h4Element = videoTitleElement.querySelector("h4");
                    if (h4Element) {
                        animeClass.name = h4Element.innerText; // Name of the anime
                    }

                    let spans = videoTitleElement.querySelectorAll("span");
                    if (spans.length >= 2) {
                        // Extract episode number properly (e.g., "E23" -> "23")
                        const episodeText = spans[0].innerText;
                        const episodeMatch = episodeText.match(/\d+/);
                        animeClass.episode = episodeMatch ? parseInt(episodeMatch[0]) : episodeText;
                        animeClass.title = spans[1].innerText; // Title of the episode
                    }

                    animeClass.link = location.href;
                    animeClass.lastUpdate = Date.now();
                }

                if (videoElement && !videoListenersAdded) {
                    videoListenersAdded = true; // Mark that listeners have been added
                    
                    animeClass.duration = videoElement.duration;
                    animeClass.currentTime = videoElement.currentTime;
                    animeClass.lastUpdate = Date.now();

                    // Listen to time updates for continuous tracking
                    videoElement.addEventListener("timeupdate", () => {
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
                }

                // Call callback only once when we have all essential info
                if (animeClass.name && animeClass.title && animeClass.episode) {
                    callback();
                    observer.disconnect();
                    break;
                }
            }
        }
    };

    let observer = new MutationObserver(observerCallback);
    observer.observe(targetNode, config);
}
