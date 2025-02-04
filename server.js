const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const compression = require('compression');
const fs = require('fs');

// Utiliser memorystore pour stocker les sessions en mémoire
const MemoryStore = require('memorystore')(session);

// Configuration du serveur
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration de la session
app.use(session({
  secret: 'votre_secret_ici', // Remplacez par une chaîne secrète sécurisée
  resave: false, // Ne sauvegarde la session que si elle a été modifiée
  saveUninitialized: false, // Ne sauvegarde pas les sessions non initialisées
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // Durée de vie du cookie de session (ici, 1 jour)
  },
  store: new MemoryStore({ checkPeriod: 86400000 }) // Nettoie les sessions toutes les 24 heures
}));

// Forcer HTTPS en production (facultatif selon vos besoins)
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

// Routes pour les pages statiques
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/pages/index.html');
});

app.get('/login.html', (req, res) => {
  res.sendFile(__dirname + '/public/pages/login.html');
});

app.get('/register.html', (req, res) => {
  res.sendFile(__dirname + '/public/pages/register.html');
});

app.get('/game.html', isAuthenticated, (req, res) => {
  res.sendFile(__dirname + '/public/pages/game.html');
});

app.get('/help.html', (req, res) => {
  res.sendFile(__dirname + '/public/pages/help.html');
});

app.get('/leaderboard.html', isAuthenticated, (req, res) => {
  res.sendFile(__dirname + '/public/pages/leaderboard.html');
});

app.get('/profile.html', isAuthenticated, (req, res) => {
  res.sendFile(__dirname + '/public/pages/profile.html');
});

// Routes d'authentification
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  // Validation des entrées
  if (!username || !password) {
    return res.send('Veuillez remplir tous les champs.');
  }
  // Vérifier si l'utilisateur existe déjà
  if (users.find(user => user.username === username)) {
    return res.send('Le nom d\'utilisateur existe déjà.');
  }
  // Hasher le mot de passe
  const hashedPassword = await bcrypt.hash(password, 10);
  // Ajouter l'utilisateur
  users.push({ username, password: hashedPassword, score: 0, rewards: [] });
  fs.writeFileSync('users.json', JSON.stringify(users));
  res.redirect('/login.html');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  // Validation des entrées
  if (!username || !password) {
    return res.send('Veuillez remplir tous les champs.');
  }
  const user = users.find(user => user.username === username);
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.user = { username: user.username };
    res.redirect('/game.html');
  } else {
    res.send('Identifiants incorrects.');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Middleware d'authentification
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect('/login.html');
  }
}

