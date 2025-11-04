/*  OpenSubtitlesManager
    Manages OpenSubtitles authentication, subtitle search and download.
    Uses OpenSubtitlesService for API interactions.
    Ensures token validity and silent re-login if needed.
*/

import { OpenSubtitlesService } from "./src/services/OpenSubtitlesService.js";
import { OpenSubtitlesAPIKey } from "./temp-key-do-not-push.js";
import { StorageService } from "../services/StorageService.js";

let openSubtitlesService = null;



export class OpenSubtitlesManager {
    /**
     * Ensure OpenSubtitles auth is valid. If token is missing/expired, try to re-login
     * using locally stored credentials (chrome.storage.local.openSubtitlesCredentials).
     * On success, persist fresh token back to chrome.storage.sync settings.
     * @returns {Promise<boolean>} true if authenticated
     */
    async ensureOpenSubtitlesAuth() {
        if (!openSubtitlesService) {
            openSubtitlesService = new OpenSubtitlesService(OpenSubtitlesAPIKey);
        }

        // If token already valid, nothing to do
        if (openSubtitlesService.tokenValid()) return true;

        // Try load token from synced settings first
        try {
            const settings = await StorageService.getsync("settings");
            if (settings?.settings?.openSubtitlesSettings?.token) {
                openSubtitlesService._token = settings.settings.openSubtitlesSettings.token;
                openSubtitlesService._tokenExp = settings.settings.openSubtitlesSettings.tokenExpiration;
                if (openSubtitlesService.tokenValid()) return true;
            }
        } catch { }

        // Try silent re-login with locally saved credentials
        try {
            const { openSubtitlesCredentials } = await StorageService.get("openSubtitlesCredentials");
            const username = openSubtitlesCredentials?.username;
            const password = openSubtitlesCredentials?.password;
            if (username && password) {
                await openSubtitlesService.login(username, password);
                // Save new token back to sync settings
                const settings = await StorageService.get("settings");
                const s = settings.settings || {};
                s.openSubtitlesSettings = s.openSubtitlesSettings || {};
                s.openSubtitlesSettings.token = openSubtitlesService._token;
                s.openSubtitlesSettings.tokenExpiration = openSubtitlesService._tokenExp;
                await StorageService.set({ settings: s });
                return true;
            }
        } catch (e) {
            console.warn("Silent re-login failed:", e);
        }

        return false;
    }

    /**
     * Handle subtitle search in background
     */
    async SubtitleSearch(anime, sendResponse) {
        try {
            const ok = await ensureOpenSubtitlesAuth();
            if (!ok) { sendResponse({ success: false, error: "Non connecté à OpenSubtitles" }); return; }

            let foundSubtitle;
            try {
                foundSubtitle = await openSubtitlesService.searchEpisodeSubtitle(
                    anime.name,
                    anime.episode,
                    ["fr"]
                );
            } catch (e) {
                // Retry once on auth-related errors
                if ((e.message || "").includes("401") || (e.message || "").toLowerCase().includes("not authenticated")) {
                    const reok = await ensureOpenSubtitlesAuth();
                    if (reok) {
                        foundSubtitle = await openSubtitlesService.searchEpisodeSubtitle(
                            anime.name,
                            anime.episode,
                            ["fr"]
                        );
                    } else {
                        throw e;
                    }
                } else {
                    throw e;
                }
            }

            if (!foundSubtitle || (Array.isArray(foundSubtitle) && foundSubtitle.length === 0)) {
                sendResponse({ success: false, error: "Aucun sous-titre trouvé" });
                return;
            }

            sendResponse({ success: true, data: foundSubtitle });

        } catch (error) {
            console.error("Erreur recherche sous-titres:", error);
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle subtitle download in background
     */
    async SubtitleDownload(subtitle, anime, offsetMs, sendResponse) {
        try {
            const ok = await ensureOpenSubtitlesAuth();
            if (!ok) { sendResponse({ success: false, error: "Non connecté à OpenSubtitles" }); return; }
            const fileId = subtitle.attributes?.files?.[0]?.file_id;
            if (!fileId) {
                sendResponse({ success: false, error: "ID de fichier manquant" });
                return;
            }

            let subtitleContent;
            try {
                subtitleContent = await openSubtitlesService.downloadSubtitleContent(fileId);
            } catch (e) {
                if ((e.message || "").includes("401") || (e.message || "").toLowerCase().includes("not authenticated")) {
                    const reok = await ensureOpenSubtitlesAuth();
                    if (reok) subtitleContent = await openSubtitlesService.downloadSubtitleContent(fileId);
                    else throw e;
                } else {
                    throw e;
                }
            }

            sendResponse({
                success: true,
                content: subtitleContent,
                info: {
                    name: subtitle.attributes?.release || "Subtitle",
                    language: subtitle.attributes?.language || "fr"
                },
                offsetMs: offsetMs
            });

        } catch (error) {
            console.error("Erreur téléchargement sous-titre:", error);
            sendResponse({ success: false, error: error.message });
        }
    }
}