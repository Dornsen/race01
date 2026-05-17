const express = require('express');
const path = require('path');
const http = require('http');
const session = require('express-session');
const { Server } = require('socket.io');

const app = express();

app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss: http: https:; font-src 'self' data:;"
    );
    next();
});

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
const migrateDatabase = require('./config/bdMigrator');
const authController = require('./controllers/authController');
const friendController = require('./controllers/friendController');
const gameController = require('./controllers/gameController');
const shopController = require('./controllers/shopController');
const { setupSocket } = require('./game/socketGame');
const questController = require('./controllers/questController');
const adminController = require('./controllers/adminController');


// --- Authentication Routes ---
app.post('/api/register', authController.register);
app.post('/api/verify', authController.verifyEmail);
app.post('/api/login', authController.login);
app.post('/api/logout', authController.logout);
app.post('/api/update-avatar', authController.updateAvatar);
app.get('/api/avatars', authController.getAvatars);
app.post('/api/update-password', authController.updatePassword);
app.post('/api/update-music-settings', authController.updateMusicSettings);
app.delete('/api/delete-account', authController.deleteAccount);
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
app.get('/api/shop/emotes', shopController.getEmoteShop);
app.post('/api/shop/emotes', shopController.buyEmote);

// --- Quest Routes ---
app.get('/api/quests', questController.getQuests);
app.post('/api/quests/claim', questController.claimReward);

// --- ADMIN API ROUTES (ПОЛНОСТЬЮ ЗАЩИЩЕНЫ CHECKADMIN) ---
app.get('/api/admin/cards', adminController.checkAdmin, adminController.getAllCards);
app.post('/api/admin/cards', adminController.checkAdmin, adminController.saveCard);
app.delete('/api/admin/cards/:id', adminController.checkAdmin, adminController.deleteCard);

app.get('/api/admin/frames', adminController.checkAdmin, adminController.getAllFrames);
app.post('/api/admin/frames', adminController.checkAdmin, adminController.saveFrame);
app.delete('/api/admin/frames/:id', adminController.checkAdmin, adminController.deleteFrame);

// --- Emotes ---
app.get('/api/emotes', authController.requireAuth, gameController.getUserEmotes);
app.get('/api/emotes/all', gameController.getAllEmotes);
app.get('/api/emotes/deck', authController.requireAuth, gameController.getUserEmoteDeck);
app.post('/api/emotes/deck', authController.requireAuth, gameController.saveUserEmoteDeck);

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server);

setupSocket(io);

autoInitDatabase().then(async () => {
    await migrateDatabase(); 

    server.listen(PORT, () => { 
        console.log(`🚀 Server is running on port http://localhost:${PORT}`); 
    }); 
}).catch(err => {
    console.error("❌ Critical server startup error:", err.message);
});