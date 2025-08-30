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

    //if (!response.ok) throw new Error("Échec de connexion");

    if (response.status === 401) {
      alert("Identifiants incorrects. Veuillez réessayer.");
      return;
    }
    const tokenJwt = await response.json();
    await chrome.storage.local.set({ "token": tokenJwt.token });
    alert("token JWT stocké : " + tokenJwt.token);
    alert("Connexion reussie !");
    //window.close(); // Ferme la fenêtre de connexion après succès
  } catch (err) {
    alert("Erreur : " + err.message);
  }
});
