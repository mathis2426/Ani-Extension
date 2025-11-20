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

// Debounce pour éviter les mises à jour trop rapides
let storageUpdateTimeout = null;

export function setupStorageListener(onPopupDataChange, onAniListsChange) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    
    // Annuler la mise à jour précédente si elle arrive trop vite
    if (storageUpdateTimeout) {
      clearTimeout(storageUpdateTimeout);
    }
    
    storageUpdateTimeout = setTimeout(() => {
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
      
      storageUpdateTimeout = null;
    }, 10); // Attendre seulement 10ms pour un rendu plus fluide
  });
}
