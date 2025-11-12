// State management for list component

export const DEFAULT_LISTS = ["wishlist", "inprogress", "finished"];

export const LIST_LABELS = {
  home: { title: "Home", sub: "Personnalisez votre tableau" },
  wishlist: { title: "Wishlist", sub: "Animés à regarder plus tard" },
  inprogress: { title: "En cours", sub: "Animés en cours de visionnage" },
  finished: { title: "Terminés", sub: "Animés terminés" },
  all: { title: "Tous", sub: "Tous les animés détectés" },
};

export const state = {
  selected: "home",
  popupData: [],
  aniLists: { wishlist: [], inprogress: [], finished: [] },
  customLists: [], // Array of { id, name, description }
  displayMode: 'list',
  listSort: 'name-asc'
};

// Track open dropdown to close on outside clicks
export let openDropdown = null;

export function setOpenDropdown(dropdown) {
  openDropdown = dropdown;
}

export function setSelectedList(listKey) {
  state.selected = listKey;
}

export function setPopupData(data) {
  state.popupData = data;
}

export function setAniLists(lists) {
  state.aniLists = lists;
}

export function setDisplayMode(mode) {
  if(mode === 'list' || mode === 'grid') state.displayMode = mode;
}

export function setListSort(sort) {
  const allowed = ['name-asc','name-desc','progress','recent'];
  if(allowed.includes(sort)) state.listSort = sort;
}

export function setCustomLists(lists) {
  state.customLists = lists || [];
}

export function addCustomList(list) {
  state.customLists.push(list);
  return list;
}

export function removeCustomList(listId) {
  state.customLists = state.customLists.filter(list => list.id !== listId);
  // Also remove from aniLists if it exists
  if (state.aniLists[listId]) {
    delete state.aniLists[listId];
  }
  // Remove from labels
  if (LIST_LABELS[listId]) {
    delete LIST_LABELS[listId];
  }
}
