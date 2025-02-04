// server.js

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const compression = require('compression');
const fs = require('fs');

// Configuration du serveur
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'ton_secret', // Change ce secret en production
  resave: false,
  saveUninitialized: true
}));

// Forcer HTTPS en production
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});

// Chargement des utilisateurs depuis un fichier JSON
let users = [];
if (fs.existsSync('users.json')) {
  users = JSON.parse(fs.readFileSync('users.json'));
}

// Variables en mémoire
let onlineUsers = {}; // { username: socket.id }
let waitingPlayers = []; // File d'attente pour le matchmaking
let games = {}; // Parties en cours

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/pages/index.html');
});

// Routes d'authentification
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  // Validation des entrées
  if (!username || !password) {
    return res.send('Veuillez remplir tous les champs');
  }
  // Vérifier si l'utilisateur existe déjà
  if (users.find(user => user.username === username)) {
    return res.send('Le nom d\'utilisateur existe déjà');
  }
  // Hasher le mot de passe
  const hashedPassword = await bcrypt.hash(password, 10);
  // Ajouter l'utilisateur
  users.push({ username, password: hashedPassword, score: 0, rewards: [] });
  fs.writeFileSync('users.json', JSON.stringify(users));
  res.redirect('/pages/login.html');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  // Validation des entrées
  if (!username || !password) {
    return res.send('Veuillez remplir tous les champs');
  }
  const user = users.find(user => user.username === username);
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.user = { username: user.username };
    res.redirect('/pages/game.html');
  } else {
    res.send('Identifiants incorrects');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Middleware d'authentification
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/pages/login.html');
  }
}

// Routes protégées
app.get('/pages/game.html', isAuthenticated, (req, res) => {
  res.sendFile(__dirname + '/public/pages/game.html');
});

app.get('/pages/profile.html', isAuthenticated, (req, res) => {
  res.sendFile(__dirname + '/public/pages/profile.html');
});

// Route pour les données du classement
app.get('/leaderboardData', (req, res) => {
  let sortedUsers = users.sort((a, b) => b.score - a.score);
  res.json(sortedUsers);
});

// Route pour les infos du profil utilisateur
app.get('/getUserInfo', isAuthenticated, (req, res) => {
  const user = users.find(u => u.username === req.session.user.username);
  res.json({
    username: user.username,
    score: user.score,
    rewards: user.rewards || []
  });
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
});

