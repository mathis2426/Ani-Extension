import { el, elWithStyle } from "../utils/dom.js";
import { getScoreColor } from "../utils/score.js";
import { getAnimeSeasonalDetails } from "../api/anilist.js";

// ============ POPUP STATE ============

let popupOverlay = null;
let currentAnimeData = null;

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
      currentAnimeData = null;
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

// ============ AJOUTER BUTTON (on event cards) ============

function buildAjouterButton() {
  const btn = el("button", "popup-add-btn", "Ajouter");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentAnimeData) {
      switchToAddForm(currentAnimeData.anime, currentAnimeData.episode, currentAnimeData.heure);
    }
  });
  return btn;
}

// ============ ADD FORM (Ajouter un anime au calendrier personnel) ============

function switchToAddForm(anime, episode, heure) {
  const card = popupOverlay.querySelector(".popup-card");
  if (!card) return;

  // Keep left section (image), replace right section
  const rightSection = card.querySelector(".popup-right");
  if (!rightSection) return;

  // Build the add form
  const form = buildAddForm(anime, episode, heure);

  // Smooth transition
  rightSection.style.opacity = "0";
  setTimeout(() => {
    rightSection.replaceWith(form);
    requestAnimationFrame(() => {
      form.style.opacity = "1";
    });
  }, 200);
}

