import {
  getChronologyNodes,
  getChronologySubtitle,
  getNodeProgressState,
  getProgressSummary,
} from './chronologyService.js';

export function renderListItems({
  container,
  empty,
  items,
  displayMode,
  currentList,
  onItemClick,
  onRemoveClick,
  canRemove = true,
}) {
  container.className = `list ${displayMode}-mode`;
  container.innerHTML = '';

  if (!items.length) {
    empty.hidden = currentList === 'home';
    return;
  }

  empty.hidden = true;

  if (displayMode === 'mixte') {
    renderMixedItems(container, items, onItemClick, onRemoveClick, canRemove);
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item) => fragment.appendChild(createItemNode(item, {
    compact: displayMode === 'grid',
    onItemClick,
    onRemoveClick,
    canRemove,
  })));
  container.appendChild(fragment);
}

export function renderChronologyModal(item) {
  closeChronologyModal();

  const nodes = getChronologyNodes(item);
  const overlay = document.createElement('div');
  overlay.className = 'chronology-overlay';
  overlay.innerHTML = `
    <section class="chronology-modal" role="dialog" aria-modal="true" aria-labelledby="chronology-title">
      <header class="chronology-header">
        <div>
          <h2 id="chronology-title" class="chronology-title">${escapeHtml(getItemTitle(item))}</h2>
          <p class="chronology-subtitle">${escapeHtml(getChronologySubtitle(item))}</p>
        </div>
        <button class="chronology-close" type="button" aria-label="Fermer">x</button>
      </header>
      <div class="chronology-content">
        ${nodes.length ? nodes.map((node, index) => renderChronologyNode(item, node, index, nodes)).join('') : renderEmptyChronology()}
      </div>
    </section>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('.chronology-close')?.addEventListener('click', closeChronologyModal);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeChronologyModal();
  });
}

export function closeChronologyModal() {
  document.querySelector('.chronology-overlay')?.remove();
}

export function getVisibleItems(items, query, sortMode) {
  const normalizedQuery = query.trim().toLowerCase();
  return [...items]
    .filter((item) => {
      if (!normalizedQuery) return true;
      return getItemTitle(item).toLowerCase().includes(normalizedQuery)
        || getItemMeta(item).toLowerCase().includes(normalizedQuery);
    })
    .sort((a, b) => sortItems(a, b, sortMode));
}

export function getItemTitle(item) {
  return item.title || item.name || item.titles?.english || item.titles?.romaji || 'Sans titre';
}

export function getItemMeta(item) {
  return [item.format, item.genres?.slice?.(0, 2)?.join(', '), item.status].filter(Boolean).join(' - ');
}

function renderMixedItems(container, items, onItemClick, onRemoveClick, canRemove) {
  const recentItems = items.slice(0, 3);
  const otherItems = items.slice(3);
  const grid = document.createElement('div');
  grid.className = 'mixte-grid-container';

  recentItems.forEach((item) => grid.appendChild(createItemNode(item, {
    compact: true,
    onItemClick,
    onRemoveClick,
    canRemove,
  })));
  container.appendChild(grid);

  otherItems.forEach((item) => container.appendChild(createItemNode(item, {
    compact: false,
    onItemClick,
    onRemoveClick,
    canRemove,
  })));
}

function createItemNode(item, { compact, onItemClick, onRemoveClick, canRemove }) {
  const article = document.createElement('article');
  article.className = 'item';
  article.dataset.itemId = item.id;
  article.tabIndex = 0;
  article.setAttribute('role', 'button');
  article.setAttribute('aria-label', `Afficher la chronologie de ${getItemTitle(item)}`);

  const image = getItemImage(item);
  const title = getItemTitle(item);
  const meta = getItemMeta(item);
  const progressSummary = getProgressSummary(item);
  const bodyClass = compact ? 'item-body-grid' : 'item-body-list';

  article.innerHTML = `
    <div class="item-image-container">
      ${image ? `<img src="${escapeAttribute(image)}" alt="">` : '<div class="item-image-placeholder"></div>'}
    </div>
    <div class="${bodyClass}">
      <div class="item-content">
        <div class="item-top">
          <div>
            <h2 class="item-title">${escapeHtml(title)}</h2>
            <div class="item-info">${escapeHtml(meta)}</div>
          </div>
        </div>
        <div class="item-meta">
          <span>${escapeHtml(progressSummary || getChronologySubtitle(item))}</span>
          <span>Chronologie AniList</span>
        </div>
      </div>
    </div>
    ${canRemove ? `
      <div class="item-top-actions">
        <button class="item-action-btn danger" data-action="remove" type="button" title="Retirer" aria-label="Retirer">x</button>
      </div>
    ` : ''}
  `;

  article.addEventListener('click', () => onItemClick(item));
  article.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onItemClick(item);
    }
  });
  if (canRemove) {
    article.querySelector('[data-action="remove"]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      onRemoveClick(item);
    });
  }

  return article;
}

function renderChronologyNode(item, node, index, nodes) {
  const alternatives = node.alternatives || [];
  const isLast = index === nodes.length - 1;
  const progress = getNodeProgressState(item, node, index, nodes);

  return `
    <article class="chronology-entry chronology-${progress.status} ${isLast ? 'no-connector' : ''}">
      <span class="chronology-index">${index + 1}</span>
      <div class="chronology-body">
        <div class="chronology-node-head">
          <h3 class="chronology-node-title">${escapeHtml(node.title || 'Sans titre')}</h3>
          <span class="chronology-state-badge">${escapeHtml(progress.label)}</span>
        </div>
        <p class="chronology-meta">${escapeHtml(getNodeMeta(node))}</p>
        ${progress.status === 'current' ? `
          <div class="chronology-progress" aria-label="Avancement ${progress.percent}%">
            <div class="chronology-progress-fill" style="width: ${progress.percent}%"></div>
          </div>
        ` : ''}
        ${alternatives.length ? `
          <div class="chronology-entry-group-special">
            ${alternatives.map(renderAlternativeNode).join('')}
          </div>
        ` : ''}
      </div>
    </article>
  `;
}

function renderAlternativeNode(node) {
  return `
    <div class="chronology-special-row">
      <h4 class="chronology-special-title">${escapeHtml(node.title || 'Sans titre')}</h4>
      <p class="chronology-special-meta">${escapeHtml(getNodeMeta(node))}</p>
    </div>
  `;
}

function renderEmptyChronology() {
  return `
    <article class="chronology-entry no-connector">
      <span class="chronology-index">1</span>
      <div class="chronology-body">
        <h3 class="chronology-node-title">Chronologie indisponible</h3>
        <p class="chronology-meta">AniList ne renvoie pas encore de relation exploitable pour cet anime.</p>
      </div>
    </article>
  `;
}

function sortItems(a, b, sortMode) {
  if (sortMode === 'name-desc') return getItemTitle(b).localeCompare(getItemTitle(a));
  if (sortMode === 'progress') return getChronologyNodes(b).length - getChronologyNodes(a).length;
  if (sortMode === 'recent') return (b.addedAt || b.updatedAt || 0) - (a.addedAt || a.updatedAt || 0);
  return getItemTitle(a).localeCompare(getItemTitle(b));
}

function getItemImage(item) {
  return item.banner || item.cover || item.anilistBanner || item.anilistImage || item.image || item.thumbnail || '';
}

function getNodeMeta(node) {
  return [
    node.format,
    node.seasonYear,
    Number.isFinite(Number(node.episodes)) ? `${node.episodes} episode${Number(node.episodes) > 1 ? 's' : ''}` : '',
    node.relationType,
  ].filter(Boolean).join(' - ');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
