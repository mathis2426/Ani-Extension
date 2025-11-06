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
        openSubtitlesLanguageSelect.value = settings.openSubtitlesSettings.language;
    }
    // Update flag image for OpenSubtitles language
    const flagImg = document.getElementById("openSubtitlesLanguageFlag");
    if (flagImg && openSubtitlesLanguageSelect) {
        const code = openSubtitlesLanguageSelect.value || settings.openSubtitlesSettings.language;
        const country = getFlagCountryCode(code);
    // use SVG for crisp rendering at any size
    flagImg.src = `https://flagcdn.com/${country}.svg`;
        flagImg.alt = `${code} flag`;
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
                    const result = await openSubtitlesService.login(email.value, password.value);
                    if (result.success && !settings.openSubtitlesSettings.saveCredentials) {
                        showCredentialSaveModal(email.value, password.value);
                    }
                    email.style.display = "none";
                    password.style.display = "none";
                    let status = document.getElementById("openSubtitlesStatus")
                    status.textContent = "Connected to OpenSubtitles";
                    status.classList.remove("alert");
                    status.classList.add("success");
                    settings.openSubtitlesSettings.token = openSubtitlesService._token;
                    settings.openSubtitlesSettings.tokenExpiration = openSubtitlesService._tokenExp;
                    saveSettings(settings);
                    document.getElementById("openSubtitlesConnect").textContent = "Logout";

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
            try { await chrome.storage.local.remove("openSubtitlesCredentials"); } catch {}
        }
    });

    document.getElementById("openSubtitlesLanguage").addEventListener("change", (e) => {
        settings.openSubtitlesSettings.language = e.target.value;
        saveSettings(settings);
        const flagImg = document.getElementById("openSubtitlesLanguageFlag");
        if (flagImg) {
            const country = getFlagCountryCode(e.target.value);
            flagImg.src = `https://flagcdn.com/${country}.svg`;
        }
    });
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


/**
 * Show modal asking user if they want to save credentials locally
 */
function showCredentialSaveModal(email, password) {
    settings.openSubtitlesSettings.saveCredentials = true;
    saveSettings(settings);
    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'credential-save-modal';
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: Arial, sans-serif;
    `;

    // Create modal content
    const content = document.createElement('div');
    content.style.cssText = `
        background: #1e1e1e;
        color: #fff;
        border-radius: 8px;
        padding: 24px;
        max-width: 450px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;

    content.innerHTML = `
        <h3 style="margin: 0 0 16px 0; font-size: 18px;">Sauvegarder les identifiants ?</h3>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #ccc;">
            Voulez-vous sauvegarder vos identifiants OpenSubtitles localement ?
            <br><br>
            <strong>Avantages :</strong> Reconnexion automatique quand le token expire
            <br>
            <strong>Attention :</strong> Les identifiants seront stockés en clair sur votre machine (non synchronisés)
        </p>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="credential-save-no" style="
                background: #555;
                color: #fff;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s;
            ">Non, merci</button>
            <button id="credential-save-yes" style="
                background: #A48EE5;
                color: #fff;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s;
            ">Oui, sauvegarder</button>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Handle button clicks
    document.getElementById('credential-save-yes').addEventListener('click', async () => {
        try {
            await chrome.storage.local.set({
                openSubtitlesCredentials: {
                    username: email,
                    password: password,
                    savedAt: Date.now()
                }
            });
            console.log("OpenSubtitles credentials saved locally for auto-refresh.");
        } catch (e) {
            console.warn("Failed to save credentials locally:", e);
        }
        modal.remove();
    });

    document.getElementById('credential-save-no').addEventListener('click', () => {
        modal.remove();
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}
