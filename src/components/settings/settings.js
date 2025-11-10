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

    const buttons = document.querySelectorAll(".nav-item");
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
            body: "Pour désactiver les notifications, rendez-vous dans les paramètres de l'extension, en cliquant sur cette notification.",
            icon: "../../../public/logo/logo-128.png",
            vibrate: [200, 100, 200],
        });
        notif.onclick = function (event) {
                    event.preventDefault();
                    chrome.tabs.create({
                        url: "chrome://settings/content/siteDetails?site=chrome-extension://" + chrome.runtime.id
                    });
                    notif.close();
                };

        return;
    }
    else {
        Notification.requestPermission().then(function (permission) {
            if (permission === "granted") {
                const notif = new Notification("Activation des notifications", {
                    body: "Vous venez d'activer les notifications pour l'extension Ani-Extension.",
                    icon: "../../../public/logo/logo-128.png",
                    vibrate: [200, 100, 200],
                });

                settings.notificationsEnabled = true;
                updateSettingsUI(settings);
            }
        });
    }
}

function updateSettingsUI(settings) {
    applyTheme(settings.theme);
    // Général
    document.getElementById("darkMode").checked = settings.theme === "light";
    document.getElementById("notifications-mail").checked = settings.mailnotificationEnabled;
    const notifBtn = document.getElementById("notifications-extension");
    if (notifBtn) {
        notifBtn.textContent = Notification.permission === "granted" ? "Disable chrome notifications" : "Enable chrome notifications";
    }

    // OpenSubtitles
    const loginButton = document.getElementById("openSubtitlesConnect");
    const status = document.getElementById("openSubtitlesStatus");
    const openSubtitlesLanguageSelect = document.getElementById("openSubtitlesLanguage");
    if (settings.openSubtitlesSettings.token) {
        document.getElementById("openSubtitlesEmail").style.display = "none";
        document.getElementById("openSubtitlesPassword").style.display = "none";
        status.textContent = "Connected to OpenSubtitles";
        status.classList.add("tooltip-ok");
        document.getElementById("language-block").style.display = "flex";
        document.getElementById("open-subtitles-create-account").style.display = "none";
        loginButton.textContent = "Logout";

    } else {
        document.getElementById("openSubtitlesEmail").style.display = "block";
        document.getElementById("openSubtitlesPassword").style.display = "block";
        status.textContent = "Not connected to OpenSubtitles";
        status.classList.add("tooltip-not-ok");
        document.getElementById("language-block").style.display = "none";
        document.getElementById("open-subtitles-create-account").style.display = "flex";
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
    document.getElementById("crunchyrollSkipIntro").checked = settings.crunchyrollSettings.autoSkip;
    document.getElementById("crunchyrollAutoNext").checked = settings.crunchyrollSettings.autoPlayNext;

    // Voiranime
    document.getElementById("voiranimeSkipIntro").checked = settings.voiranimeSettings.autoSkip;
    document.getElementById("voiranimeAutoNext").checked = settings.voiranimeSettings.autoPlayNext;

    // Netflix
    document.getElementById("netflixSkipIntro").checked = settings.netflixSettings.autoSkip;
    document.getElementById("netflixAutoNext").checked = settings.netflixSettings.autoPlayNext;

    // Planning Integration
    document.getElementById("syncGoogleCalendar").checked = settings.planningSettings.syncGoogleCalendar;

}

// lightweight toast with throttle to prevent spam
let __lastToastAt = 0;
function showToast(message = "Settings saved", type = "success") {
    const now = Date.now();
    if (now - __lastToastAt < 1200) return; // throttle
    __lastToastAt = now;
    const c = document.getElementById("toast-container");
    if (!c) return;
    
    const el = document.createElement("div");
    el.className = "toast";
    
    // Icon SVG based on type
    const icons = {
        success: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
        error: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>',
        info: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>',
        warning: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>'
    };
    
    el.innerHTML = `
        <div class="toast-content">
            <div class="toast-icon ${type}">
                ${icons[type] || icons.success}
            </div>
            <div class="toast-text">
                <p class="toast-title">${message}</p>
            </div>
        </div>
        <button class="toast-close" aria-label="Close notification">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
        </button>
    `;
    
    c.appendChild(el);
    
    // Close button handler
    const closeBtn = el.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        el.style.animation = 'toast-out .2s ease forwards';
        setTimeout(() => el.remove(), 200);
    });
    
    // Auto remove after 3 seconds
    setTimeout(() => { 
        if (el.parentNode) {
            el.style.animation = 'toast-out .2s ease forwards';
            setTimeout(() => el.remove(), 200);
        }
    }, 3000);
}

