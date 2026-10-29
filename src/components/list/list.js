import {
  createList,
  getcreateStoredLists,
  getListItems,
  removeList,
  renameList,
} from './core/storage.js';
import { initHomeWidgets } from './widgets/widgetManager.js';
import { AnilistService } from '../../services/AnilistService.js';
import { loadPopupData } from './core/state.js';
import {
  addAnilistAnimeToList,
  getListItemSyncKey,
  removeAnimeFromList,
  resumePendingChronologies,
} from './lists/listActions.js';
import {
  fetchInProgressChronology,
  getInProgressItemsMissingChronology,
  getInProgressSyncKey,
  loadInProgressItems,
} from './lists/inProgressService.js';
import { enqueueJob, getActivity, getJobState, retryJob, subscribe } from './lists/syncQueue.js';
import {
  closeChronologyModal,
  formatStatus,
  getVisibleItems,
  renderChronologyModal,
  renderListItems,
} from './lists/listRenderer.js';

const BUILT_IN_LISTS = ['wishlist', 'inprogress', 'finished'];
const LIST_LABELS = {
  home: 'Accueil',
  wishlist: 'Wishlist',
  inprogress: 'En cours',
  finished: 'Terminés',
};
const LIST_SUBTITLES = {
  home: 'Tableau de bord',
  wishlist: 'Animés à regarder plus tard',
  inprogress: 'Animés en cours de visionnage',
  finished: 'Animés terminés',
};

const state = {
  lists: [],
  currentList: 'home',
  displayMode: 'list',
  sortMode: 'name-asc',
  query: '',
  items: [],
  anilistTimer: 0,
  anilistResults: [],
  anilistSearchId: 0,
};

const els = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheElements();
  bindStaticControls();
  await loadPopupData();
  initHomeWidgets();

  state.lists = await getcreateStoredLists();
  wireBuiltInListButtons();
  renderListsNav();
  await selectList('home');

  // Background AniList work: starts right away, whatever list is displayed
  subscribe(handleSyncEvent);
  resumePendingChronologies();
  queueInProgressHydration();
}

function cacheElements() {
  els.nav = document.getElementById('lists-nav');
  els.customLists = document.getElementById('custom-lists-container');
  els.addListBtn = document.getElementById('add-list-btn');
  els.title = document.getElementById('current-list-title');
  els.subtitle = document.getElementById('current-list-sub');
  els.search = document.getElementById('search');
  els.homeSection = document.getElementById('home-section');
  els.listSection = document.getElementById('list-section');
  els.list = document.getElementById('list');
  els.empty = document.getElementById('empty');
  els.editBtn = document.getElementById('edit-list-btn');
  els.editModal = document.getElementById('edit-list-modal');
  els.editForm = document.getElementById('edit-list-form');
  els.editName = document.getElementById('edit-list-name');
  els.editDescription = document.getElementById('edit-list-description');
  els.editCancel = document.getElementById('edit-list-cancel');
  els.editCancelBtn = document.getElementById('edit-list-cancel-btn');
  els.deleteListBtn = document.getElementById('delete-list-btn');
  els.sort = document.getElementById('lt-sort');
  els.anilistBar = document.getElementById('anilist-search-bar');
  els.anilistSearch = document.getElementById('anilist-search');
  els.anilistClear = document.getElementById('anilist-search-clear');
  els.anilistResults = document.getElementById('anilist-search-results');
  els.anilistFiltersBtn = document.getElementById('anilist-search-filters-btn');
  els.anilistFiltersPanel = document.getElementById('anilist-search-filters-panel');
  els.anilistSort = document.getElementById('anilist-sort');
  els.syncActivity = document.getElementById('sync-activity');
  els.syncActivityTitle = document.getElementById('sync-activity-title');
  els.syncActivitySub = document.getElementById('sync-activity-sub');
  els.toasts = document.getElementById('toasts');
}

