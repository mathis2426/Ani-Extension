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
  const nameA = (a.name || "").trim().toLowerCase();
  const nameB = (b.name || "").trim().toLowerCase();
  // Same link -> same entry
  if (a.link && b.link && a.link === b.link) return true;
  // If names match, consider same even if links differ (AniList vs streaming link)
  if (nameA && nameB && nameA === nameB) return true;
  return false;
}

export function existsInList(listArr, entry) {
  return (listArr || []).some((e) => isSameEntry(e, entry));
}

// Sync inprogress list to exactly match popupDataList (single source of truth)
export function syncPopupToInprogress() {
  // Preserve existing fields (like anilistBanner/anilistImage) when possible
  const current = state.aniLists.inprogress || [];

  const byLink = new Map();
  const byName = new Map();
  current.forEach(e => {
    if (e?.link) byLink.set(e.link, e);
    const n = (e?.name || '').trim().toLowerCase();
    if (n) byName.set(n, e);
  });

  const nextInprogress = state.popupData.map(a => {
    const nameNorm = (a?.name || '').trim().toLowerCase();
    const existing = (a?.link && byLink.get(a.link)) || byName.get(nameNorm);
    if (existing) {
      // Keep existing stored fields (images, etc.) but refresh name/link from popup
      return { ...existing, name: a.name, link: a.link };
    }
    // New entry with minimal fields
    return { name: a.name, link: a.link };
  });

  const next = { ...state.aniLists, inprogress: nextInprogress };
  state.aniLists = next;
  persistAniLists(next);

  // re-render if viewing inprogress
  if (state.selected === "inprogress") renderList();
}

export function addToList(key, entry) {
  const currentList = state.aniLists[key] || [];

  
  const next = { ...state.aniLists, [key]: [...currentList] };
  // Préserver tous les champs de l'entrée (images, etc.)
  const newEntry = {
    id: entry.id,
    name: entry.name,
    chronology: entry.chronology || {},
    link: entry.link,
    ...(entry.anilistBanner && { anilistBanner: entry.anilistBanner }),
    ...(entry.anilistImage && { anilistImage: entry.anilistImage })
  };
  uniquePush(next[key], newEntry);
  state.aniLists = next;
  persistAniLists(next);
  
  // Ne pas re-render, laisser le storage listener s'en charger pour éviter le double-render
  // if (state.selected !== "all" && state.selected === key) renderList();
}

export function removeFromList(key, link) {
  const next = { ...state.aniLists, [key]: (state.aniLists[key] || []).filter((e) => e.link !== link) };
  state.aniLists = next;
  persistAniLists(next);
  // Ne re-render que si on est sur la liste concernée
  if (state.selected === key) renderList();
}

export function moveItem(fromKey, toKey, link, name) {
  if (fromKey === toKey) return;
  
  // Vérifier si l'élément existe déjà dans la liste de destination
  const toArr = [...(state.aniLists[toKey] || [])];
  if (existsInList(toArr, { name, link })) {
    console.log('Entry already exists in destination list, removing from source only');
    // Juste supprimer de la source si déjà dans la destination
    const fromArr = (state.aniLists[fromKey] || []).filter((e) => e.link !== link);
    const next = { ...state.aniLists, [fromKey]: fromArr };
    state.aniLists = next;
    persistAniLists(next);
    renderList();
    return;
  }
  
  const fromArr = (state.aniLists[fromKey] || []).filter((e) => e.link !== link);
  uniquePush(toArr, { name, link });
  const next = { ...state.aniLists, [fromKey]: fromArr, [toKey]: toArr };
  state.aniLists = next;
  persistAniLists(next);
  // Ne re-render que si on est sur l'une des listes concernées
  if (state.selected === fromKey || state.selected === toKey) renderList();
}

export function removeListFromAniLists(listId) {
  const next = { ...state.aniLists };
  delete next[listId];
  state.aniLists = next;
  persistAniLists(next);
}