function persist() {
    saveSettings(settings);
    showToast();
}

function setupEventListeners(settings) {
    document.getElementById("darkMode").addEventListener("change", (e) => {
        settings.theme = e.target.checked ? "light" : "dark";
        applyTheme(settings.theme);
        persist();
    });
    document.getElementById("notifications-extension").addEventListener("click", () => {
        let textbtn = document.getElementById("notifications-extension").textContent;
        asknotificationPermission();
        persist();
    });
    document.getElementById("notifications-mail").addEventListener("change", (e) => {
        settings.mailnotificationEnabled = e.target.checked;
        persist();
    });

    document.getElementById("crunchyrollSkipIntro").addEventListener("change", (e) => {
        settings.crunchyrollSettings.autoSkip = e.target.checked;
        persist();
    });
    document.getElementById("crunchyrollAutoNext").addEventListener("change", (e) => {
        settings.crunchyrollSettings.autoPlayNext = e.target.checked;
        persist();
    });

    document.getElementById("voiranimeSkipIntro").addEventListener("change", (e) => {
        settings.voiranimeSettings.autoSkip = e.target.checked;
        persist();
    });
    document.getElementById("voiranimeAutoNext").addEventListener("change", (e) => {
        settings.voiranimeSettings.autoPlayNext = e.target.checked;
        persist();
    });
    document.getElementById("netflixAutoNext").addEventListener("change", (e) => {
        settings.netflixSettings.autoPlayNext = e.target.checked;
        persist();
    });
    document.getElementById("netflixSkipIntro").addEventListener("change", (e) => {
        settings.netflixSettings.autoSkip = e.target.checked;
        persist();
    });
    document.getElementById("syncGoogleCalendar").addEventListener("change", (e) => {
        settings.planningSettings.syncGoogleCalendar = e.target.checked;
        persist();
    });
    document.getElementById("openSubtitlesConnect").addEventListener("click", async () => {

        if (document.getElementById("openSubtitlesConnect").textContent === "Login") {
            const email = document.getElementById("openSubtitlesEmail");
            const password = document.getElementById("openSubtitlesPassword");

            if (email.value && password.value) {
                try {
                    await openSubtitlesService.login(email.value, password.value);
                    if (settings.openSubtitlesSettings.saveCredentials == true) {
                        await chrome.storage.local.set({
                            openSubtitlesCredentials: {
                                username: email.value,
                                password: password.value,
                                savedAt: Date.now()
                            }
                        });
                    }
                    else if (settings.openSubtitlesSettings.saveCredentials == false) {
                        showCredentialSaveModal(email.value, password.value);
                    }
                    email.style.display = "none";
                    password.style.display = "none";
                    let status = document.getElementById("openSubtitlesStatus")
                    status.textContent = "Connected to OpenSubtitles";
                    status.classList.remove("tooltip-not-ok");
                    status.classList.add("tooltip-ok");
                    document.getElementById("language-block").style.display = "flex";
                    document.getElementById("open-subtitles-create-account").style.display = "none";
                    settings.openSubtitlesSettings.token = openSubtitlesService._token;
                    settings.openSubtitlesSettings.tokenExpiration = openSubtitlesService._tokenExp;
                    showToast("Connected to OpenSubtitles successfully");
                    saveSettings(settings);
                    document.getElementById("openSubtitlesConnect").textContent = "Logout";

                } catch (error) {
                    showToast("Connection to OpenSubtitles failed", "error");
                    console.error("Error:", error);
                }
            } else {
                alert("Please enter your OpenSubtitles credentials.");
            }
        } else {
            // Logout
            document.getElementById("openSubtitlesEmail").style.display = "block";
            document.getElementById("openSubtitlesPassword").style.display = "block";
            document.getElementById("language-block").style.display = "none";
            document.getElementById("open-subtitles-create-account").style.display = "flex";
            let status = document.getElementById("openSubtitlesStatus")
            status.textContent = "Not connected to OpenSubtitles";
            status.classList.remove("tooltip-ok");
            status.classList.add("tooltip-not-ok");
            settings.openSubtitlesSettings.token = "";
            saveSettings(settings);
            showToast("Logged out from OpenSubtitles successfully");
            document.getElementById("openSubtitlesConnect").textContent = "Login";
            await openSubtitlesService.logout();
            try { await chrome.storage.local.remove("openSubtitlesCredentials"); } catch { }
        }
    });

    document.getElementById("openSubtitlesLanguage").addEventListener("change", (e) => {
        settings.openSubtitlesSettings.language = e.target.value;
        persist();
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
