// List rendering logic

import { state, LIST_LABELS, openDropdown, setOpenDropdown } from '../core/state.js';
import { addToList, removeFromList, moveItem } from './listActions.js';
import { AnilistService } from '../../../services/AnilistService.js';
import { persistAniLists } from '../core/storage.js';

export function secondsToHMS(d) {
  d = Number(d || 0);
  let m = Math.floor((d % 3600) / 60);
  let s = Math.floor((d % 3600) % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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

export async function renderList() {
  const listEl = document.getElementById("list");
  const emptyEl = document.getElementById("empty");
  const term = document.getElementById("search").value.toLowerCase().trim();
  listEl.innerHTML = "";

  // If Home selected, hide list/empty and return
  if (state.selected === "home") {
    if (emptyEl) emptyEl.hidden = true;
    return;
  }
  let items = [];
  if (state.selected === "all") {
    items = state.popupData.map((a) => ({
      name: a.name,
      link: a.link,
      episode: a.episode,
      title: a.title,
      saison: a.saison,
      currentTime: a.currentTime,
      duration: a.duration,
      notif: !!a.notif,
      banner: a.anilistBanner || null,
      image: a.anilistImage || null
    }));
  } else {
    // Get items from aniLists and enrich with popupData
    const listItems = state.aniLists[state.selected] || [];
    let shouldSaveAniLists = false;
    
    const itemPromises = listItems.map(async (e, index) => {
      // Référence directe à l'objet dans state.aniLists pour persister les modifications
      const stateItem = state.aniLists[state.selected][index];

      // Trouver un équivalent dans popupData uniquement par nom (on ignore l'épisode)
      const fullData = state.popupData.find(p => 
        p.name && stateItem.name && p.name.trim().toLowerCase() === stateItem.name.trim().toLowerCase()
      );

      // Si ni aniLists ni popupData n'ont d'images, alors seulement on va chercher sur l'API
      const hasAnyImage = Boolean(
        stateItem?.anilistBanner ||
        stateItem?.anilistImage ||
        fullData?.anilistBanner ||
        fullData?.anilistImage
      );

      if (!hasAnyImage && stateItem && stateItem.name) {
        try {
          const result = await AnilistService.getBannerAndImageByTitle(stateItem.name);
          if (result) {
            if (result.banner) {
              stateItem.anilistBanner = result.banner;
              shouldSaveAniLists = true;
            }
            if (result.image) {
              stateItem.anilistImage = result.image;
              shouldSaveAniLists = true;
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch images for ${stateItem.name}:`, err);
        }
      }

      // Plus de récupération du nombre de saisons (désactivé)

      // Merge: on prend les infos de popupData si dispo, sinon celles de aniLists
      return {
        name: stateItem.name,
        link: stateItem.link,
        episode: fullData?.episode || stateItem.episode,
        title: fullData?.title || stateItem.title,
        saison: fullData?.saison || stateItem.saison,
        currentEp: fullData?.currentEp || stateItem.currentEp,
        totalEp: fullData?.totalEp || stateItem.totalEp,
        currentTime: fullData?.currentTime || stateItem.currentTime,
        duration: fullData?.duration || stateItem.duration,
        notif: fullData?.notif || stateItem.notif,
        banner: stateItem.anilistBanner || fullData?.anilistBanner || null,
        image: stateItem.anilistImage || fullData?.anilistImage || null
      };
    });
    
    items = await Promise.all(itemPromises);
    
    // Sauvegarder aniLists si des images ont été ajoutées
    if (shouldSaveAniLists) {
      persistAniLists(state.aniLists);
    }
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
  listEl.classList.toggle('mixte-mode', state.displayMode === 'mixte');

  if (!items.length) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  // Mode mixte : structure spéciale avec 3 premiers + grille
  if (state.displayMode === 'mixte' && items.length > 3) {
    // Ajouter les 3 premiers en mode liste
    for (let i = 0; i < 3; i++) {
      const item = createListItem(items[i], 'list');
      listEl.appendChild(item);
    }
    
    // Créer un container de grille pour le reste
    const gridContainer = document.createElement('div');
    gridContainer.className = 'mixte-grid-container';
    for (let i = 3; i < items.length; i++) {
      const item = createListItem(items[i], 'grid');
      gridContainer.appendChild(item);
    }
    listEl.appendChild(gridContainer);
  } else {
    // Mode liste ou grid normal
    const displayType = state.displayMode === 'grid' ? 'grid' : 'list';
    for (const a of items) {
      const item = createListItem(a, displayType);
      listEl.appendChild(item);
    }
  }
  
  // Update images when display mode changes
  updateItemImages();
}

export function updateItemImages() {
  const listEl = document.getElementById("list");
  const items = listEl.querySelectorAll('.item');
  
  items.forEach(item => {
    const img = item.querySelector('.item-image');
    if (!img) return;
    
    const banner = item.dataset.banner || '';
    const image = item.dataset.image || '';
    const displayType = item.dataset.displayType || 'list';
    
    // Choose image based on display type stored in data attribute
    const newSrc = displayType === 'grid' ? image : banner;
    if (img.src !== newSrc) {
      img.src = newSrc;
    }
  });
}

// Fonction optimisée pour changer de mode sans rebuild (sauf pour mixte)
export function updateDisplayMode() {
  const listEl = document.getElementById("list");
  const currentItems = listEl.querySelectorAll('.item');
  const itemCount = currentItems.length;
  
  // Si passage vers/depuis mixte, on doit rebuild
  const hasMixteContainer = listEl.querySelector('.mixte-grid-container');
  const needsMixteContainer = state.displayMode === 'mixte' && itemCount > 3;
  
  if (hasMixteContainer || needsMixteContainer) {
    // Rebuild complet nécessaire pour le mode mixte
    renderList();
    return;
  }
  
  // Pour liste <-> grid, juste mettre à jour les classes et images
  listEl.classList.toggle('grid-mode', state.displayMode === 'grid');
  listEl.classList.toggle('mixte-mode', false);
  
  // Mettre à jour le displayType et les classes de chaque item
  const newDisplayType = state.displayMode === 'grid' ? 'grid' : 'list';
  const newBodyClass = state.displayMode === 'grid' ? 'item-body-grid' : 'item-body-list';
  
  currentItems.forEach(item => {
    item.dataset.displayType = newDisplayType;
    
    // Changer la classe du item-body
    const itemBody = item.querySelector('.item-body');
    if (itemBody) {
      itemBody.className = `item-body ${newBodyClass}`;
    }
  });
  
  // Mettre à jour les images
  updateItemImages();
}

function createListItem(anime, displayType = 'list') {
  const item = document.createElement("div");
  item.className = "item";
  item.dataset.link = anime.link || "";
  item.dataset.banner = anime.banner || "";
  item.dataset.image = anime.image || "";
  item.dataset.displayType = displayType;

  const progress = anime.duration ? (Number(anime.currentTime || 0) / Math.max(1, Number(anime.duration))) * 100 : null;
  const epText = anime.episode ? (anime.title ? `Ep ${anime.episode} - ${anime.title}` : `Episode ${anime.episode}`) : null;
  
  // Use real data instead of fake info
  const hasRealInfo = anime.saison || anime.currentEp || anime.totalEp;
  const saisonText = anime.saison ? `Saison ${anime.saison}` : null;
  const epInfoText = (anime.currentEp || anime.totalEp) ? 
    `${anime.currentEp || 0}/${anime.totalEp || '?'} épisodes` : null;

  // Choose image based on display type
  const imageUrl = displayType === 'grid' ? (anime.image || '') : (anime.banner || '');
  
  // Classes pour item-body selon le mode
  const bodyClass = displayType === 'grid' ? 'item-body item-body-grid' : 'item-body item-body-list';

  item.innerHTML = `
    <div class="item-image-container">
      <img class="item-image" src="${imageUrl}" alt="${anime.name || 'No title'}">
    </div>
    <div class="${bodyClass}">
      <div class="item-content">
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
        <div class="item-meta">
          ${anime.saison ? `<span>Saison ${anime.saison}</span>` : ''}
          ${anime.saison && anime.episode ? '<span> | </span>' : ''}
          ${anime.episode ? `<span>Episode ${anime.episode}</span>` : ''}
        </div>
        <div class="item-details">
          ${hasRealInfo ? `<div class="item-info">
            ${saisonText ? `<span>${saisonText}</span>` : ''}
            ${saisonText && epInfoText ? '<span> | </span>' : ''}
            ${epInfoText ? `<span>Episode ${anime.episode || 0}</span>` : ''}
          </div>` : ''}
          ${progress != null ? `<div class="item-status-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#ff9800">
              <circle cx="12" cy="12" r="10"/>
            </svg>
            <span>En cours de visionnage</span>
          </div>` : ''}
        </div>
      </div>
      <div class="item-progress-container">
        ${progress != null ? `
          <div class="item-circular-progress">
            <svg class="progress-ring" width="70" height="70">
              <circle class="progress-ring-circle-bg" cx="35" cy="35" r="28" />
              <circle class="progress-ring-circle" cx="35" cy="35" r="28" 
                style="stroke-dasharray: ${2 * Math.PI * 28}; stroke-dashoffset: ${2 * Math.PI * 28 * (1 - progress / 100)}" />
            </svg>
            <div class="progress-value">${progress.toFixed(0)}%</div>
          </div>
          <div class="item-linear-progress">
            <div class="linear-progress-bar">
              <div class="linear-progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="linear-progress-text">${progress.toFixed(0)}%</div>
          </div>
          <button class="item-play-btn" aria-label="Lire">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        ` : ''}
      </div>
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
