// In Progress Anime Widget - Displays currently watching anime with adaptive layouts

import { state } from '../../core/state.js';

/**
 * Renders the In Progress widget with size-adaptive layouts
 * @param {Object} w - Widget configuration {id, w, h, col, row, type, title, content}
 * @returns {string} HTML string for widget content
 */
function renderInProgressWidget(w) {
  const inProgress = state.aniLists?.inprogress || [];
  const area = w.w * w.h;
  const isCompact = w.w === 2 && w.h === 2;
  const isMedium = (w.w === 3 || w.w === 4) && w.h === 2;
  const isLarge = area >= 8;

  console.log('Rendering In Progress Widget:', { w, inProgress, isCompact, isMedium, isLarge });
  // Empty state
  if (inProgress.length === 0) {
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;opacity:.6;text-align:center;padding:12px;">
      <div style="font-size:11px;">Aucun anime en cours</div>
    </div>`;
  }
  
  // Compact 2×2: show count + first anime title
  if (isCompact) {
    const first = inProgress[0];
    return `<div style="display:flex;flex-direction:column;height:100%;width:100%;padding:8px;">
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;opacity:.7;font-weight:600;justify-content:flex-end;">
        <span style="background:#7b5ac2;padding:2px 6px;border-radius:4px;font-size:10px;">${inProgress.length}</span>
      </div>
      <div style="flex:1;display:flex;align-items:center;font-size:13px;font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;">
        Anime en cours
      </div>
    </div>`;
  }
  
  // Medium 3×2 or 4×2: show 2-3 anime cards
  if (isMedium) {
    const limit = w.w >= 4 ? 3 : 2;
    const items = inProgress.slice(0, limit);
    return `<div style="display:flex;flex-direction:column;height:100%;padding:10px;gap:8px;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;opacity:.7;font-weight:600;">
        <span>📺</span>
        <span>EN COURS (${inProgress.length})</span>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:6px;overflow-y:auto;">
        ${items.map(anime => `
          <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px;display:flex;align-items:center;gap:8px;min-height:0;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${anime.name || 'Anime'}
              </div>
              <div style="font-size:10px;opacity:.6;margin-top:2px;">
                ${anime.currentEp || 0}/${anime.totalEp || '?'} épisodes
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
  }
  
  // Large 4×3+: detailed grid with progress bars
  const limit = Math.min(inProgress.length, Math.floor(area / 2));
  const items = inProgress.slice(0, limit);
  return `<div style="display:flex;flex-direction:column;height:100%;padding:12px;gap:10px;overflow:hidden;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;">
        <span>📺</span>
        <span>Animés en cours</span>
      </div>
      <div style="background:#7b5ac2;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;">
        ${inProgress.length}
      </div>
    </div>
    <div style="flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;overflow-y:auto;align-content:start;">
      ${items.map(anime => {
        const progress = anime.totalEp > 0 ? Math.round((anime.currentEp / anime.totalEp) * 100) : 0;
        return `
          <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px;transition:background .15s;" 
               onmouseover="this.style.background='rgba(255,255,255,.08)'" 
               onmouseout="this.style.background='rgba(255,255,255,.05)'">
            <div style="font-size:12px;font-weight:650;line-height:1.3;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">
              ${anime.name || 'Anime'}
            </div>
            <div style="font-size:10px;opacity:.6;">
              ${anime.currentEp || 0} / ${anime.totalEp || '?'}
            </div>
            <div style="background:rgba(255,255,255,.1);height:4px;border-radius:2px;overflow:hidden;margin-top:2px;">
              <div style="background:#7b5ac2;height:100%;width:${progress}%;transition:width .3s;"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  </div>`;
}

export default {
  key: 'inProgress',
  name: 'En cours',
  icon: '📺',
  minW: 2,
  minH: 2,
  render: renderInProgressWidget
};
