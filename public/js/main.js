// public/js/main.js
document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('toggleTheme');
  if(toggleButton){
    toggleButton.addEventListener('click', () => {
      const body = document.body;
      if(body.classList.contains('theme-light')){
        body.classList.remove('theme-light');
        body.classList.add('theme-dark');
      } else {
        body.classList.remove('theme-dark');
        body.classList.add('theme-light');
      }
    });
  }
});
