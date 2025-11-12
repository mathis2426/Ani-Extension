// Widget interactions: drag, resize, long press, keyboard

import { HW_COLS, HW_ROW_H, setRowHeight, clampHw, placeHw, hwOverlap } from './widgetLayout.js';

// Cache for widget types to avoid repeated imports
let WIDGET_TYPES_CACHE = null;

// Synchronous update widget content using cached types
function updateWidgetContent(el, widget) {
  if (!widget.type || widget.type === 'empty' || !WIDGET_TYPES_CACHE) return;
  
  const widgetType = WIDGET_TYPES_CACHE[widget.type];
  if (!widgetType) return;
  
  const contentEl = el.querySelector('.wg-widget-content');
  if (contentEl) {
    contentEl.innerHTML = widgetType.render(widget);
  }
}

// Load widget types once at startup
(async function initWidgetTypes() {
  const module = await import('./types/index.js');
  WIDGET_TYPES_CACHE = module.WIDGET_TYPES;
})();

export let hwPointer = null;
export let longPressTimer = null;
export let longPressTarget = null;

export function setHwPointer(pointer) {
  hwPointer = pointer;
}

export function attachHwInteractions(el, w, hwEdit, startHwPointerFn) {
  el.setAttribute('aria-grabbed', 'false');
  const content = el.querySelector('.wg-widget-content');
  const resize = el.querySelector('.wg-resize');
  const deleteBtn = el.querySelector('.wg-delete');
  
  if (content) {
    content.addEventListener('pointerdown', e => {
      if (e.target.closest('.wg-select-type')) return;
      startHwPointerFn(e, 'move', w, el);
    });
  }
  
  if (resize) {
    resize.addEventListener('pointerdown', e => startHwPointerFn(e, 'resize', w, el));
  }
  
  if (deleteBtn) {
    deleteBtn.addEventListener('click', e => {
      e.stopPropagation();
      // Will be handled by widgetManager
      const event = new CustomEvent('widget-delete', { detail: { id: w.id } });
      document.dispatchEvent(event);
    });
  }
}

export function setupLongPress(el, w, hwEdit, onLongPress) {
  let pressStartTime = 0;
  let pressStartX = 0;
  let pressStartY = 0;
  let pressStartEvent = null;
  let preventDefaultApplied = false;
  
  const onPointerDown = (e) => {
    if (hwEdit || e.target.closest('.wg-select-type') || e.target.closest('.wg-delete') || e.target.closest('.wg-resize')) return;
    
    pressStartTime = Date.now();
    pressStartX = e.clientX;
    pressStartY = e.clientY;
    pressStartEvent = e;
    longPressTarget = el;
    preventDefaultApplied = false;
    
    if (longPressTimer) clearTimeout(longPressTimer);
    
    longPressTimer = setTimeout(() => {
      const deltaX = Math.abs(pressStartEvent.clientX - pressStartX);
      const deltaY = Math.abs(pressStartEvent.clientY - pressStartY);
      
      if (deltaX < 10 && deltaY < 10 && !hwEdit) {
        preventDefaultApplied = true;
        if (onLongPress) onLongPress(w, el, pressStartX, pressStartY, pressStartEvent);
      }
      longPressTimer = null;
      longPressTarget = null;
    }, 500);
  };
  
  const onPointerMove = (e) => {
    if (!longPressTimer) return;
    if (preventDefaultApplied) e.preventDefault();
    const deltaX = Math.abs(e.clientX - pressStartX);
    const deltaY = Math.abs(e.clientY - pressStartY);
    if (deltaX > 10 || deltaY > 10) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      longPressTarget = null;
      preventDefaultApplied = false;
    }
  };
  
  const onPointerUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      longPressTarget = null;
      preventDefaultApplied = false;
    }
  };
  
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
}

// Pointer drag start for edit mode
export function startHwPointer(e, type, w, el, hwEdit, hwLayout) {
  if (!hwEdit) return;
  e.preventDefault();
  e.stopPropagation();
  try { el.setPointerCapture(e.pointerId); } catch {}
  const initialLayout = hwLayout.map(widget => ({
    id: widget.id,
    col: widget.col,
    row: widget.row,
    w: widget.w,
    h: widget.h
  }));
  hwPointer = {
    type,
    id: w.id,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    startCol: w.col,
    startRow: w.row,
    startW: w.w,
    startH: w.h,
    el,
    initialLayout,
    lastValidCol: w.col,
    lastValidRow: w.row,
    lastValidW: w.w,
    lastValidH: w.h
  };
  el.setAttribute('aria-grabbed','true');
  el.classList.add('dragging');

  // Local safety listeners in case global pointerup is missed
  const endHandler = () => {
    if (!hwPointer) return;
    cleanupDragState();
    el.removeEventListener('pointerup', endHandler);
    el.removeEventListener('pointercancel', endHandler);
  };
  el.addEventListener('pointerup', endHandler);
  el.addEventListener('pointercancel', endHandler);
}

