/**
 * File Name      : login.js
 * Description    : This file handles user login for the application.
 * Author         : Mathis Gramage, Mathis Cucherat
 * Date           : Last update 2025-09-29
 * Version        : 1.0.0
 */

const urlApi = "http://localhost/Ani-Api/api/connexion"; // API endpoint for login

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const mail = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const response = await fetch(urlApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        mail, 
        password
      })
    });

    if (response.status === 401) { // Unauthorized by the server
      alert("Identifiants incorrects. Veuillez réessayer.");
      return;
    }
    const tokenJwt = await response.json();
    await chrome.storage.local.set({ "token": tokenJwt.token }); // Stock token in local chrome storage
    window.close();
  } catch (err) {
    alert("Erreur : " + err.message);
  }
});
