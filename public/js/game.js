// public/js/game.js
const socket = io();

// Récupérer le nom d'utilisateur depuis la session
let username;

fetch('/getUserInfo')
  .then(response => response.json())
  .then(data => {
    username = data.username;
    socket.emit('join', username);
  });

// Éléments du DOM
const soloModeBtn = document.getElementById('soloMode');
const duelModeBtn = document.getElementById('duelMode');
const gameArea = document.getElementById('gameArea');
const guessInput = document.getElementById('guessInput');
const submitGuessBtn = document.getElementById('submitGuess');
const feedback = document.getElementById('feedback');
const chatInput = document.getElementById('chatInput');
const messages = document.getElementById('messages');
const historyList = document.getElementById('historyList');
const chatBox = document.getElementById('chatBox');

let gameMode = ''; // 'solo' ou 'duel'

// Sélection du mode de jeu
if (soloModeBtn && duelModeBtn) {
  soloModeBtn.addEventListener('click', () => {
    gameMode = 'solo';
    startGame();
  });

  duelModeBtn.addEventListener('click', () => {
    gameMode = 'duel';
    socket.emit('findMatch');
  });
}

function startGame() {
  document.getElementById('gameModeSelection').style.display = 'none';
  gameArea.style.display = 'block';
  if (gameMode === 'solo') {
    socket.emit('startSoloGame');
    // Désactiver le chat en mode solo
    chatBox.style.display = 'none';
  }
}

// Soumettre une proposition
if (submitGuessBtn) {
  submitGuessBtn.addEventListener('click', () => {
    const guess = guessInput.value;
    if (guess.length === 4 && /^[0-9]+$/.test(guess)) {
      socket.emit('guess', guess);
      guessInput.value = '';
    } else {
      alert('Veuillez entrer un code à 4 chiffres');
    }
  });
}

// Recevoir le feedback du serveur
socket.on('feedback', (data) => {
  feedback.innerHTML += `<p>${data}</p>`;
  feedback.scrollTop = feedback.scrollHeight;

  // Ajouter à l'historique en mode solo
  if (gameMode === 'solo') {
    const listItem = document.createElement('li');
    listItem.textContent = data;
    historyList.appendChild(listItem);
  }
});

// Affichage du vainqueur
socket.on('gameOver', (message) => {
  alert(message);
  // Désactiver le chat
  chatBox.style.display = 'none';
  location.reload();
});

// Activer le chat en mode duel
socket.on('enableChat', () => {
  chatBox.style.display = 'block';
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
    messages.innerHTML += `<p><strong>${data.user}:</strong> ${data.message}</p>`;
    messages.scrollTop = messages.scrollHeight;
  });
}

// Notifications
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

// Mise à jour du classement
socket.on('updateLeaderboard', (leaderboard) => {
  // Vous pouvez mettre à jour le classement sur la page si nécessaire
});

// Message de bienvenue
socket.on('welcome', (message) => {
  displayNotification(message);
});
