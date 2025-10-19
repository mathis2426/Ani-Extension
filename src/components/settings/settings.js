/**
 * File Name      : settings.css
 * Description    : Manage the logic of the setting page.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Last Updated   : 2025-09-29
 * Version        : 1.0.0
 */

import { getOrCreateSettings, saveSettings } from "../../interfaces/Settings.js";
import { OpenSubtitlesAPIKey, TMDbAPIKey } from "../../../temp-key-do-not-push.js";
import { OpenSubtitlesService } from "../../services/OpenSubtitlesService.js"
import { TMDbService } from "../../services/TMDbService.js";
import { SubtitlesSearchService } from "../../services/SubtitlesSearchService.js";

let settings;
let openSubtitlesService = new OpenSubtitlesService(OpenSubtitlesAPIKey);
let tmdbService = null;
let subtitlesSearchService = null;

document.addEventListener("DOMContentLoaded", () => {

    getOrCreateSettings((settings_data) => {
        settings = settings_data;
        
        // Initialize with default TMDb key if not set
        if (!settings.tmdbSettings.apiKey && TMDbAPIKey !== 'YOUR_TMDB_API_KEY_HERE') {
            settings.tmdbSettings.apiKey = TMDbAPIKey;
        }
        
        updateSettingsUI(settings);
        setupEventListeners(settings);
        openSubtitlesService._token = settings.openSubtitlesSettings.token;
        openSubtitlesService._tokenExp = settings.openSubtitlesSettings.tokenExpiration;

        // Initialize TMDb service if API key is provided
        if (settings.tmdbSettings && settings.tmdbSettings.apiKey && settings.tmdbSettings.apiKey !== 'YOUR_TMDB_API_KEY_HERE') {
            try {
                tmdbService = new TMDbService(settings.tmdbSettings.apiKey);
                subtitlesSearchService = new SubtitlesSearchService(tmdbService, openSubtitlesService);
                console.log("TMDb service initialized successfully");
            } catch (error) {
                console.error("Failed to initialize TMDb service:", error);
            }
        }
    });

    const buttons = document.querySelectorAll(".button");
    const sections = document.querySelectorAll(".section");

    function clearActive() {
        buttons.forEach(btn => btn.classList.remove("active"));
    }

    function setActiveButton(id) {
        clearActive();
        const btn = document.getElementById(id);
        if (btn) btn.classList.add("active");
    }

    buttons.forEach(button => {
        button.addEventListener("click", (e) => {
            e.preventDefault();
            const id = button.id;
            const section = document.getElementById(`section-${id}`);
            if (section) {
                section.scrollIntoView({ behavior: "smooth", block: "start" });
                setActiveButton(id);
            }
        });
    });

    window.addEventListener("scroll", () => {
        let current = "";
        const scrollPosition = window.scrollY + window.innerHeight / 3;

        sections.forEach(section => {
            if (section.offsetTop <= scrollPosition) {
                current = section.id.replace("section-", "");
            }
        });

        if (current) {
            setActiveButton(current);
        }
    });
    setActiveButton("home");

});
function applyTheme(theme) {
    if (theme === "light") {
        document.documentElement.classList.add("light-theme");
        document.body.classList.add("light-theme");
    } else {
        document.documentElement.classList.remove("light-theme");
        document.body.classList.remove("light-theme");

    }
}
function asknotificationPermission() {
    if (Notification.permission === "denied") {
        alert("Vous avez refusé les notifications pour cette extension. Veuillez modifier vos paramètres de navigateur pour les activer.");
        return;
    }
    else if (Notification.permission === "granted") {
        const notif = new Notification("Notifications déjà activées", {
            body: "Vous avez déjà activé les notifications pour l'extension Ani-Extension.",
            icon: "../logo/logo-128.png",
            vibrate: [200, 100, 200],

        });

        return;
    }
    else {
        Notification.requestPermission().then(function (permission) {
            const notif = new Notification("Activation des notifications", {
                body: "Vous venez d'activer les notifications pour l'extension Ani-Extension.",
                icon: "../logo/logo-128.png",
                vibrate: [200, 100, 200]
            });
            settings.notificationsEnabled = true;
            saveSettings(settings);
            updateSettingsUI(settings);
        });


    }
}

