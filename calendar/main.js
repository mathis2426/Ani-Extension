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

  window.addEventListener("scroll", () => {
    const nav = document.querySelector(".navigation");
    const prevweekBtn = document.getElementById("prev-week");
    const nextweekBtn = document.getElementById("next-week");
    const dropdowns = document.querySelectorAll(".dropdown");
    const weekLabel = document.getElementById("week-label");

    if (window.scrollY > 50) {
      nav.classList.add("scrolled");

      prevweekBtn.innerHTML =
        '<img src="images/fleche-gauche.png" alt="gauche" style="width:16px; vertical-align:middle;">';
      nextweekBtn.innerHTML =
        '<img src="images/fleche-droite.png" alt="droite" style="width:16px; vertical-align:middle;">';

      dropdowns.forEach(el => el.classList.add("hidden"));
      weekLabel.classList.add("hidden");
    } else {
      nav.classList.remove("scrolled");
      prevweekBtn.textContent = "Semaine précédente";
      nextweekBtn.textContent = "Semaine suivante";
      dropdowns.forEach(el => el.classList.remove("hidden"));
      weekLabel.classList.remove("hidden");
    }

  });
});

function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loading-screen");
  if (loadingScreen) loadingScreen.classList.add("hide");
}
