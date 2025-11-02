/**
 * File Name      : popup.js
 * Description    : This file manages the display and interaction logic for the popup page of the extension.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Date           : Last update 2025-09-29
 * Version        : 1.0.0
 */
import { URL_API } from "../../vars.js";
import { OpenSubtitlesService } from "../../services/OpenSubtitlesService.js";
import { OpenSubtitlesAPIKey } from "../../../temp-key-do-not-push.js";
import { StorageService } from "../../services/StorageService.js";

let token = null;
let openSubtitlesService = null;

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
              <button class="subtitle-search-btn" data-index="${index}" title="Rechercher sous-titres" style="display: none;">
                <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 0 576 512" fill="currentColor">
                  <path d="M0 96C0 60.7 28.7 32 64 32H512c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zM200 208c0 13.3-10.7 24-24 24s-24-10.7-24-24s10.7-24 24-24s24 10.7 24 24zm-24 56c13.3 0 24 10.7 24 24s-10.7 24-24 24s-24-10.7-24-24s10.7-24 24-24zm120-56c0 13.3-10.7 24-24 24s-24-10.7-24-24s10.7-24 24-24s24 10.7 24 24zm-24 56c13.3 0 24 10.7 24 24s-10.7 24-24 24s-24-10.7-24-24s10.7-24 24-24zm120-56c0 13.3-10.7 24-24 24s-24-10.7-24-24s10.7-24 24-24s24 10.7 24 24zM552 352H424c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8H552c4.4 0 8-3.6 8-8V360c0-4.4-3.6-8-8-8zm-400 8c0-4.4-3.6-8-8-8H24c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8H144c4.4 0 8-3.6 8-8V360zm216 0c0-4.4-3.6-8-8-8H216c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8H360c4.4 0 8-3.6 8-8V360z"/>
                </svg>
              </button>
              <div class="in-progress" id="in-progress-${index}">Lecture en cours</div>
            </div>
          </div>
        `;

      listAnime.appendChild(container);

      // Subtitle search button
      const subtitleBtn = container.querySelector(".subtitle-search-btn");
      subtitleBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        await handleSubtitleSearch(anime, index);
      });

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
  const buttons = ["home", "calendar", "suggestion", "option"];

  buttons.forEach((btn) => {
    const buttonElement = document.getElementById(btn);
    const container = buttonElement.parentElement; // the parent div of the button

    buttonElement.addEventListener("click", (btn) => {
      buttons.forEach((otherBtn) => {
        // image change 
        const suffix = otherBtn === btn ? "-activate" : "";
        document.getElementById(
          otherBtn
        ).style.backgroundImage = `url("../../../public/images-extension/${otherBtn}${suffix}.png")`;

        // .selected class removal
        const selectedEl = document
          .getElementById(otherBtn)
          .parentElement.querySelector(".selected");
        if (selectedEl) {
          selectedEl.classList.remove("active");
        }
      });
      if (btn.target.id === "option") {
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

      // Select the current button
      const selected = container.querySelector(".selected");
      if (selected) {
        selected.classList.add("active");
      }
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
          const subtitleBtn = document.querySelector(`.subtitle-search-btn[data-index="${index}"]`);

          if (anime.lastUpdate == Date.now() || anime.lastUpdate > Date.now() - 1100) {
            inprogress.classList.add("active");
            // Afficher le bouton de sous-titres quand l'anime est en cours de lecture
            if (subtitleBtn) subtitleBtn.style.display = "flex";
          } else {
            inprogress.classList.remove("active");
            // Masquer le bouton quand l'anime n'est plus en cours de lecture
            if (subtitleBtn) subtitleBtn.style.display = "none";
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

/**
 * Handle subtitle search for an anime episode
 * @param {object} anime - Anime data from storage
 * @param {number} index - Index in the list
 */
async function handleSubtitleSearch(anime, index) {
  try {
    // Initialize OpenSubtitles service if needed
    if (!openSubtitlesService) {
      openSubtitlesService = new OpenSubtitlesService(OpenSubtitlesAPIKey);

      // Load token from settings using StorageService (sync storage)
      const settings = await StorageService.getsync("settings");

      if (settings?.openSubtitlesSettings?.token) {
        openSubtitlesService._token = settings.openSubtitlesSettings.token;
        openSubtitlesService._tokenExp = settings.openSubtitlesSettings.tokenExpiration;
      } else {
        alert("Veuillez vous connecter à OpenSubtitles dans les paramètres.");
        return;
      }
    }

    // Show loading state
    const btn = document.querySelector(`[data-index="${index}"]`);
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span style="font-size:10px;">...</span>';
    btn.disabled = true;

    console.log(`Recherche sous-titres pour: ${anime.name} - Episode ${anime.episode}`);

    // Use service method for search
    const foundSubtitle = await openSubtitlesService.searchEpisodeSubtitle(
      anime.name,
      anime.episode,
      ["fr"]
    );

    // If service returns a single object (old behavior)
    if (!foundSubtitle) {
      // restore and fallback manual input
      btn.innerHTML = originalHTML;
      btn.disabled = false;
      showManualSubtitleInput(anime, index);
      return;
    }

    // If we received an array (multiple candidates)
    if (Array.isArray(foundSubtitle)) {
      if (foundSubtitle.length === 0) {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        showManualSubtitleInput(anime, index);
        return;
      }
      // Show modal allowing user to pick among candidates
      showSubtitleCandidatesModal(foundSubtitle, anime, index, btn, originalHTML);
      return;
    }

    // Otherwise object (single candidate) -> download directly
    btn.innerHTML = originalHTML;
    btn.disabled = false;

    console.log("Sous-titre trouvé (unique):", foundSubtitle);
    await downloadAndApplySubtitle(foundSubtitle, anime, index);


  } catch (error) {
    console.error("Erreur lors de la recherche de sous-titres:", error);
    alert(`Erreur: ${error.message}`);

    const btn = document.querySelector(`[data-index="${index}"]`);
    if (btn) {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }
}

/**
 * Download subtitle and send to content script to display on video
 */
async function downloadAndApplySubtitle(subtitle, anime, index, offsetMs = 0) {
  try {
    const fileId = subtitle.attributes?.files?.[0]?.file_id;
    if (!fileId) {
      alert("Impossible de trouver l'ID du fichier de sous-titres.");
      return;
    }

    console.log("Téléchargement du sous-titre, file_id:", fileId);

    // Use service method for download
    const subtitleContent = await openSubtitlesService.downloadSubtitleContent(fileId);

    console.log("Contenu du sous-titre téléchargé, taille:", subtitleContent.length);

    // Send to content script
    chrome.tabs.query({ url: anime.link }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "applySubtitle",
          subtitleContent: subtitleContent,
          subtitleInfo: {
            name: subtitle.attributes?.release || "Subtitle",
            language: subtitle.attributes?.language || "fr"
          },
          offsetMs: offsetMs
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Erreur envoi message:", chrome.runtime.lastError);
            alert("Erreur: impossible de communiquer avec la page vidéo. Rechargez la page.");
          } else if (response && response.success) {
            alert(`Sous-titres appliqués avec succès!\n${subtitle.attributes?.release || 'Subtitle'}`);
          } else {
            alert("Erreur lors de l'application des sous-titres.");
          }
        });
      } else {
        alert("Page vidéo introuvable. Assurez-vous que l'anime est ouvert.");
      }
    });

  } catch (error) {
    console.error("Erreur téléchargement sous-titre:", error);
    alert(`Erreur lors du téléchargement: ${error.message}`);
  }
}

/**
 * Show manual input dialog for OpenSubtitles URL
 */
function showManualSubtitleInput(anime, index) {
  const modal = document.createElement("div");
  modal.className = "subtitle-modal";
  modal.innerHTML = `
    <div class="subtitle-modal-content">
      <h3>Aucun sous-titre trouvé automatiquement</h3>
      <p>Anime: <strong>${anime.name}</strong></p>
      <p>Épisode: <strong>${anime.episode}</strong></p>
      <p>Veuillez fournir l'URL de la page OpenSubtitles:</p>
      <input type="text" id="manual-subtitle-url" placeholder="https://www.opensubtitles.com/..." />
      <div class="modal-buttons">
        <button id="modal-cancel" class="btn-secondary">Annuler</button>
        <button id="modal-submit" class="btn-primary">Télécharger</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("modal-cancel").addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  document.getElementById("modal-submit").addEventListener("click", async () => {
    const url = document.getElementById("manual-subtitle-url").value.trim();

    if (!url) {
      alert("Veuillez entrer une URL.");
      return;
    }

    // Extract file_id from OpenSubtitles URL
    // Example: https://www.opensubtitles.com/en/subtitles/12345678
    const match = url.match(/\/subtitles\/(\d+)/);

    if (!match) {
      alert("URL invalide. Format attendu: https://www.opensubtitles.com/.../subtitles/[ID]");
      return;
    }

    const fileId = match[1];

    try {
      document.getElementById("modal-submit").textContent = "Téléchargement...";
      document.getElementById("modal-submit").disabled = true;

      // Create a fake subtitle object with the file_id
      const fakeSubtitle = {
        attributes: {
          files: [{ file_id: parseInt(fileId) }],
          release: "Manual subtitle",
          language: "fr"
        }
      };

      await downloadAndApplySubtitle(fakeSubtitle, anime, index);
      document.body.removeChild(modal);

    } catch (error) {
      console.error("Erreur:", error);
      alert(`Erreur: ${error.message}`);
      document.getElementById("modal-submit").textContent = "Télécharger";
      document.getElementById("modal-submit").disabled = false;
    }
  });
}

