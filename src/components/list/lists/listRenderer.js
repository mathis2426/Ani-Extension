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
  onRetryClick,
  getSyncState = () => null,
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
    renderMixedItems(container, items, { onItemClick, onRemoveClick, onRetryClick, getSyncState, canRemove });
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item) => fragment.appendChild(createItemNode(item, {
    compact: displayMode === 'grid',
    onItemClick,
    onRemoveClick,
    onRetryClick,
    getSyncState,
    canRemove,
  })));
  container.appendChild(fragment);
}

export function renderChronologyModal(item, syncState = null) {
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
        <button class="chronology-close" type="button" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </header>
      <div class="chronology-content">
        ${nodes.length && !item.chronologyPending
          ? nodes.map((node, index) => renderChronologyNode(item, node, index, nodes)).join('')
          : renderEmptyChronology(syncState || (item.chronologyPending ? { state: 'queued' } : null))}
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
  return [formatFormat(item.format), item.genres?.slice?.(0, 2)?.join(', ')].filter(Boolean).join(' · ');
}

const STATUS_LABELS = {
  FINISHED: { label: 'Terminé', tone: 'finished' },
  RELEASING: { label: 'En diffusion', tone: 'releasing' },
  NOT_YET_RELEASED: { label: 'À venir', tone: 'upcoming' },
  CANCELLED: { label: 'Annulé', tone: 'cancelled' },
  HIATUS: { label: 'En pause', tone: 'cancelled' },
};

const FORMAT_LABELS = {
  TV: 'Série TV',
  TV_SHORT: 'Format court',
  MOVIE: 'Film',
  SPECIAL: 'Spécial',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Clip',
};

const RELATION_LABELS = {
  SEQUEL: 'Suite',
  PREQUEL: 'Préquelle',
  SIDE_STORY: 'Histoire parallèle',
  SPIN_OFF: 'Spin-off',
  ALTERNATIVE: 'Version alternative',
  SUMMARY: 'Résumé',
  PARENT: 'Œuvre principale',
  CHARACTER: 'Personnages communs',
  OTHER: 'Autre',
};

export function formatStatus(status) {
  return STATUS_LABELS[status]?.label || status || '';
}

export function formatFormat(format) {
  return FORMAT_LABELS[format] || format || '';
}

function renderStatusPill(status) {
  const entry = STATUS_LABELS[status];
  if (!entry) return '';
  return `<span class="item-status is-${entry.tone}">${escapeHtml(entry.label)}</span>`;
}

function getWatchPercent(item) {
  const duration = Number(item?.progress?.duration || 0);
  const currentTime = Number(item?.progress?.currentTime || 0);
  if (!duration || !currentTime) return 0;
  return Math.max(0, Math.min(100, Math.round((currentTime / duration) * 100)));
}

function renderMixedItems(container, items, handlers) {
  const recentItems = items.slice(0, 3);
  const otherItems = items.slice(3);
  const grid = document.createElement('div');
  grid.className = 'mixte-grid-container';

  recentItems.forEach((item) => grid.appendChild(createItemNode(item, { ...handlers, compact: true })));
  container.appendChild(grid);

  otherItems.forEach((item) => container.appendChild(createItemNode(item, { ...handlers, compact: false })));
}

function createItemNode(item, { compact, onItemClick, onRemoveClick, onRetryClick, getSyncState, canRemove }) {
  const article = document.createElement('article');
  article.className = 'item';
  article.dataset.itemId = item.id;
  article.tabIndex = 0;
  article.setAttribute('role', 'button');
  article.setAttribute('aria-label', `Afficher la chronologie de ${getItemTitle(item)}`);

  const image = getItemImage(item, compact);
  const syncState = getSyncState(item) || (item.chronologyPending ? { state: 'queued' } : null);
  if (syncState) article.classList.add(`is-sync-${syncState.state}`);
  const watchPercent = getWatchPercent(item);
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
            <div class="item-info">${escapeHtml(meta)}${renderStatusPill(item.status)}</div>
          </div>
        </div>
        ${syncState
          ? renderSyncStatus(syncState, item)
          : `<div class="item-meta">${escapeHtml(progressSummary || getChronologySubtitle(item))}</div>`}
        ${watchPercent ? `
          <div class="item-progress" aria-label="${watchPercent}% vu"><span style="width: ${watchPercent}%"></span></div>
        ` : ''}
      </div>
    </div>
    ${canRemove ? `
      <div class="item-top-actions">
        <button class="item-action-btn danger" data-action="remove" type="button" title="Retirer de la liste" aria-label="Retirer de la liste"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
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
  article.querySelector('[data-action="retry"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    onRetryClick?.(item);
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

function renderEmptyChronology(syncState) {
  const isLoading = syncState?.state === 'queued' || syncState?.state === 'running';
  const title = isLoading ? 'Chronologie en cours de récupération' : 'Chronologie indisponible';
  const text = isLoading
    ? 'La récupération continue en arrière-plan, tu peux fermer cette fenêtre : la carte se mettra à jour toute seule.'
    : 'AniList ne renvoie pas encore de relation exploitable pour cet anime.';
  return `
    <article class="chronology-entry no-connector">
      <span class="chronology-index">${isLoading ? '<span class="spinner" aria-hidden="true"></span>' : '1'}</span>
      <div class="chronology-body">
        <h3 class="chronology-node-title">${title}</h3>
        <p class="chronology-meta">${text}</p>
      </div>
    </article>
  `;
}

/** Status line shown on a card while AniList is working on it */
function renderSyncStatus(syncState, item) {
  const isInProgress = Boolean(item.isInProgress);
  if (syncState.state === 'running') {
    return `<div class="item-sync is-running" role="status">
      <span class="spinner" aria-hidden="true"></span>
      ${isInProgress ? 'Recherche sur AniList…' : 'Récupération de la chronologie…'}
    </div>`;
  }
  if (syncState.state === 'queued') {
    return `<div class="item-sync is-queued" role="status">
      <span class="sync-dot" aria-hidden="true"></span>
      En attente de recherche AniList
    </div>`;
  }
  const message = syncState.error?.message === 'Introuvable sur AniList'
    ? 'Introuvable sur AniList'
    : 'Échec de la récupération';
  return `<div class="item-sync is-error" role="status">
    ${message}
    <button class="item-sync-retry" data-action="retry" type="button">Réessayer</button>
  </div>`;
}

function sortItems(a, b, sortMode) {
  if (sortMode === 'name-desc') return getItemTitle(b).localeCompare(getItemTitle(a));
  if (sortMode === 'progress') return getChronologyNodes(b).length - getChronologyNodes(a).length;
  if (sortMode === 'recent') return (b.addedAt || b.updatedAt || 0) - (a.addedAt || a.updatedAt || 0);
  return getItemTitle(a).localeCompare(getItemTitle(b));
}

function getItemImage(item, compact = false) {
  // Compact cards show the poster, wide rows show the banner
  const poster = item.cover || item.anilistImage || item.image;
  const banner = item.banner || item.anilistBanner;
  return (compact ? poster || banner : banner || poster) || item.thumbnail || '';
}

function getNodeMeta(node) {
  return [
    node.format,
    node.seasonYear,
    Number(node.episodes) > 0 ? `${node.episodes} épisode${Number(node.episodes) > 1 ? 's' : ''}` : '',
    RELATION_LABELS[node.relationType] || node.relationType,
  ].filter(Boolean).map(formatFormat).join(' · ');
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
