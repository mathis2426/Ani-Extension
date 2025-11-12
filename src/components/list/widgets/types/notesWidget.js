// Notes Widget - Simple textarea for taking notes

/**
 * Renders a notes widget with textarea
 * @param {Object} w - Widget configuration
 * @returns {string} HTML string for widget content
 */
function renderNotesWidget(w) {
  return `<textarea style="width:100%;height:100%;background:#333;border:1px solid #444;border-radius:6px;color:#fff;padding:8px;resize:none;" placeholder="Notes..."></textarea>`;
}

export default {
  key: 'notes',
  name: 'Notes',
  icon: '📝',
  minW: 2,
  minH: 2,
  render: renderNotesWidget
};
