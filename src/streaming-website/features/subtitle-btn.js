/**
 * File Name      : subtitle-btn.js
 * Description    : Creates a subtitle button in the Netflix player controls.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Last Updated   : 2025-11-02
 * Version        : 1.0.2
 */
import { StorageService } from "../../services/StorageService";
let openSubtitlesService = null;
let storageService = new StorageService();

async function getStoredOffset(host = location.hostname) {
    try {
        const offset = await storageService.get("aniextOffsets").then((data) => {
            const map = data.aniextOffsets || {};
            return map[host] || 0;
        });
        return offset;
    } catch (error) {}
    return 0;
}
async function setStoredOffset(value, host = location.hostname) {
    try {
        const data = await storageService.get("aniextOffsets");
        const map = data.aniextOffsets || {};
        map[host] = value;
        await storageService.set({ aniextOffsets: map });
    } catch (error) {}
    return;
}

function createSubtitleButton() {
    if (document.getElementById('aniext-subtitle-btn')) return; // Avoid duplicates

    // Interval to wait for the Netflix player controls to load
    const waitForControls = setInterval(() => {

        // Find the Netflix player controls container
        const playerContainer = document.querySelector('.watch-video--player-view')
            || document.querySelector('.NFPlayer')
            || document.querySelector('[data-uia="video-canvas"]')
            || document.querySelector('.watch-video');
        
        if (playerContainer) {
            clearInterval(waitForControls);
            
            // Make sure the container is positioned relatively for absolute button placement
            if (getComputedStyle(playerContainer).position === 'static') {
                playerContainer.style.position = 'relative';
            }

            // Create the button
            const btn = document.createElement('button');
            btn.id = 'aniext-subtitle-btn';
            btn.className = 'aniext-subtitle-btn';
            btn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"/>
                </svg>
            `;
            btn.title = 'Charger des sous-titres AniExt';
            
            // Button styles
            btn.style.cssText = `
                position: absolute;
                bottom: 200px;
                right: 20px;
                background: rgba(0, 0, 0, 0.7);
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                color: white;
                cursor: pointer;
                padding: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 1;
                transition: opacity 0.5s ease, transform 0.2s ease;
                z-index: 9999;
                width: 48px;
                height: 48px;
                pointer-events: auto;
            `;
            
            // Hover effects
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'scale(1.1)';
                btn.style.background = '#A48EE5';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'scale(1)';
                btn.style.background = 'rgba(0, 0, 0, 0.7)';
            });
            
            // Button click handler
            btn.onclick = async () => {
                await handleSubtitleSearchFromButton();
            };

            // Insert the button into the player container
            playerContainer.appendChild(btn);
            
            // Auto-hide logic

            let hideTimeout;
            
            const resetHideTimer = () => {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
                clearTimeout(hideTimeout);
                hideTimeout = setTimeout(() => {
                    btn.style.opacity = '0';
                    btn.style.pointerEvents = 'none';
                }, 2500); // Hide after 2.5 seconds based on Netflix controls behavior
            };
            
            playerContainer.addEventListener('mousemove', resetHideTimer);
            resetHideTimer();
        }
    }, 1000); // Wait for 1 second before checking for player controls, future improvements could use MutationObserver

    // Safety timeout to stop trying after 10 seconds
    setTimeout(() => clearInterval(waitForControls), 10000);
}

/**
 * Handle subtitle search when button is clicked
 */
async function handleSubtitleSearchFromButton() {
    try {
        // Get current anime info from background/storage
        const result = await storageService.get("popupDataList");
        const animeList = result.popupDataList || [];
        
        // Find the currently playing anime (the one on Netflix)
        const currentAnime = animeList.find(anime => 
            anime.link && location.href.includes(anime.link.split('?')[0])
        );
        
        if (!currentAnime) {
            showNotification("Aucun anime détecté sur cette page", "error");
            return;
        }
        
        showNotification(`Recherche de sous-titres pour ${currentAnime.name}...`, "info");
        
        // Send request to background script
        chrome.runtime.sendMessage({
            type: "searchSubtitles",
            anime: currentAnime
        }, (response) => {
            if (chrome.runtime.lastError) {
                showNotification("Erreur de communication avec l'extension", "error");
                return;
            }
            
            if (response && response.success) {
                const results = response.data;
                
                // Si un seul résultat, télécharger directement avec l'offset mémorisé du site
                if (!Array.isArray(results)) {
                    getStoredOffset().then((siteOffset) => downloadAndApplySubtitle(results, currentAnime, siteOffset));
                } else if (results.length === 1) {
                    getStoredOffset().then((siteOffset) => downloadAndApplySubtitle(results[0], currentAnime, siteOffset));
                } else if (results.length > 1) {
                    // Afficher modal de choix
                    showSubtitleModal(results, currentAnime);
                } else {
                    showNotification("Aucun sous-titre trouvé", "error");
                }
            } else {
                showNotification(response?.error || "Erreur lors de la recherche", "error");
            }
        });
        
    } catch (error) {
        console.error("Erreur:", error);
        showNotification(`Erreur: ${error.message}`, "error");
    }
}

/**
 * Show modal with subtitle candidates
 */
async function showSubtitleModal(candidates, anime) {
    // Remove existing modal if any
    const existing = document.getElementById('aniext-subtitle-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement("div");
    modal.id = 'aniext-subtitle-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        animation: fadeIn 0.2s;
    `;
    
    const content = document.createElement("div");
    content.style.cssText = `
        background: #181818;
        border-radius: 8px;
        padding: 24px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        color: white;
        font-family: Arial, sans-serif;
    `;
    
    content.innerHTML = `
        <h2 style="margin: 0 0 16px 0; font-size: 20px;">Sous-titres pour ${anime.name} - Ep ${anime.episode}</h2>
        
        <div id="candidates-list" style="margin: 16px 0;"></div>
        
        <button id="close-modal" style="
            background: #A48EE5;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 16px;
        ">Fermer</button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Slider handling
    let currentOffset = await getStoredOffset() || 0;

    // Populate candidates
    const listEl = content.querySelector("#candidates-list");
    candidates.forEach((candidate, i) => {
        const attrs = candidate.attributes || {};
        const feat = attrs.feature_details || {};
        const title = feat.title || attrs.release || "(no title)";
        const season = feat.season_number ?? "?";
        const episode = feat.episode_number ?? "?";
        const lang = attrs.language || "?";
        
        const row = document.createElement("div");
        row.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            margin: 8px 0;
            background: rgba(255,255,255,0.05);
            border-radius: 6px;
            border: 1px solid rgba(255,255,255,0.1);
        `;
        
        row.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
                <div style="font-size: 12px; color: #aaa;">S${season} • E${episode} • ${lang}</div>
            </div>
            <button class="apply-btn" data-index="${i}" style="
                background: #46d369;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
            ">Appliquer</button>
        `;
        
        listEl.appendChild(row);
        
        const applyBtn = row.querySelector(".apply-btn");
        applyBtn.addEventListener("click", async () => {
            applyBtn.textContent = "Téléchargement...";
            applyBtn.disabled = true;
            await setStoredOffset(currentOffset);
            await downloadAndApplySubtitle(candidate, anime, currentOffset);
            modal.remove();
        });
    });
    
    // Close modal
    content.querySelector("#close-modal").addEventListener("click", () => {
        modal.remove();
    });
    
    // Close on background click
    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.remove();
    });
}

/**
 * Download and apply subtitle to video
 */
async function downloadAndApplySubtitle(subtitle, anime, offsetMs) {
    try {
        showNotification("Téléchargement du sous-titre...", "info");
        
        chrome.runtime.sendMessage({
            type: "downloadSubtitle",
            subtitle: subtitle,
            anime: anime,
            offsetMs: 0 // We apply offset later
        }, async (response) => {
            if (chrome.runtime.lastError) {
                showNotification("Erreur de communication", "error");
                return;
            }
            
            if (response && response.success) {
                // Apply subtitle to video directly (we're already in the content script)
                try {
                    await setStoredOffset(offsetMs);
                    await applySubtitleToVideo(response.content, response.info, offsetMs);
                    showNotification("Sous-titres appliqués avec succès !", "success");
                    
                    // Show offset control
                    showOffsetControl(response.content, response.info, offsetMs);
                    
                } catch (error) {
                    showNotification(`Erreur: ${error.message}`, "error");
                }
            } else {
                showNotification(response?.error || "Erreur lors du téléchargement", "error");
            }
        });
        
    } catch (error) {
        console.error("Erreur:", error);
        showNotification(`Erreur: ${error.message}`, "error");
    }
}

/**
 * Show persistent offset control overlay
 */
function showOffsetControl(subtitleContent, subtitleInfo, initialOffset = 0) {
    // Remove existing control if any
    const existing = document.getElementById('aniext-offset-control');
    if (existing) existing.remove();
    
    const control = document.createElement("div");
    control.id = 'aniext-offset-control';
    control.style.cssText = `
        position: fixed;
        bottom: 120px;
        right: 20px;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        padding: 16px;
        color: white;
        font-family: Arial, sans-serif;
        z-index: 99998;
        min-width: 280px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `;
    
    control.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 14px; font-weight: 600;">Synchronisation</span>
            <button id="close-offset-control" style="
                background: transparent;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 18px;
                padding: 0;
                width: 24px;
                height: 24px;
            ">×</button>
        </div>
        <div style="margin-bottom: 8px; display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center;">
            <span style="min-width: 60px;">Offset:</span>
            <input type="range" id="realtime-offset-slider" min="-10000" max="10000" value="${initialOffset}" step="100" 
                   style="width: 100%; cursor: pointer;" />
            <input type="number" id="realtime-offset-input" min="-10000" max="10000" step="100" value="${initialOffset}"
                   style="width: 90px; background: #111; color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 6px 8px;" />
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #aaa;">
            <span>-10s</span>
            <span id="realtime-offset-value" style="font-weight: 600; color: white; font-size: 14px;">${initialOffset} ms</span>
            <span>+10s</span>
        </div>
    `;
    
    document.body.appendChild(control);
    
    let currentOffset = initialOffset;
    const slider = control.querySelector("#realtime-offset-slider");
    const input = control.querySelector("#realtime-offset-input");
    const offsetDisplay = control.querySelector("#realtime-offset-value");

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const snap100 = (v) => Math.round(v / 100) * 100;

    async function applyWith(offset) {
        currentOffset = clamp(snap100(offset), -10000, 10000);
        slider.value = String(currentOffset);
        input.value = String(currentOffset);
        offsetDisplay.textContent = `${currentOffset} ms`;
        try {
            await applySubtitleToVideo(subtitleContent, subtitleInfo, currentOffset);
            await setStoredOffset(currentOffset);
        } catch (error) {
            console.error("Erreur réapplication offset:", error);
        }
    }

    // Gestion des interactions
    slider.addEventListener("input", () => applyWith(parseInt(slider.value || 0)));
    input.addEventListener("change", () => applyWith(parseInt(input.value || 0)));
    input.addEventListener("blur", () => applyWith(parseInt(input.value || 0)));
    
    // Bouton fermer
    control.querySelector("#close-offset-control").addEventListener("click", () => {
        control.remove();
    });
    
    // Auto-hide avec la souris (comme le bouton principal)
    let hideTimeout;
    const resetHideTimer = () => {
        control.style.opacity = '1';
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            control.style.opacity = '0.3';
        }, 3000);
    };
    
    control.addEventListener('mouseenter', () => {
        control.style.opacity = '1';
        clearTimeout(hideTimeout);
    });
    
    control.addEventListener('mouseleave', resetHideTimer);
    
    resetHideTimer();
}

/**
 * Show notification overlay on video
 */
function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    const bgColor = type === "error" ? "rgba(220, 53, 69, 0.95)" : 
                    type === "success" ? "rgba(70, 211, 105, 0.95)" :
                    "rgba(0, 0, 0, 0.9)";
    
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: ${bgColor};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 99999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        animation: slideDown 0.3s ease;
        font-family: Arial, sans-serif;
        min-width: 200px;
        text-align: center;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = "0";
        notification.style.transition = "opacity 0.3s";
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}