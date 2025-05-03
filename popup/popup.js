document.addEventListener("DOMContentLoaded", () => {
  const listAnime = document.getElementById("content_list");

  chrome.storage.local.get("popupDataList", (result) => {
    const animeList = result.popupDataList || [];

    animeList.forEach((anime, index) => {
      const container = document.createElement("div");
      container.className = "content-list";
      container.setAttribute("data-link", anime.link);

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
              <h3>Ep ${anime.episode} - ${anime.title}</h3>
            </div>
            <div class="load">
              <progress value="0" max="100" id="bar-${index}">0%</progress>
              <p id="timecode-${index}">00:00</p>
            </div>
          </div>
        `;

      listAnime.appendChild(container);

      

      // Bouton de redirection
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

      // Progression et timecode
      updateTime(anime.currentTime, anime.duration, index);

      // Notifications toggle
      const notifContainer = container.querySelector(".notif");
      const checkbox = container.querySelector(`#notif-${index}`);

      checkbox.checked = anime.notif;

      checkbox.addEventListener("change", () => {
        const isChecked = checkbox.checked;

        // Mettre à jour dans la popupDataList
        chrome.storage.local.get("popupDataList", (result) => {
          let dataList = result.popupDataList || [];
          dataList[index].notif = isChecked;
          chrome.storage.local.set({ popupDataList: dataList });
        });
      });
    });
  });

  const buttons = ["home", "calendar", "suggestion", "option"];

  buttons.forEach((btn) => {
    const buttonElement = document.getElementById(btn);
    const container = buttonElement.parentElement; // le parent direct du bouton

    buttonElement.addEventListener("click", () => {
      buttons.forEach((otherBtn) => {
        // Changement d'image
        const suffix = otherBtn === btn ? "-activate" : "";
        document.getElementById(
          otherBtn
        ).style.backgroundImage = `url("../images-extension/${otherBtn}${suffix}.png")`;

        // Gestion des .selected
        const selectedEl = document
          .getElementById(otherBtn)
          .parentElement.querySelector(".selected");
        if (selectedEl) {
          selectedEl.classList.remove("active");
        }
      });

      // Activer le bon .selected
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
