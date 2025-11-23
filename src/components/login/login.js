/**
 * File Name      : login.js
 * Description    : This file handles user login for the application.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Date           : Last update 2025-10-07
 * Version        : 1.0.0
 */
import { URL_API } from "../../vars.js";

// Load random background video
function loadRandomBackgroundVideo() {
  const videos = [
    '../../../public/videos-connexion/Video1.mp4',
    '../../../public/videos-connexion/Video2.mp4',
    '../../../public/videos-connexion/Video3.mp4'
  ];

  // Choisir une vidéo aléatoire
  const randomVideo = videos[Math.floor(Math.random() * videos.length)];
  
  // Ajouter la source à la vidéo
  const videoElement = document.getElementById('background-video');
  const source = document.createElement('source');
  source.src = randomVideo;
  source.type = 'video/mp4';
  videoElement.appendChild(source);
}

// Load video when DOM is ready
document.addEventListener('DOMContentLoaded', loadRandomBackgroundVideo);

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const mail = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const response = await fetch(URL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        mail, 
        password
      })
    });

    if (response.status === 401) { // Unauthorized by the server
      showError("Identifiants incorrects. Veuillez réessayer.");
      return;
    }
    const tokenJwt = await response.json();
    await chrome.storage.local.set({ "token": tokenJwt.token }); // Stock token in local chrome storage
    window.close();
  } catch (err) {
    showError("Erreur : " + err.message);
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Affiche un message d'erreur dans la popup
 */
function showError(message) {
  const errorDiv = document.getElementById('error');
  const errorTitle = document.getElementById('error__title');
  
  errorTitle.textContent = message;
  errorDiv.classList.remove('error-hide');
  errorDiv.classList.add('error-show');
  
  // Fermer l'erreur au clic sur le bouton X
  document.getElementById('error__close').addEventListener('click', hideError, { once: true });
}

/**
 * Masque la popup d'erreur
 */
function hideError() {
  const errorDiv = document.getElementById('error');
  errorDiv.classList.remove('error-show');
  errorDiv.classList.add('error-hide');
}