function bindStaticControls() {
  els.addListBtn?.addEventListener('click', openCreateListPopup);
  els.nav?.addEventListener('click', handleNavClick);
  els.search?.addEventListener('input', () => {
    state.query = els.search.value.trim().toLowerCase();
    renderItems();
  });

  document.querySelectorAll('.lt-btn[id^="btn-dispo-"]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.id.replace('btn-dispo-', '');
      setDisplayMode(mode === 'grid' || mode === 'mixte' ? mode : 'list');
    });
  });

  els.sort?.addEventListener('change', () => {
    state.sortMode = els.sort.value;
    renderItems();
  });

  els.editBtn?.addEventListener('click', openEditListModal);
  els.editCancel?.addEventListener('click', closeEditListModal);
  els.editCancelBtn?.addEventListener('click', closeEditListModal);
  els.editForm?.addEventListener('submit', saveEditedList);
  els.deleteListBtn?.addEventListener('click', deleteCurrentList);

  els.anilistSearch?.addEventListener('input', handleAnilistSearchInput);
  els.anilistClear?.addEventListener('click', clearAnilistSearch);
  els.anilistResults?.addEventListener('click', handleAnilistResultClick);
  els.anilistFiltersBtn?.addEventListener('click', toggleAnilistFilters);
  els.anilistSort?.addEventListener('change', () => {
    if (els.anilistSearch.value.trim().length >= 2) searchAnilist(els.anilistSearch.value.trim());
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCreateListPopup();
      closeEditListModal();
      closeChronologyModal();
      hideAnilistResults();
    }
  });

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(async (changes, area) => {
      if (area !== 'sync' || !changes.popupDataList) return;
      // A new anime may have started: look it up in the background
      queueInProgressHydration();
      if (state.currentList !== 'inprogress') return;
      state.items = await loadInProgressItems();
      renderItems();
    });
  }
}

function wireBuiltInListButtons() {
  const buttons = Array.from(document.querySelectorAll('#lists-scrollable-container > .nav-item'));
  buttons.forEach((button, index) => {
    const listName = BUILT_IN_LISTS[index];
    if (!listName) return;
    button.dataset.list = listName;
    button.textContent = LIST_LABELS[listName];
  });
}

async function handleNavClick(event) {
  const button = event.target.closest('[data-list]');
  if (!button) return;
  await selectList(button.dataset.list);
}

async function selectList(listName) {
  state.currentList = listName;
  state.query = '';
  if (els.search) els.search.value = '';

  const isHome = listName === 'home';
  els.homeSection.hidden = !isHome;
  els.listSection.hidden = isHome;
  els.list.hidden = isHome;
  els.empty.hidden = true;
  els.anilistBar.hidden = isHome || listName === 'inprogress';
  els.search.hidden = isHome;
  els.editBtn.hidden = isHome || BUILT_IN_LISTS.includes(listName);

  setActiveNavItem(listName);
  updateHeader();
  clearAnilistSearch();

  if (isHome) {
    state.items = [];
    els.list.innerHTML = '';
    return;
  }

  state.items = listName === 'inprogress'
    ? await loadInProgressItems()
    : await getListItems(listName);
  renderItems();
}

function setActiveNavItem(listName) {
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.classList.toggle('active', button.dataset.list === listName);
  });
}

function updateHeader() {
  const label = getListLabel(state.currentList);
  els.title.textContent = label;
  const count = state.items.length;
  els.subtitle.textContent = LIST_SUBTITLES[state.currentList] || (count ? `${count} anime${count > 1 ? 's' : ''}` : 'Liste vide');
}

function renderListsNav() {
  if (!els.customLists) return;
  els.customLists.innerHTML = '';

  state.lists
    .filter((listName) => !BUILT_IN_LISTS.includes(listName))
    .forEach((listName) => {
      const button = document.createElement('button');
      button.className = 'nav-item custom-list-item';
      button.dataset.list = listName;
      button.type = 'button';
      button.textContent = getListLabel(listName);
      els.customLists.appendChild(button);
    });
}

function renderItems() {
  const items = getVisibleItems(state.items, state.query, state.sortMode);
  updateToolbarMode();
  updateHeader();

  renderListItems({
    container: els.list,
    empty: els.empty,
    items,
    displayMode: state.displayMode,
    currentList: state.currentList,
    onItemClick: (item) => renderChronologyModal(item, getItemSyncState(item)),
    onRemoveClick: removeRenderedItem,
    onRetryClick: (item) => retryJob(getItemSyncKey(item)),
    getSyncState: getItemSyncState,
    canRemove: state.currentList !== 'inprogress',
  });
  updateEmptyHint();
}

function updateEmptyHint() {
  const hint = els.empty?.querySelector('.empty-hint');
  if (!hint) return;
  if (state.query) {
    hint.textContent = 'Aucun résultat pour ce filtre.';
  } else if (state.currentList === 'inprogress') {
    hint.textContent = 'Les animés que tu regardes apparaîtront ici automatiquement.';
  } else {
    hint.textContent = 'Utilise la recherche AniList en haut pour en ajouter.';
  }
}

// ===== Background AniList work =====

function getItemSyncKey(item) {
  if (item.isInProgress) return item.syncKey || null;
  return getListItemSyncKey(state.currentList, item.id);
}