export function onHwPointerMove(e, hwLayout, updatePositionsFn) {
  if (!hwPointer) return;
  const w = hwLayout.find(x => x.id === hwPointer.id);
  if (!w) return;
  
  const grid = document.getElementById('wg-grid');
  const rect = grid.getBoundingClientRect();
  const cs = getComputedStyle(grid);
  const colGap = parseFloat(cs.columnGap || cs.gap || '0') || 0;
  const rowGap = colGap;
  const trackW = (rect.width - colGap * (HW_COLS - 1)) / HW_COLS;
  
  setRowHeight(trackW);
  grid.style.setProperty('--wg-row-h', HW_ROW_H + 'px');
  
  const segW = trackW + colGap;
  const segH = HW_ROW_H + rowGap;
  const dxPx = e.clientX - hwPointer.startX;
  const dyPx = e.clientY - hwPointer.startY;
  const dCols = Math.round(dxPx / segW);
  const dRows = Math.round(dyPx / segH);
  
  const isMove = hwPointer.type === 'move';
  let candCol = w.col;
  let candRow = w.row;
  let candW = w.w;
  let candH = w.h;
  if (isMove) {
    candCol = clampHw(hwPointer.startCol + dCols, 1, HW_COLS - w.w + 1);
    candRow = clampHw(hwPointer.startRow + dRows, 1, 999);
  } else {
    candW = clampHw(hwPointer.startW + dCols, 2, HW_COLS - w.col + 1);
    candH = clampHw(hwPointer.startH + dRows, 2, 30);
  }

  const test = { col: candCol, row: candRow, w: candW, h: candH };
  let collided = null;
  for (const o of hwLayout) {
    if (o === w) continue;
    if (hwOverlap(test, o)) { collided = o; break; }
  }

  if (!collided) {
    // appliquer le candidat
    const prevW = w.w;
    const prevH = w.h;
    
    w.col = candCol;
    w.row = candRow;
    w.w = candW;
    w.h = candH;
    hwPointer.lastValidCol = w.col;
    hwPointer.lastValidRow = w.row;
    hwPointer.lastValidW = w.w;
    hwPointer.lastValidH = w.h;
    placeHw(hwPointer.el, w);
    
    // Re-render widget content if size changed (compare with previous frame, not start)
    if (!isMove && (candW !== prevW || candH !== prevH)) {
      updateWidgetContent(hwPointer.el, w);
    }
  } else {
    // Collision détectée
    // Règle: le swap n'est autorisé que si l'utilisateur place exactement le widget sur la position de l'autre (cand == collided pos)
    if (isMove && w.w === collided.w && w.h === collided.h && candCol === collided.col && candRow === collided.row) {
      const originalPos = { col: w.col, row: w.row };
      const targetPos = { col: collided.col, row: collided.row };
      // Vérifier que déplacer l'autre aux coordonnées originales ne crée pas de collision
      const otherTest = { col: originalPos.col, row: originalPos.row, w: collided.w, h: collided.h };
      const otherWouldCollide = hwLayout.some(o => o !== w && o !== collided && hwOverlap(otherTest, o));
      if (!otherWouldCollide) {
        // Effectuer le swap
        w.col = targetPos.col;
        w.row = targetPos.row;
        collided.col = originalPos.col;
        collided.row = originalPos.row;
        hwPointer.lastValidCol = w.col;
        hwPointer.lastValidRow = w.row;
        placeHw(hwPointer.el, w);
        const collidedEl = document.querySelector(`#wg-grid .wg-widget[data-id="${collided.id}"]`);
        if (collidedEl) placeHw(collidedEl, collided);
      } else {
        // Swap impossible, rester à la dernière position valide
        placeHw(hwPointer.el, { col: hwPointer.lastValidCol, row: hwPointer.lastValidRow, w: hwPointer.lastValidW, h: hwPointer.lastValidH });
      }
    } else {
      // Pas de swap: rester à la dernière position valide
      placeHw(hwPointer.el, { col: hwPointer.lastValidCol, row: hwPointer.lastValidRow, w: hwPointer.lastValidW, h: hwPointer.lastValidH });
    }
  }
}

export function onHwPointerUp(e, hwLayout, updatePositionsFn, saveFn) {
  if (!hwPointer) return;
  const w = hwLayout.find(x => x.id === hwPointer.id);
  const wasResize = hwPointer.type === 'resize';
  const sizeChanged = wasResize && w && (
    w.w !== hwPointer.startW || 
    w.h !== hwPointer.startH
  );
  
  if (w) {
    // ne pas déplacer d'autres widgets à la fin; juste sauvegarder et mettre à jour
    updatePositionsFn();
    saveFn();
  }
  cleanupDragState();
  
  // Re-render widget if size changed to update adaptive layout
  if (sizeChanged && w) {
    // Import render function dynamically to avoid circular dependency
    import('./widgetManager.js').then(({ renderHomeWidgets }) => {
      renderHomeWidgets();
    });
  }
}

export function onHwPointerCancel(e) {
  if (!hwPointer) return;
  cleanupDragState();
}

function cleanupDragState() {
  if (!hwPointer) return;
  
  try { 
    hwPointer.el.releasePointerCapture(hwPointer.pointerId); 
  } catch (err) {
    // Ignorer les erreurs de releasePointerCapture
  }
  
  hwPointer.el.classList.remove('dragging');
  hwPointer.el.setAttribute('aria-grabbed', 'false');
  hwPointer = null;
}

// Explicit export to allow external forced termination
export function forceEndHwDrag() {
  if (hwPointer) cleanupDragState();
}
