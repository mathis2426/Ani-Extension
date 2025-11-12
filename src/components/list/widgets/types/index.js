// Widget Types Index - Central registry for all widget types

import inProgressWidget from './inProgressWidget.js';

// Widget registry array - only anime-related widgets
const widgetTypes = [
  inProgressWidget
];

// Convert array to object keyed by widget key for backward compatibility
export const WIDGET_TYPES = widgetTypes.reduce((acc, widget) => {
  acc[widget.key] = widget;
  return acc;
}, {});

// Export array for easier iteration
export const WIDGET_TYPES_ARRAY = widgetTypes;

export default WIDGET_TYPES;
