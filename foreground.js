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
  case "vidmoly.to":
  case "w9gw7oou.com":
  case "voe.sx":
  case "sandratableother.com":
  case "my.mail.ru":
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

function getAnimeCarac() {
  console.log("getAnimeCarac");

  let link = location.href;
}

function crunchyroll(animeClass, location, callback) {
  window.addEventListener("message", (event) => {
    if (!event.data) return;

    if (event.data.type === "Duration") {
      animeCarac.duration = event.data.data;
    }

    if (event.data.type === "Time") {
      animeCarac.currentTime = event.data.data;
    }

    if (animeCarac.title) {
      callback();
    }
  });

  if (location.hostname === "www.crunchyroll.com") {
    let targetNode = document.getElementById("content");
    let config = { childList: true, subtree: true };

    let observerCallback = function (mutationsList, observer) {
      for (let mutation of mutationsList) {
        if (mutation.type === "childList") {
          let titleNode = document.querySelector("h1");
          let animenode = document.querySelector("a.show-title-link");
          if (titleNode) {
            const h1 = titleNode.textContent.split(" - ");
            animeClass.episode = h1[0].substring(1);
            animeClass.title = h1[1];
            animeClass.link = location.href;
          }
          if (animenode) {
            animeClass.name = animenode.querySelector("h4").textContent;
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
  } else if (location.hostname == "static.crunchyroll.com") {
    let video = document.querySelector("video");
    video.addEventListener("loadedmetadata", () => {
      window.parent.postMessage(
        { type: "Duration", data: video.duration },
        "*"
      );
    });

    video.addEventListener("timeupdate", () => {
      window.parent.postMessage(
        { type: "Time", data: Math.floor(video.currentTime) },
        "*"
      );
    });
  } else {
    console.log("Host not supported");
  }
}

async function voiranime(animeClass, callback) {
  window.addEventListener("message", (event) => {
    if (!event.data) return;

    if (event.data.type === "Duration") {
      animeCarac.duration = event.data.data;
    }

    if (event.data.type === "Time") {
      animeCarac.currentTime = event.data.data;
    }
    if (true) {
      callback();
    }
  });

  if (location.hostname == "v6.voiranime.com") {
    console.log("URL case iframe : ", location.hostname, location.href);

    let link = location.href;
    let titleAnime = link.split("/")[4].split("-").join(" ");
    titleAnime = titleAnime.charAt(0).toUpperCase() + titleAnime.slice(1);
    let episodeLink = link.split("/")[5];
    let episode = episodeLink.substring(0, episodeLink.lastIndexOf("-")).split("-").pop();

    animeClass.name = titleAnime;
    animeClass.episode = episode;
    animeClass.link = link;
    animeClass.notif = false;
  }
  if (location.hostname == "vidmoly.to" || location.hostname == "w9gw7oou.com" || location.hostname == "voe.sx" || location.hostname == "sandratableother.com" || location.hostname == "my.mail.ru") {
    console.log("URL case iframe new : ", location.hostname, location.href);

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

      video.addEventListener("timeupdate", () => {
        console.log("time : ", video.duration, video.currentTime);
        window.top.postMessage(
          { type: "Time", data: Math.floor(video.currentTime) },
          "*"
        );
      });
    }
  }
}

async function waitVideoElement() {
  return new Promise((resolve) => {
    let observer = new MutationObserver(function () {
      const video = document.getElementsByTagName("video")[0];
      if (video) {
        resolve(video);
        observer.disconnect();
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}
