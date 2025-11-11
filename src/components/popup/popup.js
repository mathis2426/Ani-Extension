/**
 * File Name      : popup.js
 * Description    : This file manages the display and interaction logic for the popup page of the extension.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Date           : Last update 2025-11-02
 * Version        : 1.1.0
 */
import { URL_API } from "../../vars.js";

let token = null;

document.addEventListener("DOMContentLoaded", () => {
  const listAnime = document.getElementById("content_list");
  chrome.storage.local.get("popupDataList", (result) => {
    const animeList = result.popupDataList || [];
    if (animeList.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "empty-message";
      emptyMessage.textContent = "Aucun anime detecté. Veuillez lancer un anime pour le voir ici.";
      listAnime.appendChild(emptyMessage);
      return;
    }
    animeList.forEach((anime, index) => {
      const container = document.createElement("div");
      container.className = "content-list";
      container.setAttribute("data-link", anime.link);
      let episodeName = "";
      if (anime.title) {
        episodeName = `Ep ${anime.episode} - ${anime.title}`;
      }
      else {
        episodeName = `Episode ${anime.episode}`;
      }

      container.innerHTML = `
          <div class="top-bar">
            <h1>${anime.name}</h1>
            <div class="notif" data-index="${index}">
              <label class="container">
                <input type="checkbox" id="notif-${index}">
                <svg class="bell-solid" xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 448 512">
                  <path d="M224 0c-17.7 0-32 14.3-32 32V51.2C119 66 64 130.6 64 208v18.8c0 47-17.3 92.4-48.5 127.6l-7.4 8.3c-8.4 9.4-10.4 22.9-5.3 34.4S19.4 416 32 416H416c12.6 0 24-7.4 29.2-18.9s3.1-25-5.3-34.4l-7.4-8.3C401.3 319.2 384 273.9 384 226.8V208c0-77.4-55-142-128-156.8V32c0-17.7-14.3-32-32-32zm45.3 493.3c12-12 18.7-28.3 18.7-45.3H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7z"></path>
                </svg>
                <svg class="bell-regular" xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 448 512">
                  <path d="M224 0c-17.7 0-32 14.3-32 32V49.9C119.5 61.4 64 124.2 64 200v33.4c0 45.4-15.5 89.5-43.8 124.9L5.3 377c-5.8 7.2-6.9 17.1-2.9 25.4S14.8 416 24 416H424c9.2 0 17.6-5.3 21.6-13.6s2.9-18.2-2.9-25.4l-14.9-18.6C399.5 322.9 384 278.8 384 233.4V200c0-75.8-55.5-138.6-128-150.1V32c0-17.7-14.3-32-32-32zm0 96h8c57.4 0 104 46.6 104 104v33.4c0 47.9 13.9 94.6 39.7 134.6H72.3C98.1 328 112 281.3 112 233.4V200c0-57.4 46.6-104 104-104h8zm64 352H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7s18.7-28.3 18.7-45.3z"></path>
                </svg>
              </label>
            </div>
          </div>
  
          <div class="info">
            <div>
              <h3>${episodeName}</h3>
            </div>
            <div class="load">
              <progress value="0" max="100" id="bar-${index}">0%</progress>
              <p id="timecode-${index}">00:00</p>
            </div>
            <div class="actions-row">
              <div class="in-progress" id="in-progress-${index}">Lecture en cours</div>
            </div>
          </div>
        `;

      listAnime.appendChild(container);

      // Anime link 
      container.addEventListener("click", () => {
        const url = container.getAttribute("data-link");
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length > 0) {
            const currentTab = tabs[0];
            const currentUrl = currentTab.url;
            if (currentUrl !== url) {
              chrome.tabs.create({ url });
            }
          }
        });
      });

      // update the timecode and progress bar 
      updateTime(anime.currentTime, anime.duration, index);

      // Notification toggle
      const notifContainer = container.querySelector(".notif");
      const checkbox = container.querySelector(`#notif-${index}`);
      checkbox.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      notifContainer.addEventListener("click", (event) => {
        event.stopPropagation();
      });

      checkbox.checked = anime.notif;

      checkbox.addEventListener("change", () => {
        const isChecked = checkbox.checked;

        // Update the notification status in the storage
        chrome.storage.local.get("popupDataList", (result) => {
          let dataList = result.popupDataList || [];
          dataList[index].notif = isChecked;
          chrome.storage.local.set({ popupDataList: dataList });
        });
      });
    });
  });

  // Manage the buttons
  const buttons = ["home", "calendar", "suggestion", "list", "option"];

  buttons.forEach((btnId) => {
    const buttonElement = document.getElementById(btnId);
    if (!buttonElement) return;
    const container = buttonElement.parentElement; // the parent div of the button

    buttonElement.addEventListener("click", (ev) => {
      const clickedId = buttonElement.id; // robust against nested SVG clicks

      // Clear all active indicators
      buttons.forEach((otherBtn) => {
        const otherEl = document.getElementById(otherBtn);
        if (!otherEl) return;
        const selectedEl = otherEl.parentElement.querySelector(".selected");
        if (selectedEl) selectedEl.classList.remove("active");
        // remove active class on buttons
        otherEl.classList.remove("active");
      });

      // Open settings when settings button is clicked
      if (clickedId === "option") {
        chrome.tabs.query({}, (tabs) => {
          const alreadyOpen = tabs.find((tab) =>
            tab.url && tab.url.includes("src/components/settings/settings.html")
          );

          if (alreadyOpen) {
            chrome.tabs.update(alreadyOpen.id, { active: true });
          } else {
            chrome.tabs.create({
              url: chrome.runtime.getURL("src/components/settings/settings.html"),
            });
          }
        });
      }

      // Mark current button as selected
      const selected = container.querySelector(".selected");
      if (selected) selected.classList.add("active");
      // Add active class to clicked button for CSS styling
      buttonElement.classList.add("active");
    });
  });
  document.getElementById("home").click();

});

