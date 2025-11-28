// In Progress Anime Widget - Displays currently watching anime with adaptive layouts

import { state } from '../../core/state.js';

/**
 * Renders the In Progress widget with size-adaptive layouts
 * @param {Object} w - Widget configuration {id, w, h, col, row, type, title, content}
 * @returns {string} HTML string for widget content
 */
function renderInProgressWidget(w) {
  // Use popupData as the single source of truth for currently watching anime
  // This prevents duplication and ensures we show exactly what's being watched
  const inProgress = (state.popupData || []).map(anime => ({
    name: anime.name,
    link: anime.link,
    episode: anime.episode || 0,
    saison: anime.saison,
    totalEp: anime.totalEp || 0
  }));
  
  const area = w.w * w.h;
  
  // Define layout variants based on width and height
  const isVeryCompact = w.w === 2 && w.h === 2;           // 2×2: Just counter
  const isSmallWide = w.w >= 3 && w.h === 1;              // 3×1, 4×1: Horizontal minimal
  const isNarrow = w.w === 2 && w.h >= 3;                 // 2×3+: Vertical list
  const isMediumWide = w.w >= 4 && w.h === 2;             // 4×2, 5×2: Horizontal cards
  const isMedium = w.w === 3 && w.h === 2;                // 3×2: Small vertical cards
  const isWide = w.w >= 6 && w.h >= 2;                    // 6×2+: Wide horizontal layout
  const isLarge = area >= 8 && !isWide;                   // 4×3+: Grid (not wide)
  
  // Empty state
  if (inProgress.length === 0) {
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;opacity:.6;text-align:center;padding:12px;">
      <div style="font-size:11px;">Aucun anime en cours</div>
    </div>`;
  }
  
  // Very Compact 2×2: Just counter badge + label
  if (isVeryCompact) {
    return `<div style="display:flex;flex-direction:column;height:100%;width:100%;padding:8px;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;opacity:.7;font-weight:600;justify-content:flex-end;">
        <span style="background:#7b5ac2;padding:2px 6px;border-radius:4px;font-size:10px;">${inProgress.length}</span>
      </div>
      <div style="display:flex;align-items:center;font-size:13px;font-weight:600;line-height:1.3;">
        En cours
      </div>
    </div>`;
  }
  
  // Small Wide 3×1, 4×1: Horizontal minimal chips
  if (isSmallWide) {
    const limit = w.w >= 4 ? 2 : 1;
    const items = inProgress.slice(0, limit);
    return `<div style="display:flex;height:100%;padding:8px;gap:6px;align-items:center;overflow:hidden;">
      <div style="background:#7b5ac2;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;">
        ${inProgress.length}
      </div>
      ${items.map(anime => `
        <div style="flex:1;min-width:0;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 10px;overflow:hidden;">
          <div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${anime.name || 'Anime'}
          </div>
        </div>
      `).join('')}
    </div>`;
  }
  
  // Narrow 2×3+: Vertical list
  if (isNarrow) {
    const limit = Math.min(inProgress.length, Math.floor(w.h * 1.5));
    const items = inProgress.slice(0, limit);
    return `<div style="display:flex;flex-direction:column;height:100%;padding:10px;gap:8px;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;opacity:.7;font-weight:600;">
        <span style="background:#7b5ac2;padding:2px 6px;border-radius:4px;font-size:10px;">${inProgress.length}</span>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:6px;overflow-y:auto;">
        ${items.map(anime => {
          const progress = anime.totalEp > 0 ? Math.round((anime.episode / anime.totalEp) * 100) : 0;
          return `
            <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px;min-height:0;">
              <div style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:4px;">
                ${anime.name || 'Anime'}
              </div>
              <div style="font-size:9px;opacity:.6;margin-bottom:4px;">
                ${anime.episode || 0}/${anime.totalEp || '?'}
              </div>
              <div style="background:rgba(255,255,255,.1);height:3px;border-radius:2px;overflow:hidden;">
                <div style="background:#7b5ac2;height:100%;width:${progress}%;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>`;
  }
  
  // Medium 3×2: Vertical cards
  if (isMedium) {
    const items = inProgress.slice(0, 2);
    return `<div style="display:flex;flex-direction:column;height:100%;padding:10px;gap:8px;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;opacity:.7;font-weight:600;">
        <span>EN COURS (${inProgress.length})</span>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:6px;overflow-y:auto;">
        ${items.map(anime => {
          const progress = anime.totalEp > 0 ? Math.round((anime.episode / anime.totalEp) * 100) : 0;
          return `
            <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:4px;">
              <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${anime.name || 'Anime'}
              </div>
              <div style="font-size:10px;opacity:.6;">
                ${anime.episode || 0}/${anime.totalEp || '?'} épisodes
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
  
  // Medium Wide 4×2, 5×2: Horizontal cards in row
  if (isMediumWide) {
    const limit = Math.min(inProgress.length, w.w - 1);
    const items = inProgress.slice(0, limit);
    return `<div style="display:flex;flex-direction:column;height:100%;padding:10px;gap:8px;overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;">
          <span>En cours</span>
        </div>
        <div style="background:#7b5ac2;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;">
          ${inProgress.length}
        </div>
      </div>
      <div style="flex:1;display:flex;flex-direction:row;gap:8px;overflow-x:auto;overflow-y:hidden;">
        ${items.map(anime => {
          const progress = anime.totalEp > 0 ? Math.round((anime.episode / anime.totalEp) * 100) : 0;
          return `
              <div class="wg-hoverable" style="flex:0 0 auto;width:140px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px;transition:background .15s;">
              <div style="font-size:12px;font-weight:650;line-height:1.3;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">
                ${anime.name || 'Anime'}
              </div>
              <div style="font-size:10px;opacity:.6;">
                ${anime.episode || 0} / ${anime.totalEp || '?'}
              </div>
              <div style="background:rgba(255,255,255,.1);height:4px;border-radius:2px;overflow:hidden;margin-top:auto;">
                <div style="background:#7b5ac2;height:100%;width:${progress}%;transition:width .3s;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>`;
  }
  
  // Wide 6×2+: Full horizontal scrollable layout
  if (isWide) {
    const items = inProgress;
    return `<div style="display:flex;flex-direction:column;height:100%;padding:12px;gap:10px;overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;">
          <span>Animés en cours</span>
        </div>
        <div style="background:#7b5ac2;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:600;">
          ${inProgress.length}
        </div>
      </div>
      <div style="flex:1;display:flex;flex-direction:row;gap:10px;overflow-x:auto;overflow-y:hidden;padding-bottom:4px;">
        ${items.map(anime => {
          const progress = anime.totalEp > 0 ? Math.round((anime.episode / anime.totalEp) * 100) : 0;
          return `
              <div class="wg-hoverable wg-hoverable-transform" style="flex:0 0 auto;width:160px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;transition:background .15s,transform .15s;">
              <div style="font-size:13px;font-weight:650;line-height:1.3;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;min-height:36px;">
                ${anime.name || 'Anime'}
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;opacity:.7;">
                <span>Episode</span>
                <span style="font-weight:600;">${anime.episode || 0}/${anime.totalEp || '?'}</span>
              </div>
              <div style="background:rgba(255,255,255,.1);height:5px;border-radius:3px;overflow:hidden;margin-top:auto;">
                <div style="background:#7b5ac2;height:100%;width:${progress}%;transition:width .3s;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>`;
  }
  
  // Large 4×3+: Grid layout (default fallback)
  const limit = Math.min(inProgress.length, Math.floor(area / 2));
  const items = inProgress.slice(0, limit);
  return `<div style="display:flex;flex-direction:column;height:100%;padding:12px;gap:10px;overflow:hidden;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;">
        <span>Animés en cours</span>
      </div>
      <div style="background:#7b5ac2;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;">
        ${inProgress.length}
      </div>
    </div>
    <div style="flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;overflow-y:auto;align-content:start;">
      ${items.map(anime => {
        const progress = anime.totalEp > 0 ? Math.round((anime.episode / anime.totalEp) * 100) : 0;
        return `
          <div class="wg-hoverable" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px;transition:background .15s;">
            <div style="font-size:12px;font-weight:650;line-height:1.3;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">
              ${anime.name || 'Anime'}
            </div>
            <div style="font-size:10px;opacity:.6;">
              ${anime.episode || 0} / ${anime.totalEp || '?'}
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
  icon: '▶',
  minW: 2,
  minH: 2,
  render: renderInProgressWidget
};
