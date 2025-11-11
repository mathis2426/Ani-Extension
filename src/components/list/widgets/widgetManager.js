// Main widget manager - orchestrates all widget functionality

import { HW_COLS, computeSquareRowHeight, placeHw, packHwLayout, resolveHwCollisionsCascade, findHwFirstSpot, sanitizeHwLayout, hwApplyDelta } from './widgetLayout.js';
import { attachHwInteractions, setupLongPress, startHwPointer, onHwPointerMove, onHwPointerUp, onHwPointerCancel, setHwPointer } from './widgetInteractions.js';
import { WIDGET_TYPES, openWidgetPanel, closeWidgetPanel, bindPanelControls } from './widgetPanel.js';

const HW_STORAGE_KEY = 'ani_home_widgets_v1';
let hwLayout = loadHwLayout() || [];
let hwEdit = false;
let hwSaveTimer = 0;

function loadHwLayout() {
  try { return JSON.parse(localStorage.getItem(HW_STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveHwLayout() {
  if (hwSaveTimer) clearTimeout(hwSaveTimer);
  hwSaveTimer = setTimeout(() => localStorage.setItem(HW_STORAGE_KEY, JSON.stringify(hwLayout)), 300);
}

export function initHomeWidgets() {
  const grid = document.getElementById('wg-grid');
  if (!grid) return;
  
  grid.style.setProperty('--wg-cols', HW_COLS);
  computeSquareRowHeight(grid);
  observeGridResize(grid);
  renderHomeWidgets();
  bindHomeToolbar();
  
  window.addEventListener('pointermove', (e) => onHwPointerMove(e, hwLayout, updateAllWidgetPositions));
  window.addEventListener('pointerup', (e) => onHwPointerUp(e, hwLayout, updateAllWidgetPositions, saveHwLayout));
  window.addEventListener('pointercancel', onHwPointerCancel);
  
  // Listen for delete events
  document.addEventListener('widget-delete', (e) => {
    deleteHwWidget(e.detail.id);
  });
}

function observeGridResize(grid) {
  const ro = new ResizeObserver(() => {
    computeSquareRowHeight(grid);
    const nodes = grid.querySelectorAll('.wg-widget');
    nodes.forEach(node => {
      const id = node.dataset.id;
      const w = hwLayout.find(x => x.id === id);
      if (w) placeHw(node, w);
    });
  });
  ro.observe(grid);
}

export function toggleHwEdit() {
  hwEdit = !hwEdit;
  document.getElementById('wg-toggle-edit').setAttribute('aria-pressed', String(hwEdit));
  renderHomeWidgets();
}

function addHwWidget() {
  const id = 'hw_' + Math.random().toString(36).slice(2, 9);
  const dims = { w: 2, h: 2 };
  const spot = findHwFirstSpot(dims.w, dims.h, hwLayout);
  const widget = { id, title: 'Widget', content: '', type: 'empty', col: spot.col, row: spot.row, w: dims.w, h: dims.h };
  hwLayout.push(widget);
  resolveHwCollisionsCascade(widget, hwLayout);
  packHwLayout(hwLayout);
  saveHwLayout();
  renderHomeWidgets();
  openWidgetPanel(widget, selectWidgetType);
}

function exportHwJson() {
  const blob = new Blob([JSON.stringify(hwLayout, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ani-home-widgets.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importHwJson(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (Array.isArray(d)) {
        hwLayout = d;
        sanitizeHwLayout(hwLayout);
        const ordered = [...hwLayout].sort((a, b) => (a.row - b.row) || (a.col - b.col));
        for (const w of ordered) { resolveHwCollisionsCascade(w, hwLayout); }
        packHwLayout(hwLayout);
        saveHwLayout();
        renderHomeWidgets();
      }
    } catch {}
  };
  r.readAsText(file);
}

export function renderHomeWidgets() {
  const grid = document.getElementById('wg-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const w of hwLayout) grid.appendChild(createHwNode(w));
}

function createHwNode(w) {
  const el = document.createElement('div');
  el.className = 'wg-widget';
  el.tabIndex = 0;
  el.setAttribute('role', 'gridcell');
  el.setAttribute('aria-roledescription', 'widget');
  el.setAttribute('aria-label', w.title || 'Widget');
  el.dataset.id = w.id;
  placeHw(el, w);
  
  let content = `<div class="wg-widget-content" style="${hwEdit ? 'cursor:grab;' : ''}">${w.content || ''}</div>`;
  
  if (hwEdit) {
    content += `
      <button class="wg-delete" aria-label="Supprimer" title="Supprimer"></button>
      <div class="wg-resize" aria-hidden="true"></div>
    `;
  }
  
  if (!w.type || w.type === 'empty') {
    content += `<button class="wg-select-type" aria-label="Choisir un type de widget" title="Choisir un type de widget"></button>`;
  }
  
  el.innerHTML = content;
  
  if (hwEdit) {
    attachHwInteractions(el, w, hwEdit, (e, type, widget, element) => {
      startHwPointer(e, type, widget, element, hwEdit, hwLayout);
    });
  }
  
  setupLongPress(el, w, hwEdit, handleLongPress);
  
  const selectBtn = el.querySelector('.wg-select-type');
  if (selectBtn) {
    selectBtn.addEventListener('click', e => {
      e.stopPropagation();
      openWidgetPanel(w, selectWidgetType);
    });
  }
  
  el.addEventListener('keydown', e => {
    if (e.key === 'Delete' || e.key === 'Suppr') {
      e.preventDefault();
      deleteHwWidget(w.id);
      return;
    }
    
    if (!hwEdit) return;
    let dx = 0, dy = 0, dw = 0, dh = 0;
    if (e.key === 'ArrowLeft') { if (e.shiftKey) dw = -1; else dx = -1; }
    if (e.key === 'ArrowRight') { if (e.shiftKey) dw = 1; else dx = 1; }
    if (e.key === 'ArrowUp') { if (e.shiftKey) dh = -1; else dy = -1; }
    if (e.key === 'ArrowDown') { if (e.shiftKey) dh = 1; else dy = 1; }
    if (dx || dy || dw || dh) {
      e.preventDefault();
      hwApplyDelta(w, { dx, dy, dw, dh });
      resolveHwCollisionsCascade(w, hwLayout);
      packHwLayout(hwLayout);
      updateAllWidgetPositions();
      saveHwLayout();
    }
  });
  
  return el;
}

function handleLongPress(w, el, pressStartX, pressStartY, pressStartEvent) {
  hwEdit = true;
  document.getElementById('wg-toggle-edit').setAttribute('aria-pressed', 'true');
  renderHomeWidgets();
  
  requestAnimationFrame(() => {
    const grid = document.getElementById('wg-grid');
    const newEl = grid?.querySelector(`[data-id="${w.id}"]`);
    if (newEl) {
      newEl.style.transform = 'scale(0.98)';
      setTimeout(() => { newEl.style.transform = ''; }, 150);
      
      const content = newEl.querySelector('.wg-widget-content');
      if (content) {
        const syntheticEvent = new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          clientX: pressStartX,
          clientY: pressStartY,
          pointerId: pressStartEvent.pointerId,
          pointerType: pressStartEvent.pointerType,
          isPrimary: pressStartEvent.isPrimary
        });
        content.dispatchEvent(syntheticEvent);
      }
    }
  });
}

function deleteHwWidget(id) {
  const idx = hwLayout.findIndex(w => w.id === id);
  if (idx === -1) return;
  
  const grid = document.getElementById('wg-grid');
  const widgetEl = grid?.querySelector(`[data-id="${id}"]`);
  if (widgetEl) {
    widgetEl.classList.add('deleting');
    setTimeout(() => {
      hwLayout.splice(idx, 1);
      packHwLayout(hwLayout);
      saveHwLayout();
      renderHomeWidgets();
    }, 250);
  } else {
    hwLayout.splice(idx, 1);
    packHwLayout(hwLayout);
    saveHwLayout();
    renderHomeWidgets();
  }
}

function selectWidgetType(typeKey, widget) {
  if (!widget) return;
  const type = WIDGET_TYPES[typeKey];
  if (!type) return;
  
  widget.type = typeKey;
  widget.title = type.name;
  widget.content = type.render(widget);
  
  saveHwLayout();
  renderHomeWidgets();
}

function updateAllWidgetPositions(activeId) {
  const grid = document.getElementById('wg-grid');
  if (!grid) return;
  const nodes = Array.from(grid.querySelectorAll('.wg-widget'));
  
  const firstRects = new Map();
  for (const node of nodes) {
    firstRects.set(node.dataset.id, node.getBoundingClientRect());
  }
  
  for (const node of nodes) {
    const id = node.dataset.id;
    const w = hwLayout.find(x => x.id === id);
    if (w) placeHw(node, w);
  }
  
  for (const node of nodes) {
    const id = node.dataset.id;
    if (id === activeId) {
      node.style.transform = '';
      continue;
    }
    const first = firstRects.get(id);
    const last = node.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      node.style.transition = 'none';
      node.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        node.style.transition = 'transform 160ms ease, box-shadow .18s';
        node.style.transform = '';
        const onEnd = () => { node.style.transition = ''; node.removeEventListener('transitionend', onEnd); };
        node.addEventListener('transitionend', onEnd);
      });
    }
  }
}

function bindHomeToolbar() {
  const g = id => document.getElementById(id);
  g('wg-toggle-edit').addEventListener('click', toggleHwEdit);
  g('wg-add-widget').addEventListener('click', addHwWidget);
  g('wg-export').addEventListener('click', exportHwJson);
  g('wg-import').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (f) importHwJson(f);
    e.target.value = '';
  });
  
  bindPanelControls();
}

export function getHwEdit() {
  return hwEdit;
}

export function setHwEdit(value) {
  hwEdit = value;
}
