// List page main orchestrator - imports and coordinates all modules

import { state, setSelectedList, setDisplayMode, setListSort, addCustomList, LIST_LABELS } from './core/state.js';
import { loadAllData, setupStorageListener, persistCustomLists } from './core/storage.js';
import { renderList, setActiveNav, closeOpenDropdown } from './lists/listRenderer.js';
import { addToList, syncPopupToInprogress } from './lists/listActions.js';
import { initHomeWidgets, getHwEdit, setHwEdit, renderHomeWidgets } from './widgets/widgetManager.js';

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
  renderList();
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


function initUI() {
  // Sidebar nav
  document.querySelectorAll("#lists-nav .nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      setSelectedList(btn.dataset.list);
      setActiveNav();
      updateListToolbarUI();
      updateEditButton();
      renderList();
    });
  });

  // Search
  document.getElementById("search").addEventListener("input", () => renderList());

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
  const sortSel = document.getElementById('lt-sort');

  if (btnList && btnGrid) {
    btnList.addEventListener('click', () => {
      setDisplayMode('list');
      updateListToolbarUI();
      renderList();
    });
    btnGrid.addEventListener('click', () => {
      setDisplayMode('grid');
      updateListToolbarUI();
      renderList();
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
  const sortSel = document.getElementById('lt-sort');
  if (btnList && btnGrid) {
    const isGrid = state.displayMode === 'grid';
    btnList.setAttribute('aria-pressed', String(!isGrid));
    btnGrid.setAttribute('aria-pressed', String(isGrid));
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

