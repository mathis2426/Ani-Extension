// List page main orchestrator - imports and coordinates all modules

import { state, setSelectedList } from './core/state.js';
import { loadAllData, setupStorageListener } from './core/storage.js';
import { renderList, setActiveNav, closeOpenDropdown } from './lists/listRenderer.js';
import { addToList, syncPopupToInprogress } from './lists/listActions.js';
import { initHomeWidgets, getHwEdit, setHwEdit, renderHomeWidgets } from './widgets/widgetManager.js';

function openAddModal() {
  const modal = document.getElementById("add-modal");
  const nameEl = document.getElementById("add-name");
  const linkEl = document.getElementById("add-link");
  if (state.selected === "all") return;
  nameEl.value = "";
  linkEl.value = "";
  modal.showModal();
}

function initUI() {
  // Sidebar nav
  document.querySelectorAll("#lists-nav .nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      setSelectedList(btn.dataset.list);
      setActiveNav();
      renderList();
    });
  });

  // Search
  document.getElementById("search").addEventListener("input", () => renderList());

  // Add item flow
  document.getElementById("add-item-btn").addEventListener("click", openAddModal);
  document.getElementById("cancel-add").addEventListener("click", () => document.getElementById("add-modal").close());

  document.getElementById("add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.selected === "all") return;
    const name = document.getElementById("add-name").value.trim();
    const link = document.getElementById("add-link").value.trim();
    if (!name) return;
    addToList(state.selected, { name, link });
    document.getElementById("add-modal").close();
    renderList();
  });
}

window.addEventListener("DOMContentLoaded", () => {
  initUI();
  setActiveNav();
  
  loadAllData(() => {
    syncPopupToInprogress();
    renderList();
  });
  
  initHomeWidgets();
  
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
    },
    () => {
      if (state.selected !== "all") renderList();
    }
  );
});

