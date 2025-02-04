// public/js/chat.js

const socket = io();

// Éléments du DOM pour le chat
const chatInput = document.getElementById('chatInput');
const messages = document.getElementById('messages');

// Envoi d'un message lorsque l'utilisateur appuie sur Entrée
if (chatInput) {
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim() !== '') {
      socket.emit('chatMessage', chatInput.value.trim());
      chatInput.value = '';
    }
  });
}

// Réception des messages du serveur
socket.on('chatMessage', (data) => {
  displayMessage(data.user, data.message);
});

// Fonction pour afficher un message dans le chat
function displayMessage(user, message) {
  const messageElem = document.createElement('p');
  messageElem.innerHTML = `<strong>${user}:</strong> ${message}`;
  messages.appendChild(messageElem);
  messages.scrollTop = messages.scrollHeight;
}

// Gestion des notifications
socket.on('notification', (data) => {
  displayNotification(data.message);
});

function displayNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.innerText = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Événement de déconnexion
window.addEventListener('beforeunload', () => {
  socket.emit('disconnect');
});
