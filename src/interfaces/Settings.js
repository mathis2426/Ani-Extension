class CrunchyrollSettings {
    constructor() {
        this.autoSkip = false; // Default auto-skip setting
        this.autoPlayNext = false; // Default auto-play next episode setting

    }
}
class VoiranimeSettings {
    constructor() {
        this.autoSkip = false; // Default auto-play setting
        this.autoPlayNext = false; // Default auto-play next episode setting
        this.autoSkipAds = false; // Default auto-skip ads setting
    }
}
class OpenSubtitlesSettings {
    constructor() {
        this.token = "";
        this.tokenExpiration = 0;
    }
}
class Settings {
    constructor() {
        this.theme = "dark"; // Default theme
        this.notificationsEnabled = false; // Default notification setting
        this.mailnotificationEnabled = false; // Default mail notification setting
        this.crunchyrollSettings = new CrunchyrollSettings(); // Crunchyroll specific settings
        this.voiranimeSettings = new VoiranimeSettings(); // Voiranime specific settings
        this.openSubtitlesSettings = new OpenSubtitlesSettings(); // OpenSubtitles specific settings
    }
}

export function getOrCreateSettings(callback) {
    chrome.storage.sync.get(["settings"], (result) => {
        if (chrome.runtime.lastError) {
            const defaultSettings = new Settings();
            chrome.storage.sync.set({ settings: defaultSettings }, () => {
                callback(defaultSettings);
            });
        } else if (!result.settings) {
            const defaultSettings = new Settings();
            chrome.storage.sync.set({ settings: defaultSettings }, () => {
                callback(defaultSettings);
            });
        } else {
            callback(result.settings);
        }
    });
}

export function saveSettings(settings, callback) {
    chrome.storage.sync.set({ settings }, () => {
        if (callback) callback();
    });
}