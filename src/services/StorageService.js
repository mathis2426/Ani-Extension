/**
 * StorageService
 * Simplifies interactions with chrome.storage.local.
 */
export const StorageService = {
  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => resolve(result[key]));
    });
  },

  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  },

  async remove(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve);
    });
  },

  async getsync(key) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(key, (result) => resolve(result[key]));
    });
  },

  async setsync(key, value) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, resolve);
    });
  }
};