function updateSettingsUI(settings) {
    applyTheme(settings.theme);
    // Général
    document.getElementById("darkMode").checked = settings.theme === "light";
    document.getElementById("notifications-mail").checked = settings.mailnotificationEnabled;
    document.getElementById("notifications-status").innerText = Notification.permission === "granted" ? "Notifications enabled" : "Notifications disabled";
    document.querySelector(".chrome-notifications").classList.add(Notification.permission === "granted" ? "success" : "alert");

    // OpenSubtitles
    const loginButton = document.getElementById("openSubtitlesConnect");
    const status = document.getElementById("openSubtitlesStatus");
    if (settings.openSubtitlesSettings.token) {
        document.getElementById("openSubtitlesEmail").style.display = "none";
        document.getElementById("openSubtitlesPassword").style.display = "none";
        status.textContent = "Connected to OpenSubtitles";
        status.classList.add("success");
        loginButton.textContent = "Logout";

    } else {
        document.getElementById("openSubtitlesEmail").style.display = "block";
        document.getElementById("openSubtitlesPassword").style.display = "block";
        status.textContent = "Not connected to OpenSubtitles";
        status.classList.add("alert");

        loginButton.textContent = "Login";
    }

    // TMDb
    if (settings.tmdbSettings) {
        const tmdbApiKeyInput = document.getElementById("tmdbApiKey");
        const tmdbEnabledCheckbox = document.getElementById("tmdbEnabled");
        const tmdbLanguageSelect = document.getElementById("tmdbLanguage");
        const tmdbStatusElement = document.getElementById("tmdbStatus");
        
        if (tmdbApiKeyInput) {
            tmdbApiKeyInput.value = settings.tmdbSettings.apiKey || "";
        }
        if (tmdbEnabledCheckbox) {
            tmdbEnabledCheckbox.checked = settings.tmdbSettings.enabled !== false;
        }
        if (tmdbLanguageSelect) {
            tmdbLanguageSelect.value = settings.tmdbSettings.language || "fr-FR";
        }
        if (tmdbStatusElement) {
            if (settings.tmdbSettings.apiKey) {
                tmdbStatusElement.textContent = "TMDb API Key configured";
                tmdbStatusElement.classList.remove("alert");
                tmdbStatusElement.classList.add("success");
            } else {
                tmdbStatusElement.textContent = "TMDb API Key not configured";
                tmdbStatusElement.classList.remove("success");
                tmdbStatusElement.classList.add("alert");
            }
        }
    }

    // Crunchyroll
    document.getElementById("skipIntroOutro").checked = settings.crunchyrollSettings.autoSkip;
    document.getElementById("autoNext").checked = settings.crunchyrollSettings.autoPlayNext;

    // Voiranime
    document.getElementById("voiranimeSkipIntro").checked = settings.voiranimeSettings.autoSkip;
    document.getElementById("voiranimeAutoNext").checked = settings.voiranimeSettings.autoPlayNext;

}

