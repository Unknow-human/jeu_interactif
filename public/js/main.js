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
