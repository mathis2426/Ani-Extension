// Widget type selection panel

export const WIDGET_TYPES = {
  clock: { name: 'Horloge', icon: '🕐', minW: 2, minH: 2, render: (w) => `<div style="font-size:24px;font-weight:600;">${new Date().toLocaleTimeString()}</div>` },
  calendar: { name: 'Calendrier', icon: '📅', minW: 2, minH: 2, render: (w) => `<div style="font-size:18px;font-weight:600;">${new Date().toLocaleDateString()}</div>` },
  stats: { name: 'Statistiques', icon: '📊', minW: 4, minH: 2, render: (w) => '<div>Statistiques</div>' },
  recentAnime: { name: 'Récents', icon: '📺', minW: 2, minH: 2, render: (w) => '<div>Animés récents</div>' },
  progress: { name: 'Progression', icon: '📈', minW: 3, minH: 2, render: (w) => '<div>Progression</div>' },
  favorites: { name: 'Favoris', icon: '⭐', minW: 2, minH: 3, render: (w) => '<div>Favoris</div>' },
  search: { name: 'Recherche', icon: '🔍', minW: 4, minH: 1, render: (w) => '<input type="text" placeholder="Rechercher..." style="width:100%;padding:8px;background:#333;border:1px solid #444;border-radius:6px;color:#fff;">' },
  quote: { name: 'Citation', icon: '💬', minW: 3, minH: 2, render: (w) => '<div style="font-style:italic;opacity:.8;">"Une citation inspirante"</div>' },
  weather: { name: 'Météo', icon: '🌤️', minW: 2, minH: 2, render: (w) => '<div>☀️ 22°C</div>' },
  notes: { name: 'Notes', icon: '📝', minW: 2, minH: 2, render: (w) => '<textarea style="width:100%;height:100%;background:#333;border:1px solid #444;border-radius:6px;color:#fff;padding:8px;resize:none;">Notes...</textarea>' },
};

let currentWidgetForPanel = null;

export function openWidgetPanel(widget, onSelectType) {
  currentWidgetForPanel = widget;
  const panel = document.getElementById('wg-panel');
  const overlay = document.getElementById('wg-panel-overlay');
  const content = document.getElementById('wg-panel-content');
  
  const available = Object.entries(WIDGET_TYPES).filter(([key, type]) => {
    return type.minW <= widget.w && type.minH <= widget.h;
  });
  
  const unavailable = Object.entries(WIDGET_TYPES).filter(([key, type]) => {
    return type.minW > widget.w || type.minH > widget.h;
  });
  
  content.innerHTML = '';
  
  if (available.length > 0) {
    const availSection = document.createElement('div');
    availSection.className = 'wg-panel-section';
    availSection.innerHTML = `<h3 class="wg-panel-section-title">Disponibles (${widget.w}×${widget.h})</h3><div class="wg-panel-grid"></div>`;
    const grid = availSection.querySelector('.wg-panel-grid');
    
    for (const [key, type] of available) {
      const item = document.createElement('button');
      item.className = 'wg-panel-item';
      item.innerHTML = `<div class="wg-panel-item-icon">${type.icon}</div><div class="wg-panel-item-name">${type.name}</div>`;
      item.addEventListener('click', () => {
        if (onSelectType) onSelectType(key, currentWidgetForPanel);
        closeWidgetPanel();
      });
      grid.appendChild(item);
    }
    
    content.appendChild(availSection);
  }
  
  if (unavailable.length > 0) {
    const unavailSection = document.createElement('div');
    unavailSection.className = 'wg-panel-section';
    unavailSection.innerHTML = `<h3 class="wg-panel-section-title">Taille insuffisante</h3><div class="wg-panel-grid"></div>`;
    const grid = unavailSection.querySelector('.wg-panel-grid');
    
    for (const [key, type] of unavailable) {
      const item = document.createElement('button');
      item.className = 'wg-panel-item';
      item.style.opacity = '0.4';
      item.style.cursor = 'not-allowed';
      item.innerHTML = `<div class="wg-panel-item-icon">${type.icon}</div><div class="wg-panel-item-name">${type.name}<br><small style="font-size:9px;opacity:.7;">(min ${type.minW}×${type.minH})</small></div>`;
      grid.appendChild(item);
    }
    
    content.appendChild(unavailSection);
  }
  
  overlay.classList.add('active');
  panel.classList.add('active');
}

export function closeWidgetPanel() {
  const panel = document.getElementById('wg-panel');
  const overlay = document.getElementById('wg-panel-overlay');
  overlay.classList.remove('active');
  panel.classList.remove('active');
  currentWidgetForPanel = null;
}

export function bindPanelControls(onClose) {
  document.getElementById('wg-panel-close').addEventListener('click', () => {
    closeWidgetPanel();
    if (onClose) onClose();
  });
  document.getElementById('wg-panel-overlay').addEventListener('click', () => {
    closeWidgetPanel();
    if (onClose) onClose();
  });
}
