// Search Widget - Search input field

/**
 * Renders a search widget
 * @param {Object} w - Widget configuration
 * @returns {string} HTML string for widget content
 */
function renderSearchWidget(w) {
  return `<input type="text" placeholder="Rechercher..." style="width:100%;padding:8px;background:#333;border:1px solid #444;border-radius:6px;color:#fff;">`;
}

export default {
  key: 'search',
  name: 'Recherche',
  icon: '🔍',
  minW: 4,
  minH: 1,
  render: renderSearchWidget
};
