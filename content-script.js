/**
 * File Name      : content-script.js
 * Description    : This file manages the extraction, processing, and sending of anime information for the extension.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Date           : Last update 2025-09-29
 * Version        : 1.0.0
 */

let animeClass = new anime();

// --- ton switch hostname existant (inchangé) ---
switch (location.hostname) {
  case "v6.voiranime.com":
  case "vidmoly.net": // lecteur myTV
  case "voe.sx": // lecteur voe
  case "my.mail.ru": // lecteur FHD1
    voiranime(animeClass, () => {
        chrome.runtime.sendMessage({ type: "animeData", data: animeClass });
    });
    break;

  case "www.crunchyroll.com":
  case "static.crunchyroll.com":
    SPADetectChange(() => {
      crunchyroll(animeClass, location, () => {
          chrome.runtime.sendMessage({ type: "animeData", data: animeClass });
      });
    });
    break;
  
  case "www.netflix.com":
    netflix(animeClass, () => {
      chrome.runtime.sendMessage({ type: "animeData", data: animeClass });
    });
    break;
  default:
    console.log("Site non supporté pour le moment : " + location.hostname);
    break;
}

// Listen for subtitle application messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "applySubtitle") {
    (async () => {
      try {
        await applySubtitleToVideo(message.subtitleContent, message.subtitleInfo, Number(message.offsetMs || 0));
        sendResponse({ success: true });
      } catch (error) {
        console.error("Erreur application sous-titres:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async response
  }
});

/* ===========================
   Main: appliquer les sous-titres
   =========================== */
async function applySubtitleToVideo(subtitleContent, subtitleInfo = {}, offsetMs = 0) {
  console.log("Application des sous-titres...", subtitleInfo, "offsetMs=", offsetMs);

  // Trouver la video - tentative progressive (some sites use shadow DOM/custom players)
  const video = findBestVideoElement();
  if (!video) throw new Error("Aucune vidéo trouvée sur la page");

  // Convert SRT -> VTT if needed, and apply offset
  let vttContent = subtitleContent;
  if (!subtitleContent.trim().startsWith("WEBVTT")) {
    vttContent = srtToVtt(subtitleContent, offsetMs);
  } else if (offsetMs !== 0) {
    // If already VTT, apply a simple offset by reparsing times
    vttContent = vttApplyOffset(subtitleContent, offsetMs);
  }

  // create blob and url
  const blob = new Blob([vttContent], { type: "text/vtt;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  // remove previous custom tracks created by extension
  removeCustomTracksFromVideo(video);

  // create track
  const track = document.createElement("track");
  track.kind = "subtitles";
  track.label = subtitleInfo.name || "AniExt Subtitles";
  track.srclang = subtitleInfo.language || "fr";
  track.src = url;
  track.default = true;
  track.setAttribute("data-custom-subtitle", "aniext");

  // append track and wait for load to show
  video.appendChild(track);

  // inject style once
  injectSubtitleStyle();

  // Ensure track is shown after load (some players only expose textTracks after append)
  await waitForTrackAndShow(video, track);

  console.log("Sous-titres appliqués avec succès");
  return true;
}

/* ===========================
   Helpers: detection video / tracks
   =========================== */
function findBestVideoElement() {
  // Common selectors: try simple selectors first
  const candidates = [
    () => document.querySelector("video"),
    () => document.querySelector("video[data-player]"),
    () => document.querySelector("video#video"),
    () => document.querySelector("video[src]"),
  ];
  for (const fn of candidates) {
    try {
      const v = fn();
      if (v) return v;
    } catch (e) {}
  }
  // try to find any video deeper (shadow DOM/ref)
  const vids = document.getElementsByTagName("video");
  if (vids && vids.length > 0) return vids[0];
  return null;
}

function removeCustomTracksFromVideo(video) {
  try {
    const existing = video.querySelectorAll("track[data-custom-subtitle='aniext']");
    existing.forEach(t => {
      try { t.remove(); } catch (e) { console.warn(e); }
    });
    // revoke object URLs if any (best-effort)
    // Note: can't reliably find blob urls to revoke without storing them; rely on GC.
  } catch (e) {
    console.warn("removeCustomTracksFromVideo error:", e);
  }
}

function waitForTrackAndShow(video, track, timeoutMs = 3000) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = () => { if (!resolved) { resolved = true; resolve(); } };

    // If track fires load event, set mode
    const onLoad = () => {
      try {
        // set underlying textTrack mode to showing
        try { track.mode = "showing"; } catch {}
        const tv = Array.from(video.textTracks || []).find(t => (t.label === track.label || t.language === track.srclang));
        if (tv) tv.mode = "showing";
      } catch (e) { console.warn("track load handling:", e); }
      cleanup();
      done();
    };

    const cleanup = () => {
      track.removeEventListener("load", onLoad);
      clearTimeout(timer);
    };

    track.addEventListener("load", onLoad);

    // Sometimes load doesn't fire (site blocks), so fallback after short timeout:
    const timer = setTimeout(() => {
      try {
        // Try to enable via video.textTracks
        const tv = Array.from(video.textTracks || []).find(t => (t.label === track.label || t.language === track.srclang));
        if (tv) tv.mode = "showing";
      } catch (e) { console.warn("fallback enabling track:", e); }
      cleanup();
      done();
    }, timeoutMs);
  });
}

/* ===========================
   SRT -> VTT conversion & offset helpers
   =========================== */
