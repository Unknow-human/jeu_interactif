// public/js/game.js

// Initialisation de la connexion Socket.io
const socket = io();

// Variables pour stocker le nom d'utilisateur et le mode de jeu
let username;
let gameMode = ''; // 'solo' ou 'duel'

// Sélection des éléments du DOM
const soloModeBtn = document.getElementById('soloMode');
const duelModeBtn = document.getElementById('duelMode');
const gameModeSelection = document.getElementById('gameModeSelection');
const gameArea = document.getElementById('gameArea');
const gameWheel = document.getElementById('gameWheel');
const submitGuessBtn = document.getElementById('submitGuess');
const feedback = document.getElementById('feedback');
const historyList = document.getElementById('historyList');
const chatBox = document.getElementById('chatBox');
const messages = document.getElementById('messages');
const chatInput = document.getElementById('chatInput');
const abandonBtn = document.getElementById('abandonBtn');
const returnBtn = document.getElementById('returnBtn');

// Variables pour la saisie du code
let currentGuess = [];

// Récupération du nom d'utilisateur depuis le serveur
fetch('/getUserInfo')
  .then(response => response.json())
  .then(data => {
    username = data.username;
    socket.emit('join', username);
  })
  .catch(error => {
    console.error('Erreur lors de la récupération des informations utilisateur :', error);
  });

// Gestion des événements pour les boutons du mode de jeu
if (soloModeBtn && duelModeBtn) {
  soloModeBtn.addEventListener('click', () => {
    gameMode = 'solo';
    startGame();
  });
  
  duelModeBtn.addEventListener('click', () => {
    gameMode = 'duel';
    startGame();
    socket.emit('findMatch');
  });
}

// Fonction pour démarrer le jeu
function startGame() {
  gameModeSelection.style.display = 'none';
  gameArea.style.display = 'block';
  feedback.innerHTML = '';
  resetGuess();
  if (gameMode === 'solo') {
    socket.emit('startSoloGame');
    chatBox.style.display = 'none';
    historyList.innerHTML = '';
  } else if (gameMode === 'duel') {
    chatBox.style.display = 'none'; // Le chat sera activé lorsque le duel commencera
    historyList.innerHTML = ''; // Pas d'historique en mode duel
  }
}

// Gestion de l'interaction avec la roue
if (gameWheel) {
  gameWheel.addEventListener('click', (e) => {
    if (e.target.classList.contains('wheel-segment')) {
      const value = e.target.getAttribute('data-value');
      currentGuess.push(value);
      if (currentGuess.length === 4) {
        submitGuessBtn.disabled = false;
      } else {
        submitGuessBtn.disabled = true;
      }
    }
  });
}

// Gestion de l'événement du bouton "Valider"
if (submitGuessBtn) {
  submitGuessBtn.addEventListener('click', submitGuess);
}

// Fonction pour réinitialiser la saisie du code
function resetGuess() {
  currentGuess = [];
  submitGuessBtn.disabled = true;
}

// Fonction pour soumettre une proposition
function submitGuess() {
  const guess = currentGuess.join('');
  if (guess.length === 4 && /^\d{4}$/.test(guess)) {
    socket.emit('guess', guess);
    resetGuess();
  } else {
    alert('Veuillez entrer un code à 4 chiffres');
  }
}

// Réception des feedbacks du serveur
socket.on('feedback', (data) => {
  feedback.innerHTML += `<p>${data}</p>`;
  feedback.scrollTop = feedback.scrollHeight;
  
  if (gameMode === 'solo') {
    // Ajouter à l'historique en mode solo
    const listItem = document.createElement('li');
    listItem.textContent = data;
    historyList.appendChild(listItem);
  }
});

// Activation du chat en mode duel
socket.on('enableChat', () => {
  chatBox.style.display = 'block';
});

// Gestion de la fin de la partie
socket.on('gameOver', (message) => {
  alert(message);
  resetGame();
});

// Gestion du chat
if (chatInput) {
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim() !== '') {
      socket.emit('chatMessage', chatInput.value.trim());
      chatInput.value = '';
    }
  });
  
  socket.on('chatMessage', (data) => {
    messages.innerHTML += `<p><strong>${data.user} :</strong> ${data.message}</p>`;
    messages.scrollTop = messages.scrollHeight;
  });
}

// Bouton "Abandonner"
if (abandonBtn) {
  abandonBtn.addEventListener('click', () => {
    if (confirm('Voulez-vous vraiment abandonner la partie ?')) {
      socket.emit('abandon');
      resetGame();
    }
  });
}

// Bouton "Retour"
if (returnBtn) {
  returnBtn.addEventListener('click', () => {
    socket.emit('leaveGame');
    resetGame();
  });
}

// Fonction pour réinitialiser le jeu
function resetGame() {
  gameArea.style.display = 'none';
  gameModeSelection.style.display = 'block';
  feedback.innerHTML = '';
  historyList.innerHTML = '';
  messages.innerHTML = '';
  resetGuess();
  chatInput.value = '';
  chatBox.style.display = 'none';
  gameMode = '';
}

// Notifications
socket.on('notification', (data) => {
  displayNotification(data.message);
});

// Fonction pour afficher une notification
function displayNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.innerText = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Message de bienvenue
socket.on('welcome', (message) => {
  displayNotification(message);
});

// Gestion de la déconnexion de l'adversaire
socket.on('opponentLeft', (message) => {
  alert(message);
  resetGame();
});