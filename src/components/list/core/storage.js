// Chrome storage interactions

import { state, setPopupData, setAniLists, setCustomLists } from './state.js';

export function persistAniLists(lists) {
  chrome.storage.local.set({ aniLists: lists });
}

export function persistCustomLists(lists) {
  chrome.storage.local.set({ customLists: lists });
}

export function loadAllData(callback) {
  chrome.storage.local.get(["popupDataList", "aniLists", "customLists"], (result) => {
    setPopupData(result.popupDataList || []);
    setAniLists(result.aniLists || { wishlist: [], inprogress: [], finished: [] });
    setCustomLists(result.customLists || []);
    if (callback) callback();
  });
}

export function setupStorageListener(onPopupDataChange, onAniListsChange) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    
    if (changes.popupDataList) {
      setPopupData(changes.popupDataList.newValue || []);
      if (onPopupDataChange) onPopupDataChange();
    }
    
    if (changes.aniLists) {
      setAniLists(changes.aniLists.newValue || state.aniLists);
      if (onAniListsChange) onAniListsChange();
    }

    if (changes.customLists) {
      setCustomLists(changes.customLists.newValue || []);
      if (onAniListsChange) onAniListsChange();
    }
  });
}
