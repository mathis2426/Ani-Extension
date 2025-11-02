/**
 * File Name      : navigationUtils.js
 * Description    : Utility functions for detecting navigation changes in SPAs.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Last Updated   : 2025-11-02
 * Version        : 1.0.0
 */

/**
 * Detects changes in the URL and calls the callback function for Single Page Applications (SPA)
 * Useful for sites like Crunchyroll that use client-side routing
 * @param {Function} callback - Function to call when navigation is detected
 */
function SPADetectChange(callback) {
  callback();
  let currentUrl = location.href;

  function handleEpisodeChange() {
    if (location.href !== currentUrl && location.href.includes('/watch/')) {
      currentUrl = location.href;
      callback();
    }
  }

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    setTimeout(handleEpisodeChange, 100);
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    setTimeout(handleEpisodeChange, 100);
  };

  const observer = new MutationObserver(() => {
    handleEpisodeChange();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  handleEpisodeChange();
}
