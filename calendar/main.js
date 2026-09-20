import { getAnimeScheduleWithCache } from "./storage/cache.js";
import { fetchTwoWeeksSchedule } from "./api/anilist.js";
import { renderScheduleAnimeCalendar } from "./ui/renderAnimeCalendar.js";
import { renderSchedulePersonnalCalendar } from "./ui/renderPersonnalCalendar.js";
import { Dropdown } from "./ui/dropdown.js";
import { RangeSlider } from "./ui/rangeSlider.js";

// ===== CONFIGURATION =====
const NUM_PREVIOUS_WEEKS = 2; // Nombre de semaines affichées avant la semaine actuelle
const NUM_NEXT_WEEKS = 10;     // Nombre de semaines affichées après la semaine actuelle
const TOTAL_WEEKS = NUM_PREVIOUS_WEEKS + 1 + NUM_NEXT_WEEKS; // Total semaines à fetcher

let currentCalendar = "anime"; // Track the current calendar being displayed
let animeList = []; // Global anime list
let personalAnimeList = []; // List of anime in user's list

document.addEventListener("DOMContentLoaded", async () => {
  let currentFilter = "popularité";
  let currentDate = new Date();
  let currentNoteFilter = { min: 0, max: 100 };

  try {
    // Calculate start date (NUM_PREVIOUS_WEEKS semaines en arrière)
    const fetchStartDate = new Date(currentDate);
    fetchStartDate.setDate(fetchStartDate.getDate() - (NUM_PREVIOUS_WEEKS * 7));
    
    animeList = await getAnimeScheduleWithCache();
    // Fetch data at startup
    try {
      animeList = await fetchTwoWeeksSchedule(fetchStartDate, TOTAL_WEEKS);
    } catch (err) {
      console.error(`Erreur lors du chargement des ${TOTAL_WEEKS} semaines :`, err);
    }
    renderScheduleAnimeCalendar(animeList, currentDate, currentFilter);
    renderSchedulePersonnalCalendar(personalAnimeList, currentDate, currentFilter);
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
      
      // Choose the correct list based on current calendar
      const listToUse = currentCalendar === "personal" ? personalAnimeList : animeList;
      const filteredList = filterAnimeByNotes(listToUse, currentNoteFilter);
      
      const animeContent = document.getElementById("anime-content");
      const personalContent = document.getElementById("personal-content");
      
      // Force correct display
      if (currentCalendar === "personal") {
        personalContent.style.display = "flex";
        animeContent.style.display = "none";
        renderSchedulePersonnalCalendar(filteredList, currentDate, currentFilter);
      } else {
        animeContent.style.display = "flex";
        personalContent.style.display = "none";
        renderScheduleAnimeCalendar(filteredList, currentDate, currentFilter);
      }
    },
  });

  sortDropdown.mount(document.getElementById("sort-dropdown"));

  // Switch calendar
  document.addEventListener("click", (e) => {
    if (e.target.id === "tab-personal" || e.target.id === "tab-anime") {
      if (e.target.id === "tab-personal" && currentCalendar === "personal") return;
      if (e.target.id === "tab-anime" && currentCalendar === "anime") return;

      currentCalendar = e.target.id === "tab-personal" ? "personal" : "anime";
      
      // Update button styles
      const tabAnimeBtn = document.getElementById("tab-anime");
      const tabPersonalBtn = document.getElementById("tab-personal");
      tabAnimeBtn.classList.remove("active");
      tabPersonalBtn.classList.remove("active");
      
      if (e.target.id === "tab-personal") {
        tabPersonalBtn.classList.add("active");
      } else {
        tabAnimeBtn.classList.add("active");
      }
      
      const animeContent = document.getElementById("anime-content");
      const personalContent = document.getElementById("personal-content");

      if (e.target.id === "tab-personal") {
        personalContent.style.display = "flex";
        animeContent.style.display = "none";
        const filteredList = filterAnimeByNotes(personalAnimeList, currentNoteFilter);
        renderSchedulePersonnalCalendar(filteredList, currentDate, currentFilter);
      } else {
        animeContent.style.display = "flex";
        personalContent.style.display = "none";
        const filteredList = filterAnimeByNotes(animeList, currentNoteFilter);
        renderScheduleAnimeCalendar(filteredList, currentDate, currentFilter);
      }
    }
  });

  const filterRangeSlider = new RangeSlider({
    minValue: 0,
    maxValue: 100,
    defaultMin: 0,
    defaultMax: 100,
    onChange: (values) => {
      currentNoteFilter = values;
      
      // Choose the correct list based on current calendar
      const listToUse = currentCalendar === "personal" ? personalAnimeList : animeList;
      const filteredList = filterAnimeByNotes(listToUse, currentNoteFilter);
      
      const animeContent = document.getElementById("anime-content");
      const personalContent = document.getElementById("personal-content");
      
      // Force correct display
      if (currentCalendar === "personal") {
        personalContent.style.display = "flex";
        animeContent.style.display = "none";
        renderSchedulePersonnalCalendar(filteredList, currentDate, currentFilter);
      } else {
        animeContent.style.display = "flex";
        personalContent.style.display = "none";
        renderScheduleAnimeCalendar(filteredList, currentDate, currentFilter);
      }
    },
  });

  filterRangeSlider.mount(document.getElementById("filter-dropdown"));

  const today = new Date(); // Get today's date
  const startOfWeek = new Date(today); // Calculate start of the week (Monday)
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  startOfWeek.setDate(today.getDate() + diff);
  startOfWeek.setHours(0, 0, 0, 0);

  document.getElementById("prev-week").addEventListener("click", async () => {
    const minDate = new Date(startOfWeek);
    minDate.setDate(minDate.getDate() - (NUM_PREVIOUS_WEEKS * 7));

    if (currentDate <= minDate) return;

    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() - 7);
    
    if (currentCalendar === "personal") {
      renderSchedulePersonnalCalendar(personalAnimeList, currentDate, currentFilter);
    } else {
      renderScheduleAnimeCalendar(animeList, currentDate, currentFilter);
    }
    
    // Update button states
    if (currentDate <= minDate) {
      document.getElementById("prev-week").classList.add("inactive");
    } else {
      document.getElementById("prev-week").classList.remove("inactive");
    }
    document.getElementById("next-week").classList.remove("inactive");
  });

  document.getElementById("next-week").addEventListener("click", async () => {
    const maxDate = new Date(startOfWeek);
    maxDate.setDate(maxDate.getDate() + (NUM_NEXT_WEEKS * 7));

    if (currentDate >= maxDate) return;

    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 7);
    
    if (currentCalendar === "personal") {
      renderSchedulePersonnalCalendar(personalAnimeList, currentDate, currentFilter);
    } else {
      renderScheduleAnimeCalendar(animeList, currentDate, currentFilter);
    }
    
    // Update button states
    if (currentDate >= maxDate) {
      document.getElementById("next-week").classList.add("inactive");
    } else {
      document.getElementById("next-week").classList.remove("inactive");
    }
    document.getElementById("prev-week").classList.remove("inactive");
  });

  // Handle scroll event to modify navigation bar appearance
  window.addEventListener("scroll", () => { 
    const nav = document.querySelector(".navigation");
    const prevweekBtn = document.getElementById("prev-week");
    const nextweekBtn = document.getElementById("next-week");
    const dropdowns = document.querySelectorAll(".dropdown");
    const rangeSlider = document.querySelector(".range-slider");
    const weekLabel = document.getElementById("week-label");
    const openDropdowns = Array.from(dropdowns).some(d => d.querySelector(".dropdown-options.show"));

    // Don't hide dropdowns if one is open
    if (window.scrollY > 50 && !openDropdowns) {
      nav.classList.add("scrolled");

      prevweekBtn.innerHTML =
        '<img src="images/fleche-gauche.png" alt="gauche" style="width:16px; vertical-align:middle;">';
      nextweekBtn.innerHTML =
        '<img src="images/fleche-droite.png" alt="droite" style="width:16px; vertical-align:middle;">';

      dropdowns.forEach(el => el.classList.add("hidden"));
      if (rangeSlider) rangeSlider.classList.add("hidden");
      weekLabel.classList.add("hidden");
    } else if (window.scrollY <= 50) {
      nav.classList.remove("scrolled");
      prevweekBtn.textContent = "Semaine précédente";
      nextweekBtn.textContent = "Semaine suivante";
      dropdowns.forEach(el => el.classList.remove("hidden"));
      if (rangeSlider) rangeSlider.classList.remove("hidden");
      weekLabel.classList.remove("hidden");
    }

  });
});


// Function to hide the loading screen
function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loading-screen");
  if (loadingScreen) loadingScreen.classList.add("hide");
}

// Function to filter anime by notes
function filterAnimeByNotes(animeList, noteFilter) {
  if (typeof noteFilter === 'object' && noteFilter.min !== undefined && noteFilter.max !== undefined) {
    return animeList.filter(anime => {
      const score = anime.score || 0;
      return score >= noteFilter.min && score <= noteFilter.max;
    });
  }
  return animeList;
}