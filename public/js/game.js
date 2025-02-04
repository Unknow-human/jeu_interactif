// public/js/game.js
const socket = io();

let username;

// Récupérer le nom d'utilisateur
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
const historyList = document.getElementById('historyList');
const chatBox = document.getElementById('chatBox');
const messages = document.getElementById('messages');
const chatInput = document.getElementById('chatInput');
const abandonBtn = document.getElementById('abandonBtn');
const returnBtn = document.getElementById('returnBtn');
const historySection = document.getElementById('history');

let gameMode = ''; // 'solo' ou 'duel'

// Sélection du mode de jeu
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

function startGame() {
  document.getElementById('gameModeSelection').style.display = 'none';
  gameArea.style.display = 'block';
  feedback.innerHTML = '';
  if (gameMode === 'solo') {
    socket.emit('startSoloGame');
    chatBox.style.display = 'none';
    historySection.style.display = 'block';
  } else if (gameMode === 'duel') {
    chatBox.style.display = 'none'; // Sera activé lors de la connexion à un duel
    historySection.style.display = 'none'; // Historique non nécessaire en duel
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

  if (gameMode === 'solo') {
    // Ajouter à l'historique en mode solo
    const listItem = document.createElement('li');
    listItem.textContent = data;
    historyList.appendChild(listItem);
  }
});

// Activer le chat en mode duel
socket.on('enableChat', () => {
  chatBox.style.display = 'block';
});

// Affichage du vainqueur
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

// Message de bienvenue
socket.on('welcome', (message) => {
  displayNotification(message);
});

// Bouton d'abandon
if (abandonBtn) {
  abandonBtn.addEventListener('click', () => {
    if (confirm('Voulez-vous vraiment abandonner la partie ?')) {
      socket.emit('abandon');
      resetGame();
    }
  });
}

// Bouton retour
if (returnBtn) {
  returnBtn.addEventListener('click', () => {
    resetGame();
  });
}

// Fonction pour réinitialiser le jeu
function resetGame() {
  gameArea.style.display = 'none';
  document.getElementById('gameModeSelection').style.display = 'block';
  feedback.innerHTML = '';
  historyList.innerHTML = '';
  chatBox.style.display = 'none';
  historySection.style.display = 'none';
}

// Gestion de la déconnexion de l'adversaire
socket.on('opponentLeft', (message) => {
  alert(message);
  resetGame();
});

// Désactiver le chat si le joueur quitte le mode duel
window.addEventListener('beforeunload', () => {
  socket.emit('leaveGame');
});
