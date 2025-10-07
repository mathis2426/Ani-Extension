document.addEventListener("DOMContentLoaded", () => {
    const buttons = document.querySelectorAll(".button");
    const sections = document.querySelectorAll(".section");

    // Fonction pour enlever la classe active à tous les boutons
    function clearActive() {
        buttons.forEach(btn => btn.classList.remove("active"));
    }

    // Fonction pour activer un bouton via son id
    function setActiveButton(id) {
        clearActive();
        const btn = document.getElementById(id);
        if (btn) btn.classList.add("active");
    }

    // Scroll vers la section au clic sur bouton
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

    // Mise à jour active bouton lors du scroll
    window.addEventListener("scroll", () => {
        let current = "";
        const scrollPosition = window.scrollY + window.innerHeight / 3; // Ajuste le seuil

        sections.forEach(section => {
            if (section.offsetTop <= scrollPosition) {
                current = section.id.replace("section-", "");
            }
        });

        if (current) {
            setActiveButton(current);
        }
    });

    // Initialisation : active "home" au chargement
    setActiveButton("home");
});
