import { AnimeProperties } from "../interfaces/calendar-interface.js";

document.addEventListener("DOMContentLoaded", () => {
  let animeList;
  fetchAllAnimes()
    .then((mediaList) => {
      console.log("Tous les animes récupérés :", mediaList);

      const now = Date.now() / 1000;
      const nextWeek = now + 7 * 24 * 60 * 60;

      const animesFormatted = mediaList
        .map((anime) => {
          const airing = anime.nextAiringEpisode?.airingAt;
          if (airing && airing >= now && airing <= nextWeek) {
            const dateObj = new Date(airing * 1000);

            const date = dateObj.toISOString().split("T")[0];
            const heure = dateObj.toTimeString().slice(0, 5);
            const score = anime.averageScore ?? null;
            const poster = anime.coverImage?.large ?? null;

            return {
              title: anime.title.romaji,
              date,
              heure,
              ...(score !== null ? { score } : {}),
              ...(poster ? { poster } : {}),
            };
          }
          return null;
        })
        .filter(Boolean);

      chrome.storage.local.get("animeProperties", (data) => {
        if (data.animeProperties) {
          if (data.animeProperties.lastUpdate >= Date.now() - 60 * 60 * 1000) {
          }
        } else {
          const animeProperties = new AnimeProperties();
          animeProperties.animelist = animesFormatted;
          animeProperties.lastUpdate = Date.now();
          chrome.storage.local.set({ animeProperties });
        }
      });

      animeList = animesFormatted;
      renderSchedule();
      hideLoadingScreen();
    })
    .catch((err) => console.error("Erreur AniList :", err));

  let currentFilter = "popularité";

  const scheduleEl = document.getElementById("schedule");
  const weekLabel = document.getElementById("week-label");

  document
    .getElementById("prev-week")
    .addEventListener("click", () => changeWeek(-1));
  document
    .getElementById("next-week")
    .addEventListener("click", () => changeWeek(1));
  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  let currentDate = new Date();

  /**
   * Renders the anime schedule based on the current date and filter.
   * @returns
   */
  function renderSchedule() {
    if (!Array.isArray(animeList) || animeList.length === 0) {
      return;
    }
    console.log("Rendu du calendrier avec les données :", animeList);
    const weekDates = getWeekDates(currentDate);
    scheduleEl.innerHTML = "";

    const activeHours = getActiveHours(animeList, weekDates);

    if (currentFilter === "heure") {
      const gridTemplateRows = activeHours.map(() => "80px").join(" ");
      scheduleEl.style.display = "grid";
      scheduleEl.style.gridTemplateColumns = "repeat(7, 1fr)";
      scheduleEl.style.gridTemplateRows = `50px ${gridTemplateRows}`;
    } else {
      scheduleEl.style.display = "grid";
      scheduleEl.style.gridTemplateColumns = "repeat(7, 1fr)";
      scheduleEl.style.gridTemplateRows = `50px repeat(10, 120px)`; // 10 lignes par jour max
    }

    // Affichage de la plage de dates
    const formatter = new Intl.DateTimeFormat("fr-FR", {
      month: "short",
      day: "numeric",
    });
    const first = formatter.format(weekDates[0]);
    const last = formatter.format(weekDates[6]);
    weekLabel.textContent = `Semaine du ${first} au ${last}`;

    // Affichage des entêtes (jours)
    const todayStr = new Date().toLocaleDateString("fr-CA");

    weekDates.forEach((date, dayIndex) => {
      const header = document.createElement("div");
      header.className = "day-header";

      // Appliquer une classe spéciale si c'est aujourd'hui
      if (date.toLocaleDateString("fr-CA") === todayStr) {
        header.classList.add("today-column");

        const items = Array.from(scheduleEl.children);
        const columns = 7;
        const targetColumn = 3; // 0-based index (colonne 3)

        const columnItems = items.filter(
          (item, index) => index % columns === targetColumn
        );

        columnItems.forEach((item) => {
          item.style.backgroundColor = "lightblue";
        });
      }

      header.style.gridColumn = `${dayIndex + 1}`;
      header.style.gridRow = `1`;
      header.textContent = `${dayNames[dayIndex]} ${date.getDate()}/${
        date.getMonth() + 1
      }`;
      scheduleEl.appendChild(header);
    });

    // Affichage des événements
    weekDates.forEach((date, dayIndex) => {
      const dateStr = date.toLocaleDateString("fr-CA");

      const todaysEvents = animeList.filter((e) => e.date === dateStr);

      if (currentFilter === "heure") {
        todaysEvents
          .filter((e) => e.heure)
          .sort((a, b) => {
            const hA = parseInt(a.heure.split(":")[0], 10);
            const hB = parseInt(b.heure.split(":")[0], 10);
            return hA - hB;
          })
          .forEach((ev) => {
            const hour = parseInt(ev.heure.split(":")[0], 10);
            const rowIndex = activeHours.indexOf(hour);
            if (rowIndex === -1) return;

            const evDiv = document.createElement("div");
            evDiv.className = "event";

            // IMG container
            const imgDiv = document.createElement("div");
            imgDiv.className = "event-img";
            if (ev.poster) {
              imgDiv.innerHTML = `<img src="${ev.poster}" style="width: 100%; height: 100%; object-fit: cover;" />`;
            }
            evDiv.appendChild(imgDiv);

            // TEXT container
            const txtDiv = document.createElement("div");
            txtDiv.className = "event-txt";
            txtDiv.textContent = `${ev.heure} - ${ev.title} (${
              ev.score ?? "?"
            })`;
            evDiv.appendChild(txtDiv);

            evDiv.style.gridColumn = `${dayIndex + 1}`;
            evDiv.style.gridRow = `${rowIndex + 2}`;
            scheduleEl.appendChild(evDiv);
          });
      } else if (currentFilter === "popularité") {
        todaysEvents
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .forEach((ev, index) => {
            const evDiv = document.createElement("div");
            evDiv.className = "event";

            // IMG container
            const imgDiv = document.createElement("div");
            imgDiv.className = "event-img";
            if (ev.poster) {
              imgDiv.innerHTML = `<img src="${ev.poster}" style="width: 100%; height: 100%; object-fit: cover;" />`;
            }
            evDiv.appendChild(imgDiv);

            // TEXT container
            const txtDiv = document.createElement("div");
            txtDiv.className = "event-txt";
            txtDiv.textContent = `${ev.heure ?? "?"} - ${ev.title} (${
              ev.score ?? "?"
            })`;
            evDiv.appendChild(txtDiv);

            evDiv.style.gridColumn = `${dayIndex + 1}`;
            evDiv.style.gridRow = `${index + 2}`; // +2 car 1 = header
            scheduleEl.appendChild(evDiv);
          });
      }
    });

    // Affichage des heures seulement si on est en mode "heure"
    if (currentFilter === "heure") {
      renderHourLabels(activeHours);
      const hoursContainer = document.querySelector(".hours");
      if (hoursContainer) {
        hoursContainer.style.display = "flex";
      }
    } else {
      const hoursContainer = document.querySelector(".hours");
      if (hoursContainer) {
        hoursContainer.innerHTML = "";
        hoursContainer.style.display = "none";
      }
    }
  }

  // Change week function
  function changeWeek(offset) {
    currentDate.setDate(currentDate.getDate() + offset * 7);
    renderSchedule();
  }

  renderSchedule();

  const selected = document.querySelector(".selected");
  const optionsContainer = document.querySelector(".options");
  const options = document.querySelectorAll(".options li");

  // Close custom dropdown when clicking outside
  document.addEventListener("click", (event) => {
    const isClickInside =
      selected.contains(event.target) ||
      optionsContainer.contains(event.target);
    if (!isClickInside) {
      optionsContainer.classList.remove("show");
    }
  });

  selected.addEventListener("click", () => {
    optionsContainer.classList.toggle("show");
  });

  options.forEach((option, index) => {
    option.addEventListener("click", () => {
      selected.textContent = option.textContent;
      optionsContainer.classList.remove("show");
      handleComboBoxChange(index);
    });
  });
  selected.textContent = options[0].textContent;

  function handleComboBoxChange(index) {
    const selectedText = options[index].textContent.toLowerCase();

    if (selectedText.includes("heure")) {
      currentFilter = "heure";
    } else if (selectedText.includes("popularité")) {
      currentFilter = "popularité";
    }

    renderSchedule(); // relancer le rendu avec le bon filtre
  }

  function getActiveHours(events, weekDates) {
    const activeHoursSet = new Set();

    weekDates.forEach((date) => {
      const dateStr = date.toLocaleDateString("fr-CA");
      events
        .filter((e) => e.date === dateStr && e.heure)
        .forEach((e) => {
          const hour = parseInt(e.heure.split(":")[0], 10);
          activeHoursSet.add(hour);
        });
    });

    return Array.from(activeHoursSet).sort((a, b) => a - b);
  }

  function renderHourLabels(hours) {
    const hoursContainer = document.querySelector(".hours");
    hoursContainer.innerHTML = "";
    hours.forEach((h) => {
      const div = document.createElement("div");
      div.className = "hour";
      div.textContent = `${h.toString().padStart(2, "0")}:00`;
      hoursContainer.appendChild(div);
    });
  }

  function getWeekDates(date) {
    const monday = new Date(date);
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);

    return [...Array(7)].map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }

  async function fetchAllAnimes() {
    let currentPage = 1;
    let hasNextPage = true;
    const allMedia = [];

    while (currentPage != 10) {
      const query = `
      query{
        Page(page: ${currentPage}, perPage: 50) {
          pageInfo {
            currentPage
            hasNextPage
          }
          media(status_in: [RELEASING, NOT_YET_RELEASED], type: ANIME, sort: POPULARITY_DESC) {
            title { romaji }
            nextAiringEpisode { airingAt episode }
            averageScore
            coverImage { large }
          }
        }
      }
    `;

      const variables = { page: currentPage };

      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });

      const result = await response.json();
      const pageData = result.data.Page;

      allMedia.push(...pageData.media);
      hasNextPage = pageData.pageInfo.hasNextPage;
      currentPage++;
    }

    return allMedia;
  }
  function hideLoadingScreen() {
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) {
      document.getElementById("loading-screen").classList.add("hide");
    }
  }
});
