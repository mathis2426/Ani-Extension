import { getWeekDates, getActiveHours } from "./scheduleUtils.js";
import { renderHourLabels } from "./renderHours.js";

export function renderSchedule(animeList, currentDate, currentFilter) {
  const scheduleEl = document.getElementById("schedule");
  const weekLabel = document.getElementById("week-label");
  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  if (!Array.isArray(animeList) || animeList.length === 0) return;

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


  const formatter = new Intl.DateTimeFormat("fr-FR", { month: "short", day: "numeric" });
  weekLabel.textContent = `Semaine du ${formatter.format(weekDates[0])} au ${formatter.format(weekDates[6])}`;

  const todayStr = new Date().toLocaleDateString("fr-CA");

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

  weekDates.forEach((date, dayIndex) => {
    const dateStr = date.toLocaleDateString("fr-CA");
    const todaysEvents = animeList.filter((e) => e.date === dateStr);

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
  txtDiv.textContent = `${ev.heure ?? "?"} - ${ev.title} (${ev.score ?? "?"})`;
  evDiv.appendChild(txtDiv);

  return evDiv;
}
