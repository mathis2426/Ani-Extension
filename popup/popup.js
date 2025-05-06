document.addEventListener("DOMContentLoaded", () => {
  const listAnime = document.getElementById("content_list");
  chrome.storage.local.get("popupDataList", (result) => {
    const animeList = result.popupDataList || [];

    animeList.forEach((anime, index) => {
      const container = document.createElement("div");
      container.className = "content-list";

      container.innerHTML = `
          <div class="top-bar">
            <h1>${anime.name}</h1>
            <div class="notif" data-index="${index}">
              <label class="container">
                <input type="checkbox" id="notif-${index}">
                <svg class="bell-solid" xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 448 512">
                  <path d="M224 0c-17.7 0-32 14.3-32 32V49.9C119.5 61.4 64 124.2 64 200v33.4c0 45.4-15.5 89.5-43.8 124.9L5.3 377c-5.8 7.2-6.9 17.1-2.9 25.4S14.8 416 24 416H424c9.2 0 17.6-5.3 21.6-13.6s2.9-18.2-2.9-25.4l-14.9-18.6C399.5 322.9 384 278.8 384 233.4V200c0-75.8-55.5-138.6-128-150.1V32c0-17.7-14.3-32-32-32zm0 96h8c57.4 0 104 46.6 104 104v33.4c0 47.9 13.9 94.6 39.7 134.6H72.3C98.1 328 112 281.3 112 233.4V200c0-57.4 46.6-104 104-104h8zm64 352H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7s18.7-28.3 18.7-45.3z"></path>
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
              <button class="goto-btn" data-link="${anime.link}"></button>
              <progress value="0" max="100" id="bar-${index}">0%</progress>
              <p id="timecode-${index}">00:00</p>
            </div>
          </div>
        `;

      listAnime.appendChild(container);

      // Bouton de redirection
      container.querySelector(".goto-btn").addEventListener("click", (e) => {
        const url = e.target.getAttribute("data-link");
        if (url) chrome.tabs.create({ url });
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


  // Thème
  const theme = document.getElementById('combox-back');
  theme.addEventListener("change", () => {
    const gradients = {
      "1": "#FFED68, #38D4F8",
      "2": "#FF93F8, #52BDFF",
      "3": "#FF4A4A, #0CFE71",
      "4": "#36E43C, #E2FF3E",
      "5": "#294DFF, #FE951E"
    };
    const selected = gradients[theme.value] || gradients["1"];
    document.body.style.background = `linear-gradient(to bottom right, ${selected})`;
  });
});

// Utils
function secondsToms(d) {
  d = Number(d);
  let m = Math.floor(d % 3600 / 60);
  let s = Math.floor(d % 3600 % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
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
      const newList = changes.popupDataList.newValue || [];
      newList.forEach((anime, index) => {
        // Verified if the element exist and update
        const progressBar = document.getElementById(`bar-${index}`);
        const timecode = document.getElementById(`timecode-${index}`);
        
        if (progressBar && timecode) {
          updateTime(anime.currentTime, anime.duration, index);
        }
      });
    }
  });
});
