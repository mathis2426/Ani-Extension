import { StorageService } from '../../../services/StorageService.js';

export async function getcreateStoredLists() {
  const storedLists = await StorageService.getsync("ListsNames");
  if (!storedLists) {
    await StorageService.setsync("ListsNames", ["wishlist", "inprogress", "finished"]);
    const baseLists = ["wishlist", "inprogress", "finished"];
    for (const listName of baseLists) {
      await StorageService.setsync(`${listName}`, []);
    }
    return baseLists;
  }
  return storedLists;
}

export async function createList(listName) {
  const storedLists = await getcreateStoredLists();
  if (!storedLists.includes(listName)) {
    storedLists.push(listName);
    await StorageService.setsync("ListsNames", storedLists);
    await StorageService.setsync(`${listName}`, []);
  }
  return storedLists;
}

export async function renameList(oldName, newName) {
  const storedLists = await getcreateStoredLists();
  if (!oldName || !newName || oldName === newName || storedLists.includes(newName)) {
    return storedLists;
  }

  const index = storedLists.indexOf(oldName);
  if (index === -1) return storedLists;

  const listItems = await getListItems(oldName);
  storedLists[index] = newName;
  await StorageService.setsync("ListsNames", storedLists);
  await StorageService.setsync(newName, listItems);
  await removeSyncKey(oldName);
  return storedLists;
}

export async function removeList(listName) {
  const storedLists = await getcreateStoredLists();
  const index = storedLists.indexOf(listName);
  if (index > -1) {
    storedLists.splice(index, 1);
    await StorageService.setsync("ListsNames", storedLists);
    await removeSyncKey(listName);
  }
  return storedLists;
}

export async function getListItems(listName) {
  return (await StorageService.getsync(listName)) || [];
}

export async function setListItems(listName, items) {
  await StorageService.setsync(listName, Array.isArray(items) ? items : []);
  return getListItems(listName);
}

export async function addListItem(listName, item) {
  const items = await getListItems(listName);
  const id = item.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const nextItem = {
    ...item,
    id,
    addedAt: item.addedAt ?? Date.now(),
  };

  const exists = items.some((currentItem) => String(currentItem.id) === String(id));
  if (!exists) {
    items.unshift(nextItem);
    await setListItems(listName, items);
  }

  return items;
}

export async function updateListItem(listName, itemId, patch) {
  const items = await getListItems(listName);
  const nextItems = items.map((item) => (
    String(item.id) === String(itemId)
      ? { ...item, ...patch, updatedAt: Date.now() }
      : item
  ));
  await setListItems(listName, nextItems);
  return nextItems;
}

export async function removeListItem(listName, itemId) {
  const items = await getListItems(listName);
  const nextItems = items.filter((item) => String(item.id) !== String(itemId));
  await setListItems(listName, nextItems);
  return nextItems;
}

function removeSyncKey(key) {
  return new Promise((resolve) => {
    chrome.storage.sync.remove(key, resolve);
  });
}

