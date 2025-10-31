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
    const openSubtitlesLanguageSelect = document.getElementById("openSubtitlesLanguage");
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

    // OpenSubtitles language
    if (openSubtitlesLanguageSelect) {
        openSubtitlesLanguageSelect.value = settings.openSubtitlesSettings.language || "fr";
    }
    // Update flag image for OpenSubtitles language
    const flagImg = document.getElementById("openSubtitlesLanguageFlag");
    if (flagImg && openSubtitlesLanguageSelect) {
        const code = openSubtitlesLanguageSelect.value || (settings.openSubtitlesSettings.language || "fr");
        const country = getFlagCountryCode(code);
    // use SVG for crisp rendering at any size
    flagImg.src = `https://flagcdn.com/${country}.svg`;
        flagImg.alt = `${code} flag`;
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

    // OpenSubtitles language change listener
    const openSubtitlesLanguageSelectEl = document.getElementById("openSubtitlesLanguage");
    if (openSubtitlesLanguageSelectEl) {
        openSubtitlesLanguageSelectEl.addEventListener("change", (e) => {
            settings.openSubtitlesSettings.language = e.target.value;
            saveSettings(settings);
            // update flag image
            const flagImg = document.getElementById("openSubtitlesLanguageFlag");
            if (flagImg) {
                const country = getFlagCountryCode(e.target.value);
                flagImg.src = `https://flagcdn.com/${country}.svg`;
                flagImg.alt = `${e.target.value} flag`;
            }
        });
    }

    // Test buttons
    document.getElementById("testApiOpenSubtitles").addEventListener("click", async () => {
        // openSubtitlesService.searchSubtitles({imdbid: "tt7441658", languages: ["fr"] })
        //     .then(results => {
        //         console.log("Search results:", results);
        //     })
        // openSubtitlesService.searchByImdbOrEpisode({imdbId: "7441658", season: 3, languages: "fr" })
        //     .then(results => {
        //         console.log("Search results:", results);
        //     });

        openSubtitlesService.searchSubtitles({ query: "Black clover s03e120", languages: ["fr"] })
            .then(results => {
                if (!results) {
                    console.log("Search results:", results);
                }
                else {
                    // Fallback to episode search
                    // openSubtitlesService.searchSubtitles({query: "Black Clover", languages: ["fr"] }).then(results => {
                    //     for (let i = 1; i <= results.total_pages; i++) {
                    //         openSubtitlesService.searchSubtitles({ query: "Black Clover", languages: ["fr"], page: i }).then(pageResults => {
                    //             pageResults.data.forEach(subtitle => {
                    //                 const a = subtitle.attributes || {};
                    //                 console.log(`Subtitle: ${a.release || a.files?.[0]?.file_name || "(no release)"} | Lang: ${a.language} | HI: ${a.hearing_impaired ? "yes" : "no"}`);
                    //             });
                    //         });
                    //         setTimeout(() => {}, 100000);
                    //     }
                    // });

                    // Fallback to episode search
                    const { seasonCounts, totalEpisodes, seasons } = getEpisodesPerSeasonFromOpenSubtitlesByImdb("7441658", ["fr"]);
                    console.log("Season counts from OpenSubtitles (by imdb):", seasonCounts, "TotalEpisodes:", totalEpisodes, "Seasons:", seasons);
                }

            });
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
                if (result.success) {
                    const best = result.subtitles?.[0];
                    const a = best?.attributes || {};
                    const feat = a.feature_details || {};
                    const release = a.release || a.files?.[0]?.file_name || "(no release)";
                    alert(
                        `Integrated Search (by title):\n` +
                        `Method: ${result.searchMethod}\n` +
                        `Episode (TMDb): ${result.tmdbInfo?.episode?.name || 'N/A'} ` +
                        `(S${result.tmdbInfo?.episode?.seasonNumber}E${result.tmdbInfo?.episode?.episodeNumber})\n` +
                        `Found: ${result.subtitles.length} subtitles\n` +
                        `Top pick: ${release}\n` +
                        `OS S/E: S${feat.season_number ?? '?'}E${feat.episode_number ?? '?'} ` +
                        `Lang: ${a.language || '?'} ` +
                        `HI: ${a.hearing_impaired ? 'yes' : 'no'}`
                    );
                } else {
                    alert(`Integrated Search failed: ${result.error}`);
                }
            } catch (error) {
                console.error("Integrated search error:", error);
                alert(`Integrated search failed: ${error.message}`);
            }
        });
    }
}


