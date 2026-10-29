import { StorageService } from '../../../services/StorageService.js';

/*
 * Where list data lives
 * ---------------------
 * chrome.storage.sync  (8 KB per key, 100 KB total, shared between your Chrome profiles)
 *   ListsNames            -> ["wishlist", "inprogress", "finished", ...custom]
 *   <listName>            -> [{ id, title, addedAt }]   lightweight references only
 *
 * chrome.storage.local (10 MB, this browser only)
 *   animeDetails          -> { [id]: { cover, banner, genres, status, chronology, ... } }
 *
 * A reference whose details are missing locally (new computer, cleared data...)
 * comes back with `chronologyPending: true` and is fetched again from AniList.
 */

const DETAILS_KEY = 'animeDetails';
const SYNC_FIELDS = ['id', 'title', 'addedAt'];
// Flags that only make sense while the page is open, never stored
const RUNTIME_FIELDS = ['chronologyPending', 'syncKey'];

// All list writes go one after the other: a background update can no longer
// overwrite an item the user just added.
let writeQueue = Promise.resolve();
function withWriteLock(task) {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => {});
  return run;
}

export async function getcreateStoredLists() {
  const storedLists = await StorageService.getsync("ListsNames");
  if (!storedLists) {
    const baseLists = ["wishlist", "inprogress", "finished"];
    await StorageService.setsync("ListsNames", baseLists);
    for (const listName of baseLists) {
      await StorageService.setsync(`${listName}`, []);
    }
    return baseLists;
  }
  return storedLists;
}

export function createList(listName) {
  return withWriteLock(async () => {
    const storedLists = await getcreateStoredLists();
    if (!storedLists.includes(listName)) {
      storedLists.push(listName);
      await StorageService.setsync("ListsNames", storedLists);
      await StorageService.setsync(`${listName}`, []);
    }
    return storedLists;
  });
}

export function renameList(oldName, newName) {
  return withWriteLock(async () => {
    const storedLists = await getcreateStoredLists();
    if (!oldName || !newName || oldName === newName || storedLists.includes(newName)) {
      return storedLists;
    }

    const index = storedLists.indexOf(oldName);
    if (index === -1) return storedLists;

    const refs = await readRefs(oldName);
    await StorageService.setsync(newName, refs);
    storedLists[index] = newName;
    await StorageService.setsync("ListsNames", storedLists);
    await removeSyncKey(oldName);
    return storedLists;
  });
}

export function removeList(listName) {
  return withWriteLock(async () => {
    const storedLists = await getcreateStoredLists();
    const index = storedLists.indexOf(listName);
    if (index > -1) {
      storedLists.splice(index, 1);
      await StorageService.setsync("ListsNames", storedLists);
      await removeSyncKey(listName);
      await pruneUnusedDetails(storedLists);
    }
    return storedLists;
  });
}

/** Items of a list: sync references merged with their local details */
export async function getListItems(listName) {
  const rawItems = (await StorageService.getsync(listName)) || [];
  const details = await readDetails();

  // Old format (full items with chronology stored in sync): move details to local.
  // No write lock here (this is also called from inside locked writes); running
  // the migration twice is harmless.
  if (rawItems.some(isLegacyItem)) {
    await migrateLegacyList(listName);
    return getListItems(listName);
  }

  return rawItems.map((ref) => mergeRefWithDetails(ref, details[ref.id]));
}

export function setListItems(listName, items) {
  return withWriteLock(() => writeItems(listName, items));
}

export function addListItem(listName, item) {
  return withWriteLock(async () => {
    const items = await getListItems(listName);
    const id = item.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const exists = items.some((currentItem) => String(currentItem.id) === String(id));
    if (exists) return items;

    items.unshift({
      ...item,
      id,
      addedAt: item.addedAt ?? Date.now(),
    });
    return writeItems(listName, items);
  });
}

export function updateListItem(listName, itemId, patch) {
  return withWriteLock(async () => {
    const items = await getListItems(listName);
    const nextItems = items.map((item) => (
      String(item.id) === String(itemId)
        ? { ...item, ...patch, updatedAt: Date.now() }
        : item
    ));
    return writeItems(listName, nextItems);
  });
}

export function removeListItem(listName, itemId) {
  return withWriteLock(async () => {
    const items = await getListItems(listName);
    const nextItems = items.filter((item) => String(item.id) !== String(itemId));
    const result = await writeItems(listName, nextItems);
    await pruneUnusedDetails(await getcreateStoredLists());
    return result;
  });
}

// ===== internals =====

async function writeItems(listName, items) {
  const safeItems = Array.isArray(items) ? items : [];
  const details = await readDetails();

  for (const item of safeItems) {
    const itemDetails = toDetails(item);
    if (Object.keys(itemDetails).length) {
      details[item.id] = { ...(details[item.id] || {}), ...itemDetails };
    }
  }

  // Local first: if sync is refused, the details are not lost
  await StorageService.set(DETAILS_KEY, details);
  await StorageService.setsync(listName, safeItems.map(toRef));
  return safeItems.map((item) => mergeRefWithDetails(toRef(item), details[item.id]));
}

async function readRefs(listName) {
  const items = await getListItems(listName);
  return items.map(toRef);
}

function toRef(item) {
  const ref = {};
  for (const field of SYNC_FIELDS) {
    if (item[field] !== undefined && item[field] !== null) ref[field] = item[field];
  }
  if (!ref.title && item.name) ref.title = item.name;
  return ref;
}

function toDetails(item) {
  const details = {};
  for (const [key, value] of Object.entries(item)) {
    if (key === 'id' || key === 'addedAt' || RUNTIME_FIELDS.includes(key)) continue;
    if (value !== undefined) details[key] = value;
  }
  return details;
}

function mergeRefWithDetails(ref, details) {
  const merged = {
    ...(details || {}),
    ...ref,
    name: details?.name || ref.title,
    title: details?.title || ref.title,
  };
  // No chronology here yet (just added, or new computer): fetch it again
  merged.chronologyPending = !details?.chronologyFetchedAt && !details?.chronology;
  return merged;
}

function isLegacyItem(item) {
  return item && Object.keys(item).some((key) => !SYNC_FIELDS.includes(key));
}

async function migrateLegacyList(listName) {
  const rawItems = (await StorageService.getsync(listName)) || [];
  const details = await readDetails();
  const refs = rawItems.map((item) => {
    const itemDetails = toDetails(item);
    if (Object.keys(itemDetails).length) {
      details[item.id] = { ...(details[item.id] || {}), ...itemDetails };
    }
    return toRef(item);
  });
  await StorageService.set(DETAILS_KEY, details);
  await StorageService.setsync(listName, refs);
}

/** Drop local details no list refers to anymore */
async function pruneUnusedDetails(listNames) {
  const usedIds = new Set();
  for (const listName of listNames) {
    const refs = (await StorageService.getsync(listName)) || [];
    refs.forEach((ref) => usedIds.add(String(ref.id)));
  }
  const details = await readDetails();
  let changed = false;
  for (const id of Object.keys(details)) {
    if (!usedIds.has(String(id))) {
      delete details[id];
      changed = true;
    }
  }
  if (changed) await StorageService.set(DETAILS_KEY, details);
}

async function readDetails() {
  return (await StorageService.get(DETAILS_KEY)) || {};
}

function removeSyncKey(key) {
  return new Promise((resolve) => {
    chrome.storage.sync.remove(key, resolve);
  });
}
