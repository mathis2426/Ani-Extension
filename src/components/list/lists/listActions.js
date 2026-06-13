import { addListItem, getListItems, removeListItem } from '../core/storage.js';
import { createAnimeListItemFromAnilist } from './chronologyService.js';

export async function addAnilistAnimeToList(listName, anilistId) {
  const item = await createAnimeListItemFromAnilist(anilistId);
  if (!item) return getListItems(listName);

  await addListItem(listName, item);
  return getListItems(listName);
}

export async function removeAnimeFromList(listName, itemId) {
  await removeListItem(listName, itemId);
  return getListItems(listName);
}