// Gestion des sockets
io.on('connection', (socket) => {
  // Gestion des sessions avec les sockets
  let session = socket.request.session;
  if (session && session.user) {
    const username = session.user.username;
    const user = users.find(u => u.username === username);
    if (user) {
      socket.username = username;
      onlineUsers[username] = socket.id;
      socket.emit('updateOnlineUsers', Object.keys(onlineUsers));
      socket.emit('updateLeaderboard', getLeaderboard());
      socket.emit('welcome', `Bienvenue ${username} !`);
    }
  } else {
    // Déconnecter le socket si pas de session utilisateur
    socket.disconnect(true);
    return;
  }

  // Démarrer une partie solo
  socket.on('startSoloGame', () => {
    socket.game = {
      mode: 'solo',
      secretCode: generateSecretCode(),
      attempts: 0
    };
    socket.emit('feedback', 'La partie solo a commencé ! Bonne chance !');
  });

  // Rejoindre le matchmaking pour le duel
  socket.on('findMatch', () => {
    socket.game = { mode: 'duel' };
    waitingPlayers.push(socket);
    if (waitingPlayers.length >= 2) {
      const player1 = waitingPlayers.shift();
      const player2 = waitingPlayers.shift();
      startDuel(player1, player2);
    } else {
      socket.emit('feedback', 'En attente d\'un adversaire...');
    }
  });

  // Recevoir une proposition
  socket.on('guess', (guess) => {
    if (!socket.game || !guess || guess.length !== 4 || !/^\d{4}$/.test(guess)) {
      return socket.emit('feedback', 'Entrée invalide.');
    }

    socket.game.attempts++;
    let result = checkGuess(guess, socket.game.secretCode);
    socket.emit('feedback', `Tentative ${socket.game.attempts}: ${result}`);

    if (result.includes('4 chiffres corrects et bien placés')) {
      socket.emit('gameOver', '🎉 Félicitations, vous avez gagné !');
      // Mettre à jour le score
      updateScore(socket.username, socket.game.mode);
      // Informer l'adversaire en mode duel
      if (socket.game.mode === 'duel') {
        const opponentSocket = io.sockets.sockets.get(socket.game.opponentId);
        if (opponentSocket) {
          opponentSocket.emit('gameOver', `😢 Vous avez perdu ! ${socket.username} a gagné la partie.`);
          // Mettre à jour le score de l'adversaire
          updateScore(opponentSocket.username, 'defeat');
        }
      }
    }
  });

  // Gestion du chat

// Gestion du chat
socket.on('chatMessage', (message) => {
  if (socket.game && socket.game.gameId) {
    // Envoyer le message uniquement aux joueurs de la partie en cours
    io.to(socket.game.gameId).emit('chatMessage', { user: socket.username, message });
  } else {
    // Optionnel : permettre aux utilisateurs de discuter dans un chat général
    socket.emit('feedback', '⚠️ Vous devez être en jeu pour envoyer des messages.');
  }

  if (message.length > 200) {
    message = message.substring(0, 200) + '...';
  }
  // Optionnel : Filtrer les mots inappropriés
  // message = filterBadWords(message);

  if (socket.game && socket.game.gameId) {
    io.to(socket.game.gameId).emit('chatMessage', { user: socket.username, message });
  } else {
    socket.emit('feedback', '⚠️ Vous devez être en jeu pour envoyer des messages.');
  }



});


  // Déconnexion
  socket.on('disconnect', () => {
    if (socket.username) {
      delete onlineUsers[socket.username];
      io.emit('updateOnlineUsers', Object.keys(onlineUsers));
    }
    // Retirer le joueur de la file d'attente s'il s'y trouve
    waitingPlayers = waitingPlayers.filter(player => player.id !== socket.id);

// Informer l'adversaire si en duel
if (socket.game && socket.game.mode === 'duel') {
  const opponentSocketId = socket.game.opponentId;
  const opponentSocket = io.sockets.sockets.get(opponentSocketId);
  if (opponentSocket) {
    opponentSocket.emit('notification', { message: '⚠️ Votre adversaire a quitté la partie.' });
    opponentSocket.emit('gameOver', 'Vous avez gagné par forfait de l\'adversaire.');
    updateScore(opponentSocket.username, 'duel');
  }
}

  });



  // Fonctions auxiliaires
  function startDuel(player1, player2) {
    const gameId = `game-${player1.id}-${player2.id}`;
    player1.join(gameId);
    player2.join(gameId);

    const secretCode1 = generateSecretCode();
    const secretCode2 = generateSecretCode();

    player1.game = {
      mode: 'duel',
      secretCode: secretCode2, // Le code que player1 doit deviner est celui de player2
      attempts: 0,
      opponentId: player2.id,
      gameId: gameId
    };

    player2.game = {
      mode: 'duel',
      secretCode: secretCode1, // Le code que player2 doit deviner est celui de player1
      attempts: 0,
      opponentId: player1.id,
      gameId: gameId
    };

    io.to(gameId).emit('feedback', 'La partie en duel a commencé ! Bonne chance !');
  }

  function updateScore(username, result) {
    const user = users.find(u => u.username === username);
    if (user) {
      if (result === 'solo') {
        user.score += 5;
        checkRewards(user);
      } else if (result === 'duel') {
        user.score += 10;
        checkRewards(user);
      } else if (result === 'defeat') {
        user.score += 2;
      }
      fs.writeFileSync('users.json', JSON.stringify(users));
      io.emit('updateLeaderboard', getLeaderboard());
    }
  }

  function checkRewards(user) {
    // Exemple de récompenses
    if (user.score >= 50 && !user.rewards.includes('Champion')) {
      user.rewards.push('Champion');
      const socketId = onlineUsers[user.username];
      if (socketId) {
        io.to(socketId).emit('notification', { message: '🏆 Vous avez débloqué le badge Champion !' });
      }
    }
  }

  function generateSecretCode() {
    let code = '';
    while (code.length < 4) {
      const digit = Math.floor(Math.random() * 10).toString();
      if (!code.includes(digit)) {
        code += digit;
      }
    }
    return code;
  }

  function checkGuess(guess, secretCode) {
    let wellPlaced = 0;
    let correctDigits = 0;
    for (let i = 0; i < 4; i++) {
      if (guess[i] === secretCode[i]) {
        wellPlaced++;
      } else if (secretCode.includes(guess[i])) {
        correctDigits++;
      }
    }
    return `${wellPlaced} chiffre(s) correct(s) et bien placé(s), ${correctDigits} chiffre(s) correct(s) mais mal placé(s)`;
  }

  function getLeaderboard() {
    return users.sort((a, b) => b.score - a.score).slice(0, 10);
  }
});
