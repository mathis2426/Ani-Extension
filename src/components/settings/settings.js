/**
 * File Name      : settings.css
 * Description    : Manage the logic of the setting page.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Last Updated   : 2025-09-29
 * Version        : 1.0.0
 */

import { getOrCreateSettings, saveSettings } from "../../interfaces/Settings.js";
import { OpenSubtitlesAPIKey } from "../../../temp-key-do-not-push.js";
import { OpenSubtitlesService } from "../../services/OpenSubtitlesService.js";

let settings;
let openSubtitlesService = new OpenSubtitlesService(OpenSubtitlesAPIKey);
let tmdbService = null;
let subtitlesSearchService = null;

document.addEventListener("DOMContentLoaded", () => {

    getOrCreateSettings((settings_data) => {
        settings = settings_data;

        updateSettingsUI(settings);
        setupEventListeners(settings);
        openSubtitlesService._token = settings.openSubtitlesSettings.token;
        openSubtitlesService._tokenExp = settings.openSubtitlesSettings.tokenExpiration;
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


    // ------------------ START: remplacement du handler testApiOpenSubtitles + helpers ------------------

    /**
     * Helpers pour la recherche plus intelligente sur OpenSubtitles (par nom de show)
     * - inferSeasonCountsFromShowName: construit seasonCounts en tenant compte de doublons (même numéro d'épisode mais titres distincts)
     * - mapGlobalToSeasonEpisode: utilise globalEpisodeToSeasonEpisode (existante)
     * - fetchSeasonEpisodesByShowName: tente de récupérer objets d'épisodes complets pour une saison (par query showName + season_number)
     */



    function extractSeasonEpisodeAndTitle(item) {
        const a = item?.attributes || {};
        const feat = a.feature_details || {};
        let sn = feat.season_number ?? null;
        let en = feat.episode_number ?? null;
        // Priorité : feature_details.title > movie_name > release > file_name
        let title = feat.title || feat.movie_name || a.release || (a.files && a.files[0] && a.files[0].file_name) || "";

        // fallback parse filename si manque sn/en
        if ((sn === null || en === null) && a.files && a.files.length > 0) {
            const fname = a.files[0].file_name || a.release || "";
            // patterns communs : S01E02, S1E2, 01x02, 1x2, - 102 (rare)
            const m = fname.match(/S?(\d{1,2})[ ._xX-]?(?:E|e|x)(\d{1,3})/);
            if (m) {
                sn = sn ?? parseInt(m[1], 10);
                en = en ?? parseInt(m[2], 10);
            } else {
                const m2 = fname.match(/(\d{1,2})x(\d{1,3})/);
                if (m2) {
                    sn = sn ?? parseInt(m2[1], 10);
                    en = en ?? parseInt(m2[2], 10);
                } else {
                    // fallback: try split like Show.Name.S01.E02 or Show.Name.102 (season+ep)
                    const m3 = fname.match(/(?:S?)(\d)(\d{2})\b/);
                    if (m3) {
                        // ex: 102 -> season 1 episode 02
                        sn = sn ?? parseInt(m3[1], 10);
                        en = en ?? parseInt(m3[2], 10);
                    }
                }
            }
            if (!title) title = fname;
        }

        if (sn !== null && en !== null && !isNaN(sn) && !isNaN(en)) {
            sn = Number(sn);
            en = Number(en);
        } else {
            sn = null; en = null;
        }
        const normTitle = normalizeTitle(title);
        return { sn, en, normTitle, rawTitle: title };
    }


    async function inferSeasonCountsFromShowName(showName, languages = ["fr"], maxPages = 20) {
        if (!showName || !showName.trim()) return { seasonCounts: {}, seasons: [], totalEpisodes: 0 };
        // Groupes: season -> (episode_number -> Set(titres normalisés))
        const seasonGroups = new Map();
        let page = 1;
        let totalPages = 1;

        try {
            do {
                const res = await openSubtitlesService.searchSubtitles({
                    query: showName,
                    type: "episode",
                    languages,
                    page,
                    per_page: 100,
                    order_by: "download_count"
                });

                if (!res || !Array.isArray(res.data) || res.data.length === 0) break;
                if (res.total_pages) totalPages = res.total_pages;

                for (const item of res.data) {
                    const { sn, en, normTitle } = extractSeasonEpisodeAndTitle(item);
                    if (sn == null || en == null) continue;
                    let epMap = seasonGroups.get(sn);
                    if (!epMap) { epMap = new Map(); seasonGroups.set(sn, epMap); }
                    let titleSet = epMap.get(en);
                    if (!titleSet) { titleSet = new Set(); epMap.set(en, titleSet); }
                    titleSet.add(normTitle || "(untitled)");
                }

                page++;
                if (page > maxPages) break; // sécurité
            } while (page <= totalPages);

            const seasons = Array.from(seasonGroups.keys()).sort((a, b) => a - b);
            const seasonCounts = {};
            for (const s of seasons) {
                const epMap = seasonGroups.get(s);
                let sum = 0;
                for (const set of epMap.values()) sum += set.size;
                seasonCounts[s] = sum;
            }
            const totalEpisodes = seasons.reduce((acc, s) => acc + (seasonCounts[s] || 0), 0);
            return { seasonCounts, seasons, totalEpisodes };
        } catch (e) {
            console.error("inferSeasonCountsFromShowName error:", e);
            return { seasonCounts: {}, seasons: [], totalEpisodes: 0 };
        }
    }

    async function fetchSeasonEpisodesByShowName(showName, seasonNumber, languages = ["fr"]) {
        // Tente de récupérer objets pour la saison en interrogeant OpenSubtitles avec query + season_number
        if (!showName || !seasonNumber) return [];
        let page = 1;
        let totalPages = 1;
        const byEpisode = new Map();

        try {
            do {
                const res = await openSubtitlesService.searchSubtitles({
                    query: showName,
                    type: "episode",
                    season_number: seasonNumber,
                    languages,
                    page,
                    per_page: 100,
                    order_by: "download_count"
                });

                if ((!res || !Array.isArray(res.data)) || res.data.length === 0) {
                    // Fallback: essayer sans season_number (tout le show) mais filtrer localement
                    const res2 = await openSubtitlesService.searchSubtitles({
                        query: showName,
                        type: "episode",
                        languages,
                        page,
                        per_page: 100,
                        order_by: "download_count"
                    });
                    if (!res2 || !Array.isArray(res2.data) || res2.data.length === 0) break;
                    // on utilisera res2
                    for (const item of res2.data) {
                        const a = item.attributes || {};
                        const feat = a.feature_details || {};
                        const ep = Number(feat.episode_number);
                        const sn = Number(feat.season_number);
                        if (sn === seasonNumber && ep && !byEpisode.has(ep)) byEpisode.set(ep, item);
                    }
                    if (res2.total_pages) totalPages = res2.total_pages;
                } else {
                    for (const item of res.data) {
                        const a = item.attributes || {};
                        const feat = a.feature_details || {};
                        const ep = Number(feat.episode_number);
                        if (!isNaN(ep) && !byEpisode.has(ep)) byEpisode.set(ep, item);
                    }
                    if (res.total_pages) totalPages = res.total_pages;
                }

                page++;
                if (!totalPages && page > 40) break;
            } while (page <= totalPages);

            return Array.from(byEpisode.entries()).sort((a, b) => a[0] - b[0]).map(([_, item]) => item);
        } catch (e) {
            console.error("fetchSeasonEpisodesByShowName error:", e);
            return [];
        }
    }

    /**
     * Crée une fenêtre (neighbors) autour d'un épisode : [ep - window, ..., ep, ..., ep + window]
     * et renvoie les objets disponibles (si fournis) sinon seulement les indices
     */
    function buildEpisodeWindow(centerEpisode, windowSize = 2, seasonCount = null) {
        const list = [];
        for (let i = centerEpisode - windowSize; i <= centerEpisode + windowSize; i++) {
            if (i >= 1) list.push(i);
        }
        return list;
    }

    /**
     * Remplacement du handler du bouton testApiOpenSubtitles :
     * - lecture des inputs (ids: testAnimeName, testEpisode, testSeason, testLanguage)
     * - comportement décrit dans la demande
     */
    const testApiOpenSubtitlesBtn = document.getElementById("testApiOpenSubtitles");
    if (testApiOpenSubtitlesBtn) {
        testApiOpenSubtitlesBtn.addEventListener("click", async () => {
            const showNameInput = document.getElementById("testAnimeName");
            const epInput = document.getElementById("testEpisode");
            const seasonInput = document.getElementById("testSeason");
            const langInput = document.getElementById("testLanguage");

            const showName = showNameInput ? showNameInput.value.trim() : "";
            const epRaw = epInput ? epInput.value.trim() : "";
            const seasonRaw = seasonInput ? seasonInput.value.trim() : "";
            const langRaw = langInput ? langInput.value.trim() : "fr";

            if (!showName) {
                alert("Veuillez renseigner le nom de l'anime (testAnimeName).");
                return;
            }
            if (!epRaw) {
                alert("Veuillez renseigner le numéro d'épisode (testEpisode).");
                return;
            }

            const languages = langRaw ? [langRaw] : ["fr"];

            // essayer d'interpréter episode (peut être global ou numéro dans saison)
            const episodeNumberInput = Number(epRaw);
            if (isNaN(episodeNumberInput) || episodeNumberInput <= 0) {
                alert("Numéro d'épisode invalide.");
                return;
            }

            let providedSeason = null;
            if (seasonRaw && !isNaN(Number(seasonRaw))) {
                providedSeason = Number(seasonRaw);
            }

            try {
                // 1) Tentative "classique" : "ShowName SxxExx"
                const candidates = [];
                if (providedSeason) {
                    const pad = (n) => String(n).padStart(2, "0");
                    candidates.push(`${showName} S${pad(providedSeason)}E${String(episodeNumberInput).padStart(2, "0")}`);
                    candidates.push(`${showName} S${providedSeason}E${episodeNumberInput}`);
                    candidates.push(`${showName} ${providedSeason}x${episodeNumberInput}`);
                } else {
                    candidates.push(`${showName} Ep${episodeNumberInput}`);
                    candidates.push(`${showName} ${episodeNumberInput}`);
                    candidates.push(`${showName} episode ${episodeNumberInput}`);
                }

                console.log("Tentatives classiques:", candidates);

                let foundResults = null;
                for (const q of candidates) {
                    const res = await openSubtitlesService.searchSubtitles({ query: q, languages, page: 1, per_page: 50 });
                    if (res && Array.isArray(res.data) && res.data.length > 0) {
                        foundResults = { method: "classicQuery", query: q, res };
                        break;
                    }
                }

                // 2) Si rien trouvé, tenter inférences plus larges (récupère seasonCounts basé sur le nom)
                let seasonCountsInfo = null;
                if (!foundResults) {
                    seasonCountsInfo = await inferSeasonCountsFromShowName(showName, languages);
                    console.log("seasonCountsInfo:", seasonCountsInfo);
                }

                // Si la saison n'a pas été fournie et que seasonCounts detecte quelque chose, on peut mapper global -> saison/ep
                let targetSeason = providedSeason;
                let targetEpisodeInSeason = null;
                if (!targetSeason && seasonCountsInfo && Object.keys(seasonCountsInfo.seasonCounts || {}).length > 0) {
                    // si l'utilisateur a donné un numéro d'épisode potentiellement global (ex: 120)
                    const mapping = globalEpisodeToSeasonEpisode(episodeNumberInput, seasonCountsInfo.seasonCounts);
                    if (mapping) {
                        targetSeason = mapping.season;
                        targetEpisodeInSeason = mapping.episode;
                        console.log(`Mapping global ${episodeNumberInput} -> S${targetSeason} E${targetEpisodeInSeason} (overflow: ${mapping.overflow})`);
                    }
                } else if (targetSeason) {
                    targetEpisodeInSeason = episodeNumberInput;
                }

                // 3) Si trouvé via classicQuery : renvoyer directement le premier résultat
                if (foundResults) {
                    const res = foundResults.res;
                    const first = res.data[0];
                    const a = first.attributes || {};
                    const feat = a.feature_details || {};
                    let sn = feat.season_number ?? null;
                    let en = feat.episode_number ?? null;

                    // fallback parse filename
                    if ((sn === null || en === null) && a.files && a.files.length > 0) {
                        const fname = a.files[0].file_name || a.release || "";
                        const m = fname.match(/(?:S?)(\d{1,2})[ ._xX-]?(?:E|e|x)(\d{1,3})/);
                        if (m) {
                            sn = sn ?? parseInt(m[1], 10);
                            en = en ?? parseInt(m[2], 10);
                        }
                    }

                    // Renvoyer directement l'épisode trouvé sans fenêtre
                    const result = {
                        method: "classicQuery",
                        query: foundResults.query,
                        season: sn !== null ? Number(sn) : null,
                        episode: en !== null ? Number(en) : null,
                        item: first
                    };

                    console.log("Épisode trouvé (classicQuery) :", result);
                    const title = feat.title || feat.movie_name || a.release || a.files?.[0]?.file_name || "(no title)";
                    alert(`Épisode trouvé !\nRequête: ${foundResults.query}\nTitre: ${title}\nSaison: ${sn ?? '?'}\nÉpisode: ${en ?? '?'}\nLangue: ${a.language || '?'}\nVoir console pour détails`);
                    return;
                }

                // // 4) Si rien trouvé en classique, mais on a seasonCountsInfo et mapping -> tenter récupérer la saison cible et renvoyer fenêtre
                // if (!foundResults && targetSeason) {
                //     const seasonEpisodes = await fetchSeasonEpisodesByShowName(showName, Number(targetSeason), languages);
                //     if (seasonEpisodes && seasonEpisodes.length > 0) {
                //         const mapByEp = new Map();
                //         for (const it of seasonEpisodes) {
                //             const a = it.attributes || {};
                //             const f = a.feature_details || {};
                //             const epNum = Number(f.episode_number);
                //             if (!isNaN(epNum) && !mapByEp.has(epNum)) mapByEp.set(epNum, it);
                //         }

                //         const center = targetEpisodeInSeason || episodeNumberInput;
                //         const windowList = buildEpisodeWindow(center, 2);
                //         const resultsWindow = windowList.map(epNum => ({
                //             season: Number(targetSeason),
                //             episode: epNum,
                //             item: mapByEp.get(epNum) || null
                //         }));

                //         console.log("Résultats (inférence + fetch saison par nom) :", resultsWindow);
                //         alert(`Résultats (inférence) : S${targetSeason}E${targetEpisodeInSeason}\n${resultsWindow.length} propositions affichées (voir console).`);
                //         return;
                //     } else {
                //         // On n'a pas d'objets pour la saison mais on peut quand même proposer indices basés sur seasonCountsInfo
                //         const center = targetEpisodeInSeason || episodeNumberInput;
                //         const windowList = buildEpisodeWindow(center, 2);
                //         const resultsWindow = windowList.map(epNum => ({
                //             season: Number(targetSeason),
                //             episode: epNum,
                //             item: null
                //         }));
                //         console.log("Pas d'objets récupérables pour la saison, propositions indices:", resultsWindow, "seasonCountsInfo:", seasonCountsInfo);
                //         alert(`Aucun objet OpenSubtitles récupéré pour S${targetSeason} — propositions d'indices renvoyées (voir console).`);
                //         return;
                //     }
                // }

                // // 5) Si vraiment rien, tenter recherches larges par showName + episode number (sans season) et proposer ce qu'on a
                // const broadQueries = [
                //     `${showName} ${episodeNumberInput}`,
                //     `${showName} episode ${episodeNumberInput}`,
                //     `${showName} ep ${episodeNumberInput}`
                // ];
                // let broadFound = null;
                // for (const q of broadQueries) {
                //     const res = await openSubtitlesService.searchSubtitles({ query: q, languages, page: 1, per_page: 50 });
                //     if (res && Array.isArray(res.data) && res.data.length > 0) {
                //         broadFound = { q, res };
                //         break;
                //     }
                // }

                // if (broadFound) {
                //     console.log("Résultats trouvés (broad queries):", broadFound.q, broadFound.res.data.slice(0, 30));
                //     alert(`Résultats (recherche large) trouvés pour "${broadFound.q}". Voir console pour la liste.`);
                //     return;
                // }

                // Rien du tout
                alert("Aucun sous-titre trouvé avec les méthodes testées. Voir la console pour les détails des tentatives.");
                console.log("Aucune piste trouvée - candidates:", candidates, "seasonCountsInfo:", seasonCountsInfo);
            } catch (err) {
                console.error("Erreur lors du test OpenSubtitles:", err);
                alert(`Erreur lors du test OpenSubtitles: ${err.message || err}`);
            }
        });
    }
    function normalizeTitle(raw) {
        if (!raw) return "";
        // enlever balises, releases techniques, year, résolutions, codecs, langues, etc.
        const TECH_RE = /\b(1080p|2160p|720p|webrip|web|bluray|bdrip|dvdrip|hdrip|x264|x265|aac|ddp\.?5?\.?1?|dts|proper|repack|multi|vostfr|vf|vo|eng|sub|subs|internal)\b/gi;
        const BRACKETS = /\[(?:[^\]]+)\]|\((?:[^\)]+)\)|\{(?:[^\}]+)\}/g;

        let s = String(raw).toLowerCase();
        s = s.replace(BRACKETS, " ");
        s = s.replace(TECH_RE, " ");
        s = s.replace(/[-_.]+/g, " ");
        // retirer années ( (2021) ), tags type S01E01, mais on garde S01E01 si utile ailleurs
        s = s.replace(/\b\d{4}\b/g, " ");
        // supprimer ponctuation et accents
        s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        s = s.replace(/[^\w\s]/g, " ");
        s = s.replace(/\s+/g, " ").trim();
        return s;
    }

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