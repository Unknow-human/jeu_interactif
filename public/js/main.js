// public/js/main.js
// Basculer entre le thème sombre et le thème clair
const toggleThemeBtn = document.getElementById('toggleTheme');

if (toggleThemeBtn) {
  toggleThemeBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    // Sauvegarder la préférence dans le localStorage
    if (document.body.classList.contains('light-theme')) {
      localStorage.setItem('theme', 'light');
    } else {
      localStorage.setItem('theme', 'dark');
    }
  });
}

// Charger la préférence de thème
window.addEventListener('load', () => {
  const theme = localStorage.getItem('theme');
  if (theme === 'light') {
    document.body.classList.add('light-theme');
  }
});
// main.js

// Fonction pour vérifier si l'utilisateur est connecté et afficher le menu
function displayMenuIfLoggedIn() {
  fetch('/getUserInfo')
    .then(response => {
      if (response.ok) {
        const topMenu = document.getElementById('topMenu');
        if (topMenu) {
          topMenu.style.display = 'flex';
        }
      }
    })
    .catch(error => {
      console.log('Utilisateur non connecté');
    });
}

// Appeler la fonction au chargement de la page
window.addEventListener('DOMContentLoaded', displayMenuIfLoggedIn);
