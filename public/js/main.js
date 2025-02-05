// public/js/main.js

document.addEventListener("DOMContentLoaded", () => {
  const toggleThemeBtn = document.getElementById('toggleTheme');
  const themes = ['intergalactic-theme', 'sea-star-theme', 'moonlight-theme', 'cloudy-sky-theme', 'stormy-sky-theme'];
  let currentThemeIndex = 0;

  if (toggleThemeBtn) {
    toggleThemeBtn.addEventListener('click', () => {
      document.body.classList.remove(themes[currentThemeIndex]);
      currentThemeIndex = (currentThemeIndex + 1) % themes.length;
      document.body.classList.add(themes[currentThemeIndex]);
      toggleThemeBtn.innerHTML = `Changer en ${themes[(currentThemeIndex + 1) % themes.length].replace(/-/g, ' ').replace('theme', 'thème')}`;
    });
  }
});
