// animations.js

document.addEventListener("DOMContentLoaded", () => {
  // Animation de fond
  const body = document.body;
  body.classList.add("fade-in");

  // Animation des boutons
  const buttons = document.querySelectorAll(".btn, .nav-link");
  buttons.forEach(button => {
    button.addEventListener("mouseover", () => {
      button.classList.add("hover");
    });
    button.addEventListener("mouseout", () => {
      button.classList.remove("hover");
    });
  });

  // Animation des notifications
  const notifications = document.querySelectorAll(".notification");
  notifications.forEach(notification => {
    notification.classList.add("slide-in");
  });
});