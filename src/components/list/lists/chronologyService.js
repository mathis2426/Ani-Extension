import { AnilistService } from '../../../services/AnilistService.js';

const CHRONOLOGY_FORMATS = ['TV', 'TV_SHORT', 'MOVIE', 'OVA', 'ONA', 'SPECIAL'];

export async function createAnimeListItemFromAnilist(anilistId) {
  const anime = await AnilistService.getAnimeById(anilistId);
  if (!anime) return null;

  const franchiseInfo = await AnilistService.getFranchiseInfoById(anilistId, 6, { allowedFormats: CHRONOLOGY_FORMATS });
  const chronology = buildChronology(franchiseInfo);
  const chronologyStats = getChronologyStats(chronology);

  return {
    id: anime.id,
    name: anime.title,
    title: anime.title,
    TotalEpisodes: chronologyStats.totalEpisodes || anime.episodes || 0,
    TotalSaison: chronologyStats.entries || (anime.season ? 1 : 0),
    cover: anime.cover,
    banner: anime.banner,
    status: anime.status,
    format: anime.format,
    genres: anime.genres || [],
    link: `https://anilist.co/anime/${anime.id}`,
    chronology,
    chronologyFetchedAt: Date.now(),
  };
}

export async function createAnimeListItemFromTitle(title) {
  const results = await AnilistService.searchAnimes(title, 1, {
    formats: CHRONOLOGY_FORMATS,
    statuses: [],
    sort: 'SEARCH_MATCH',
  });
  const bestMatch = results[0];
  if (!bestMatch?.id) return null;
  return createAnimeListItemFromAnilist(bestMatch.id);
}

export function buildChronology(franchiseInfo) {
  if (!franchiseInfo || !Array.isArray(franchiseInfo.nodes)) return {};

  return franchiseInfo.nodes.reduce((chronology, node, index) => {
    chronology[index + 1] = {
      ...node,
      alternatives: Array.isArray(node.alternatives) ? node.alternatives : [],
    };
    return chronology;
  }, {});
}

export function getChronologyNodes(item) {
  const nodes = Object.entries(item?.chronology || {})
    .map(([position, node]) => ({
      position: Number(position),
      ...node,
      alternatives: Array.isArray(node.alternatives) ? node.alternatives : [],
    }))
    .sort((a, b) => a.position - b.position);

  if (nodes.length || !item?.isInProgress) return nodes;

  return [{
    position: 1,
    id: item.id,
    title: item.progress?.episodeTitle || item.title || item.name || 'Lecture en cours',
    episodes: item.progress?.currentEpisode || null,
    format: 'Lecture',
    alternatives: [],
  }];
}

export function getChronologyStats(chronology) {
  const nodes = getChronologyNodes({ chronology });
  const totalEpisodes = nodes.reduce((total, node) => (
    total + (Number.isFinite(Number(node.episodes)) ? Number(node.episodes) : 0)
  ), 0);

  return {
    entries: nodes.length,
    totalEpisodes,
  };
}

export function getChronologySubtitle(item) {
  const nodes = getChronologyNodes(item);
  const totalEpisodes = nodes.reduce((total, node) => (
    total + (Number.isFinite(Number(node.episodes)) ? Number(node.episodes) : 0)
  ), 0);

  const entryText = `${nodes.length} entree${nodes.length > 1 ? 's' : ''}`;
  const episodeText = totalEpisodes
    ? `${totalEpisodes} episode${totalEpisodes > 1 ? 's' : ''}`
    : '';
  const progressText = getProgressSummary(item);

  return [entryText, episodeText, progressText].filter(Boolean).join(' - ');
}

export function getProgressSummary(item) {
  if (!item?.progress) return '';

  const episode = Number(item.progress.currentEpisode || 0);
  const saison = item.progress.currentSaison;
  const timePercent = getWatchTimePercent(item.progress);

  const parts = [];
  if (saison) parts.push(`Saison ${saison}`);
  if (episode) parts.push(`Episode ${episode}`);
  if (timePercent > 0) parts.push(`${timePercent}% vu`);

  return parts.join(' - ');
}

export function getNodeProgressState(item, node, index, nodes) {
  const progress = item?.progress;
  if (!progress) return { status: 'unknown', label: 'A voir', percent: 0 };

  const currentSaison = Number(progress.currentSaison || 0);
  const currentEpisode = Number(progress.currentEpisode || 0);
  const nodeEpisodes = Number(node.episodes || 0);

  if (currentSaison > 0) {
    const nodePosition = index + 1;
    if (nodePosition < currentSaison) return { status: 'done', label: 'Vu', percent: 100 };
    if (nodePosition > currentSaison) return { status: 'upcoming', label: 'A venir', percent: 0 };

    const percent = nodeEpisodes > 0
      ? clampPercent(Math.round((currentEpisode / nodeEpisodes) * 100))
      : getWatchTimePercent(progress);
    return { status: 'current', label: 'En cours', percent };
  }

  if (currentEpisode > 0) {
    let previousEpisodes = 0;
    for (let i = 0; i < index; i += 1) {
      previousEpisodes += Number(nodes[i].episodes || 0);
    }
    const endEpisode = previousEpisodes + nodeEpisodes;

    if (nodeEpisodes > 0 && currentEpisode > endEpisode) {
      return { status: 'done', label: 'Vu', percent: 100 };
    }
    if (nodeEpisodes > 0 && currentEpisode > previousEpisodes && currentEpisode <= endEpisode) {
      const percent = clampPercent(Math.round(((currentEpisode - previousEpisodes) / nodeEpisodes) * 100));
      return { status: 'current', label: 'En cours', percent };
    }
  }

  return { status: 'upcoming', label: 'A venir', percent: 0 };
}

function getWatchTimePercent(progress) {
  const currentTime = Number(progress.currentTime || 0);
  const duration = Number(progress.duration || 0);
  if (!duration || !currentTime) return 0;
  return clampPercent(Math.round((currentTime / duration) * 100));
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}