/**
 * Affiche une modal listant plusieurs candidats de sous-titres et permet de choisir lequel télécharger.
 * @param {Array} candidates - tableau d'objets subtitle (OpenSubtitles item)
 * @param {object} anime - anime info
 * @param {number} index - index du bouton / item dans la popup
 * @param {HTMLElement} btn - le bouton de recherche (pour restaurer état)
 * @param {string} originalHTML - html original du bouton
 */
function showSubtitleCandidatesModal(candidates, anime, index, btn, originalHTML) {
  // création modal
  const modal = document.createElement("div");
  modal.className = "subtitle-modal";
  modal.style.zIndex = 9999;
  modal.innerHTML = `
    <div class="subtitle-modal-content">
      <h3>Choisir un sous-titre pour : <strong>${anime.name} — Ep ${anime.episode}</strong></h3>
      
      <div style="margin: 12px 0; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 6px;">
        <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
          <span style="min-width: 120px;">Offset de synchro:</span>
          <input type="range" id="offset-slider" min="-10000" max="10000" value="0" step="100" 
                 style="flex: 1; cursor: pointer;" />
          <span id="offset-value" style="min-width: 70px; font-weight: 600;">0 ms</span>
        </label>
        <div style="font-size: 11px; color: #666; margin-top: 4px;">
          Ajustez si les sous-titres sont décalés (positif = en avance, négatif = en retard)
        </div>
      </div>

      <div class="candidates-list" id="candidates-list"></div>
      <div style="margin-top:12px;text-align:right;">
        <button id="modal-close" class="btn-secondary">Fermer</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Gestion du slider
  const slider = modal.querySelector("#offset-slider");
  const offsetValueDisplay = modal.querySelector("#offset-value");
  let currentOffset = 0;

  slider.addEventListener("input", (e) => {
    currentOffset = parseInt(e.target.value);
    offsetValueDisplay.textContent = `${currentOffset} ms`;
  });

  const listEl = modal.querySelector("#candidates-list");

  // si pas de candidats, afficher message
  if (!candidates || candidates.length === 0) {
    listEl.innerHTML = `<p>Aucun candidat trouvé.</p>`;
  } else {
    // construire la liste
    candidates.forEach((c, i) => {
      const attrs = c.attributes || {};
      const feat = attrs.feature_details || {};
      const title = feat.title || attrs.release || attrs.files?.[0]?.file_name || "(no title)";
      const season = feat.season_number ?? (attrs.season_number ?? " ?");
      const episode = feat.episode_number ?? (attrs.episode_number ?? " ?");
      const lang = attrs.language || "(langue inconnue)";
      const sizeInfo = attrs.files && attrs.files[0] && attrs.files[0].file_size ? ` — ${attrs.files[0].file_size} bytes` : "";

      const row = document.createElement("div");
      row.className = "candidate-row";
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.padding = "6px 0";
      row.style.borderBottom = "1px solid rgba(0,0,0,0.08)";

      const left = document.createElement("div");
      left.style.maxWidth = "72%";
      left.innerHTML = `<strong>${title}</strong><br/><small>S${season} • E${episode} • ${lang}${sizeInfo}</small>`;

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "8px";

      const applyBtn = document.createElement("button");
      applyBtn.className = "btn-primary";
      applyBtn.textContent = "Appliquer";
      applyBtn.style.fontSize = "12px";
      applyBtn.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        applyBtn.disabled = true;
        applyBtn.textContent = "Téléchargement...";
        try {
          await downloadAndApplySubtitle(c, anime, index, currentOffset);
          // fermer la modal après application réussie
          document.body.removeChild(modal);
        } catch (e) {
          console.error("Erreur apply candidate:", e);
          alert("Erreur lors du téléchargement/appli : " + (e.message || e));
          applyBtn.disabled = false;
          applyBtn.textContent = "Appliquer";
        } finally {
          // restore button in popup
          if (btn) {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
          }
        }
      });

      const inspectBtn = document.createElement("button");
      inspectBtn.className = "btn-secondary";
      inspectBtn.textContent = "Voir";
      inspectBtn.style.fontSize = "12px";
      inspectBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        // open the OpenSubtitles page if id present
        const osId = c.id || c.attributes?.files?.[0]?.file_id;
        if (osId) {
          const url = `https://www.opensubtitles.com/en/subtitles/${osId}`;
          window.open(url, "_blank");
        } else {
          alert("Aucun identifiant pour ouvrir la page OpenSubtitles.");
        }
      });

      actions.appendChild(applyBtn);
      actions.appendChild(inspectBtn);

      row.appendChild(left);
      row.appendChild(actions);
      listEl.appendChild(row);
    });
  }

  modal.querySelector("#modal-close").addEventListener("click", () => {
    if (modal.parentElement) modal.parentElement.removeChild(modal);
    // restore btn
    if (btn) {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  });
}