function srtToVtt(srt, offsetMs = 0) {
  if (!srt) return "WEBVTT\n\n";
  // normalize endings
  srt = srt.replace(/\r/g, "");
  const blocks = srt.trim().split(/\n\n+/);
  let vtt = "WEBVTT\n\n";
  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    if (lines.length === 0) continue;
    let idx = 0;
    if (/^\d+$/.test(lines[0].trim())) idx = 1;
    const timeLine = lines[idx] || "";
    if (!timeLine.includes("-->")) continue;
    const [startRaw, endRaw] = timeLine.split("-->").map(s => s.trim());
    const startMs = timeToMs(startRaw);
    const endMs = timeToMs(endRaw);
    const newStart = msToVttTime(startMs + offsetMs);
    const newEnd = msToVttTime(endMs + offsetMs);
    const text = lines.slice(idx + 1).join("\n");
    vtt += `${newStart} --> ${newEnd}\n${text}\n\n`;
  }
  return vtt;
}
function vttApplyOffset(vttText, offsetMs = 0) {
  // Very simple parser: shift all time lines that match X --> Y
  return vttText.replace(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/g, (m, a, b) => {
    const aMs = timeToMs(a.replace(".", ",")); // timeToMs accepts both
    const bMs = timeToMs(b.replace(".", ","));
    return `${msToVttTime(aMs + offsetMs)} --> ${msToVttTime(bMs + offsetMs)}`;
  });
}
function timeToMs(timeStr) {
  // Accept 00:00:00,000 or 00:00:00.000 or 00:00:00
  if (!timeStr) return 0;
  timeStr = timeStr.replace(",", ".").trim();
  const parts = timeStr.split(":").map(p => p.trim());
  let ms = 0;
  if (parts.length === 3) {
    ms += Number(parts[0]) * 3600 * 1000;
    ms += Number(parts[1]) * 60 * 1000;
    ms += Math.round(parseFloat(parts[2]) * 1000);
  } else if (parts.length === 2) {
    ms += Number(parts[0]) * 60 * 1000;
    ms += Math.round(parseFloat(parts[1]) * 1000);
  } else {
    ms += Math.round(parseFloat(parts[0]) * 1000);
  }
  return ms;
}
function msToVttTime(ms) {
  const sign = ms < 0 ? "-" : "";
  ms = Math.max(0, Math.round(ms));
  const hh = Math.floor(ms / 3600000); ms -= hh * 3600000;
  const mm = Math.floor(ms / 60000); ms -= mm * 60000;
  const ss = Math.floor(ms / 1000); ms -= ss * 1000;
  const mmm = ms;
  return `${sign}${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}.${String(mmm).padStart(3,"0")}`;
}

/* ===========================
   Styling injection (::cue) - Netflix/Crunchyroll style
   =========================== */
let __aniext_style_injected = false;
function injectSubtitleStyle() {
  if (__aniext_style_injected) return;
  __aniext_style_injected = true;

  const css = `
  ::cue {
  color: #ffffff;
  font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
  font-size: 1.1em;
  font-weight: 700;
  line-height: 1.3;
  background: transparent;
  padding: 0;

  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  text-shadow:
    /* flou central un peu plus large pour lisser */
    0 0 9px rgba(0,0,0,0.85),

    /* diagonales légères et fractionnaires */
    -1.2px -1.2px 1px rgba(0,0,0,0.95),
    1.2px -1.2px 1px rgba(0,0,0,0.95),
    -1.2px 1.2px 1px rgba(0,0,0,0.95),
    1.2px 1.2px 1px rgba(0,0,0,0.95),

    /* nouvelle couche diagonale proche pour renforcer l'épaisseur */
    -1.5px -1.5px 1px rgba(0,0,0,0.92),
    1.5px -1.5px 1px rgba(0,0,0,0.92),
    -1.5px 1.5px 1px rgba(0,0,0,0.92),
    1.5px 1.5px 1px rgba(0,0,0,0.92),

    /* axes horizontaux et verticaux */
    -2px 0 1px rgba(0,0,0,0.88),
    2px 0 1px rgba(0,0,0,0.88),
    0 -2px 1px rgba(0,0,0,0.88),
    0 2px 1px rgba(0,0,0,0.88);
}
  /* fallback overlay style */
  #aniext-subtitle-overlay {
    position: absolute;
    bottom: 6%;
    left: 50%;
    transform: translateX(-50%);
    width: 84%;
    text-align: center;
    pointer-events: none;
    z-index: 999999;
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    font-weight: 700;
    color: #fff;
    text-shadow:
      -2px -2px 0 #000,
      2px -2px 0 #000,
      -2px 2px 0 #000,
      2px 2px 0 #000,
      -2px 0 0 #000,
      2px 0 0 #000,
      0 -2px 0 #000,
      0 2px 0 #000,
      0 0 4px rgba(0,0,0,0.8);
  }
  #aniext-subtitle-overlay .line {
    display: block;
    margin: 2px 0;
    background: transparent;
    padding: 0;
    font-size: 1.1em;
    line-height: 1.3;
  }
  `;

  const style = document.createElement("style");
  style.id = "aniext-subtitle-style";
  style.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(style);
}

/* ===========================
   Fallback overlay parser (optionnel)
   - Not automatically enabled. Useful for sites that don't show <track>.
   - If needed, we can parse VTT cues and display overlay.
   =========================== */
function showOverlayFromVtt(video, vttContent) {
  // minimal parser to show current cue; not necessary if native track works
  // (left here for future implementation if needed)
}
