/**
 * File Name      : utils.js
 * Description    : Main utility file - Re-exports all utility functions for backward compatibility.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Last Updated   : 2025-11-02
 * Version        : 2.0.0
 * 
 * Note: All utility functions are now loaded directly via manifest.json for content scripts.
 * For extension pages (popup, settings), use direct imports from specific files.
 */

// Note: This file is intentionally empty for content scripts.
// All utils are loaded individually via manifest.json.
// For ES6 module contexts (popup, settings, service worker), import directly from specific files:
// - import { normalizeTitle } from './subtitleUtils.js';
// - import { findBestMatch } from './subtitleSearchUtils.js';
// etc.

