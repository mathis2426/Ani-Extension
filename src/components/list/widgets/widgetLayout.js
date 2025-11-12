// Widget layout algorithms: packing, collision detection, positioning

export const HW_COLS = 12;
export let HW_ROW_H = 80;

export function setRowHeight(height) {
  HW_ROW_H = height;
}

export function clampHw(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function hwOverlap(a, b) {
  return !(a.col + a.w <= b.col || b.col + b.w <= a.col || a.row + a.h <= b.row || b.row + b.h <= a.row);
}

export function resolveHwCollisionsCascade(active, hwLayout, moveDir = 'right') {
  const queue = [active];
  const visited = new Set();
  
  while (queue.length) {
    const cur = queue.shift();
    const key = cur.id + ':' + cur.row + ':' + cur.col;
    if (visited.has(key)) continue;
    visited.add(key);
    
    for (const w of hwLayout) {
      if (w === cur) continue;
      if (hwOverlap(cur, w)) {
        // For widgets on the same row, try to push them horizontally first
        if (w.row === cur.row && w.col >= cur.col + cur.w - 1) {
          const newCol = cur.col + cur.w;
          if (newCol + w.w - 1 <= HW_COLS) {
            w.col = newCol;
            queue.push(w);
            continue;
          }
        }
        // Otherwise push down
        const targetRow = cur.row + cur.h;
        if (w.row < targetRow) {
          w.row = targetRow;
          queue.push(w);
        }
      }
    }
  }
}

// Désactivé: on ne veut plus de "packing" automatique qui déplace d'autres widgets
export function packHwLayout(hwLayout) {
  return hwLayout;
}

export function packHwLayoutLive(active, hwLayout) {
  return hwLayout;
}

export function findHwFirstSpot(w, h, hwLayout) {
  // scan rows top-down, columns left-right
  for (let r = 1; r < 1000; r++) {
    for (let c = 1; c <= HW_COLS - w + 1; c++) {
      const test = { col: c, row: r, w, h };
      const free = hwLayout.every(o => !hwOverlap(test, o));
      if (free) return { col: c, row: r };
    }
  }
  // fallback: place below the lowest widget
  const maxBottom = hwLayout.reduce((m, o) => Math.max(m, o.row + o.h - 1), 0);
  return { col: 1, row: maxBottom + 1 };
}

export function sanitizeHwLayout(hwLayout) {
  for (const w of hwLayout) {
    w.w = Math.max(2, Math.min(w.w | 0 || 2, HW_COLS)); // min = 2
    w.h = Math.max(2, w.h | 0 || 2); // min = 2
    w.col = Math.max(1, Math.min(w.col | 0 || 1, HW_COLS - w.w + 1));
    w.row = Math.max(1, w.row | 0 || 1);
  }
}

export function hwApplyDelta(w, { dx = 0, dy = 0, dw = 0, dh = 0 }) {
  w.col = clampHw(w.col + dx, 1, HW_COLS - w.w + 1);
  w.row = clampHw(w.row + dy, 1, 999);
  w.w = clampHw(w.w + dw, 2, HW_COLS - w.col + 1); // min width = 2
  w.h = clampHw(w.h + dh, 2, 30); // min height = 2
}

export function placeHw(el, w) {
  el.style.gridColumn = `${w.col} / span ${w.w}`;
  el.style.gridRow = `${w.row} / span ${w.h}`;
}

export function computeSquareRowHeight(grid) {
  const rect = grid.getBoundingClientRect();
  const cs = getComputedStyle(grid);
  const colGap = parseFloat(cs.columnGap || cs.gap || '0') || 0;
  const trackW = (rect.width - colGap * (HW_COLS - 1)) / HW_COLS;
  HW_ROW_H = trackW; // square cell
  grid.style.setProperty('--wg-row-h', HW_ROW_H + 'px');
  return HW_ROW_H;
}
