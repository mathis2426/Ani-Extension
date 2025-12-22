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
class NetflixSettings {
    constructor() {
        this.autoSkip = false; // Default auto-skip setting
        this.autoPlayNext = false; // Default auto-play next episode setting
    }
}
class OpenSubtitlesSettings {
    constructor() {
        this.token = "";
        this.tokenExpiration = 0;
        this.saveCredentials = false; // Default save credentials setting
        this.language = "en"; // Default language
    }
}

class SubtitleCustomizationSettings {
    constructor() {
        this.fontSize = 0.9; // Default font size value
        this.fontSizeUnit = "em"; // Default unit (em or px)
        this.fontWeight = 700; // Default font weight (bold)
        this.fontFamily = 'Arial, "Helvetica Neue", Helvetica, sans-serif'; // Default font family
        this.customFont = ""; // Custom font family name
        this.color = "#ffffff"; // Default text color (white)
        this.background = "#000000"; // Default background color (black)
        this.backgroundOpacity = 0; // Default background opacity (0-100)
    }
}

class PlanningSettings {
    constructor() {
        this.syncGoogleCalendar = false; // Default Google Calendar sync setting
    }
}
class Settings {
    constructor() {
        this.theme = "dark"; // Default theme
        this.notificationsEnabled = false; // Default notification setting
        this.mailnotificationEnabled = false; // Default mail notification setting
        this.crunchyrollSettings = new CrunchyrollSettings(); // Crunchyroll specific settings
        this.voiranimeSettings = new VoiranimeSettings(); // Voiranime specific settings
        this.netflixSettings = new NetflixSettings(); // Netflix specific settings
        this.planningSettings = new PlanningSettings(); // Planning specific settings
        this.openSubtitlesSettings = new OpenSubtitlesSettings(); // OpenSubtitles specific settings
        this.subtitleCustomization = new SubtitleCustomizationSettings(); // Subtitle customization settings
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