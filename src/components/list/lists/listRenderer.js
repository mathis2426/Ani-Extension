// List rendering logic

import { state, LIST_LABELS, openDropdown, setOpenDropdown } from '../core/state.js';
import { addToList, removeFromList, moveItem } from './listActions.js';

export function secondsToHMS(d) {
  d = Number(d || 0);
  let m = Math.floor((d % 3600) / 60);
  let s = Math.floor((d % 3600) % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function fakeAnimeInfo(name) {
  const h = hashCode((name || "").toString());
  const seasons = 1 + (Math.abs(h) % 6); // 1..6
  const epsPerSeason = 10 + (Math.abs(Math.floor(h / 7)) % 15); // 10..24
  return { seasons, episodes: seasons * epsPerSeason };
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0; // 32-bit
  }
  return h;
}

export function setActiveNav() {
  const nav = document.getElementById("lists-nav");
  nav.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.list === state.selected);
  });
  const { title, sub } = LIST_LABELS[state.selected] || LIST_LABELS.all;
  document.getElementById("current-list-title").textContent = title;
  document.getElementById("current-list-sub").textContent = sub;
  
  // toggle home section visibility
  const homeSection = document.getElementById("home-section");
  if (homeSection) homeSection.hidden = state.selected !== "home";

  // toggle list toolbar visibility (only when not on home)
  const listSection = document.getElementById('list-section');
  if(listSection) listSection.hidden = state.selected === 'home';
}

export function renderList() {
  const listEl = document.getElementById("list");
  const emptyEl = document.getElementById("empty");
  const term = document.getElementById("search").value.toLowerCase().trim();
  listEl.innerHTML = "";

  // If Home selected, hide list/empty and return
  if (state.selected === "home") {
    if (emptyEl) emptyEl.hidden = true;
    return;
  }
  console.log("Rendering list:", state.popupData, state.aniLists, state.selected);
  let items = [];
  if (state.selected === "all") {
    items = state.popupData.map((a) => ({
      name: a.name,
      link: a.link,
      episode: a.episode,
      title: a.title,
      currentTime: a.currentTime,
      duration: a.duration,
      notif: !!a.notif,
    }));
  } else {
    items = (state.aniLists[state.selected] || []).map((e) => ({ 
      name: e.name, 
      link: e.link,
      episode: e.episode,
      saison: e.saison,
      currentEp: e.currentEp,
      totalEp: e.totalEp
    }));
  }

  if (term) {
    items = items.filter((a) =>
      (a.name || "").toLowerCase().includes(term) ||
      (a.title || "").toLowerCase().includes(term)
    );
  }

  // Apply sorting based on state.listSort
  const sort = state.listSort;
  const nameKey = (obj) => (obj.name || obj.title || '').toLowerCase();
  if(sort === 'name-asc') items.sort((a,b)=> nameKey(a).localeCompare(nameKey(b)));
  else if(sort === 'name-desc') items.sort((a,b)=> nameKey(b).localeCompare(nameKey(a)));
  else if(sort === 'progress') {
    // Sort descending by progress ratio (only items with duration)
    items.sort((a,b)=> {
      const pa = a.duration ? (Number(a.currentTime||0)/Math.max(1,Number(a.duration))) : -1;
      const pb = b.duration ? (Number(b.currentTime||0)/Math.max(1,Number(b.duration))) : -1;
      return pb - pa; // highest first
    });
  } else if(sort === 'recent') {
    // We don't have a timestamp; keep original order (fallback)
  }

  // Update list display mode class
  listEl.classList.toggle('grid-mode', state.displayMode === 'grid');

  if (!items.length) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  for (const a of items) {
    const item = createListItem(a);
    listEl.appendChild(item);
  }
}

