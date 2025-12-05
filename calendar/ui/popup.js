import { el, elWithStyle } from "../utils/dom.js";
import { getScoreColor } from "../utils/score.js";
import { getAnimeSeasonalDetails } from "../api/anilist.js";

// ============ POPUP STATE ============

let popupOverlay = null;

// ============ OVERLAY MANAGEMENT ============

function createPopupOverlay() {
  if (popupOverlay) return popupOverlay;

  popupOverlay = el("div", "popup-overlay");
  popupOverlay.addEventListener("click", (e) => {
    if (e.target === popupOverlay) closePopup();
  });
  document.body.appendChild(popupOverlay);
  return popupOverlay;
}

function closePopup() {
  if (popupOverlay) {
    popupOverlay.classList.remove("show");
    setTimeout(() => {
      popupOverlay.innerHTML = "";
    }, 300);
  }
}

// ============ CARD BUILDERS ============

function buildLoadingCard() {
  return el("div", "popup-card", "", [
    el("div", "popup-loading", "", [
      el("div", "loader"),
      el("p", "", "Chargement...")
    ])
  ]);
}

function buildErrorCard() {
  const btn = el("button", "", "Fermer");
  btn.addEventListener("click", closePopup);

  return el("div", "popup-card", "", [
    el("div", "popup-error", "", [
      el("p", "", "❌ Erreur lors du chargement"),
      btn
    ])
  ]);
}

// ============ POPUP COMPONENTS ============

function buildScoreCircle(score) {
  const { color, degrees } = getScoreColor(score);
  
  const bar = elWithStyle("div", "popup-score-bar", {
    background: `conic-gradient(${color} 0deg, ${color} ${degrees}deg, #555 ${degrees}deg, #555 360deg)`
  });

  return el("div", "popup-score", "", [
    bar,
    el("div", "popup-score-center"),
    el("span", "popup-score-text", String(score))
  ]);
}

function buildSection(title, items) {
  const box = el("div", "popup-box popup-box-scroll");
  items.forEach((item, i) => {
    box.appendChild(document.createTextNode(item));
    if (i < items.length - 1) box.appendChild(document.createElement("br"));
  });

  return el("div", "popup-section", "", [
    el("h3", "", title),
    box
  ]);
}

function buildSynopsis(description) {
  const synopsis = el("div", "popup-synopsis");
  // innerHTML nécessaire car l'API AniList renvoie du HTML (<br>, <i>, etc.)
  synopsis.innerHTML = description || "Aucune description disponible.";

  return el("div", "popup-section", "", [
    el("h3", "", "Synopsis"),
    synopsis
  ]);
}

function formatDate(dateObj) {
  if (!dateObj || !dateObj.year) return "Inconnue";
  const { day, month, year } = dateObj;
  if (day && month) {
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }
  return String(year);
}

function buildDates(startDate, endDate) {
  const formattedStart = formatDate(startDate);
  const formattedEnd = formatDate(endDate);

  const buildDate = (label, value) => el("div", "popup-date", "", [
    el("span", "date-label", label),
    el("span", "date-value", value)
  ]);

  return el("div", "popup-dates", "", [
    buildDate("Date de début -", formattedStart),
    buildDate("Date de fin -", formattedEnd)
  ]);
}

function buildFooter(currentEpisode, heure, progressPercent) {
  const progressBar = elWithStyle("div", "popup-progress-bar", { width: `${progressPercent}%` });
  const progressRemaining = elWithStyle("div", "popup-progress-remaining", { width: `${100 - progressPercent}%` });

  return el("div", "popup-footer", "", [
    el("div", "popup-episode", `Episode ${currentEpisode} - ${heure || "?"}`),
    el("div", "popup-progress", "", [progressBar, progressRemaining])
  ]);
}

// ============ MAIN POPUP CARD ============

function buildPopupCard(anime, episode, heure) {
  const nextEp = anime.nextAiringEpisode;
  const currentEpisode = episode || (nextEp?.episode ? nextEp.episode - 1 : "?");
  const progressPercent = anime.episodes 
    ? Math.min((currentEpisode / anime.episodes) * 100, 100) 
    : 50;

  // Image
  const img = document.createElement("img");
  img.src = anime.poster?.large || "";
  img.alt = anime.title.romaji;

  const leftSection = el("div", "popup-left", "", [img]);

  // Header
  const header = el("div", "popup-header", "", [
    el("h2", "popup-title", anime.title.romaji),
    buildScoreCircle(anime.averageScore ?? 0)
  ]);

  // Content
  const infoLeft = el("div", "popup-info-left", "", [
    buildSection("Genres", anime.genres || ["Inconnu"]),
    buildSection("Studio", anime.studios?.nodes?.map(s => s.name) || ["Inconnu"])
  ]);

  const infoRight = el("div", "popup-info-right", "", [
    buildSynopsis(anime.description),
    buildDates(anime.startDate, anime.endDate)
  ]);

  const content = el("div", "popup-content", "", [infoLeft, infoRight]);

  // Footer
  const footer = buildFooter(currentEpisode, heure, progressPercent);

  // Assemble right section
  const rightSection = el("div", "popup-right", "", [header, content, footer]);

  return el("div", "popup-card", "", [leftSection, rightSection]);
}

// ============ PUBLIC API ============

export async function showAnimePopup(animeName, episode, heure) {
  const overlay = createPopupOverlay();

  // Show loading
  overlay.innerHTML = "";
  overlay.appendChild(buildLoadingCard());
  overlay.classList.add("show");

  try {
    const anime = await getAnimeSeasonalDetails(animeName);
    overlay.innerHTML = "";
    overlay.appendChild(buildPopupCard(anime, episode, heure));
  } catch (error) {
    console.error("Erreur lors du chargement des détails:", error);
    overlay.innerHTML = "";
    overlay.appendChild(buildErrorCard());
  }
}
