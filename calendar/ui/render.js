import { getWeekDates, getActiveHours } from "./scheduleUtils.js";
import { renderHourLabels } from "./renderHours.js";
import { showAnimePopup } from "./popup.js";
import { getScoreColor } from "../utils/score.js";

export function renderSchedule(animeList, currentDate, currentFilter, hideEmptyHours = true) {
  const scheduleEl = document.getElementById("schedule"); // Main schedule container
  const weekLabel = document.getElementById("week-label"); // Week label element
  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  const weekDates = getWeekDates(currentDate);
  scheduleEl.innerHTML = "";

  let displayHours;
  if (hideEmptyHours) {
    displayHours = getActiveHours(animeList, weekDates);
  } else {
    // Afficher toutes les heures de 0 à 23
    displayHours = Array.from({ length: 24 }, (_, i) => i);
  }

  if (currentFilter === "heure") {
    const gridTemplateRows = displayHours.map(() => "120px").join(" ");
    scheduleEl.style.display = "grid";
    scheduleEl.style.gridTemplateColumns = "repeat(7, 1fr)";
    scheduleEl.style.gridTemplateRows = `50px ${gridTemplateRows}`;
    scheduleEl.classList.add("light-grid");

    renderHourLabels(displayHours);
  } else {
    scheduleEl.style.display = "grid";
    scheduleEl.style.gridTemplateColumns = "repeat(7, 1fr)";
    scheduleEl.style.gridTemplateRows = `50px repeat(100, 120px)`;
    scheduleEl.classList.remove("light-grid");
    
    const hoursContainer = document.querySelector(".hours");
    if (hoursContainer) hoursContainer.innerHTML = "";  
  }


  const formatter = new Intl.DateTimeFormat("fr-FR", { month: "short", day: "numeric" }); // Formatter for week label
  weekLabel.textContent = `Semaine du ${formatter.format(weekDates[0])} au ${formatter.format(weekDates[6])}`;

  const todayStr = new Date().toLocaleDateString("fr-CA"); // Today's date string for highlighting

  // Header part
  weekDates.forEach((date, dayIndex) => {
    const header = document.createElement("div");
    header.className = "day-header";
    header.style.gridColumn = `${dayIndex + 1}`;
    header.style.gridRow = `1`;
    header.textContent = `${dayNames[dayIndex]} ${date.getDate()}/${date.getMonth() + 1}`;

    const headerSelect = document.createElement("div");
    
    if (date.toLocaleDateString("fr-CA") === todayStr) {
      headerSelect.className = "today-indicator";
      header.classList.add("today-column");
      header.appendChild(headerSelect);
    } else {
      headerSelect.className = "not-today-indicator";
      header.appendChild(headerSelect);
    }


    scheduleEl.appendChild(header);
  });

  // Events part
  weekDates.forEach((date, dayIndex) => {
    const dateStr = date.toLocaleDateString("fr-CA");
    const todaysEvents = animeList.filter((e) => e.date === dateStr);

    // Sort and place animes based on current filter + creation of "card" divs
    if (currentFilter === "heure") {
      todaysEvents
        .filter((e) => e.heure)
        .sort((a, b) => parseInt(a.heure) - parseInt(b.heure))
        .forEach((ev) => {
          const hour = parseInt(ev.heure.split(":")[0], 10);
          const rowIndex = displayHours.indexOf(hour);
          if (rowIndex === -1) return;

          const evDiv = buildEventDiv(ev, "hour-view");
          evDiv.style.gridColumn = `${dayIndex + 1}`;
          evDiv.style.gridRow = `${rowIndex + 2}`;
          scheduleEl.appendChild(evDiv);
        });
    } else if (currentFilter === "popularité") {
      todaysEvents
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .forEach((ev, index) => {
          const evDiv = buildEventDiv(ev);
          evDiv.style.gridColumn = `${dayIndex + 1}`;
          evDiv.style.gridRow = `${index + 2}`;
          scheduleEl.appendChild(evDiv);
        });
    } else if (currentFilter === "notes") {
      todaysEvents
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .forEach((ev, index) => {
          const evDiv = buildEventDiv(ev);
          evDiv.style.gridColumn = `${dayIndex + 1}`;
          evDiv.style.gridRow = `${index + 2}`;
          scheduleEl.appendChild(evDiv);
        });
    }
  });
}

// Helper function to build event divs
function buildEventDiv(ev, viewType = "default") {
  const evDiv = document.createElement("div");
  evDiv.className = "event";
  if (viewType === "hour-view") {
    evDiv.classList.add("event-hour-view");
  }
  evDiv.style.cursor = "pointer";
  
  // Ajouter le clic pour ouvrir la popup
  evDiv.addEventListener("click", () => {
    showAnimePopup(ev.title, ev.episode, ev.heure);
  });

  const imgDiv = document.createElement("div");
  imgDiv.className = "event-img";
  if (ev.poster) {
    imgDiv.innerHTML = `<img src="${ev.poster}" style="width: 100%; height: 100%; object-fit: cover;" />`;
  }
  evDiv.appendChild(imgDiv);

  const txtDiv = document.createElement("div");
  txtDiv.className = "event-txt";
  
  // Anime title (top)
  const titleDiv = document.createElement("div");
  titleDiv.className = "event-title";
  titleDiv.textContent = ev.title;
  txtDiv.appendChild(titleDiv);
  
  // Middle section (time + score circle)
  const middleDiv = document.createElement("div");
  middleDiv.className = "event-middle";
  
  // Get color and degrees based on score (0-100)
  const score = ev.score ?? 0;
  const { color, degrees } = getScoreColor(score);
  
  // Create score donut
  const scoreDiv = document.createElement("div");
  scoreDiv.className = "event-score";
  
  // Progress bar (dynamic gradient based on score)
  const scoreBar = document.createElement("div");
  scoreBar.className = "score-bar";
  scoreBar.style.background = `conic-gradient(${color} 0deg, ${color} ${degrees}deg, #555 ${degrees}deg, #555 360deg)`;
  scoreDiv.appendChild(scoreBar);
  
  // Center hole
  const donutCenter = document.createElement("div");
  donutCenter.className = "score-center";
  scoreDiv.appendChild(donutCenter);
  
  // Score value
  const scoreText = document.createElement("span");
  scoreText.className = "score-text";
  scoreText.textContent = score;
  scoreDiv.appendChild(scoreText);
  
  middleDiv.appendChild(scoreDiv);

  // Time (left of circle)
  const timeDiv = document.createElement("div");
  timeDiv.className = "event-time";
  timeDiv.textContent = ev.heure ?? "?";
  middleDiv.appendChild(timeDiv);
  txtDiv.appendChild(middleDiv);
  
  evDiv.appendChild(txtDiv);

  return evDiv;
}