const express = require('express');
const path = require('path');
const app = express();
const session = require('express-session');

// Учим сервер понимать JSON от клиента
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


app.post('/api/register', authController.register);
app.post('/api/verify', authController.verifyEmail);
app.post('/api/login', authController.login);
app.post('/api/forgot-password', authController.forgotPassword);
app.post('/api/reset-password', authController.resetPassword);

app.get('/api/me', authController.checkAuth);

// Запуск сервера
const PORT = process.env.PORT || 3000;
autoInitDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Сервер игры запущен на http://localhost:${PORT}`);
    });
});