function getItemSyncState(item) {
  const key = getItemSyncKey(item);
  return key ? getJobState(key) : null;
}

async function queueInProgressHydration() {
  const missing = await getInProgressItemsMissingChronology();
  missing.forEach((popupItem) => {
    enqueueJob({
      key: getInProgressSyncKey(popupItem.name),
      kind: 'inprogress',
      label: popupItem.name,
      listName: 'inprogress',
      run: () => fetchInProgressChronology(popupItem),
    });
  });
}

let syncRenderFrame = 0;

async function handleSyncEvent(event) {
  renderSyncActivity();

  const { job } = event;
  const concernsCurrentList = job.listName === state.currentList;

  if (event.type === 'done' && job.kind === 'add') {
    showToast(`« ${job.label} » : chronologie récupérée`);
  }
  if (event.type === 'error' && job.kind === 'add') {
    showToast(`Impossible de récupérer la chronologie de « ${job.label} »`, 'error');
  }

  if (!concernsCurrentList) return;

  if (event.type === 'done') {
    // The item changed in storage: reload the list
    state.items = state.currentList === 'inprogress'
      ? await loadInProgressItems()
      : await getListItems(state.currentList);
  }

  // Several events can arrive at once: render once per frame
  cancelAnimationFrame(syncRenderFrame);
  syncRenderFrame = requestAnimationFrame(renderItems);
}

function renderSyncActivity() {
  if (!els.syncActivity) return;
  const { running, queuedCount } = getActivity();

  if (!running && !queuedCount) {
    els.syncActivity.hidden = true;
    return;
  }

  els.syncActivity.hidden = false;
  els.syncActivityTitle.textContent = running?.kind === 'inprogress'
    ? 'Recherche sur AniList'
    : 'Récupération des chronologies';
  const parts = [];
  if (running) parts.push(running.label);
  if (queuedCount) parts.push(`${queuedCount} en attente`);
  els.syncActivitySub.textContent = parts.join(' · ');
}

function getStorageErrorMessage(error) {
  return /quota/i.test(error?.message || '')
    ? 'Liste pleine : la synchronisation Chrome est limitée, retire quelques animés'
    : "Impossible d'enregistrer la liste";
}

