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
  if (listSection) listSection.hidden = state.selected === 'home';
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
    // Ensure popupData is an array
    const popupData = Array.isArray(state.popupData) ? state.popupData : [];
    items = popupData.map((a) => ({
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

      // Ensure popupData is an array before using find
      const popupData = Array.isArray(state.popupData) ? state.popupData : [];
      // Trouver un équivalent dans popupData uniquement par nom (on ignore l'épisode)
      const fullData = popupData.find(p =>
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

      // Note: franchise info will be fetched on user click to avoid mass requests during render

      // Merge: on prend les infos de popupData si dispo, sinon celles de aniLists
      return {
        name: stateItem.name,
        link: stateItem.link,
        chronology: stateItem.chronology || fullData?.chronology || {},
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
  if (sort === 'name-asc') items.sort((a, b) => nameKey(a).localeCompare(nameKey(b)));
  else if (sort === 'name-desc') items.sort((a, b) => nameKey(b).localeCompare(nameKey(a)));
  else if (sort === 'progress') {
    // Sort descending by progress ratio (only items with duration)
    items.sort((a, b) => {
      const pa = a.duration ? (Number(a.currentTime || 0) / Math.max(1, Number(a.duration))) : -1;
      const pb = b.duration ? (Number(b.currentTime || 0) / Math.max(1, Number(b.duration))) : -1;
      return pb - pa; // highest first
    });
  } else if (sort === 'recent') {
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
  const hasRealInfo = anime.saison || anime.currentEp || anime.totalEp;
  const saisonText = anime.saison ? `Saison ${anime.saison}` : null;
  const epInfoText = (anime.currentEp || anime.totalEp) ? `${anime.currentEp || 0}/${anime.totalEp || '?'} épisodes` : null;
  const imageUrl = displayType === 'grid' ? (anime.image || '') : (anime.banner || '');
  const bodyClass = displayType === 'grid' ? 'item-body item-body-grid' : 'item-body item-body-list';

  // Affichage conditionnel selon la liste sélectionnée
  let metaHtml = '';
  let detailsHtml = '';
  let progressHtml = '';

  if (state.selected === 'inprogress') {
    metaHtml = `
      ${anime.saison ? `<span>Saison ${anime.saison}</span>` : ''}
      ${anime.saison && anime.episode ? '<span> | </span>' : ''}
      ${anime.episode ? `<span>Episode ${anime.episode}</span>` : ''}
    `;
    detailsHtml = hasRealInfo ? `<div class="item-info">
      ${saisonText ? `<span>${saisonText}</span>` : ''}
      ${saisonText && epInfoText ? '<span> | </span>' : ''}
      ${epInfoText ? `<span>Episode ${anime.episode || 0}</span>` : ''}
    </div>` : '';
    if (progress != null) {
      detailsHtml += `<div class="item-status-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#ff9800">
          <circle cx="12" cy="12" r="10"/>
        </svg>
        <span>En cours de visionnage</span>
      </div>`;
      progressHtml = `
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
      `;
    }
  } else if (state.selected === 'finished' || state.selected === 'wishlist') {
    // Afficher le nombre de saisons et d'épisodes si la chronologie existe
    let saisonCount = 0;
    let episodeCount = 0;
    if (anime.chronology && typeof anime.chronology === 'object') {
      Object.values(anime.chronology).forEach(node => {
        if (node.format === 'TV') {
          saisonCount++;
          if (typeof node.episodes === 'number') episodeCount += node.episodes;
        }
        //if (node.format === 'MOVIE' && typeof node.episodes === 'number') episodeCount += node.episodes;
      });
    }
    metaHtml = `<span>${saisonCount} saison${saisonCount > 1 ? 's' : ''}</span> | <span>${episodeCount} épisode${episodeCount > 1 ? 's' : ''}</span>`;
    detailsHtml = '';
    progressHtml = '';
  }
  else {
    // Pour "all" ou autres, garder l'affichage par défaut
    metaHtml = `
      ${anime.saison ? `<span>Saison ${anime.saison}</span>` : ''}
      ${anime.saison && anime.episode ? '<span> | </span>' : ''}
      ${anime.episode ? `<span>Episode ${anime.episode}</span>` : ''}
    `;
    detailsHtml = hasRealInfo ? `<div class="item-info">
      ${saisonText ? `<span>${saisonText}</span>` : ''}
      ${saisonText && epInfoText ? '<span> | </span>' : ''}
      ${epInfoText ? `<span>Episode ${anime.episode || 0}</span>` : ''}
    </div>` : '';
    if (progress != null) {
      detailsHtml += `<div class="item-status-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#ff9800">
          <circle cx="12" cy="12" r="10"/>
        </svg>
        <span>En cours de visionnage</span>
      </div>`;
      progressHtml = `
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
      `;
    }
  }

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
          ${metaHtml}
        </div>
        <div class="item-details">
          ${detailsHtml}
        </div>
      </div>
      <div class="item-progress-container">
        ${progressHtml}
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
    // On click show chronology panel/modal
    showChronology(anime);
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
        // Désactiver le bouton pour éviter les double-clics
        btn.disabled = true;
        addToList(key, { name: anime.name, link: anime.link });
        closeOpenDropdown();
        // Réactiver après un court délai
        setTimeout(() => { btn.disabled = false; }, 300);
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
        // Désactiver le bouton pour éviter les double-clics
        btn.disabled = true;
        moveItem(state.selected, key, anime.link, anime.name);
        closeOpenDropdown();
        // Réactiver après un court délai
        setTimeout(() => { btn.disabled = false; }, 300);
      });
      menu.appendChild(btn);
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "danger";
    del.textContent = "Retirer";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      // Désactiver le bouton pour éviter les double-clics
      del.disabled = true;
      removeFromList(state.selected, anime.link);
      closeOpenDropdown();
      // Réactiver après un court délai
      setTimeout(() => { del.disabled = false; }, 300);
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

// Chronology modal handling
function closeChronologyModal() {
  const overlay = document.getElementById('chronology-overlay');
  if (overlay) overlay.remove();
}

function showChronology(anime) {
  if (!anime) return;

  // Remove existing chronology modal/overlay if any
  closeChronologyModal();

  // overlay (covers full viewport)
  const overlay = document.createElement('div');
  overlay.id = 'chronology-overlay';
  overlay.className = 'chronology-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeChronologyModal();
    }
  });

  // panel (dialog)
  const panel = document.createElement('div');
  panel.id = 'chronology-modal';
  panel.className = 'chronology-modal';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'chronology-header';

  const title = document.createElement('h3');
  title.className = 'chronology-title';
  title.textContent = anime.name || anime.title || 'Chronologie';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'chronology-close';
  closeBtn.textContent = '✕';
  closeBtn.type = 'button';
  closeBtn.addEventListener('click', () => closeChronologyModal());

  header.appendChild(title);
  header.appendChild(closeBtn);

  const content = document.createElement('div');
  content.className = 'chronology-content';

  // Build chronology entries (anime.chronology is an object keyed by index)
  const chronology = anime.chronology || {};
  const keys = Object.keys(chronology).sort((a, b) => Number(a) - Number(b));

  if (keys.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'Aucune chronologie disponible.';
    empty.style.opacity = '0.8';
    content.appendChild(empty);
  } else {
    // Use a for-loop so we can inspect the next node and decide connector style
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const node = chronology[k];
      const nextKey = keys[i + 1];
      const nextNode = nextKey ? chronology[nextKey] : null;

      const entry = document.createElement('div');
      entry.className = 'chronology-entry';

      const indexEl = document.createElement('div');
      indexEl.className = 'chronology-index';
      indexEl.textContent = k;

      // Build main title/meta
      const nTitle = document.createElement('div');
      nTitle.className = 'chronology-node-title';
      nTitle.textContent = node.title || node.name || `(id:${node.id})`;

      const meta = document.createElement('div');
      meta.className = 'chronology-meta';
      const parts = [];
      if (node.format) parts.push(node.format);
      if (node.season) parts.push(String(node.season));
      if (node.seasonYear) parts.push(String(node.seasonYear));
      if (typeof node.episodes === 'number') parts.push(`${node.episodes} ep`);
      meta.textContent = parts.join(' • ');

      // Split alternatives into inline (shown in the same card) and special ones
      const alternatives = Array.isArray(node.alternatives) ? node.alternatives : [];
      const specialTypes = ['SUMMARY', 'SPIN_OFF', 'SIDE_STORY'];
      const specialAlts = alternatives.filter(a => specialTypes.includes(((a.relationType || '').toString().toUpperCase())));
      const inlineAlts = alternatives.filter(a => !specialTypes.includes(((a.relationType || '').toString().toUpperCase())));

      let body;
      if (inlineAlts.length > 0) {

        const twoBox = document.createElement('div');
        twoBox.className = 'chronology-two-box';

        // Left box: main node info (title + meta)
        const leftBox = document.createElement('div');
        leftBox.className = 'chronology-box';
        // Reuse nTitle and meta (already created above)
        // ensure we append clones to avoid moving originals if reused
        leftBox.appendChild(nTitle.cloneNode(true));
        leftBox.appendChild(meta.cloneNode(true));

        // Right box: alternatives stacked, each in its own row/card
        const rightBox = document.createElement('div');
        rightBox.className = 'chronology-box chronology-box--alts';
        if (inlineAlts.length === 1) rightBox.classList.add('single');

        inlineAlts.forEach(alt => {
          const altRow = document.createElement('div');
          altRow.className = 'chronology-alt-row';

          const altTitle = document.createElement('div');
          altTitle.className = 'chronology-node-title';
          altTitle.textContent = alt.title || alt.name || `(id:${alt.id})`;

          const altMeta = document.createElement('div');
          altMeta.className = 'chronology-meta';
          const am = [];
          if (alt.format) am.push(alt.format);
          if (alt.season) am.push(String(alt.season));
          if (alt.seasonYear) am.push(String(alt.seasonYear));
          if (typeof alt.episodes === 'number') am.push(`${alt.episodes} ep`);
          altMeta.textContent = am.join(' • ');

          altRow.appendChild(altTitle);
          if (am.length) altRow.appendChild(altMeta);

          // Optionally add quick-action or small thumbnail here in future

          rightBox.appendChild(altRow);
        });

        twoBox.appendChild(leftBox);
        twoBox.appendChild(rightBox);

        body = twoBox;
      } else {
        // existing fallback: single column body
        body = document.createElement('div');
        body.className = 'chronology-body';
        body.appendChild(nTitle);
        body.appendChild(meta);

        // if there are non-special alternatives but no split, still show them as chips
        if (inlineAlts.length === 0 && alternatives.length > 0 && specialAlts.length === 0) {
          const altWrap = document.createElement('div');
          altWrap.className = 'chronology-alternatives';
          alternatives.forEach(alt => {
            const a = document.createElement('div');
            a.className = 'chronology-alternative';
            a.textContent = `Alternative (${alt.relationType || alt.format || 'alt'}): ${alt.title || alt.name || `(id:${alt.id})`}`;
            altWrap.appendChild(a);
          });
          body.appendChild(altWrap);
        }
      }


      // If the next node has alternatives marked as SPIN_OFF or SUMMARY, show a dotted connector
      if (nextNode && Array.isArray(nextNode.alternatives) && nextNode.alternatives.length) {
        const hasSpinOffOrSummary = nextNode.alternatives.some(a => {
          const rt = (a.relationType || '').toString().toUpperCase();
          return rt === 'SPIN_OFF' || rt === 'SUMMARY' || rt === 'SIDE_STORY';
        });
        if (hasSpinOffOrSummary) entry.classList.add('dotted-connector');
      }

      // If this node itself has special alternatives, mark the main entry connector dotted
      if (specialAlts.length > 0) {
        entry.classList.add('dotted-connector');
      }

      entry.appendChild(indexEl);
      entry.appendChild(body);
      content.appendChild(entry);

      // Render special alternatives as their own timeline points (e.g., spin-offs, summaries, side stories)
      if (specialAlts.length > 0) {

        const groupSpecial = document.createElement('div');
        groupSpecial.className = 'chronology-entry-group-special';

        if (nextNode) {
          const sIndex = document.createElement('div');
          sIndex.className = 'chronology-index special';
          sIndex.textContent = '';
          groupSpecial.appendChild(sIndex);
        }
        else {
          const sIndexfinal = document.createElement('div');
          sIndexfinal.className = 'final-dot';
          sIndexfinal.textContent = '';
          groupSpecial.appendChild(sIndexfinal);
        }


        specialAlts.forEach(alt => {

          const sEntry = document.createElement('div');
          sEntry.className = 'chronology-entry chronology-special';

          const sBody = document.createElement('div');
          sBody.className = 'chronology-body';

          const sTitle = document.createElement('div');
          sTitle.className = 'chronology-node-title';
          sTitle.textContent = alt.title || alt.name || `(id:${alt.id})`;

          const sMeta = document.createElement('div');
          sMeta.className = 'chronology-meta';
          const sParts = [];
          if (alt.relationType) sParts.push(alt.relationType);
          if (alt.format) sParts.push(alt.format);
          if (alt.seasonYear) sParts.push(String(alt.seasonYear));
          sMeta.textContent = sParts.join(' • ');

          sBody.appendChild(sTitle);
          if (sParts.length) sBody.appendChild(sMeta);

          sEntry.appendChild(sBody);
          groupSpecial.appendChild(sEntry);

        });
        content.appendChild(groupSpecial);
      }
    }
  }

  panel.appendChild(header);
  panel.appendChild(content);

  // Put panel inside the overlay so flex centering works,
  // then append the overlay to the body.
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
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