function createListItem(anime) {
  const item = document.createElement("div");
  item.className = "item";
  item.dataset.link = anime.link || "";

  const progress = anime.duration ? (Number(anime.currentTime || 0) / Math.max(1, Number(anime.duration))) * 100 : null;
  const epText = anime.episode ? (anime.title ? `Ep ${anime.episode} - ${anime.title}` : `Episode ${anime.episode}`) : null;
  
  // Use real data instead of fake info
  const hasRealInfo = anime.saison || anime.currentEp || anime.totalEp;
  const saisonText = anime.saison ? `Saison ${anime.saison}` : null;
  const epInfoText = (anime.currentEp || anime.totalEp) ? 
    `${anime.currentEp || 0}/${anime.totalEp || '?'} épisodes` : null;

  item.innerHTML = `
    <div class="item-top">
      <h2 class="item-title">${anime.name || "Sans titre"}</h2>
      <div class="item-top-actions" style="position:relative;">
        <button class="kebab" aria-haspopup="menu" aria-expanded="false" aria-label="Actions">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="12" cy="5" r="2" fill="#cfcfcf"/>
            <circle cx="12" cy="12" r="2" fill="#cfcfcf"/>
            <circle cx="12" cy="19" r="2" fill="#cfcfcf"/>
          </svg>
        </button>
        <div class="dropdown" role="menu" hidden></div>
      </div>
    </div>
    ${hasRealInfo ? `<div class="item-info">
      ${saisonText ? `<span>${saisonText}</span>` : ''}
      ${saisonText && epInfoText ? '<span> • </span>' : ''}
      ${epInfoText ? `<span>${epInfoText}</span>` : ''}
    </div>` : ''}
    <div class="item-meta">
      ${epText ? `<span>${epText}</span>` : ""}
      ${progress != null ? `<span>Progression: ${secondsToHMS(anime.currentTime)}/${secondsToHMS(anime.duration)} (${progress.toFixed(0)}%)</span>` : ""}
    </div>
  `;

  // Build dropdown menu
  const menu = item.querySelector('.dropdown');
  buildDropdownMenu(menu, anime);

  // Kebab toggle
  const kebab = item.querySelector('.kebab');
  kebab.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(menu, kebab);
  });
  
  menu.addEventListener('click', (e) => e.stopPropagation());

  item.addEventListener("click", () => {
    if (anime.link) chrome.tabs.create({ url: anime.link });
  });

  return item;
}

function buildDropdownMenu(menu, anime) {
  if (state.selected === "all") {
    [
      { key: "wishlist", label: "Ajouter à Wishlist" },
      { key: "inprogress", label: "Ajouter à En cours" },
      { key: "finished", label: "Ajouter à Terminés" },
    ].forEach(({ key, label }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        addToList(key, { name: anime.name, link: anime.link });
        closeOpenDropdown();
      });
      menu.appendChild(btn);
    });
  } else {
    const moveTo = [
      { key: "wishlist", label: "Déplacer vers Wishlist" },
      { key: "inprogress", label: "Déplacer vers En cours" },
      { key: "finished", label: "Déplacer vers Terminés" },
    ].filter((x) => x.key !== state.selected);

    moveTo.forEach(({ key, label }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        moveItem(state.selected, key, anime.link, anime.name);
        closeOpenDropdown();
      });
      menu.appendChild(btn);
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "danger";
    del.textContent = "Retirer";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      removeFromList(state.selected, anime.link);
      closeOpenDropdown();
    });
    menu.appendChild(del);
  }
}

function toggleDropdown(menuEl, btnEl) {
  if (!menuEl) return;
  if (openDropdown && openDropdown !== menuEl) {
    closeOpenDropdown();
  }
  const willOpen = menuEl.hidden === true;
  menuEl.hidden = !willOpen;
  btnEl.setAttribute('aria-expanded', String(willOpen));
  setOpenDropdown(willOpen ? menuEl : null);
}

export function closeOpenDropdown() {
  if (!openDropdown) return;
  const container = openDropdown.closest('.item-top');
  if (container) {
    const btn = container.querySelector('.kebab');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
  openDropdown.hidden = true;
  setOpenDropdown(null);
}
