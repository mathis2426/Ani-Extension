// Clock Widget - Displays current time

/**
 * Renders a simple clock widget
 * @param {Object} w - Widget configuration
 * @returns {string} HTML string for widget content
 */
function renderClockWidget(w) {
  return `<div style="font-size:24px;font-weight:600;">${new Date().toLocaleTimeString()}</div>`;
}

export default {
  key: 'clock',
  name: 'Horloge',
  icon: '🕐',
  minW: 2,
  minH: 2,
  render: renderClockWidget
};
