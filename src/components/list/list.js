// List page main orchestrator - imports and coordinates all modules

import { state, setSelectedList, setDisplayMode, setListSort, addCustomList, removeCustomList, LIST_LABELS } from './core/state.js';
import { loadAllData, setupStorageListener, persistCustomLists } from './core/storage.js';
import { renderList, setActiveNav, closeOpenDropdown, updateDisplayMode } from './lists/listRenderer.js';
import { addToList, syncPopupToInprogress, removeListFromAniLists } from './lists/listActions.js';
import { initHomeWidgets, getHwEdit, setHwEdit, renderHomeWidgets } from './widgets/widgetManager.js';
import { AnilistService } from '../../services/AnilistService.js';

function createNewList() {
  // Generate unique ID and default name
  const timestamp = Date.now();
  const listNumber = state.customLists.length + 1;
  const newList = {
    id: `custom-${timestamp}`,
    name: `Ma liste ${listNumber}`,
    description: ""
  };
  
  // Add to state and persist
  addCustomList(newList);
  state.aniLists[newList.id] = [];
  persistCustomLists(state.customLists);
  
  // Add label for navigation
  LIST_LABELS[newList.id] = {
    title: newList.name,
    sub: newList.description || "Liste personnalisée"
  };
  
  // Render the new list item in sidebar
  renderCustomListsInSidebar();
  
  // Navigate to the new list
  setSelectedList(newList.id);
  setActiveNav();
  updateListToolbarUI();
  updateEditButton();
  updateAniListSearchVisibility();
  renderList();
}

function deleteCustomList(listId) {
  // Remove from state
  removeCustomList(listId);
  
  // Persist changes
  persistCustomLists(state.customLists);
  removeListFromAniLists(listId);
  
  // Re-render sidebar
  renderCustomListsInSidebar();
  
  // Navigate back to home if we were on the deleted list
  if (state.selected === listId) {
    setSelectedList('home');
    setActiveNav();
    updateListToolbarUI();
    updateEditButton();
    updateAniListSearchVisibility();
    renderList();
  }
}

function renderCustomListsInSidebar() {
  const container = document.getElementById('custom-lists-container');
  
  // Clear container
  container.innerHTML = '';
  
  // Add each custom list
  state.customLists.forEach(list => {
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.dataset.list = list.id;
    btn.dataset.custom = 'true';
    btn.setAttribute('aria-label', list.name);
    btn.textContent = list.name;
    
    btn.addEventListener('click', () => {
      setSelectedList(list.id);
      setActiveNav();
      updateListToolbarUI();
      updateEditButton();
      updateAniListSearchVisibility();
      renderList();
    });
    
    container.appendChild(btn);
  });
}

function openEditListModal(list) {
  const modal = document.getElementById("edit-list-modal");
  const nameEl = document.getElementById("edit-list-name");
  const descEl = document.getElementById("edit-list-description");
  
  nameEl.value = list.name;
  descEl.value = list.description || "";
  modal.dataset.listId = list.id;
  modal.showModal();
}

function updateEditButton() {
  const editBtn = document.getElementById('edit-list-btn');
  
  // Check if current list is custom
  const isCustomList = state.customLists.some(list => list.id === state.selected);
  
  if (isCustomList) {
    // Show and enable for custom lists
    editBtn.hidden = false;
    editBtn.disabled = false;
    editBtn.style.opacity = '1';
    editBtn.style.cursor = 'pointer';
  } else {
    // Hide for default lists
    editBtn.hidden = true;
  }
}


// AniList Search functionality
let anilistSearchTimeout;

