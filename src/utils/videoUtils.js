/**
 * File Name      : videoUtils.js
 * Description    : Utility functions for video element management and detection.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Last Updated   : 2025-11-02
 * Version        : 1.0.0
 */

/**
 * Wait for the video element to be loaded in the DOM
 * Useful for pages where video is loaded dynamically
 * @returns {Promise<HTMLVideoElement>} - Promise that resolves with the video element
 */
async function waitVideoElement() {
  return new Promise((resolve) => {
    // Check if the video already exists
    const existing = document.getElementsByTagName("video")[0];
    if (existing) return resolve(existing);

    // Observe changes
    let observer = new MutationObserver(() => {
      const video = document.getElementsByTagName("video")[0];
      if (video) {
        resolve(video);
        observer.disconnect();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });
}
