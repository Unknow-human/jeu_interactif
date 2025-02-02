// index.js
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configuration du moteur de vue EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware pour les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'secretcode',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Stockage simple en mémoire des utilisateurs (à remplacer par une BDD en production)
let users = [];

// Configuration de Passport pour la stratégie locale
passport.use(new LocalStrategy(function(username, password, done) {
    let user = users.find(u => u.username === username);
    if (!user) {
        return done(null, false, { message: 'Utilisateur non trouvé' });
    }
    if (user.password !== password) {
        return done(null, false, { message: 'Mot de passe incorrect' });
    }
    return done(null, user);
}));

passport.serializeUser(function(user, done) {
  done(null, user.username);
});

passport.deserializeUser(function(username, done) {
  let user = users.find(u => u.username === username);
  if (user) {
      done(null, user);
  } else {
      done(null, false);
  }
});

// Routes

// Page d'accueil
app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

// Page de connexion
app.get('/login', (req, res) => {
  // On peut transmettre un message d'erreur si besoin
  res.render('login', { message: req.query.error ? "Nom d'utilisateur ou mot de passe incorrect" : "" });
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login?error=true'
}));

// Page d'inscription
app.get('/register', (req, res) => {
  res.render('register', { message: '' });
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if(users.find(u => u.username === username)){
    res.render('register', { message: 'Nom d\'utilisateur déjà utilisé' });
  } else {
    users.push({ username, password });
    res.redirect('/login');
  }
});

// Tableau de bord (accessible uniquement si authentifié)
app.get('/dashboard', ensureAuthenticated, (req, res) => {
  // Liste des autres utilisateurs pour pouvoir les défier
  let otherUsers = users.filter(u => u.username !== req.user.username);
  res.render('dashboard', { user: req.user, users: otherUsers });
});

// Déconnexion
app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// Page de duel : l'URL inclut le nom de l'adversaire
app.get('/duel/:opponent', ensureAuthenticated, (req, res) => {
  let opponent = req.params.opponent;
  // On crée une room unique basée sur les deux noms (triés alphabétiquement)
  let room = [req.user.username, opponent].sort().join('_');
  res.render('duel', { user: req.user, opponent, room });
});

// Socket.io : gestion en temps réel des duels
// Stocke l'état de chaque duel par room
const duels = {};

io.on('connection', (socket) => {
  console.log('Un utilisateur s\'est connecté');

  socket.on('joinRoom', ({ room, username }) => {
    socket.join(room);
    socket.username = username;
    socket.room = room;
    // Initialisation de la partie si non existante
    if (!duels[room]) {
      // Génération d'un code secret aléatoire à 4 chiffres (avec potentiellement des zéros devant)
      let code = ('0000' + Math.floor(Math.random() * 10000)).slice(-4);
      duels[room] = {
        code,
        attempts: {}
      };
      console.log(`Duel dans la room ${room} – Code secret : ${code}`);
    }
    io.to(room).emit('message', { msg: `${username} a rejoint le duel.` });
  });

  socket.on('guess', ({ guess, username }) => {
    const room = socket.room;
    if(!room || !duels[room]) return;
    let game = duels[room];
    // Validation de la proposition : 4 chiffres uniquement
    if (!/^\d{4}$/.test(guess)) {
      socket.emit('message', { msg: 'Veuillez entrer un code de 4 chiffres.' });
      return;
    }
    // Calcul du nombre de chiffres corrects et bien placés
    let code = game.code;
    let correctDigits = 0;
    let correctPositions = 0;
    let codeDigitsCount = {};
    let guessDigitsCount = {};

    // Comptage des chiffres du code
    for (let i = 0; i < 4; i++) {
      let digit = code[i];
      codeDigitsCount[digit] = (codeDigitsCount[digit] || 0) + 1;
    }
    // Comptage des chiffres de la proposition
    for (let i = 0; i < 4; i++) {
      let digit = guess[i];
      guessDigitsCount[digit] = (guessDigitsCount[digit] || 0) + 1;
    }
    // Comparaison sur chaque chiffre présent dans la proposition
    for (let digit in guessDigitsCount) {
      if(codeDigitsCount[digit]){
        correctDigits += Math.min(guessDigitsCount[digit], codeDigitsCount[digit]);
      }
    }
    // Comptage des positions correctes
    for (let i = 0; i < 4; i++) {
      if(code[i] === guess[i]) correctPositions++;
    }

    // Condition de victoire
    if(guess === code){
      io.to(room).emit('message', { msg: `${username} a trouvé le code exact ${code} et gagne le duel !` });
      // On peut ensuite réinitialiser la partie (ou fermer la room)
      delete duels[room];
    } else {
      io.to(room).emit('message', { msg: `${username} a proposé ${guess} : ${correctDigits} chiffres corrects, dont ${correctPositions} à la bonne place.` });
    }
  });

  socket.on('disconnect', () => {
    console.log('Un utilisateur s\'est déconnecté');
  });
});

// Middleware de protection des pages
function ensureAuthenticated(req, res, next) {
  if(req.isAuthenticated()){
    return next();
  }
  res.redirect('/login');
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
