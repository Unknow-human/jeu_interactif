document.addEventListener("DOMContentLoaded", () => {
  const toggleThemeBtn = document.getElementById('toggleTheme');
  
  if (toggleThemeBtn) {
    toggleThemeBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      if (document.body.classList.contains('light-theme')) {
        toggleThemeBtn.innerHTML = "Changer en Thème Sombre";
      } else {
        toggleThemeBtn.innerHTML = "Changer en Thème Clair";
      }
    });
  }
});
