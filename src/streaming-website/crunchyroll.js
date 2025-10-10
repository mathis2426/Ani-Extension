/**
 * crunchyroll
 * Description :
 *  - Get information about the anime currently playing on Crunchyroll
 * @param {animeClass} animeClass 
 * @param {string} location 
 * @param {function} callback 
 */
function crunchyroll(animeClass, location, callback) {
  // Listener for messages from the iframe
  window.addEventListener("message", (event) => {
    if (!event.data) return;

    // Duration is the total duration of the video
    if (event.data.type === "Duration") {
      animeClass.duration = event.data.data;
    }

    // Time is the current time of the video
    if (event.data.type === "Time") {
      animeClass.currentTime = event.data.data;
      animeClass.lastUpdate = Date.now(); // Update the last update time
    }

    if (animeClass.title) {
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