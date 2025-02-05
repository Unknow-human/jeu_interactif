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
const soloGameArea = document.getElementById('soloGameArea');
const duelGameArea = document.getElementById('duelGameArea');
const submitGuessSolo = document.getElementById('submitGuessSolo');
const submitGuessDuel = document.getElementById('submitGuessDuel');
const feedbackSolo = document.getElementById('historyListSolo');
const feedbackDuel = document.getElementById('historyListDuel');
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
  if (gameMode === 'solo') {
    soloGameArea.style.display = 'block';
    duelGameArea.style.display = 'none';
    chatBox.style.display = 'none';
    socket.emit('startSoloGame');
  } else if (gameMode === 'duel') {
    soloGameArea.style.display = 'none';
    duelGameArea.style.display = 'block';
    chatBox.style.display = 'none'; // Le chat sera activé lorsque le duel commencera
    socket.emit('findMatch');
  }
}

// Gestion de l'événement du bouton "Valider"
if (submitGuessSolo) {
  submitGuessSolo.addEventListener('click', submitGuess);
}

if (submitGuessDuel) {
  submitGuessDuel.addEventListener('click', submitGuess);
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
  const feedbackElement = (gameMode === 'solo') ? feedbackSolo : feedbackDuel;
  feedbackElement.innerHTML += `<li>${data}</li>`;
  feedbackElement.scrollTop = feedbackElement.scrollHeight;
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
  feedbackSolo.innerHTML = '';
  feedbackDuel.innerHTML = '';
  messages.innerHTML = '';
  currentGuess = [];
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