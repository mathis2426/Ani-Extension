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
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(`chrome.storage.local "${key}": ${chrome.runtime.lastError.message}`));
          return;
        }
        resolve();
      });
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

  /**
   * chrome.storage.sync is small: 8 KB per key, 100 KB in total.
   * Rejects (instead of failing silently) when a quota is exceeded.
   */
  async setsync(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(`chrome.storage.sync "${key}": ${chrome.runtime.lastError.message}`));
          return;
        }
        resolve();
      });
    });
  }
};