function setupEventListeners(settings) {
    document.getElementById("darkMode").addEventListener("change", (e) => {
        settings.theme = e.target.checked ? "light" : "dark";
        applyTheme(settings.theme);
        saveSettings(settings);
    });
    document.getElementById("notifications-extension").addEventListener("click", () => {
        asknotificationPermission();
        saveSettings(settings);
    });
    document.getElementById("notifications-mail").addEventListener("change", (e) => {
        settings.mailnotificationEnabled = e.target.checked;
        saveSettings(settings);
    });

    document.getElementById("skipIntroOutro").addEventListener("change", (e) => {
        settings.crunchyrollSettings.autoSkip = e.target.checked;
        saveSettings(settings);
    });
    document.getElementById("autoNext").addEventListener("change", (e) => {
        settings.crunchyrollSettings.autoPlayNext = e.target.checked;
        saveSettings(settings);
    });

    document.getElementById("voiranimeSkipIntro").addEventListener("change", (e) => {
        settings.voiranimeSettings.autoSkip = e.target.checked;
        saveSettings(settings);
    });
    document.getElementById("voiranimeAutoNext").addEventListener("change", (e) => {
        settings.voiranimeSettings.autoPlayNext = e.target.checked;
        saveSettings(settings);
    });
    document.getElementById("openSubtitlesConnect").addEventListener("click", async () => {

        if (document.getElementById("openSubtitlesConnect").textContent === "Login") {
            const email = document.getElementById("openSubtitlesEmail");
            const password = document.getElementById("openSubtitlesPassword");

            if (email.value && password.value) {
                try {
                    await openSubtitlesService.login(email.value, password.value);
                    email.style.display = "none";
                    password.style.display = "none";
                    let status = document.getElementById("openSubtitlesStatus")
                    status.textContent = "Connected to OpenSubtitles";
                    status.classList.remove("alert");
                    status.classList.add("success");
                    settings.openSubtitlesSettings.token = openSubtitlesService._token;
                    settings.openSubtitlesSettings.tokenExpiration = openSubtitlesService._tokenExp;
                    saveSettings(settings);


                } catch (error) {
                    console.error("Error:", error);
                }
            } else {
                alert("Please enter your OpenSubtitles credentials.");
            }
        } else {
            // Logout
            document.getElementById("openSubtitlesEmail").style.display = "block";
            document.getElementById("openSubtitlesPassword").style.display = "block";
            let status = document.getElementById("openSubtitlesStatus")
            status.textContent = "Not connected to OpenSubtitles";
            status.classList.remove("success");
            status.classList.add("alert");
            settings.openSubtitlesSettings.token = "";
            saveSettings(settings);
            document.getElementById("openSubtitlesConnect").textContent = "Login";
            await openSubtitlesService.logout();
        }
    });
    // TMDb settings
    const tmdbApiKeyInput = document.getElementById("tmdbApiKey");
    const tmdbEnabledCheckbox = document.getElementById("tmdbEnabled");
    const tmdbLanguageSelect = document.getElementById("tmdbLanguage");
    
    if (tmdbApiKeyInput) {
        tmdbApiKeyInput.addEventListener("change", (e) => {
            settings.tmdbSettings.apiKey = e.target.value.trim();
            saveSettings(settings);
            
            // Reinitialize services with new API key
            if (settings.tmdbSettings.apiKey) {
                tmdbService = new TMDbService(settings.tmdbSettings.apiKey);
                subtitlesSearchService = new SubtitlesSearchService(tmdbService, openSubtitlesService);
            }
            updateSettingsUI(settings);
        });
    }
    
    if (tmdbEnabledCheckbox) {
        tmdbEnabledCheckbox.addEventListener("change", (e) => {
            settings.tmdbSettings.enabled = e.target.checked;
            saveSettings(settings);
        });
    }
    
    if (tmdbLanguageSelect) {
        tmdbLanguageSelect.addEventListener("change", (e) => {
            settings.tmdbSettings.language = e.target.value;
            saveSettings(settings);
        });
    }

    // Test buttons
    document.getElementById("testApiOpenSubtitles").addEventListener("click", async () => {
        openSubtitlesService.searchSubtitles({tmdb_id: 2058052, languages: ["fr"] })
            .then(results => {
                console.log("Search results:", results);
            })
    });
    
    const testTmdbButton = document.getElementById("testApiTMDb");
    if (testTmdbButton) {
        testTmdbButton.addEventListener("click", async () => {
            if (!tmdbService) {
                alert("Please configure TMDb API key first");
                return;
            }
            
            try {
                // Test by episode title (more reliable)
                const result = await tmdbService.searchEpisodeByTitle({
                    showName: "Black Clover",
                    episodeTitle: "L'aube",
                    language: settings.tmdbSettings.language || "fr-FR"
                });
                console.log("TMDb test result:", result);
                alert(`TMDb Test (by title):\n${result.success ? 
                    `Found: ${result.tvShow.name}\nEpisode: ${result.episode.name}\nSeason: ${result.episode.seasonNumber}\nEpisode: ${result.episode.episodeNumber}\nMatch: ${result.matchType}` : 
                    `Error: ${result.error}`}`);
            } catch (error) {
                console.error("TMDb test error:", error);
                alert(`TMDb test failed: ${error.message}`);
            }
        });
    }
    
    const testIntegratedSearchButton = document.getElementById("testIntegratedSearch");
    if (testIntegratedSearchButton) {
        testIntegratedSearchButton.addEventListener("click", async () => {
            if (!subtitlesSearchService) {
                alert("Please configure TMDb and OpenSubtitles first");
                return;
            }
            
            try {
                // Test with episode title (more reliable than episode number)
                const result = await subtitlesSearchService.searchSubtitles({
                    showName: "Black Clover",
                    episodeTitle: "L'aube", // Search by title instead of number
                    languages: ["fr"],
                    targetLanguage: settings.tmdbSettings.language || "fr-FR"
                });
                console.log("Integrated search result:", result);
                alert(`Integrated Search (by title):\n${result.success ? 
                    `Found ${result.subtitles.length} subtitles\nMethod: ${result.searchMethod}\nEpisode: ${result.tmdbInfo?.episode?.name || 'N/A'}\nS${result.tmdbInfo?.episode?.seasonNumber}E${result.tmdbInfo?.episode?.episodeNumber}` : 
                    `Error: ${result.error}`}`);
            } catch (error) {
                console.error("Integrated search error:", error);
                alert(`Integrated search failed: ${error.message}`);
            }
        });
    }
}