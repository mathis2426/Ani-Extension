// ============ DOM HELPER FUNCTIONS ============

/**
 * Créer un élément avec classe, texte et enfants
 * @param {string} tag - Tag HTML (div, span, etc.)
 * @param {string} className - Classes CSS
 * @param {string} textContent - Contenu texte
 * @param {HTMLElement[]} children - Éléments enfants
 * @returns {HTMLElement}
 */
export function el(tag, className = "", textContent = "", children = []) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  children.forEach(child => element.appendChild(child));
  return element;
}

/**
 * Créer un élément avec styles inline
 * @param {string} tag - Tag HTML
 * @param {string} className - Classes CSS
 * @param {Object} style - Objet de styles
 * @returns {HTMLElement}
 */
export function elWithStyle(tag, className = "", style = {}) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  Object.assign(element.style, style);
  return element;
}
