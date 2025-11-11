// Widget interactions: drag, resize, long press, keyboard

import { HW_COLS, HW_ROW_H, setRowHeight, clampHw, placeHw, resolveHwCollisionsCascade, packHwLayoutLive, hwApplyDelta } from './widgetLayout.js';

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

export function startHwPointer(e, type, w, el, hwEdit, hwLayout) {
  if (!hwEdit) return;
  e.preventDefault();
  el.setPointerCapture(e.pointerId);
  
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
    initialLayout
  };
  
  el.setAttribute('aria-grabbed', 'true');
  el.classList.add('dragging');
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
  
  if (hwPointer.type === 'move') {
    w.col = clampHw(hwPointer.startCol + dCols, 1, HW_COLS - w.w + 1);
    w.row = clampHw(hwPointer.startRow + dRows, 1, 999);
  } else {
    w.w = clampHw(hwPointer.startW + dCols, 2, HW_COLS - w.col + 1);
    w.h = clampHw(hwPointer.startH + dRows, 2, 30);
  }
  
  placeHw(hwPointer.el, w);
  resolveHwCollisionsCascade(w, hwLayout);
  packHwLayoutLive(w, hwLayout);
  updatePositionsFn(w.id);
}

export function onHwPointerUp(e, hwLayout, updatePositionsFn, saveFn) {
  if (!hwPointer) return;
  const w = hwLayout.find(x => x.id === hwPointer.id);
  
  if (w) {
    const backToStart = (hwPointer.type === 'move' && w.col === hwPointer.startCol && w.row === hwPointer.startRow) ||
                        (hwPointer.type === 'resize' && w.w === hwPointer.startW && w.h === hwPointer.startH);
    
    if (backToStart) {
      for (const snapshot of hwPointer.initialLayout) {
        const widget = hwLayout.find(x => x.id === snapshot.id);
        if (widget) {
          widget.col = snapshot.col;
          widget.row = snapshot.row;
          widget.w = snapshot.w;
          widget.h = snapshot.h;
        }
      }
      updatePositionsFn();
    } else {
      resolveHwCollisionsCascade(w, hwLayout);
      const { packHwLayout } = require('./widgetLayout.js');
      packHwLayout(hwLayout);
      updatePositionsFn();
    }
    saveFn();
  }
  
  try { hwPointer.el.releasePointerCapture(hwPointer.pointerId); } catch {}
  hwPointer.el.classList.remove('dragging');
  hwPointer.el.setAttribute('aria-grabbed', 'false');
  hwPointer = null;
}

export function onHwPointerCancel(e) {
  if (!hwPointer) return;
  try { hwPointer.el.releasePointerCapture(hwPointer.pointerId); } catch {}
  hwPointer.el.classList.remove('dragging');
  hwPointer.el.setAttribute('aria-grabbed', 'false');
  hwPointer = null;
}