// Route pour les données du classement
app.get('/leaderboardData', (req, res) => {
  let sortedUsers = [...users].sort((a, b) => b.score - a.score);
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
io.use((socket, next) => {
  // Gestion de la session avec socket.io
  session(socket.request, {}, next);
});

io.on('connection', (socket) => {
  const req = socket.request;
  if (!req.session || !req.session.user) {
    console.log('Utilisateur non authentifié, déconnexion du socket.');
    return socket.disconnect(true);
  }

  const username = req.session.user.username;
  const user = users.find(u => u.username === username);

  if (user) {
    socket.username = username;
    onlineUsers[username] = socket.id;
    socket.emit('welcome', `Bienvenue ${username} !`);
    io.emit('updateOnlineUsers', Object.keys(onlineUsers));
  } else {
    return socket.disconnect(true);
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
    if (!waitingPlayers.includes(socket)) {
      waitingPlayers.push(socket);
      socket.emit('feedback', 'En attente d\'un adversaire...');
    }

    if (waitingPlayers.length >= 2) {
      const player1 = waitingPlayers.shift();
      const player2 = waitingPlayers.shift();
      startDuel(player1, player2);
    }
  });

  // Recevoir une proposition
  socket.on('guess', (guess) => {
    if (socket.game && socket.game.mode === 'solo') {
      let result = checkGuess(guess, socket.game.secretCode);
      socket.game.attempts++;
      socket.emit('feedback', `Tentative ${socket.game.attempts} - ${guess} : ${result}`);

      if (result.includes('4 chiffres corrects et bien placés')) {
        socket.emit('gameOver', '🎉 Félicitations, vous avez gagné en mode solo !');
        updateScore(socket.username, 'solo');
        delete socket.game;
      }
    } else if (socket.game && socket.game.mode === 'duel') {
      let result = checkGuess(guess, socket.game.secretCode);
      socket.game.attempts++;
      socket.emit('feedback', `Tentative ${socket.game.attempts} - ${guess} : ${result}`);

      if (result.includes('4 chiffres corrects et bien placés')) {
        socket.emit('gameOver', '🎉 Vous avez gagné le duel !');
        updateScore(socket.username, 'duel');

        const opponentSocket = io.sockets.sockets.get(socket.game.opponentId);
        if (opponentSocket) {
          opponentSocket.emit('gameOver', `😢 Vous avez perdu le duel. ${socket.username} a trouvé votre code.`);
          delete opponentSocket.game;
        }

        delete socket.game;
      }
    }
  });

  // Gestion du chat
  socket.on('chatMessage', (message) => {
    if (socket.game && socket.game.gameId) {
      io.to(socket.game.gameId).emit('chatMessage', { user: socket.username, message });
    }
  });

  // Gestion de l'abandon
  socket.on('abandon', () => {
    if (socket.game && socket.game.mode === 'duel') {
      const opponentSocket = io.sockets.sockets.get(socket.game.opponentId);
      if (opponentSocket) {
        opponentSocket.emit('gameOver', `🏆 Vous avez gagné ! ${socket.username} a abandonné le duel.`);
        updateScore(opponentSocket.username, 'duel');
        delete opponentSocket.game;
      }
      delete socket.game;
    }
    socket.emit('gameOver', 'Vous avez abandonné la partie.');
  });

  // Déconnexion du joueur
socket.on('disconnect', () => {
          if (socket.game && socket.game.mode === 'duel') {
            const opponentSocket = io.sockets.sockets.get(socket.game.opponentId);
            if (opponentSocket) {
              opponentSocket.emit('opponentLeft', `🏆 Vous avez gagné ! ${socket.username} a quitté la partie.`);
              updateScore(opponentSocket.username, 'duel');
              delete opponentSocket.game;
            }
            delete socket.game;
          }
    
          // Retirer le joueur de la file d'attente s'il y est
          waitingPlayers = waitingPlayers.filter(player => player.id !== socket.id);
    
          // Mise à jour des utilisateurs en ligne
          delete onlineUsers[socket.username];
          io.emit('updateOnlineUsers', Object.keys(onlineUsers));
        });
    
        // Gestion de la déconnexion volontaire
        socket.on('leaveGame', () => {
          if (socket.game && socket.game.mode === 'duel') {
            const opponentSocket = io.sockets.sockets.get(socket.game.opponentId);
            if (opponentSocket) {
              opponentSocket.emit('opponentLeft', `🏆 Vous avez gagné ! ${socket.username} a quitté la partie.`);
              updateScore(opponentSocket.username, 'duel');
              delete opponentSocket.game;
            }
            delete socket.game;
          }
    
          // Retirer le joueur de la file d'attente s'il y est
          waitingPlayers = waitingPlayers.filter(player => player.id !== socket.id);
        });
    
        // Fonction pour démarrer un duel
        function startDuel(player1, player2) {
          const gameId = `game-${player1.id}-${player2.id}`;
          player1.join(gameId);
          player2.join(gameId);
    
          const secretCode1 = generateSecretCode();
          const secretCode2 = generateSecretCode();
    
          player1.game = {
            mode: 'duel',
            secretCode: secretCode2, // Deviner le code de l'adversaire
            attempts: 0,
            opponentId: player2.id,
            gameId: gameId
          };
    
          player2.game = {
            mode: 'duel',
            secretCode: secretCode1,
            attempts: 0,
            opponentId: player1.id,
            gameId: gameId
          };
    
          player1.emit('feedback', `🎮 Duel commencé contre ${player2.username}. Bonne chance !`);
          player2.emit('feedback', `🎮 Duel commencé contre ${player1.username}. Bonne chance !`);
    
          // Activer le chat
          io.to(gameId).emit('enableChat');
        }
    
        // Fonctions auxiliaires
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
          return `${wellPlaced} chiffres corrects et bien placés, ${correctDigits} chiffres corrects mais mal placés`;
        }
    
        function updateScore(username, result) {
          const user = users.find(u => u.username === username);
          if (user) {
            if (result === 'solo') {
              user.score += 5;
            } else if (result === 'duel') {
              user.score += 10;
            }
            fs.writeFileSync('users.json', JSON.stringify(users));
            io.emit('updateLeaderboard', getLeaderboard());
          }
        }

  
        function getLeaderboard() {
          return users.sort((a, b) => b.score - a.score).slice(0, 10);
        }
      });
