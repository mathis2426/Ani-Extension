/**
 * File Name      : subtitle-btn.js
 * Description    : Creates a subtitle button in the Netflix player controls.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Last Updated   : 2025-11-02
 * Version        : 1.0.2
 */

let openSubtitlesService = null;

async function getStoredOffset(host = location.hostname) {
    try {
        const offset = await chrome.storage.local.get("aniextOffsets").then((data) => {
            const map = data.aniextOffsets || {};
            return map[host] || 0;
        });
        return offset;
    } catch (error) { }
    return 0;
}
async function setStoredOffset(value, host = location.hostname) {
    try {
        const data = await chrome.storage.local.get("aniextOffsets");
        const map = data.aniextOffsets || {};
        map[host] = value;
        await chrome.storage.local.set({ aniextOffsets: map });
    } catch (error) { }
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
        const result = await chrome.storage.local.get("popupDataList");
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
 * Show modal with subtitle candidates (updated: hover animations + entry animations)
 */
async function showSubtitleModal(candidates, anime) {
    // Supprime toute modal existante
    const existing = document.getElementById('aniext-subtitle-modal');
    if (existing) existing.remove();

    // Récupère offset stocké pour initialisation
    let currentOffset = await getStoredOffset() || 0;

    // Inject CSS scoped (une seule fois) - enrichi pour hover / animations
    if (!document.getElementById('aniext-subtitle-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'aniext-subtitle-modal-styles';
        style.textContent = `
/* Modal AniExt (injected) */
#aniext-subtitle-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; font-family:Arial, sans-serif; z-index:1000000; animation: aniext-fadeIn 180ms ease; }
#aniext-subtitle-modal .modal-content { background:#181818; color:#fff; border-radius:8px; padding:20px; width:600px; max-height:80vh; overflow:auto; box-shadow:0 8px 36px rgba(0,0,0,0.7); transform-origin:center; animation: aniext-popIn 200ms cubic-bezier(.2,.9,.3,1); }
@keyframes aniext-fadeIn { from { opacity:0 } to { opacity:1 } }
@keyframes aniext-popIn { from { transform: scale(0.98); opacity: 0 } to { transform: scale(1); opacity:1 } }

#aniext-subtitle-modal .modal-title { margin:0 0 10px 0; font-size:18px; text-align:center; }
#aniext-subtitle-modal .menu { display:flex; gap:8px; justify-content:space-between; margin:10px 0 16px 0; }
#aniext-subtitle-modal .menu button { flex:1; background:none; border:none; padding:10px 12px; border-bottom:2px solid transparent; cursor:pointer; font-size:13px; transition: color .20s ease, border-color .25s ease, transform .12s ease; color:#cfcfcf; outline: none; }
#aniext-subtitle-modal .menu button.passive { color:#7a7a7a; border-color:transparent; transform: translateY(0); }
#aniext-subtitle-modal .menu button.active { color:#ffffff; border-color:#afafaf; transform: translateY(0); }

/* Hover / focus states for menu buttons */
#aniext-subtitle-modal .menu button:hover { color:#e6e6e6; border-color:#9b9b9b; transform: translateY(-3px) scale(1.02); }
#aniext-subtitle-modal .menu button:focus { box-shadow: 0 0 0 4px rgba(164,142,229,0.12); border-radius:4px; }

/* Content area and list */
#aniext-subtitle-modal .content-area { min-height:120px; }
#aniext-subtitle-modal .candidates-list { display:flex; flex-direction:column; gap:10px; margin-top:6px; }
#aniext-subtitle-modal .candidate { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:10px; display:flex; justify-content:space-between; align-items:center; gap:12px; transition: transform .12s ease, box-shadow .12s ease, background .12s ease; }
#aniext-subtitle-modal .candidate:hover { transform: translateY(-4px); box-shadow: 0 8px 20px rgba(0,0,0,0.6); background: rgba(255,255,255,0.04); }

/* Candidate info */
#aniext-subtitle-modal .candidate-info { display:flex; flex-direction:column; }
#aniext-subtitle-modal .candidate-title { font-weight:600; }
#aniext-subtitle-modal .candidate-meta { font-size:12px; color:#aaa; margin-top:4px; }

/* Apply button with subtle hover animation */
#aniext-subtitle-modal .apply-btn { background:#46d369; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:13px; transition: transform .12s ease, box-shadow .12s ease, background .12s ease; box-shadow: 0 6px 16px rgba(70,211,105,0.12); }
#aniext-subtitle-modal .apply-btn:hover { transform: translateY(-3px) scale(1.02); background:#3db35b; box-shadow: 0 12px 26px rgba(61,179,91,0.14); }
#aniext-subtitle-modal .apply-btn:active { transform: translateY(-1px) scale(0.995); }

/* Disabled state */
#aniext-subtitle-modal .apply-btn[disabled] { opacity:0.75; cursor:default; transform:none; box-shadow:none; }

/* Close button with hover */
#aniext-subtitle-modal .close-btn { background:#a48ee5; color:#fff; border:none; padding:10px 18px; border-radius:8px; cursor:pointer; display:block; margin:16px auto 0; font-size:14px; transition: transform .12s ease, background .12s ease, box-shadow .12s ease; box-shadow: 0 6px 18px rgba(164,142,229,0.12); }
#aniext-subtitle-modal .close-btn:hover { transform: translateY(-3px) scale(1.02); background:#8f78d2; box-shadow: 0 12px 28px rgba(143,120,210,0.14); }
#aniext-subtitle-modal .close-btn:active { transform: translateY(-1px) scale(0.995); }

/* Placeholder text style */
#aniext-subtitle-modal .tab-placeholder { color:#bdbdbd; font-size:13px; padding:12px 6px; text-align:center; }

/* Header row and small offset text */
#aniext-subtitle-modal .header-row { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:8px; }
#aniext-subtitle-modal .header-row .subtitle-info { font-size:13px; color:#dcdcdc; }

/* small responsive tweak */
@media (max-width:640px) {
  #aniext-subtitle-modal .modal-content { width:92%; padding:16px; }
  #aniext-subtitle-modal .menu button { padding:8px 6px; font-size:12px; }
}
        `;
        document.head.appendChild(style);
    }

    // Create modal structure
    const modal = document.createElement('div');
    modal.id = 'aniext-subtitle-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const content = document.createElement('div');
    content.className = 'modal-content';

    // Header + title
    const headerRow = document.createElement('div');
    headerRow.className = 'header-row';
    const title = document.createElement('h2');
    title.className = 'modal-title';
    title.textContent = `Sous-titres pour ${anime.name || '—'} — Épisode ${anime.episode ?? '?'}`;

    headerRow.appendChild(title);

    content.appendChild(headerRow);

    // Menu (tabs)
    const menu = document.createElement('div');
    menu.className = 'menu';
    const tabs = [
        { id: 'autoSearch', label: 'Auto search' },
        { id: 'fullAnime', label: 'Full anime' },
        { id: 'opensubId', label: 'OpenSubID' },
        { id: 'file', label: 'File' },
    ];
    const tabButtons = {};
    tabs.forEach((t, idx) => {
        const btn = document.createElement('button');
        btn.dataset.section = t.id;
        btn.type = 'button';
        btn.textContent = t.label;
        btn.className = idx === 0 ? 'active' : 'passive';
        menu.appendChild(btn);
        tabButtons[t.id] = btn;
    });

    content.appendChild(menu);

    // Content area
    const contentArea = document.createElement('div');
    contentArea.id = 'content-area';
    contentArea.className = 'content-area';
    content.appendChild(contentArea);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.id = 'close-modal';
    closeBtn.className = 'close-btn';
    closeBtn.type = 'button';
    closeBtn.textContent = 'Fermer';
    content.appendChild(closeBtn);

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Accessibility / close handling
    function closeModal() {
        const el = document.getElementById('aniext-subtitle-modal');
        if (el) el.remove();
    }
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    function onKey(e) { if (e.key === 'Escape') closeModal(); }
    document.addEventListener('keydown', onKey);

    // Utility: escape HTML
    function escapeHtml(input) {
        if (input === null || input === undefined) return "";
        return String(input)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // RENDERERS
    function renderAutoSearch() {
        contentArea.innerHTML = ''; // clear
        const list = document.createElement('div');
        list.id = 'candidates-list';
        list.className = 'candidates-list';

        if (!Array.isArray(candidates) || candidates.length === 0) {
            const p = document.createElement('div');
            p.className = 'tab-placeholder';
            p.textContent = "Aucun sous-titre disponible.";
            contentArea.appendChild(p);
            return;
        }

        candidates.forEach((candidate, index) => {
            const attrs = candidate.attributes || {};
            const feat = attrs.feature_details || {};
            const titleTxt = feat.title || attrs.release || candidate.title || "(no title)";
            const season = feat.season_number ?? candidate.season ?? "?";
            const episodeNum = feat.episode_number ?? candidate.episode ?? "?";
            const lang = attrs.language || candidate.lang || "?";

            const row = document.createElement('div');
            row.className = 'candidate';
            row.innerHTML = `
                <div class="candidate-info">
                    <div class="candidate-title">${escapeHtml(titleTxt)}</div>
                    <div class="candidate-meta">S${escapeHtml(season)} • E${escapeHtml(episodeNum)} • ${escapeHtml(lang)}</div>
                </div>
            `;

            const applyBtn = document.createElement('button');
            applyBtn.className = 'apply-btn';
            applyBtn.type = 'button';
            applyBtn.textContent = 'Appliquer';
            applyBtn.addEventListener('click', async () => {
                try {
                    applyBtn.textContent = 'Téléchargement...';
                    applyBtn.disabled = true;
                    // persist offset and start download/apply
                    await setStoredOffset(currentOffset);
                    await downloadAndApplySubtitle(candidate, anime, currentOffset);
                    closeModal();
                } catch (err) {
                    console.error("Erreur lors de l'application du sous-titre:", err);
                    applyBtn.textContent = 'Appliquer';
                    applyBtn.disabled = false;
                }
            });

            row.appendChild(applyBtn);
            list.appendChild(row);
        });

        contentArea.appendChild(list);
    }

    function renderFullAnime() {
        contentArea.innerHTML = `<div class="tab-placeholder">Chargement de la liste complète de l'anime...</div>`;
        // Option: here you could call background to get full-anime subtitles if required.
    }
    function renderOpenSubId() {
        contentArea.innerHTML = `<div class="tab-placeholder">Historique OpenSubID / OpenSubtitles (non implémenté)</div>`;
    }
    function renderFileSection() {
        contentArea.innerHTML = `<div class="tab-placeholder">Charger un fichier local (non implémenté)</div>`;
    }

    // Tab click handler
    Object.keys(tabButtons).forEach((id) => {
        tabButtons[id].addEventListener('click', () => {
            // toggle classes
            Object.values(tabButtons).forEach(b => { b.classList.remove('active'); b.classList.add('passive'); });
            tabButtons[id].classList.add('active');
            tabButtons[id].classList.remove('passive');

            // render content for tab
            switch (id) {
                case 'autoSearch':
                    renderAutoSearch();
                    break;
                case 'fullAnime':
                    renderFullAnime();
                    break;
                case 'opensubId':
                    renderOpenSubId();
                    break;
                case 'file':
                    renderFileSection();
                    break;
                default:
                    contentArea.innerHTML = `<div class="tab-placeholder">Section inconnue</div>`;
            }
        });
    });

    // Initialize: simulate click on autoSearch (first tab)
    const first = tabButtons['autoSearch'];
    if (first) first.click();

    // Keep header offset display in sync when offset changes externally (optionnel)
    // expose a small API on modal element to update offset display if needed
    modal.updateOffset = (ms) => {
        currentOffset = ms;
    };

    // When modal is removed, cleanup key listener
    const observer = new MutationObserver((mutations) => {
        if (!document.getElementById('aniext-subtitle-modal')) {
            document.removeEventListener('keydown', onKey);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true });
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