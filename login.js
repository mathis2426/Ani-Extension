//User connexion

const urlApi = "http://localhost/Ani-Api/api/connexion";

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

    if (!response.ok) throw new Error("Échec de connexion");

    const tokenJwt = await response.json();
    await chrome.storage.local.set({ "token": tokenJwt });
    alert("token JWT stocké : " + tokenJwt);
    alert("Connexion reussie !");
    //window.close(); // Ferme la fenêtre de connexion après succès
  } catch (err) {
    alert("Erreur : " + err.message);
  }
});
