const express = require('express');
const path = require('path');
const http = require('http');
const session = require('express-session');
const { Server } = require('socket.io');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

app.use(session({
    secret: 'kiri_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 10 * 24 * 60 * 60 * 1000,
        secure: false
    }
}));

const autoInitDatabase = require('./config/initDb');
const authController = require('./controllers/authController');
const friendController = require('./controllers/friendController');
const gameController = require('./controllers/gameController');
const shopController = require('./controllers/shopController');
const { setupSocket } = require('./game/socketGame');
const questController = require('./controllers/questController');


// --- Authentication Routes ---
app.post('/api/register', authController.register);
app.post('/api/verify', authController.verifyEmail);
app.post('/api/login', authController.login);
app.post('/api/logout', authController.logout);
app.post('/api/update-avatar', authController.updateAvatar);
app.post('/api/forgot-password', authController.forgotPassword);
app.post('/api/reset-password', authController.resetPassword);

// --- Session Check ---
app.get('/api/me', authController.checkAuth);

// --- Friend System Routes ---
app.post('/api/friends/add', friendController.addFriend);
app.get('/api/friends', friendController.getFriends);
app.get('/api/friends/pending', friendController.getPendingRequests);
app.post('/api/friends/accept', friendController.acceptFriend);
app.post('/api/friends/handle', friendController.handleRequest);
app.post('/api/friends/remove', friendController.removeFriend);

// --- Game & Deck Routes ---
app.get('/api/cards', gameController.getAllCards);
app.get('/api/cards/collection', gameController.getCardCollection);
app.post('/api/decks/save', gameController.saveDeck);
app.get('/api/decks/mine', gameController.getMyDeck);

// --- Progression & Shop Routes ---
app.get('/api/matches/history', gameController.getMatchHistory);
app.get('/api/leaderboard', gameController.getLeaderboard);
app.post('/api/gacha/open', gameController.openGacha);
app.get('/api/shop/frames', shopController.getFrameShop);
app.post('/api/shop/frames', shopController.buyOrEquipFrame);

// --- Quest Routes ---
app.get('/api/quests', questController.getQuests);
app.post('/api/quests/claim', questController.claimReward);

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server);

setupSocket(io);

autoInitDatabase().then(() => {
    server.listen(PORT, () => {
        console.log(`🚀 Game server is running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('❌ Failed to initialize database:', err);
});