async function getEpisodesPerSeasonFromOpenSubtitlesByImdb(imdbId, languages = ["fr"]) {
    const seasonCounts = {};
    let page = 1;
    let totalPages = 1;

    // Normalize possible imdb id forms
    const idStr = String(imdbId || "").trim();
    const withTt = idStr.startsWith("tt") ? idStr : `tt${idStr}`;
    const withoutTt = idStr.startsWith("tt") ? idStr.slice(2) : idStr;

    try {
        do {
            // Essayer plusieurs clés que ton OpenSubtitlesService pourrait accepter.
            // Certains services demandent "imdbid" (avec tt...), d'autres "imdb_id" ou "imdbId" (sans tt).
            const tryParamsList = [
                { imdbid: withTt },
                { imdbid: withoutTt },
                { imdb_id: withTt },
                { imdb_id: withoutTt },
                { imdbId: withoutTt },
                { imdbId: withTt }
            ];

            let res = null;
            // Essayer chaque formulation jusqu'à obtenir des données
            for (const p of tryParamsList) {
                try {
                    // ajouter page & languages à chaque essai
                    const params = Object.assign({}, p, { page, languages });
                    res = await openSubtitlesService.searchSubtitles(params);
                } catch (e) {
                    // ignorer l'erreur, tenter la prochaine clé
                    res = null;
                }
                if (res && res.data && Array.isArray(res.data) && res.data.length > 0) break;
            }

            if (!res || !res.data || !Array.isArray(res.data)) {
                // Si aucune des formes n'a renvoyé de données, on sort
                break;
            }

            if (res.total_pages) totalPages = res.total_pages;

            for (const item of res.data) {
                const a = item.attributes || {};
                const feat = a.feature_details || {};

                let sn = feat.season_number ?? null;
                let en = feat.episode_number ?? null;

                // fallback: extraire depuis file_name / release
                if ((sn === null || en === null) && a.files && a.files.length > 0) {
                    const fname = a.files[0].file_name || a.release || "";
                    // regex pour S03E10, s03e10, 3x10, 03x10, 3-10, etc.
                    const m = fname.match(/(?:S?)(\d{1,2})[ ._xX-]?(?:E|e|x)(\d{1,3})/);
                    if (m) {
                        sn = sn ?? parseInt(m[1], 10);
                        en = en ?? parseInt(m[2], 10);
                    } else {
                        const m2 = fname.match(/(\d{1,2})x(\d{1,3})/);
                        if (m2) {
                            sn = sn ?? parseInt(m2[1], 10);
                            en = en ?? parseInt(m2[2], 10);
                        }
                    }
                }

                if (sn !== null && en !== null && !isNaN(sn) && !isNaN(en)) {
                    sn = Number(sn);
                    en = Number(en);
                    if (!seasonCounts[sn] || seasonCounts[sn] < en) {
                        seasonCounts[sn] = en;
                    }
                }
            }

            page++;
            if (!res.total_pages && page > 40) break; // sécurité : empêcher boucle infinie
        } while (page <= totalPages);

        const seasons = Object.keys(seasonCounts).map(n => parseInt(n, 10)).sort((a, b) => a - b);
        const totalEpisodes = seasons.reduce((acc, s) => acc + (seasonCounts[s] || 0), 0);

        return { seasonCounts, totalEpisodes, seasons };
    } catch (err) {
        console.error("Erreur getEpisodesPerSeasonFromOpenSubtitlesByImdb:", err);
        return { seasonCounts: {}, totalEpisodes: 0, seasons: [] };
    }
}

/**
 * Convertit un numéro d'épisode global (1-based) en saison/épisode
 * (identique à la version précédente)
 */
function globalEpisodeToSeasonEpisode(globalEpisode, seasonCounts) {
    if (!globalEpisode || globalEpisode < 1) return null;
    const seasons = Object.keys(seasonCounts).map(n => parseInt(n,10)).sort((a,b) => a-b);
    let remaining = globalEpisode;
    for (const s of seasons) {
        const count = seasonCounts[s] || 0;
        if (remaining <= count) {
            return { season: s, episode: remaining, overflow: false };
        }
        remaining -= count;
    }
    const lastSeason = seasons.length ? seasons[seasons.length - 1] : 1;
    const guessedSeason = lastSeason + Math.ceil(remaining / (seasonCounts[lastSeason] || 12));
    const guessedEpisode = remaining;
    return { season: guessedSeason, episode: guessedEpisode, overflow: true };
}

/**
 * Map a language ISO to a country code suitable for flag images.
 * Some languages don't have a single country; we choose a representative flag.
 */
function getFlagCountryCode(lang) {
    if (!lang) return 'fr';
    const l = lang.toLowerCase();
    switch (l) {
        case 'en': return 'gb'; // use UK flag for english
        case 'ja': return 'jp';
        case 'pt': return 'pt';
        case 'es': return 'es';
        case 'de': return 'de';
        case 'it': return 'it';
        case 'ru': return 'ru';
        case 'fr':
        default:
            return 'fr';
    }
}