function switchToDetailsView(anime, episode, heure) {
  const card = popupOverlay.querySelector(".popup-card");
  if (!card) return;

  const formSection = card.querySelector(".popup-right-form");
  if (!formSection) return;

  const nextEp = anime.nextAiringEpisode;
  const currentEpisode = episode || (nextEp?.episode ? nextEp.episode - 1 : "?");
  const progressPercent = anime.episodes
    ? Math.min((currentEpisode / anime.episodes) * 100, 100)
    : 50;

  // Header
  const header = el("div", "popup-header", "", [
    el("h2", "popup-title", anime.title.romaji),
    buildAjouterButton(),
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
  const footer = buildFooter(currentEpisode, heure, progressPercent);
  const rightSection = el("div", "popup-right", "", [header, content, footer]);
  rightSection.style.opacity = "0";

  formSection.style.opacity = "0";
  setTimeout(() => {
    formSection.replaceWith(rightSection);
    requestAnimationFrame(() => {
      rightSection.style.opacity = "1";
    });
  }, 200);
}

function buildAddForm(anime, episode, heure) {
  const form = el("div", "popup-right popup-right-form");
  form.style.opacity = "0";
  form.style.transition = "opacity 0.2s ease";

  // --- Header: editable title + notification/favorite icons ---
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "form-title-input";
  titleInput.value = anime.title.romaji || "";
  titleInput.placeholder = "Titre de l'anime";

  const bellIcon = el("button", "form-icon-btn", "🔔");
  bellIcon.title = "Notification";
  bellIcon.addEventListener("click", () => bellIcon.classList.toggle("active"));

  const starIcon = el("button", "form-icon-btn", "⭐");
  starIcon.title = "Favori";
  starIcon.addEventListener("click", () => starIcon.classList.toggle("active"));

  const iconsRow = el("div", "form-icons-row", "", [bellIcon, starIcon]);
  const header = el("div", "form-header", "", [titleInput, iconsRow]);

  // --- Date / Heure checkboxes ---
  const animeDate = formatDate(anime.startDate);
  const animeHeure = heure || "?";

  // Date row
  const dateCheckbox = document.createElement("input");
  dateCheckbox.type = "checkbox";
  dateCheckbox.id = "form-date-check";
  dateCheckbox.className = "form-checkbox";
  dateCheckbox.checked = false;

  const dateCustomLabel = el("span", "form-custom-label", "Jour personnalisé");

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.className = "form-date-input form-inline-input";
  dateInput.value = animeDate;
  dateInput.disabled = true;

  const dateFieldWrapper = el("div", "form-field-wrapper", "", [dateInput]);

  dateCheckbox.addEventListener("change", () => {
    if (dateCheckbox.checked) {
      // Checked = custom enabled
      dateInput.disabled = false;
      dateInput.value = "";
      dateFieldWrapper.classList.add("custom-enabled");
    } else {
      // Unchecked = use anime date (disabled)
      dateInput.disabled = true;
      dateInput.value = animeDate;
      dateFieldWrapper.classList.remove("custom-enabled");
    }
  });

  const dateRow = el("div", "form-check-row", "", [dateCheckbox, dateCustomLabel, dateFieldWrapper]);

  // Heure row
  const heureCheckbox = document.createElement("input");
  heureCheckbox.type = "checkbox";
  heureCheckbox.id = "form-heure-check";
  heureCheckbox.className = "form-checkbox";
  heureCheckbox.checked = false;

  const heureCustomLabel = el("span", "form-custom-label", "Heure personnalisée");

  const heureInput = document.createElement("input");
  heureInput.type = "text";
  heureInput.className = "form-time-input form-inline-input";
  heureInput.value = animeHeure;
  heureInput.disabled = true;

  const heureFieldWrapper = el("div", "form-field-wrapper", "", [heureInput]);

  heureCheckbox.addEventListener("change", () => {
    if (heureCheckbox.checked) {
      // Checked = custom enabled, switch to time input
      heureInput.type = "time";
      heureInput.disabled = false;
      heureInput.value = "";
      heureFieldWrapper.classList.add("custom-enabled");
    } else {
      // Unchecked = use anime time (disabled)
      heureInput.type = "text";
      heureInput.disabled = true;
      heureInput.value = animeHeure;
      heureFieldWrapper.classList.remove("custom-enabled");
    }
  });

  const heureRow = el("div", "form-check-row", "", [heureCheckbox, heureCustomLabel, heureFieldWrapper]);

  const checksColumn = el("div", "form-checks-column", "", [dateRow, heureRow]);

  // --- Comment / Message ---
  const commentArea = document.createElement("textarea");
  commentArea.className = "form-comment";
  commentArea.placeholder = "Com / Message";
  commentArea.rows = 4;

  const topRow = el("div", "form-top-row", "", [checksColumn, commentArea]);

  // --- Status dropdown ---
  const statusSelect = document.createElement("select");
  statusSelect.className = "form-select";
  const optEnCours = document.createElement("option");
  optEnCours.value = "en_cours";
  optEnCours.textContent = "En cours";
  const optAVoir = document.createElement("option");
  optAVoir.value = "a_voir";
  optAVoir.textContent = "À voir";
  statusSelect.appendChild(optEnCours);
  statusSelect.appendChild(optAVoir);

  // --- Conditional fields: note provisoire + episodes vues ---
  const noteInput = document.createElement("input");
  noteInput.type = "number";
  noteInput.className = "form-input";
  noteInput.placeholder = "Note provisoire";
  noteInput.min = "0";
  noteInput.max = "100";

  const episodesInput = document.createElement("input");
  episodesInput.type = "number";
  episodesInput.className = "form-input";
  episodesInput.placeholder = "Episodes vus";
  episodesInput.min = "0";

  const conditionalFields = el("div", "form-conditional-fields", "", [noteInput, episodesInput]);

  // Status + conditional fields on same horizontal row
  const statusRow = el("div", "form-status-row", "", [statusSelect, conditionalFields]);

  // Show/hide conditional fields based on status
  function updateConditionalFields() {
    if (statusSelect.value === "en_cours") {
      conditionalFields.style.display = "flex";
    } else {
      conditionalFields.style.display = "none";
    }
  }
  statusSelect.addEventListener("change", updateConditionalFields);
  updateConditionalFields(); // init

  // --- Footer: Retour + Confirmer ---
  const retourBtn = el("button", "form-btn form-btn-retour", "Retour");
  retourBtn.addEventListener("click", () => {
    switchToDetailsView(anime, episode, heure);
  });

  const confirmerBtn = el("button", "form-btn form-btn-confirmer", "Confirmer");
  confirmerBtn.addEventListener("click", () => {
    const formData = {
      title: titleInput.value,
      notification: bellIcon.classList.contains("active"),
      favorite: starIcon.classList.contains("active"),
      keepDate: dateCheckbox.checked,
      customDate: dateInput.value || null,
      keepHeure: heureCheckbox.checked,
      customHeure: heureInput.value || null,
      comment: commentArea.value,
      status: statusSelect.value,
      noteProvisoire: statusSelect.value === "en_cours" ? (noteInput.value || null) : null,
      episodesVus: statusSelect.value === "en_cours" ? (episodesInput.value || null) : null,
      animeId: anime.id,
      poster: anime.poster?.large || "",
      originalDate: animeDate,
      originalHeure: heure
    };

    // Save to chrome storage
    saveToPersonalCalendar(formData);
    closePopup();
  });

  const footerBtns = el("div", "form-footer", "", [retourBtn, confirmerBtn]);

  // --- Separator before footer ---
  const separator = el("div", "form-separator");

  // --- Assemble ---
  form.appendChild(header);
  form.appendChild(topRow);
  form.appendChild(statusRow);
  form.appendChild(separator);
  form.appendChild(footerBtns);

  return form;
}

function saveToPersonalCalendar(formData) {
  chrome.storage.local.get("personalCalendar", (data) => {
    const calendar = data.personalCalendar || [];
    calendar.push({
      ...formData,
      addedAt: Date.now()
    });
    chrome.storage.local.set({ personalCalendar: calendar }, () => {
      console.log("Anime ajouté au calendrier personnel:", formData.title);
    });
  });
}

// ============ MAIN POPUP CARD ============

function buildPopupCard(anime, episode, heure) {
  // Store current anime data for the add button
  currentAnimeData = { anime, episode, heure };

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

  // Header (with Ajouter button to the left of score)
  const header = el("div", "popup-header", "", [
    el("h2", "popup-title", anime.title.romaji),
    buildAjouterButton(),
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
