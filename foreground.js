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
  case "6v254h9v.xyz":
  case "voe.sx":
  case "sandratableother.com":
  case "my.mail.ru":
    console.log("URL case iframe : ", location.hostname, location.href);
    voiranime(animeCarac);
    break;

  case "www.crunchyroll.com":
  case "static.crunchyroll.com":
    crunchyroll(animeCarac, location, () => {
      chrome.runtime.sendMessage({ type: "animeData", data: animeCarac });
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

function voiranime(animeClass) {
  if (location.hostname == "v6.voiranime.com") {
    console.log("URL case iframe : ", location.hostname, location.href);

    let link = location.href;
    let title = link.split("/")[4].split("-").join(" ");
    let episodeLink = link.split("/")[5];
    let episode = episodeLink.split("-")[4];
    let traduction = episodeLink.split("-")[5];

    animeCarac.title = title;

    console.log(
      "Traduction : ",
      traduction,
      "Episode split : ",
      episodeLink.split("-"),
      "Title : ",
      title,
      "Link split : ",
      link.split("/"),
      "Link : ",
      link,
      "URL : ",
      location.hostname,
      location.href
    );
  }
}