function showToast(message, tone = 'info') {
  if (!els.toasts) return;
  const toast = document.createElement('div');
  toast.className = `toast is-${tone}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  els.toasts.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function setDisplayMode(mode) {
  state.displayMode = mode;
  renderItems();
}

function updateToolbarMode() {
  document.querySelectorAll('.lt-btn[id^="btn-dispo-"]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.id === `btn-dispo-${state.displayMode}`));
  });
}

function openCreateListPopup() {
  closeCreateListPopup();
  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  overlay.innerHTML = `
    <form class="popup-content" id="create-list-form">
      <div class="popup-header">
        <h2>Créer une nouvelle liste</h2>
        <button id="close-popup-btn" class="close-button" type="button" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <input type="text" id="new-list-name" class="inputs" placeholder="Nom de la liste" aria-label="Nom de la liste" maxlength="30" required>
      <div class="popup-buttons">
        <button id="create-list-confirm-btn" class="button" type="submit">Créer</button>
      </div>
    </form>
  `;
  document.body.appendChild(overlay);
  document.getElementById('close-popup-btn')?.addEventListener('click', closeCreateListPopup);
  document.getElementById('create-list-form')?.addEventListener('submit', createNewList);
  document.getElementById('new-list-name')?.focus();
}

async function createNewList(event) {
  event.preventDefault();
  const input = document.getElementById('new-list-name');
  const listName = normalizeListName(input.value);
  if (!listName) return;
  state.lists = await createList(listName);
  renderListsNav();
  closeCreateListPopup();
  await selectList(listName);
}

function closeCreateListPopup() {
  document.querySelector('.popup-overlay')?.remove();
}

function openEditListModal() {
  if (BUILT_IN_LISTS.includes(state.currentList) || state.currentList === 'home') return;
  els.editName.value = getListLabel(state.currentList);
  els.editDescription.value = LIST_SUBTITLES[state.currentList] || '';
  els.editModal.showModal();
  els.editName.focus();
}

function closeEditListModal() {
  if (els.editModal?.open) els.editModal.close();
}

async function saveEditedList(event) {
  event.preventDefault();
  const oldName = state.currentList;
  const newName = normalizeListName(els.editName.value);
  if (!newName) return;

  state.lists = await renameList(oldName, newName);
  renderListsNav();
  closeEditListModal();
  await selectList(state.lists.includes(newName) ? newName : oldName);
}

async function deleteCurrentList() {
  if (BUILT_IN_LISTS.includes(state.currentList) || state.currentList === 'home') return;
  const label = getListLabel(state.currentList);
  const confirmed = window.confirm(`Supprimer la liste "${label}" ?`);
  if (!confirmed) return;

  state.lists = await removeList(state.currentList);
  renderListsNav();
  closeEditListModal();
  await selectList('wishlist');
}

function handleAnilistSearchInput() {
  const query = els.anilistSearch.value.trim();
  els.anilistClear.hidden = !query;
  clearTimeout(state.anilistTimer);

  if (query.length < 2) {
    hideAnilistResults();
    return;
  }

  state.anilistTimer = setTimeout(() => searchAnilist(query), 250);
}

async function searchAnilist(query) {
  const searchId = ++state.anilistSearchId;
  els.anilistResults.hidden = false;
  els.anilistResults.innerHTML = '<div class="anilist-search-loading">Recherche…</div>';

  try {
    // High priority: goes before the background chronology requests
    const results = await AnilistService.searchAnimes(query, 8, getAnilistFilters(), { priority: 'high' });
    // An older search finishing late must not overwrite a newer one
    if (searchId !== state.anilistSearchId || els.anilistResults.hidden) return;
    state.anilistResults = results;
    if (!results.length) {
      els.anilistResults.innerHTML = '<div class="anilist-search-empty">Aucun résultat</div>';
      return;
    }

    els.anilistResults.innerHTML = results.map((anime) => `
      <button class="anilist-search-result-item" type="button" data-anilist-id="${anime.id}">
        ${anime.cover ? `<img class="anilist-search-result-cover" src="${escapeAttribute(anime.cover)}" alt="">` : ''}
        <span class="anilist-search-result-info">
          <strong class="anilist-search-result-title">${escapeHtml(anime.title || 'Sans titre')}</strong>
          <span class="anilist-search-result-meta">${escapeHtml([formatStatus(anime.status), getYear(anime.startDate)].filter(Boolean).join(' · '))}</span>
        </span>
        ${state.items.some((item) => String(item.id) === String(anime.id))
          ? '<span class="anilist-search-result-added">Déjà dans la liste</span>'
          : ''}
      </button>
    `).join('');
  } catch (error) {
    console.warn('AniList search failed', error);
    els.anilistResults.innerHTML = '<div class="anilist-search-empty">Recherche indisponible</div>';
  }
}

async function handleAnilistResultClick(event) {
  const button = event.target.closest('[data-anilist-id]');
  if (!button) return;
  const anime = state.anilistResults.find((result) => String(result.id) === button.dataset.anilistId);
  if (!anime) return;

  const listName = state.currentList;
  clearAnilistSearch();

  // Added immediately; the chronology arrives in the background
  let result;
  try {
    result = await addAnilistAnimeToList(listName, anime);
  } catch (error) {
    console.error('Unable to save list item', error);
    showToast(getStorageErrorMessage(error), 'error');
    return;
  }
  const { items, added } = result;
  if (!added) {
    showToast(`« ${anime.title} » est déjà dans cette liste`);
  }
  if (state.currentList === listName) {
    state.items = items;
    renderItems();
  }
}

async function removeRenderedItem(item) {
  state.items = await removeAnimeFromList(state.currentList, item.id);
  renderItems();
}

function getAnilistFilters() {
  const checked = (name) => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
  return {
    formats: checked('format'),
    statuses: checked('status'),
    sort: els.anilistSort?.value || 'SEARCH_MATCH',
  };
}

function clearAnilistSearch() {
  state.anilistSearchId += 1;
  state.anilistResults = [];
  clearTimeout(state.anilistTimer);
  if (els.anilistSearch) els.anilistSearch.value = '';
  if (els.anilistClear) els.anilistClear.hidden = true;
  hideAnilistResults();
}

function hideAnilistResults() {
  if (els.anilistResults) {
    els.anilistResults.hidden = true;
    els.anilistResults.innerHTML = '';
  }
  if (els.anilistFiltersPanel) els.anilistFiltersPanel.hidden = true;
  if (els.anilistFiltersBtn) els.anilistFiltersBtn.setAttribute('aria-pressed', 'false');
}

function toggleAnilistFilters() {
  const next = !els.anilistFiltersPanel.hidden;
  els.anilistFiltersPanel.hidden = next;
  els.anilistFiltersBtn.setAttribute('aria-pressed', String(!next));
}

function getListLabel(listName) {
  return LIST_LABELS[listName] || listName.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeListName(value) {
  return value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '').slice(0, 30);
}

function getYear(startDate) {
  return startDate?.year || '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
