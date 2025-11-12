// Calendar Widget - Displays current date

/**
 * Renders a simple calendar widget
 * @param {Object} w - Widget configuration
 * @returns {string} HTML string for widget content
 */
function renderCalendarWidget(w) {
  return `<div style="font-size:18px;font-weight:600;">${new Date().toLocaleDateString()}</div>`;
}

export default {
  key: 'calendar',
  name: 'Calendrier',
  icon: '📅',
  minW: 2,
  minH: 2,
  render: renderCalendarWidget
};
