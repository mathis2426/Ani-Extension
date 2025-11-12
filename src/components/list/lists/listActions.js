// List actions: add, remove, move, sync

import { state } from '../core/state.js';
import { persistAniLists } from '../core/storage.js';
import { renderList } from './listRenderer.js';

export function uniquePush(arr, entry) {
  const exists = arr.some((e) => isSameEntry(e, entry));
  if (!exists) arr.push(entry);
}

export function isSameEntry(a, b) {
  if (!a || !b) return false;
  if (a.link && b.link) return a.link === b.link;
  // fallback to name match (case-insensitive)
  return (a.name || "").trim().toLowerCase() === (b.name || "").trim().toLowerCase();
}

export function existsInList(listArr, entry) {
  return (listArr || []).some((e) => isSameEntry(e, entry));
}

// Ensure all popupData anime are present in inprogress (promote from wishlist if needed)
export function syncPopupToInprogress() {
  let changed = false;
  const next = {
    wishlist: [...(state.aniLists.wishlist || [])],
    inprogress: [...(state.aniLists.inprogress || [])],
    finished: [...(state.aniLists.finished || [])],
  };

  for (const a of state.popupData) {
    const entry = { name: a.name, link: a.link };
    const inFinished = existsInList(next.finished, entry);
    const inProgress = existsInList(next.inprogress, entry);
    const inWishlist = existsInList(next.wishlist, entry);

    // If already finished, don't auto-add to inprogress
    if (inFinished || inProgress) continue;

    if (inWishlist) {
      // promote from wishlist to inprogress
      next.wishlist = next.wishlist.filter((e) => !isSameEntry(e, entry));
      uniquePush(next.inprogress, entry);
      changed = true;
    } else {
      // add to inprogress
      uniquePush(next.inprogress, entry);
      changed = true;
    }
  }

  if (changed) {
    state.aniLists = next;
    persistAniLists(next);
    // re-render if viewing inprogress
    if (state.selected === "inprogress") renderList();
  }
}

export function addToList(key, entry) {
  const next = { ...state.aniLists, [key]: [...(state.aniLists[key] || [])] };
  uniquePush(next[key], { name: entry.name, link: entry.link });
  state.aniLists = next;
  persistAniLists(next);
  if (state.selected !== "all" && state.selected === key) renderList();
}

export function removeFromList(key, link) {
  const next = { ...state.aniLists, [key]: (state.aniLists[key] || []).filter((e) => e.link !== link) };
  state.aniLists = next;
  persistAniLists(next);
  renderList();
}

export function moveItem(fromKey, toKey, link, name) {
  if (fromKey === toKey) return;
  const fromArr = (state.aniLists[fromKey] || []).filter((e) => e.link !== link);
  const toArr = [...(state.aniLists[toKey] || [])];
  uniquePush(toArr, { name, link });
  const next = { ...state.aniLists, [fromKey]: fromArr, [toKey]: toArr };
  state.aniLists = next;
  persistAniLists(next);
  renderList();
}

export function removeListFromAniLists(listId) {
  const next = { ...state.aniLists };
  delete next[listId];
  state.aniLists = next;
  persistAniLists(next);
}
