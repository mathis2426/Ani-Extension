import { StorageService } from '../../../services/StorageService.js';

export const state = {
  popupData: [],
};

export async function loadPopupData() {
  const popupDataList = (await StorageService.getsync('popupDataList')) || {};

  state.popupData = Object.entries(popupDataList)
    .filter(([, entry]) => Array.isArray(entry?.history) && entry.history.length > 0)
    .sort((a, b) => {
      const lastA = a[1].history[0]?.lastUpdate ?? 0;
      const lastB = b[1].history[0]?.lastUpdate ?? 0;
      return lastB - lastA;
    })
    .map(([name, entry]) => ({
      name,
      notif: entry.notif ?? false,
      ...entry.history[0],
    }));

  return state.popupData;
}

export function setPopupData(nextPopupData) {
  state.popupData = Array.isArray(nextPopupData) ? nextPopupData : [];
}
