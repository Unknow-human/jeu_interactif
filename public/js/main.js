// public/js/main.js
// Charger la préférence de thème
window.addEventListener('load', () => {
  const theme = localStorage.getItem('theme');
  if (theme === 'light') {
    document.body.classList.add('light-theme');
  }
});
// main.js



// Appeler la fonction au chargement de la page
window.addEventListener('DOMContentLoaded', displayMenuIfLoggedIn);
// public/js/main.js

document.addEventListener("DOMContentLoaded", () => {
  const toggleThemeBtn = document.getElementById('toggleTheme');
  
  if (toggleThemeBtn) {
    toggleThemeBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
    });
  }
});

