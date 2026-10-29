import { StorageService } from '../../../services/StorageService.js';
import { loadPopupData } from '../core/state.js';
import { getcreateStoredLists, getListItems } from '../core/storage.js';
import { createAnimeListItemFromTitle } from './chronologyService.js';
import { normalizeTitle } from '../../../utils/subtitles/subtitleUtils.js';

const CHRONOLOGY_CACHE_KEY = 'inprogressChronologyCache';
// Titles AniList did not match: not searched again before this delay
const CHRONOLOGY_MISSES_KEY = 'inprogressChronologyMisses';
const MISS_RETRY_DELAY_MS = 24 * 60 * 60 * 1000;

export async function loadInProgressItems() {
  const popupItems = await loadPopupData();
  if (!popupItems.length) return [];

  const cache = {
    ...(await StorageService.get(CHRONOLOGY_CACHE_KEY) || {}),
    ...(await getStoredChronologyItems()),
  };

  return popupItems.map((popupItem) => createInProgressItem(
    popupItem,
    findCachedChronologyItem(cache, popupItem.name),
  ));
}

/**
 * Animes being watched that have no chronology yet (and were not looked up
 * without success recently).
 */
export async function getInProgressItemsMissingChronology() {
  const popupItems = await loadPopupData();
  if (!popupItems.length) return [];

  const cache = {
    ...(await StorageService.get(CHRONOLOGY_CACHE_KEY) || {}),
    ...(await getStoredChronologyItems()),
  };
  const misses = await StorageService.get(CHRONOLOGY_MISSES_KEY) || {};
  const now = Date.now();

  return popupItems.filter((popupItem) => {
    if (findCachedChronologyItem(cache, popupItem.name)) return false;
    const missedAt = misses[normalizeCacheKey(popupItem.name)];
    return !missedAt || now - missedAt > MISS_RETRY_DELAY_MS;
  });
}

/** Key used to follow the background job of an "En cours" anime */
export function getInProgressSyncKey(name) {
  return `inprogress:${normalizeCacheKey(name)}`;
}

/**
 * Look an "En cours" anime up on AniList and cache its chronology.
 * Throws when nothing matches, so the UI can say so.
 */
export async function fetchInProgressChronology(popupItem) {
  const cleanTitle = normalizeTitle(popupItem.name);
  const chronologyItem = await createAnimeListItemFromTitle(cleanTitle);
  const missKey = normalizeCacheKey(popupItem.name);
  const misses = await StorageService.get(CHRONOLOGY_MISSES_KEY) || {};

  if (!chronologyItem) {
    misses[missKey] = Date.now();
    await StorageService.set(CHRONOLOGY_MISSES_KEY, misses);
    throw new Error('Introuvable sur AniList');
  }

  if (misses[missKey]) {
    delete misses[missKey];
    await StorageService.set(CHRONOLOGY_MISSES_KEY, misses);
  }

  const cache = await StorageService.get(CHRONOLOGY_CACHE_KEY) || {};
  addCacheEntry(cache, popupItem.name, chronologyItem);
  addCacheEntry(cache, chronologyItem.name, chronologyItem);
  addCacheEntry(cache, chronologyItem.title, chronologyItem);
  await StorageService.set(CHRONOLOGY_CACHE_KEY, cache);
  return chronologyItem;
}

function createInProgressItem(popupItem, chronologyItem) {
  const progress = {
    currentEpisode: Number(popupItem.episode || 0),
    currentSaison: popupItem.saison || popupItem.season || null,
    episodeTitle: popupItem.title || '',
    currentTime: Number(popupItem.currentTime || 0),
    duration: Number(popupItem.duration || 0),
    lastUpdate: popupItem.lastUpdate || 0,
  };

  return {
    ...(chronologyItem || {}),
    id: chronologyItem?.id || `inprogress-${normalizeCacheKey(popupItem.name)}`,
    // Lets the page show the AniList lookup state of this card
    syncKey: chronologyItem ? null : getInProgressSyncKey(popupItem.name),
    name: chronologyItem?.name || popupItem.name,
    title: chronologyItem?.title || popupItem.name,
    link: popupItem.link || chronologyItem?.link || '',
    notif: popupItem.notif ?? chronologyItem?.notif ?? false,
    progress,
    isInProgress: true,
    lastUpdate: popupItem.lastUpdate || Date.now(),
  };
}

async function getStoredChronologyItems() {
  const lists = await getcreateStoredLists();
  const cache = {};

  for (const listName of lists) {
    if (listName === 'inprogress') continue;
    const items = await getListItems(listName);
    for (const item of items) {
      if (!item?.chronology) continue;
      addCacheEntry(cache, item.name, item);
      addCacheEntry(cache, item.title, item);
      addCacheEntry(cache, item.titles?.english, item);
      addCacheEntry(cache, item.titles?.romaji, item);
      addCacheEntry(cache, item.titles?.native, item);
    }
  }

  return cache;
}

function addCacheEntry(cache, title, item) {
  const key = normalizeCacheKey(title);
  if (key) cache[key] = item;
}

function findCachedChronologyItem(cache, title) {
  const exactKey = normalizeCacheKey(title);
  if (cache[exactKey]) return cache[exactKey];

  const looseKey = normalizeLooseKey(title);
  const match = Object.entries(cache).find(([cacheKey]) => {
    const looseCacheKey = normalizeLooseKey(cacheKey);
    return looseCacheKey === looseKey
      || looseCacheKey.includes(looseKey)
      || looseKey.includes(looseCacheKey);
  });

  return match?.[1] || null;
}

function normalizeCacheKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '');
}

function normalizeLooseKey(value) {
  return normalizeCacheKey(value)
    .replace(/-/g, '')
    .replace(/(.)\1+/g, '$1')
    .replace(/season|saison|part|cour/g, '');
}
