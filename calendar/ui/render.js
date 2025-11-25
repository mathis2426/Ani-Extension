import { getWeekDates, getActiveHours } from "./scheduleUtils.js";
import { renderHourLabels } from "./renderHours.js";

export function renderSchedule(animeList, currentDate, currentFilter) {
  const scheduleEl = document.getElementById("schedule"); // Main schedule container
  const weekLabel = document.getElementById("week-label"); // Week label element
  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  if (!Array.isArray(animeList) || animeList.length === 0) return; // No events to display

  const weekDates = getWeekDates(currentDate);
  scheduleEl.innerHTML = "";

  const activeHours = getActiveHours(animeList, weekDates);

  if (currentFilter === "heure") {
    const gridTemplateRows = activeHours.map(() => "80px").join(" ");
    scheduleEl.style.display = "grid";
    scheduleEl.style.gridTemplateColumns = "repeat(7, 1fr)";
    scheduleEl.style.gridTemplateRows = `50px ${gridTemplateRows}`;

    renderHourLabels(activeHours);
  } else {
    scheduleEl.style.display = "grid";
    scheduleEl.style.gridTemplateColumns = "repeat(7, 1fr)";
    scheduleEl.style.gridTemplateRows = `50px repeat(10, 120px)`;
    
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


    if (date.toLocaleDateString("fr-CA") === todayStr) {
      header.classList.add("today-column");
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
          const rowIndex = activeHours.indexOf(hour);
          if (rowIndex === -1) return;

          const evDiv = buildEventDiv(ev);
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
    }
  });
}

// Helper function to build event divs
function buildEventDiv(ev) {
  const evDiv = document.createElement("div");
  evDiv.className = "event";

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

  console.log("color and degrees:", color, degrees);
  
  // Create circle with donut
  const scoreDiv = document.createElement("div");
  scoreDiv.className = "event-score";
  scoreDiv.style.position = "relative";
  scoreDiv.style.boxShadow = `inset 0 0 0 3px #555`;
  
  // Colored progress bar (fills circle proportionally to score)
  const scoreBar = document.createElement("div");
  scoreBar.style.position = "absolute";
  scoreBar.style.width = "100%";
  scoreBar.style.height = "100%";
  scoreBar.style.borderRadius = "50%";
  scoreBar.style.background = `conic-gradient(${color} 0deg, ${color} ${degrees}deg, #555 ${degrees}deg, #555 360deg)`;
  scoreBar.style.zIndex = "0";
  scoreDiv.appendChild(scoreBar);
  
  // Donut center (creates the hole in the middle)
  const donutCenter = document.createElement("div");
  donutCenter.style.position = "absolute";
  donutCenter.style.top = "50%";
  donutCenter.style.left = "50%";
  donutCenter.style.transform = "translate(-50%, -50%)";
  donutCenter.style.width = "80%";
  donutCenter.style.height = "80%";
  donutCenter.style.borderRadius = "50%";
  donutCenter.style.background = "#383838";
  donutCenter.style.zIndex = "1";
  scoreDiv.appendChild(donutCenter);
  
  // Score text (above everything)
  const scoreText = document.createElement("span");
  scoreText.textContent = score;
  scoreText.style.position = "relative";
  scoreText.style.zIndex = "2";
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



function getScoreColor(score) { // switch to utils after architecture update
  let color;
  const degrees = Math.max(0, Math.min(100, score)) * 3.6; // 0-100 => 0-360 degrees

  if (score < 50) {
    color = "#d34848ff"; // Rouge
  } else if (score < 60) {
    color = "#fd6d1fff"; // Orange
  } else if (score < 70) {
    color = "#edb200ff"; // Jaune
  } else if (score <= 85) {
    color = "#4CAF50"; // Vert
  } else if (score <= 99) {
    color = "#038808ff"; // Vert fonce
  } else {
    color = "#2196F3"; // Bleu
  }
  
  return { color, degrees };
}