const express = require('express');
const path = require('path');
const http = require('http');
const app = express();
const session = require('express-session');
const { Server } = require('socket.io');


app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use(session({
    secret: 'kiri_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 10000,
        secure: false
    }
}));


const autoInitDatabase = require('./config/initDb');
const authController = require('./controllers/authController');
const friendController = require('./controllers/friendController');
const gameController = require('./controllers/gameController')
const { setupSocket } = require('./game/socketGame');

//login register routes
app.post('/api/register', authController.register);
app.post('/api/verify', authController.verifyEmail);
app.post('/api/login', authController.login);
app.post('/api/update-avatar', authController.updateAvatar);
app.post('/api/forgot-password', authController.forgotPassword);
app.post('/api/reset-password', authController.resetPassword);
app.post('/api/logout', authController.logout);
//friend routes
app.post('/api/friends/add', friendController.addFriend);
app.get('/api/friends', friendController.getFriends);
app.get('/api/friends/pending', friendController.getPendingRequests);
app.post('/api/friends/accept', friendController.acceptFriend);
app.post('/api/friends/handle', friendController.handleRequest);
app.post('/api/friends/remove', friendController.removeFriend);
//decks and cards
app.get('/api/cards', gameController.getAllCards);
app.get('/api/cards/collection', gameController.getCardCollection);
app.post('/api/decks/save', gameController.saveDeck);
app.get('/api/decks/mine', gameController.getMyDeck);
app.get('/api/matches/history', gameController.getMatchHistory);
app.get('/api/leaderboard', gameController.getLeaderboard);
app.post('/api/gacha/open', gameController.openGacha);


// stay logged in
app.get('/api/me', authController.checkAuth);

// start server
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server);

setupSocket(io);

autoInitDatabase().then(() => {
    server.listen(PORT, () => {
        console.log(`🚀 Сервер игры запущен на http://localhost:${PORT}`);
    });
});