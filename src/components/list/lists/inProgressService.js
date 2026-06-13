import { StorageService } from '../../../services/StorageService.js';
import { loadPopupData } from '../core/state.js';
import { getcreateStoredLists, getListItems } from '../core/storage.js';
import { createAnimeListItemFromTitle } from './chronologyService.js';

const CHRONOLOGY_CACHE_KEY = 'inprogressChronologyCache';

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

export async function hydrateInProgressChronologies(onUpdate) {
  const popupItems = await loadPopupData();
  if (!popupItems.length) return [];

  const storedChronologies = await getStoredChronologyItems();
  const cache = {
    ...(await StorageService.get(CHRONOLOGY_CACHE_KEY) || {}),
    ...storedChronologies,
  };

  for (const popupItem of popupItems) {
    if (findCachedChronologyItem(cache, popupItem.name)) continue;

    const chronologyItem = await createAnimeListItemFromTitle(popupItem.name).catch((error) => {
      console.warn('Unable to fetch in-progress chronology', popupItem.name, error);
      return null;
    });

    if (!chronologyItem) continue;

    addCacheEntry(cache, popupItem.name, chronologyItem);
    addCacheEntry(cache, chronologyItem.name, chronologyItem);
    addCacheEntry(cache, chronologyItem.title, chronologyItem);
    await StorageService.set(CHRONOLOGY_CACHE_KEY, cache);

    if (typeof onUpdate === 'function') {
      onUpdate(await loadInProgressItems());
    }
  }

  return loadInProgressItems();
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
