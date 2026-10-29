import {
  addListItem,
  getcreateStoredLists,
  getListItems,
  removeListItem,
  updateListItem,
} from '../core/storage.js';
import { createAnimeListItemFromAnilist } from './chronologyService.js';
import { enqueueJob } from './syncQueue.js';

/**
 * Add an anime to a list right away (with the data we already have from the
 * search result), then fetch its full chronology in the background.
 * @param {string} listName
 * @param {object} searchResult anime returned by AnilistService.searchAnimes
 */
export async function addAnilistAnimeToList(listName, searchResult) {
  const existingItems = await getListItems(listName);
  const alreadyInList = existingItems.find((item) => String(item.id) === String(searchResult.id));
  if (alreadyInList) {
    return { items: existingItems, added: false };
  }

  const placeholder = {
    id: searchResult.id,
    name: searchResult.title,
    title: searchResult.title,
    titles: searchResult.titles || {},
    cover: searchResult.cover || null,
    banner: searchResult.banner || null,
    status: searchResult.status || null,
    format: searchResult.format || null,
    genres: searchResult.genres || [],
    link: `https://anilist.co/anime/${searchResult.id}`,
    chronologyPending: true,
  };

  const items = await addListItem(listName, placeholder);
  queueChronologyFetch(listName, placeholder);
  return { items, added: true };
}

/** Key used to follow the background job of a list item */
export function getListItemSyncKey(listName, itemId) {
  return `list:${listName}:${itemId}`;
}

/** Fetch (in the background) the full chronology of an item already in a list */
export function queueChronologyFetch(listName, item) {
  return enqueueJob({
    key: getListItemSyncKey(listName, item.id),
    kind: 'add',
    label: item.title || item.name || 'Anime',
    listName,
    run: async () => {
      const fullItem = await createAnimeListItemFromAnilist(item.id);
      if (!fullItem) throw new Error('Anime introuvable sur AniList');
      // Keep what the user already had (addedAt...), replace the rest
      await updateListItem(listName, item.id, { ...fullItem, chronologyPending: false });
      return fullItem;
    },
  });
}

/**
 * Items added while the page was closed too early keep `chronologyPending`:
 * resume their fetch when the page opens again.
 */
export async function resumePendingChronologies() {
  const lists = await getcreateStoredLists();
  for (const listName of lists) {
    if (listName === 'inprogress') continue;
    const items = await getListItems(listName);
    items
      .filter((item) => item?.chronologyPending)
      .forEach((item) => queueChronologyFetch(listName, item));
  }
}

export async function removeAnimeFromList(listName, itemId) {
  await removeListItem(listName, itemId);
  return getListItems(listName);
}