function initAniListSearch() {
  const searchInput = document.getElementById('anilist-search');
  const searchResults = document.getElementById('anilist-search-results');
  
  if (!searchInput || !searchResults) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    clearTimeout(anilistSearchTimeout);
    
    if (query.length < 2) {
      searchResults.hidden = true;
      return;
    }

    // Show loading
    searchResults.hidden = false;
    searchResults.innerHTML = '<div class="anilist-search-loading">Recherche en cours...</div>';

    anilistSearchTimeout = setTimeout(async () => {
      try {
        const results = await AnilistService.searchAnimes(query, 8);
        
        if (results.length === 0) {
          searchResults.innerHTML = '<div class="anilist-search-empty">Aucun résultat trouvé</div>';
          return;
        }

        searchResults.innerHTML = results.map(anime => `
          <div class="anilist-search-result-item" data-anime='${JSON.stringify({ 
            name: anime.title, 
            link: `https://anilist.co/anime/${anime.id}`,
            cover: anime.cover
          })}'>
            ${anime.cover ? `<img src="${anime.cover}" class="anilist-search-result-cover" alt="${anime.title}">` : ''}
            <div class="anilist-search-result-info">
              <div class="anilist-search-result-title">${anime.title}</div>
              <div class="anilist-search-result-meta">
                ${anime.status ? `<span>${anime.status}</span>` : ''}
                ${anime.startDate?.year ? `<span>${anime.startDate.year}</span>` : ''}
              </div>
            </div>
          </div>
        `).join('');

        // Add click listeners to results
        searchResults.querySelectorAll('.anilist-search-result-item').forEach(item => {
          item.addEventListener('click', () => {
            const animeData = JSON.parse(item.dataset.anime);
            addAnimeToCurrentList(animeData);
            searchInput.value = '';
            searchResults.hidden = true;
          });
        });
      } catch (error) {
        console.error('AniList search error:', error);
        searchResults.innerHTML = '<div class="anilist-search-empty">Erreur lors de la recherche</div>';
      }
    }, 300);
  });

  // Close results when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.hidden = true;
    }
  });
}

function addAnimeToCurrentList(anime) {
  const currentList = state.selected;
  
  // Only add to wishlist or finished
  if (currentList === 'wishlist' || currentList === 'finished') {
    // Add the anime with cached images from AniList
    const animeWithImages = {
      name: anime.name,
      link: anime.link,
      anilistBanner: anime.banner || null,
      anilistImage: anime.cover || null
    };
    addToList(currentList, animeWithImages);
  }
}

function updateAniListSearchVisibility() {
  const searchBar = document.getElementById('anilist-search-bar');
  if (!searchBar) return;
  
  // Show only for wishlist and finished
  if (state.selected === 'wishlist' || state.selected === 'finished') {
    searchBar.hidden = false;
  } else {
    searchBar.hidden = true;
  }
}


function initUI() {
  // Sidebar nav
  document.querySelectorAll("#lists-nav .nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      setSelectedList(btn.dataset.list);
      setActiveNav();
      updateListToolbarUI();
      updateEditButton();
      updateAniListSearchVisibility();
      renderList();
    });
  });

  // Search
  document.getElementById("search").addEventListener("input", () => renderList());

  // AniList Search (for wishlist and finished lists)
  initAniListSearch();

  // Add list button - creates list directly
  const addBtn = document.querySelector('.add-btn');
  if (addBtn) {
    addBtn.addEventListener("click", createNewList);
  }

  // Edit button in page header
  const editListBtn = document.getElementById('edit-list-btn');
  if (editListBtn) {
    editListBtn.addEventListener('click', () => {
      const currentList = state.customLists.find(list => list.id === state.selected);
      if (currentList) {
        openEditListModal(currentList);
      }
    });
  }

  // Edit list modal handlers
  const editModal = document.getElementById("edit-list-modal");
  if (editModal) {
    document.getElementById("edit-list-cancel").addEventListener("click", () => {
      editModal.close();
    });

    const cancelBtn = document.getElementById("edit-list-cancel-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        editModal.close();
      });
    }

    // Delete list button
    const deleteBtn = document.getElementById("delete-list-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        const listId = editModal.dataset.listId;
        const list = state.customLists.find(l => l.id === listId);
        
        if (list && confirm(`Voulez-vous vraiment supprimer la liste "${list.name}" ?`)) {
          deleteCustomList(listId);
          editModal.close();
        }
      });
    }

    document.getElementById("edit-list-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const listId = editModal.dataset.listId;
      const name = document.getElementById("edit-list-name").value.trim();
      const description = document.getElementById("edit-list-description").value.trim();
      
      if (!name) return;
      
      // Update the list
      const listIndex = state.customLists.findIndex(l => l.id === listId);
      if (listIndex !== -1) {
        state.customLists[listIndex].name = name;
        state.customLists[listIndex].description = description;
        
        // Update label
        LIST_LABELS[listId] = {
          title: name,
          sub: description || "Liste personnalisée"
        };
        
        persistCustomLists(state.customLists);
        renderCustomListsInSidebar();
        
        // Update header if we're currently on this list
        if (state.selected === listId) {
          setActiveNav();
        }
      }
      
      editModal.close();
    });
  }

  // List toolbar events

  const btnList = document.getElementById('btn-dispo-list');
  const btnGrid = document.getElementById('btn-dispo-grid');
  const btnMixte = document.getElementById('btn-dispo-mixte');
  const sortSel = document.getElementById('lt-sort');

  if (btnList && btnGrid) {
    btnList.addEventListener('click', () => {
      setDisplayMode('list');
      updateListToolbarUI();
      updateDisplayMode();
    });
    btnGrid.addEventListener('click', () => {
      setDisplayMode('grid');
      updateListToolbarUI();
      updateDisplayMode();
    });
    btnMixte.addEventListener('click', () => {
      setDisplayMode('mixte');
      updateListToolbarUI();
      updateDisplayMode();
    });
  }

  if (sortSel) {
    sortSel.addEventListener('change', (e) => {
      const val = e.target.value;
      setListSort(val);
      renderList();
    });
  }
}

function updateListToolbarUI() {
  const btnList = document.getElementById('btn-dispo-list');
  const btnGrid = document.getElementById('btn-dispo-grid');
  const btnMixte = document.getElementById('btn-dispo-mixte');
  const sortSel = document.getElementById('lt-sort');
  if (btnList && btnGrid && btnMixte) {
    btnList.setAttribute('aria-pressed', String(state.displayMode === 'list'));
    btnGrid.setAttribute('aria-pressed', String(state.displayMode === 'grid'));
    btnMixte.setAttribute('aria-pressed', String(state.displayMode === 'mixte'));
  }
  if (sortSel) {
    sortSel.value = state.listSort;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initUI();
  setActiveNav();
  updateListToolbarUI();
  updateEditButton();
  updateAniListSearchVisibility();
  
  // Load data first, THEN initialize widgets so they have data to render
  loadAllData(() => {
    syncPopupToInprogress();
    renderCustomListsInSidebar();
    renderList();
    
    // Initialize widgets AFTER data is loaded
    initHomeWidgets();
  });
  
  // Global event listeners
  document.addEventListener('click', () => closeOpenDropdown());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeOpenDropdown();
      // Exit edit mode if active
      if (getHwEdit()) {
        setHwEdit(false);
        document.getElementById('wg-toggle-edit')?.setAttribute('aria-pressed', 'false');
        renderHomeWidgets();
      }
    }
  });

  // Setup storage listeners
  setupStorageListener(
    () => {
      syncPopupToInprogress();
      if (state.selected === "all") renderList();
      // Re-render widgets when data changes
      renderHomeWidgets();
    },
    () => {
      if (state.selected !== "all") renderList();
      // Re-render widgets when data changes
      renderHomeWidgets();
    }
  );
});

