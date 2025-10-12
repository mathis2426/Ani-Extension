/**
 * File Name      : voiranime.js
 * Description    : Script to retrieve information about the currently playing anime on Voiranime.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Last Updated   : 2024-06-10
 * Version        : 1.0.0
 */


/**
 * voiranime
 * Description: - Get information about the anime currently playing on Voiranime
 * @param {animeClass} animeClass
 * @param {function} callback
 * @return void
 */
async function voiranime(animeClass, callback) {

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
      animeClass.lastUpdate = Date.now();
    }

    // Trigger the callback when we receive Duration or Time updates
    if (event.data.type === "Duration" || event.data.type === "Time") {
      callback();
    }
  });

  if (location.hostname == "v6.voiranime.com") {

    let link = location.href;
    if(link == "https://v6.voiranime.com/") return; // If on the homepage, do nothing

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