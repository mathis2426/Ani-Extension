// Widget Types Index - Central registry for all widget types

import inProgressWidget from './inProgressWidget.js';
import clockWidget from './clockWidget.js';
import calendarWidget from './calendarWidget.js';
import notesWidget from './notesWidget.js';
import searchWidget from './searchWidget.js';

// Placeholder widgets (to be implemented)
const statsWidget = {
  key: 'stats',
  name: 'Statistiques',
  icon: '📊',
  minW: 4,
  minH: 2,
  render: (w) => '<div>Statistiques</div>'
};

const recentAnimeWidget = {
  key: 'recentAnime',
  name: 'Récents',
  icon: '🎬',
  minW: 2,
  minH: 2,
  render: (w) => '<div>Animés récents</div>'
};

const progressWidget = {
  key: 'progress',
  name: 'Progression',
  icon: '📈',
  minW: 3,
  minH: 2,
  render: (w) => '<div>Progression</div>'
};

const favoritesWidget = {
  key: 'favorites',
  name: 'Favoris',
  icon: '⭐',
  minW: 2,
  minH: 3,
  render: (w) => '<div>Favoris</div>'
};

const quoteWidget = {
  key: 'quote',
  name: 'Citation',
  icon: '💬',
  minW: 3,
  minH: 2,
  render: (w) => '<div style="font-style:italic;opacity:.8;">"Une citation inspirante"</div>'
};

const weatherWidget = {
  key: 'weather',
  name: 'Météo',
  icon: '🌤️',
  minW: 2,
  minH: 2,
  render: (w) => '<div>☀️ 22°C</div>'
};

// Widget registry array
const widgetTypes = [
  inProgressWidget,
  clockWidget,
  calendarWidget,
  statsWidget,
  recentAnimeWidget,
  progressWidget,
  favoritesWidget,
  searchWidget,
  quoteWidget,
  weatherWidget,
  notesWidget
];

// Convert array to object keyed by widget key for backward compatibility
export const WIDGET_TYPES = widgetTypes.reduce((acc, widget) => {
  acc[widget.key] = widget;
  return acc;
}, {});

// Export array for easier iteration
export const WIDGET_TYPES_ARRAY = widgetTypes;

export default WIDGET_TYPES;