// Utils
function secondsToms(d) {
  d = Number(d);
  let m = Math.floor((d % 3600) / 60);
  let s = Math.floor((d % 3600) % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function updateTime(current, total, index) {
  if (!isFinite(current) || !isFinite(total) || total <= 0) return;

  const progress = (current / total) * 100;
  const bar = document.getElementById(`bar-${index}`);
  const timecode = document.getElementById(`timecode-${index}`);

  if (bar) bar.value = progress;
  if (timecode) timecode.textContent = secondsToms(current);
}

// Event Listeners for the popup
// Update of the timecode on the popup
document.addEventListener("DOMContentLoaded", () => {

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.popupDataList) {
      const oldList = changes.popupDataList.oldValue || [];
      const newList = changes.popupDataList.newValue || [];
      // Détecte d'abord s'il y a eu un vrai changement lié à la lecture
      let anyHasChanged = false;
      newList.forEach((anime, index) => {
        const oldAnime = oldList[index];
        if (!oldAnime) return; // nouvel élément ? ignore
        if (anime.currentTime !== oldAnime.currentTime || anime.duration !== oldAnime.duration) {
          anyHasChanged = true;
        }
      });

      // N'insère le delimiter que si un changement de lecture a eu lieu.
      if (anyHasChanged) {
        // Compte les items qui sont réellement marqués comme "in-progress.active"
        const activeCount = document.querySelectorAll('.in-progress.active').length;
        const listanime = document.getElementById(`content_list`);
        if (!document.getElementById("delimiter")) {
          let delimiter = document.createElement("div");
          delimiter.innerHTML = '<div class="delimiter-container"><div class="delimiter" id="delimiter"></div></div>';
          const refernode = listanime.children[activeCount + 1] || null;
          listanime.insertBefore(delimiter, refernode);
        }
      }

      // Puis applique les mises à jour de temps/état uniquement pour les éléments réellement modifiés
      newList.forEach((anime, index) => {
        const oldAnime = oldList[index];
        if (!oldAnime) return; // nouvel élément ? ignore

        const hasChanged = anime.currentTime !== oldAnime.currentTime || anime.duration !== oldAnime.duration;
        if (hasChanged) {
          const inprogress = document.getElementById(`in-progress-${index}`);

          if (anime.lastUpdate == Date.now() || anime.lastUpdate > Date.now() - 1100) {
            inprogress.classList.add("active");
          } else {
            inprogress.classList.remove("active");
          }
          updateTime(anime.currentTime, anime.duration, index);
        }
      });
    }
  });
});

// Click on the login button
document.addEventListener("click", (event) => {
  const target = event.target;

  // Check if the clicked element is #connexion
  if (target.id === "connexion") {
    chrome.tabs.query({}, (tabs) => {
      const alreadyOpen = tabs.find((tab) =>
        tab.url && tab.url.includes("src/components/login/login.html")
      );

      if (alreadyOpen) {
        chrome.tabs.update(alreadyOpen.id, { active: true });
      } else {
        chrome.tabs.create({
          url: chrome.runtime.getURL("src/components/login/login.html"),
        });
      }
    });
  }
  else if (target.id === "deconnexion") {
    chrome.storage.local.remove("token", () => {
      token = null;
    });
  }
});

/**
 * Get user information for the popup
 * @param {*} token 
 * @returns 
 */
async function getPopupUserInformation(token) {
  try {
    const response = await fetch("http://localhost/Ani-Api/api/userInformations/simpleInformation", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();
    console.log("data id users : ", data.id_users);
    if ((data.status === "expired" || data.message === "Token expired, renewal possible") && data.id_users) {
      await reloadToken(data.id_users);
      let newToken = await getToken();

      return await getPopupUserInformation(newToken); // retry with new token
    }
    return data[0]; // returns the object { uid, username, mail }
  } catch (err) {
    console.error("Erreur lors de la récupération des données utilisateur:", err);
    return null;
  }
}

// Profile design
const profilePicture = document.getElementById("profile-picture");
profilePicture.addEventListener("click", async () => {
  if (document.querySelector('.profile-container')) return;

  let token = await getToken();

  const base = document.getElementById("base");
  const containerProfile = document.createElement("div");
  containerProfile.className = "profile-container";

  if (token) {
    const userData = await getPopupUserInformation(token);

    if (!userData) {
      alert("Impossible de récupérer les infos utilisateur");
      return;
    }

    containerProfile.innerHTML = `
        <div class="user-infos">
          <div class="user-infos-item">
            <span class="dash"></span>
            <span>Username : ${userData.username}</span>
          </div>
          <div class="user-infos-item">
            <span class="dash"></span>
            <span>UID : ${userData.uid}</span>
          </div>
          <button class="button-profile">voir le profil</button>
          <button class="button-profile" id="deconnexion">Déconnexion</button>
        </div>
      `;
  } else {
    containerProfile.innerHTML = `
        <div class="user-infos">
          <button class="button-profile" id="connexion">Se connecter</button>
        </div>
      `;
  }

  base.appendChild(containerProfile);
});



// Token reconnection
async function reloadToken(id_users) {
  try {
    const response = await fetch(URL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_users
      })
    });

    if (!response.ok) throw new Error("Connection échouée");
    const tokenJwt = await response.json(); // error

    await chrome.storage.local.set({ "token": tokenJwt.token });

  } catch (err) {
    console.log("Erreur : " + err.message);
  }
};


function getToken() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("token", (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.token);
      }
    });
  });
}

