import { getAnimeScheduleWithCache } from "./storage/cache.js";
import { renderSchedule } from "./ui/render.js";
import { Dropdown } from "./ui/dropdown.js";

document.addEventListener("DOMContentLoaded", async () => {
  let animeList = [];
  let currentFilter = "popularité";
  let currentDate = new Date();

  try {
    animeList = await getAnimeScheduleWithCache();
    renderSchedule(animeList, currentDate, currentFilter);
    hideLoadingScreen();
  } catch (err) {
    console.error("Erreur AniList :", err);
  }

  const sortDropdown = new Dropdown({
    options: ["Popularité", "Heure"],
    defaultIndex: 0,
    onChange: (value) => {
      currentFilter = value.toLowerCase().includes("heure")
        ? "heure"
        : "popularité";
      renderSchedule(animeList, currentDate, currentFilter);
    },
  });

  sortDropdown.mount(document.getElementById("sort-dropdown"));

  const filterDropdown = new Dropdown({
    options: ["Tous les animes", "Notes > 70", "Notes > 80"],
    defaultIndex: 0,
    onChange: (value) => {
      console.log("Filtre choisi :", value);
    },
  });

  filterDropdown.mount(document.getElementById("filter-dropdown"));

  const today = new Date();
  const startOfWeek = new Date(today);
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  startOfWeek.setDate(today.getDate() + diff);
  startOfWeek.setHours(0, 0, 0, 0);

  document.getElementById("prev-week").addEventListener("click", () => {
    if (currentDate <= startOfWeek) return;

    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() - 7);
    renderSchedule(animeList, currentDate, currentFilter);

    document.getElementById("prev-week").classList.add("inactive");
    document.getElementById("next-week").classList.remove("inactive");
  });

  document.getElementById("next-week").addEventListener("click", () => {
    const maxDate = new Date(startOfWeek);
    maxDate.setDate(maxDate.getDate() + 7);

    if (currentDate >= maxDate) return;

    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 7);
    renderSchedule(animeList, currentDate, currentFilter);
    document.getElementById("next-week").classList.add("inactive");
    document.getElementById("prev-week").classList.remove("inactive");
  });
});

function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loading-screen");
  if (loadingScreen) loadingScreen.classList.add("hide");
}
