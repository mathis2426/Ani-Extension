/**
 * File Name      : subtitle-btn.js
 * Description    : Creates a subtitle button in the Netflix player controls.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Last Updated   : 2025-11-02
 * Version        : 1.0.2
 */

let openSubtitlesService = null;
let infoTimeout = null; // Notification timer

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

            // Hide notification before showing modal
            if (infoTimeout) {
                clearTimeout(infoTimeout);
                infoTimeout = null;
            }
            // Hide all existing notifications
            document.querySelectorAll('div[style*="position: fixed"][style*="top: 80px"]').forEach(notif => {
                notif.remove();
            });

            if (response && response.success) {
                const results = response.data;

                // if only one result, download directly with stored site offset
                if (!Array.isArray(results)) {
                    getStoredOffset().then((siteOffset) => downloadAndApplySubtitle(results, currentAnime, siteOffset));
                } else if (results.length === 1) {
                    getStoredOffset().then((siteOffset) => downloadAndApplySubtitle(results[0], currentAnime, siteOffset));
                } else {
                    // Show modal even if results is empty or has multiple items
                    // This allows users to try other search methods (OpenSubID, File upload, etc.)
                    showSubtitleModal(results || [], currentAnime);
                }
            } else {
                // Even if the search fails or finds nothing, show the modal
                // This allows users to try other search methods (Full Anime, OpenSubID, File upload, etc.)
                showSubtitleModal([], currentAnime);
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
#aniext-subtitle-modal .menu button.passive { color:#7a7a7a; border-color:transparent; }

/* Hover / focus states for menu buttons */
#aniext-subtitle-modal .menu button:hover { border-color: #9b9b9b; }
#aniext-subtitle-modal .menu button:focus { border-color: #9b9b9b; }

/* Content area and list */
#aniext-subtitle-modal .content-area { min-height:120px; }
#aniext-subtitle-modal .candidates-list { display:flex; flex-direction:column; gap:10px; margin-top:6px; }
#aniext-subtitle-modal .candidate { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:10px; display:flex; justify-content:space-between; align-items:center; gap:12px; transition: transform .12s ease, box-shadow .12s ease, background .12s ease; }
#aniext-subtitle-modal .candidate:hover { box-shadow: 0 8px 20px rgba(0,0,0,0.6); background: rgba(255,255,255,0.04); }

/* Candidate info */
#aniext-subtitle-modal .candidate-info { display:flex; flex-direction:column; }
#aniext-subtitle-modal .candidate-title { font-weight:600; }
#aniext-subtitle-modal .candidate-meta { font-size:12px; color:#aaa; margin-top:4px; }

/* Apply button with subtle hover animation */
#aniext-subtitle-modal .apply-btn { background-color: #323232; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:13px; transition: box-shadow 0.5s, background-color 0.5s;}
#aniext-subtitle-modal .apply-btn:hover { box-shadow: 0 0 7px 3px #A48EE5;}
#aniext-subtitle-modal .apply-btn:active { background-color: #A48EE5; opacity:0.6; }

/* Disabled state */
#aniext-subtitle-modal .apply-btn[disabled] { opacity:0.75; cursor:default; transform:none; box-shadow:none; }


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

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Accessibility / close handling
    function closeModal() {
        const el = document.getElementById('aniext-subtitle-modal');
        if (el) el.remove();
    }
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

        // Fonction pour vérifier si le titre correspond à l'anime recherché
        function isMatchingAnime(subtitle, targetName) {
            const attrs = subtitle.attributes || {};
            const feat = attrs.feature_details || {};
            
            // Récupérer le nom du fichier/release
            const release = (attrs.release || '').toLowerCase();
            const title = (feat.title || '').toLowerCase();
            const movieName = (feat.movie_name || '').toLowerCase();
            
            // Nettoyer et normaliser le nom cible
            const target = targetName.toLowerCase()
                .replace(/[:\-]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            
            // Vérifier si le nom de l'anime apparaît dans les métadonnées
            const allText = `${release} ${title} ${movieName}`;
            
            // Split target pour vérifier chaque mot clé
            const targetWords = target.split(' ').filter(w => w.length > 2);
            
            // Au moins 70% des mots importants doivent matcher
            const matchCount = targetWords.filter(word => allText.includes(word)).length;
            const matchRatio = matchCount / targetWords.length;
            
            return matchRatio >= 0.7;
        }

        // Filtrer les candidats qui correspondent vraiment à l'anime
        const filteredCandidates = candidates.filter(candidate => {
            return isMatchingAnime(candidate, anime.name || '');
        });

        console.log(`[Auto Search] Candidats avant filtrage: ${candidates.length}, après: ${filteredCandidates.length}`);

        if (filteredCandidates.length === 0) {
            const p = document.createElement('div');
            p.className = 'tab-placeholder';
            p.textContent = "Aucun sous-titre correspondant après filtrage.";
            contentArea.appendChild(p);
            return;
        }

        // Trier par pertinence (download_count décroissant)
        filteredCandidates.sort((a, b) => {
            const aCount = a.attributes?.download_count ?? 0;
            const bCount = b.attributes?.download_count ?? 0;
            return bCount - aCount;
        });

        filteredCandidates.forEach((candidate, index) => {
            const attrs = candidate.attributes || {};
            const feat = attrs.feature_details || {};
            const release = attrs.release || 'Unknown';
            const titleTxt = feat.title || release || "(no title)";
            const season = feat.season_number ?? candidate.season ?? "?";
            const episodeNum = feat.episode_number ?? candidate.episode ?? "?";
            const lang = attrs.language || candidate.lang || "?";
            const downloads = attrs.download_count || 0;

            const row = document.createElement('div');
            row.className = 'candidate';
            row.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                background: rgba(255,255,255,0.02);
                border-radius: 8px;
                margin-bottom: 8px;
                transition: all 0.2s ease;
                border: 1px solid rgba(255,255,255,0.05);
            `;
            
            // Badge "Meilleur" pour le premier (plus téléchargé)
            const badge = index === 0 ? '<span style="color: #46d369; font-weight: 600; margin-left: 6px;">• Meilleur</span>' : '';
            
            row.innerHTML = `
                <div class="candidate-info" style="flex: 1; min-width: 0;">
                    <div class="candidate-title" style="font-size: 13px; color: #fff; font-weight: 500; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(release)}">${escapeHtml(titleTxt)}</div>
                    <div class="candidate-meta" style="font-size: 11px; color: #999; margin-bottom: 2px;">S${escapeHtml(season)} • E${escapeHtml(episodeNum)} • ${escapeHtml(lang)}</div>
                    <div style="font-size: 10px; color: #888;">${downloads} téléchargements${badge}</div>
                </div>
            `;

            const applyBtn = document.createElement('button');
            applyBtn.className = 'apply-btn';
            applyBtn.type = 'button';
            applyBtn.style.padding = '6px 12px';
            applyBtn.style.fontSize = '12px';
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
            
            row.addEventListener('mouseenter', () => {
                row.style.background = 'rgba(255,255,255,0.05)';
                row.style.borderColor = 'rgba(164,142,229,0.3)';
            });
            row.addEventListener('mouseleave', () => {
                row.style.background = 'rgba(255,255,255,0.02)';
                row.style.borderColor = 'rgba(255,255,255,0.05)';
            });

            row.appendChild(applyBtn);
            list.appendChild(row);
        });

        contentArea.appendChild(list);
    }

    function renderFullAnime() {
        contentArea.innerHTML = '';
        
        const loadingMsg = document.createElement('div');
        loadingMsg.className = 'tab-placeholder';
        loadingMsg.textContent = `Chargement des épisodes pour ${anime.name || '—'}...`;
        contentArea.appendChild(loadingMsg);

        // Rechercher tous les épisodes de l'anime
        (async () => {
            try {
                // On fait une recherche large pour récupérer plusieurs épisodes/saisons
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({
                        type: "searchFullAnime",
                        anime: anime
                    }, (resp) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(resp);
                        }
                    });
                });

                if (!response || !response.success || !response.data) {
                    throw new Error(response?.error || "Aucune donnée reçue");
                }

                const episodes = response.data; // Array of subtitle objects with season/episode info
                
                if (!Array.isArray(episodes) || episodes.length === 0) {
                    contentArea.innerHTML = '<div class="tab-placeholder">Aucun épisode trouvé</div>';
                    return;
                }

                // Fonction pour vérifier si le titre correspond à l'anime recherché
                function isMatchingAnime(subtitle, targetName) {
                    const attrs = subtitle.attributes || {};
                    const feat = attrs.feature_details || {};
                    
                    // Récupérer le nom du fichier/release
                    const release = (attrs.release || '').toLowerCase();
                    const title = (feat.title || '').toLowerCase();
                    const movieName = (feat.movie_name || '').toLowerCase();
                    
                    // Nettoyer et normaliser le nom cible
                    const target = targetName.toLowerCase()
                        .replace(/[:\-]/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    
                    // Vérifier si le nom de l'anime apparaît dans les métadonnées
                    const allText = `${release} ${title} ${movieName}`;
                    
                    // Split target pour vérifier chaque mot clé
                    const targetWords = target.split(' ').filter(w => w.length > 2);
                    
                    // Au moins 70% des mots importants doivent matcher
                    const matchCount = targetWords.filter(word => allText.includes(word)).length;
                    const matchRatio = matchCount / targetWords.length;
                    
                    return matchRatio >= 0.7;
                }
                
                // Filtrer et grouper par saison puis par épisode
                const seasonMap = new Map(); // Map<season, Map<episode, subtitle[]>>
                
                console.log(`[Full Anime] Total episodes reçus: ${episodes.length}`);
                
                episodes.forEach(ep => {
                    // Vérifier que c'est bien le bon anime
                    if (!isMatchingAnime(ep, anime.name)) {
                        return; // Skip si pas le bon anime
                    }
                    
                    const attrs = ep.attributes || {};
                    const feat = attrs.feature_details || {};
                    const season = feat.season_number ?? ep.season ?? 1;
                    const epNum = feat.episode_number ?? ep.episode ?? 0;
                    
                    if (!seasonMap.has(season)) {
                        seasonMap.set(season, new Map());
                    }
                    
                    const episodeMap = seasonMap.get(season);
                    if (!episodeMap.has(epNum)) {
                        episodeMap.set(epNum, []);
                    }
                    
                    episodeMap.get(epNum).push(ep);
                });
                
                console.log(`[Full Anime] Saisons trouvées: ${seasonMap.size}`);
                seasonMap.forEach((eps, season) => {
                    console.log(`  - Saison ${season}: ${eps.size} épisodes`);
                });

                // Trier les saisons
                const seasons = Array.from(seasonMap.keys()).sort((a, b) => a - b);
                
                if (seasons.length === 0) {
                    contentArea.innerHTML = '<div class="tab-placeholder">Aucun épisode ne correspond à cet anime après filtrage</div>';
                    return;
                }
                
                contentArea.innerHTML = '';
                
                const container = document.createElement('div');
                container.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-top: 8px;';
                
                seasons.forEach(seasonNum => {
                    const episodeMap = seasonMap.get(seasonNum);
                    const episodeNumbers = Array.from(episodeMap.keys()).sort((a, b) => a - b);
                    
                    // Season accordion container
                    const seasonBlock = document.createElement('div');
                    seasonBlock.style.cssText = `
                        background: rgba(255,255,255,0.03);
                        border: 1px solid rgba(255,255,255,0.06);
                        border-radius: 8px;
                        overflow: hidden;
                        transition: all 0.2s ease;
                    `;
                    
                    // Season header (clickable)
                    const seasonHeader = document.createElement('div');
                    seasonHeader.style.cssText = `
                        padding: 12px 16px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        cursor: pointer;
                        background: rgba(255,255,255,0.02);
                        transition: background 0.2s ease;
                    `;
                    
                    seasonHeader.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-weight: 600; color: #fff;">Saison ${seasonNum}</span>
                            <span style="font-size: 12px; color: #999;">${episodeNumbers.length} épisode${episodeNumbers.length > 1 ? 's' : ''}</span>
                        </div>
                        <svg class="season-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.2s ease; color: #A48EE5;">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    `;
                    
                    // Episode list (collapsible)
                    const episodeList = document.createElement('div');
                    episodeList.className = 'episode-list';
                    episodeList.style.cssText = `
                        max-height: 0;
                        overflow: hidden;
                        transition: max-height 0.3s ease;
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 4px;
                        padding: 0 12px;
                        box-sizing: border-box !important;
                        width: 100% !important;
                        min-height: 0 !important;
                    `;
                    
                    episodeNumbers.forEach(epNum => {
                        const variants = episodeMap.get(epNum);
                        
                        // Trier les variantes par download_count (meilleur en premier)
                        variants.sort((a, b) => {
                            const aCount = a.attributes?.download_count ?? 0;
                            const bCount = b.attributes?.download_count ?? 0;
                            return bCount - aCount;
                        });
                        
                        const bestVariant = variants[0];
                        
                        // Si une seule variante, affichage simple sans accordéon
                        if (variants.length === 1) {
                            const attrs = bestVariant.attributes || {};
                            const release = attrs.release || 'Unknown';
                            const downloads = attrs.download_count || 0;
                            const lang = attrs.language || 'unknown';
                            
                            const simpleRow = document.createElement('div');
                            simpleRow.style.cssText = `
                                padding: 10px 12px;
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                                background: rgba(255,255,255,0.02);
                                border-radius: 6px;
                                margin: 2px 0;
                                transition: background 0.15s ease;
                            `;
                            
                            simpleRow.innerHTML = `
                                <div style="display: flex; flex-direction: column; flex: 1; min-width: 0;">
                                    <div style="font-size: 13px; color: #fff; font-weight: 500;">Épisode ${epNum}</div>
                                    <div style="font-size: 11px; color: #999; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(release)}">${escapeHtml(release)}</div>
                                    <div style="font-size: 10px; color: #888; margin-top: 2px;">${downloads} téléchargements • ${lang}</div>
                                </div>
                            `;
                            
                            const applyBtn = document.createElement('button');
                            applyBtn.className = 'apply-btn';
                            applyBtn.style.padding = '6px 12px';
                            applyBtn.style.fontSize = '12px';
                            applyBtn.textContent = 'Appliquer';
                            
                            applyBtn.addEventListener('click', async () => {
                                try {
                                    applyBtn.textContent = 'Chargement...';
                                    applyBtn.disabled = true;
                                    const siteOffset = await getStoredOffset();
                                    await downloadAndApplySubtitle(bestVariant, anime, siteOffset);
                                    closeModal();
                                } catch (err) {
                                    console.error("Erreur application:", err);
                                    applyBtn.textContent = 'Appliquer';
                                    applyBtn.disabled = false;
                                }
                            });
                            
                            simpleRow.addEventListener('mouseenter', () => {
                                simpleRow.style.background = 'rgba(255,255,255,0.05)';
                            });
                            simpleRow.addEventListener('mouseleave', () => {
                                simpleRow.style.background = 'rgba(255,255,255,0.02)';
                            });
                            
                            simpleRow.appendChild(applyBtn);
                            episodeList.appendChild(simpleRow);
                            return; // Skip l'accordéon pour cet épisode
                        }
                        
                        // Si plusieurs variantes, affichage avec accordéon
                        const episodeBlock = document.createElement('div');
                        episodeBlock.className = 'episode-block-with-variants';
                        episodeBlock.style.cssText = `
                            background: rgba(255,255,255,0.02);
                            border-radius: 6px;
                            overflow: hidden;
                            margin: 2px 0;
                        `;
                        
                        // Episode header
                        const epHeader = document.createElement('div');
                        epHeader.style.cssText = `
                            padding: 10px 12px;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            cursor: pointer;
                            transition: background 0.15s ease;
                        `;
                        
                        epHeader.innerHTML = `
                            <div style="display: flex; flex-direction: column; flex: 1;">
                                <div style="font-size: 13px; color: #fff; font-weight: 500;">Épisode ${epNum}</div>
                                <div style="font-size: 11px; color: #999; margin-top: 2px;">${variants.length} versions disponibles</div>
                            </div>
                            <svg class="episode-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.2s ease; color: #A48EE5;">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        `;
                        
                        // Variants list (collapsible)
                        const variantsList = document.createElement('div');
                        variantsList.className = 'variants-list';
                        variantsList.style.cssText = `
                            max-height: 0;
                            overflow: hidden;
                            transition: max-height 0.3s ease;
                            background: rgba(0,0,0,0.2);
                            padding: 0 8px;
                        `;
                        
                        variants.forEach((variant, idx) => {
                            const attrs = variant.attributes || {};
                            const release = attrs.release || 'Unknown';
                            const downloads = attrs.download_count || 0;
                            const lang = attrs.language || 'unknown';
                            
                            const variantRow = document.createElement('div');
                            variantRow.style.cssText = `
                                padding: 8px 10px;
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                                gap: 10px;
                                transition: background 0.15s ease;
                                border-radius: 4px;
                                margin: 4px 0;
                            `;
                            
                            variantRow.innerHTML = `
                                <div style="display: flex; flex-direction: column; flex: 1; min-width: 0;">
                                    <div style="font-size: 12px; color: #ddd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(release)}">${escapeHtml(release)}</div>
                                    <div style="font-size: 10px; color: #888; margin-top: 2px;">
                                        ${downloads} téléchargements • ${lang}${idx === 0 ? ' • <span style="color: #46d369;">Meilleur</span>' : ''}
                                    </div>
                                </div>
                            `;
                            
                            const applyBtn = document.createElement('button');
                            applyBtn.className = 'apply-btn';
                            applyBtn.style.padding = '5px 10px';
                            applyBtn.style.fontSize = '11px';
                            applyBtn.textContent = 'Appliquer';
                            
                            applyBtn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                try {
                                    applyBtn.textContent = 'Chargement...';
                                    applyBtn.disabled = true;
                                    const siteOffset = await getStoredOffset();
                                    await downloadAndApplySubtitle(variant, anime, siteOffset);
                                    closeModal();
                                } catch (err) {
                                    console.error("Erreur application:", err);
                                    applyBtn.textContent = 'Appliquer';
                                    applyBtn.disabled = false;
                                }
                            });
                            
                            variantRow.addEventListener('mouseenter', () => {
                                variantRow.style.background = 'rgba(255,255,255,0.05)';
                            });
                            variantRow.addEventListener('mouseleave', () => {
                                variantRow.style.background = 'transparent';
                            });
                            
                            variantRow.appendChild(applyBtn);
                            variantsList.appendChild(variantRow);
                        });
                        
                        // Toggle episode accordion
                        episodeBlock.dataset.episodeOpen = 'false';
                        epHeader.addEventListener('click', () => {
                            const chevron = epHeader.querySelector('.episode-chevron');
                            const isCurrentlyOpen = episodeBlock.dataset.episodeOpen === 'true';
                            
                            if (isCurrentlyOpen) {
                                // Fermer cet épisode
                                episodeBlock.dataset.episodeOpen = 'false';
                                variantsList.style.maxHeight = '0';
                                variantsList.style.paddingTop = '0';
                                variantsList.style.paddingBottom = '0';
                                chevron.style.transform = 'rotate(0deg)';
                                epHeader.style.background = 'transparent';
                            } else {
                                // Fermer tous les autres épisodes de cette saison
                                const allEpisodeBlocks = episodeList.querySelectorAll('.episode-block-with-variants');
                                allEpisodeBlocks.forEach(block => {
                                    if (block !== episodeBlock && block.dataset.episodeOpen === 'true') {
                                        const otherVariantsList = block.querySelector('.variants-list');
                                        const otherChevron = block.querySelector('.episode-chevron');
                                        const otherHeader = block.querySelector('div[style*="cursor: pointer"]');
                                        
                                        block.dataset.episodeOpen = 'false';
                                        otherVariantsList.style.maxHeight = '0';
                                        otherVariantsList.style.paddingTop = '0';
                                        otherVariantsList.style.paddingBottom = '0';
                                        otherChevron.style.transform = 'rotate(0deg)';
                                        otherHeader.style.background = 'transparent';
                                    }
                                });
                                
                                // Ouvrir cet épisode
                                episodeBlock.dataset.episodeOpen = 'true';
                                variantsList.style.maxHeight = variantsList.scrollHeight + 'px';
                                variantsList.style.paddingTop = '4px';
                                variantsList.style.paddingBottom = '4px';
                                chevron.style.transform = 'rotate(180deg)';
                                epHeader.style.background = 'rgba(164,142,229,0.08)';
                            }
                        });
                        
                        epHeader.addEventListener('mouseenter', () => {
                            const isCurrentlyOpen = episodeBlock.dataset.episodeOpen === 'true';
                            if (!isCurrentlyOpen) {
                                epHeader.style.background = 'rgba(255,255,255,0.04)';
                            }
                        });
                        epHeader.addEventListener('mouseleave', () => {
                            const isCurrentlyOpen = episodeBlock.dataset.episodeOpen === 'true';
                            if (!isCurrentlyOpen) {
                                epHeader.style.background = 'transparent';
                            }
                        });
                        
                        episodeBlock.appendChild(epHeader);
                        episodeBlock.appendChild(variantsList);
                        episodeList.appendChild(episodeBlock);
                    });
                    
                    // Toggle accordion
                    let isOpen = false;
                    seasonHeader.addEventListener('click', () => {
                        isOpen = !isOpen;
                        const chevron = seasonHeader.querySelector('.season-chevron');
                        
                        if (isOpen) {
                            // Forcer tous les styles inline pour contrer Netflix
                            episodeList.style.setProperty('display', 'flex', 'important');
                            episodeList.style.setProperty('flex-direction', 'column', 'important');
                            episodeList.style.setProperty('max-height', 'none', 'important');
                            episodeList.style.setProperty('overflow', 'visible', 'important');
                            episodeList.style.setProperty('height', 'auto', 'important');
                            episodeList.style.paddingTop = '8px';
                            episodeList.style.paddingBottom = '8px';
                            
                            chevron.style.transform = 'rotate(180deg)';
                            seasonHeader.style.background = 'rgba(164,142,229,0.1)';
                            seasonBlock.dataset.open = 'true';
                        } else {
                            episodeList.style.setProperty('max-height', '0', 'important');
                            episodeList.style.paddingTop = '0';
                            episodeList.style.paddingBottom = '0';
                            episodeList.style.setProperty('overflow', 'hidden', 'important');
                            chevron.style.transform = 'rotate(0deg)';
                            seasonHeader.style.background = 'rgba(255,255,255,0.02)';
                            seasonBlock.dataset.open = 'false';
                        }
                    });
                    
                    seasonHeader.addEventListener('mouseenter', () => {
                        if (!isOpen) {
                            seasonHeader.style.background = 'rgba(255,255,255,0.05)';
                        }
                    });
                    seasonHeader.addEventListener('mouseleave', () => {
                        if (!isOpen) {
                            seasonHeader.style.background = 'rgba(255,255,255,0.02)';
                        }
                    });
                    
                    seasonBlock.appendChild(seasonHeader);
                    seasonBlock.appendChild(episodeList);
                    container.appendChild(seasonBlock);
                });
                
                contentArea.appendChild(container);
                
            } catch (error) {
                console.error("Erreur chargement full anime:", error);
                contentArea.innerHTML = `<div class="tab-placeholder" style="color: #dc3545;">Erreur: ${error.message}</div>`;
            }
        })();
    }
    function renderOpenSubId() {
        contentArea.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            display: flex;
            gap: 10px;
            align-items: center;
            justify-content: center;
            margin: 8px 0 4px 0;
        `;

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Entrez un OpenSubtitles file_id (ex: 12345678)';
        input.autocomplete = 'off';
        input.inputMode = 'numeric';
        input.style.cssText = `
            flex: 1;
            max-width: 340px;
            background: #111;
            color: #fff;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 6px;
            padding: 10px 12px;
            font-size: 14px;
            outline: none;
            box-shadow: 0 0 0 0 rgba(164,142,229,0);
            transition: box-shadow .15s ease, border-color .15s ease;
        `;
        input.addEventListener('focus', () => {
            input.style.boxShadow = '0 0 0 3px rgba(164,142,229,0.18)';
            input.style.borderColor = 'rgba(164,142,229,0.6)';
        });
        input.addEventListener('blur', () => {
            input.style.boxShadow = '0 0 0 0 rgba(164,142,229,0)';
            input.style.borderColor = 'rgba(255,255,255,0.2)';
        });

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Entrer';
        button.className = 'apply-btn';

        const status = document.createElement('div');
        status.style.cssText = 'text-align:center; font-size: 12px; color:#bdbdbd; margin-top: 10px; min-height: 18px;';

        wrapper.appendChild(input);
        wrapper.appendChild(button);
        contentArea.appendChild(wrapper);
        contentArea.appendChild(status);

        async function handleSubmit() {
            const raw = (input.value || '').trim();
            if (!raw) { status.textContent = 'Veuillez entrer un identifiant numérique.'; return; }
            const id = Number(raw);
            if (!Number.isFinite(id) || id <= 0) { status.textContent = 'Identifiant invalide.'; return; }

            // Construire un objet "subtitle" minimal pour réutiliser le flux standard
            const pseudoSubtitle = {
                attributes: {
                    files: [{ file_id: id }],
                    release: `OpenSubtitles #${id}`,
                    language: 'fr'
                }
            };

            try {
                button.disabled = true;
                button.textContent = 'Téléchargement...';
                status.textContent = '';

                // Utilise l'offset actuel mémorisé pour le site
                const siteOffset = await getStoredOffset();
                await downloadAndApplySubtitle(pseudoSubtitle, anime, siteOffset);
                closeModal();
            } catch (e) {
                console.error('OpenSubID error:', e);
                status.textContent = e?.message || 'Erreur lors du téléchargement';
            } finally {
                button.disabled = false;
                button.textContent = 'Entrer';
            }
        }

        button.addEventListener('click', handleSubmit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSubmit();
        });

        // Focus auto pour rapidité
        setTimeout(() => input.focus(), 50);
    }
    function renderFileSection() {
        contentArea.innerHTML = '';

        const dropZone = document.createElement('div');
        dropZone.style.cssText = `
            border: 2px dashed rgba(164,142,229,0.5);
            border-radius: 12px;
            padding: 40px 20px;
            text-align: center;
            cursor: pointer;
            background: rgba(255,255,255,0.02);
            transition: all 0.3s ease;
            margin: 16px 0;
        `;

        const icon = document.createElement('div');
        icon.innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 12px; color: #A48EE5;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
        `;

        const text = document.createElement('div');
        text.style.cssText = 'font-size: 14px; color: #dcdcdc; margin-bottom: 8px;';
        text.textContent = 'Glissez-déposez votre fichier de sous-titres';

        const subtext = document.createElement('div');
        subtext.style.cssText = 'font-size: 12px; color: #999;';
        subtext.textContent = 'ou cliquez pour sélectionner (.srt, .vtt)';

        const status = document.createElement('div');
        status.style.cssText = 'margin-top: 16px; font-size: 13px; color: #bdbdbd; min-height: 20px;';

        dropZone.appendChild(icon);
        dropZone.appendChild(text);
        dropZone.appendChild(subtext);
        contentArea.appendChild(dropZone);
        contentArea.appendChild(status);

        // Hidden file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.srt,.vtt';
        fileInput.style.display = 'none';
        contentArea.appendChild(fileInput);

        // Hover effect
        dropZone.addEventListener('mouseenter', () => {
            dropZone.style.borderColor = 'rgba(164,142,229,0.8)';
            dropZone.style.background = 'rgba(164,142,229,0.08)';
        });
        dropZone.addEventListener('mouseleave', () => {
            dropZone.style.borderColor = 'rgba(164,142,229,0.5)';
            dropZone.style.background = 'rgba(255,255,255,0.02)';
        });

        // Click to open file picker
        dropZone.addEventListener('click', () => fileInput.click());

        // Handle file selection
        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files[0]) {
                handleFile(fileInput.files[0]);
            }
        });

        // Drag and drop handlers
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.borderColor = '#A48EE5';
            dropZone.style.background = 'rgba(164,142,229,0.15)';
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.borderColor = 'rgba(164,142,229,0.5)';
            dropZone.style.background = 'rgba(255,255,255,0.02)';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.borderColor = 'rgba(164,142,229,0.5)';
            dropZone.style.background = 'rgba(255,255,255,0.02)';

            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                handleFile(files[0]);
            }
        });

        async function handleFile(file) {
            const validExts = ['.srt', '.vtt'];
            const fileName = file.name.toLowerCase();
            const isValid = validExts.some(ext => fileName.endsWith(ext));

            if (!isValid) {
                status.textContent = 'Fichier invalide. Utilisez .srt ou .vtt';
                status.style.color = '#dc3545';
                return;
            }

            status.textContent = `Lecture de ${file.name}...`;
            status.style.color = '#A48EE5';

            try {
                const content = await file.text();
                
                if (!content || content.trim().length === 0) {
                    status.textContent = 'Le fichier est vide';
                    status.style.color = '#dc3545';
                    return;
                }

                status.textContent = `${file.name} chargé — Application...`;
                status.style.color = '#46d369';

                // Apply subtitle directly (same flow as downloadAndApplySubtitle but without API call)
                const siteOffset = await getStoredOffset();
                await setStoredOffset(siteOffset);
                
                const subtitleInfo = {
                    name: file.name,
                    language: 'fr' // could detect from filename if needed
                };

                await applySubtitleToVideo(content, subtitleInfo, siteOffset);
                showNotification(`Sous-titres de ${file.name} appliqués !`, "success");
                
                // Show offset control
                showOffsetControl(content, subtitleInfo, siteOffset);
                
                closeModal();

            } catch (error) {
                console.error('File handling error:', error);
                status.textContent = `Erreur: ${error.message}`;
                status.style.color = '#dc3545';
            }
        }
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
            <input type="range" id="realtime-offset-slider" min="-50000" max="50000" value="${initialOffset}" step="100" 
                   style="width: 100%; cursor: pointer;" />
            <input type="number" id="realtime-offset-input" min="-50000" max="50000" step="100" value="${initialOffset}"
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
        currentOffset = clamp(snap100(offset), -50000, 50000);
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
function showNotification(message, type = "info", options = {}) {
    // Options par défaut
    const {
        duration = 3000,
        persist = false, // si true, pas d'auto-dismiss
        replace = true // si true, remplace la notification précédente
    } = options;

    // Couleurs selon type
    const bgColor = type === "error" ? "rgba(220,53,69,0.95)" :
        type === "success" ? "rgba(70,211,105,0.95)" :
            "rgba(0,0,0,0.9)";

    // Si on remplace, supprimer toutes les notifications existantes
    if (replace) {
        document.querySelectorAll('.aniext-notification').forEach(n => {
            try { n.remove(); } catch (e) { }
        });
        // Nettoyer ancien timer global si présent
        if (infoTimeout) {
            clearTimeout(infoTimeout);
            infoTimeout = null;
        }
    }

    // Créer l'élément
    const notification = document.createElement("div");
    notification.className = 'aniext-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: ${bgColor};
        color: #fff;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 99999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        font-family: Arial, sans-serif;
        min-width: 200px;
        text-align: center;
        opacity: 0;
        transition: opacity .25s ease, transform .25s ease;
    `;

    // Animation d'entrée
    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Permet de fermer au clic
    notification.addEventListener('click', () => fadeAndRemove(notification));

    document.body.appendChild(notification);

    // Timer local pour chaque notification (ne dépend plus d'une variable globale unique)
    if (!persist) {
        const removeTimer = setTimeout(() => fadeAndRemove(notification), duration);
        // Stocker pour éventuelle annulation future
        notification.dataset.timerId = removeTimer;
        // Conserver compatibilité avec l'ancien code si nécessaire
        infoTimeout = removeTimer;
    }
}

function fadeAndRemove(el) {
    if (!el || !el.parentNode) return;
    try {
        const tid = el.dataset.timerId;
        if (tid) clearTimeout(Number(tid));
    } catch { }
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    el.style.transition = 'opacity .25s ease';
    setTimeout(() => { try { el.remove(); } catch { } }, 280);
}