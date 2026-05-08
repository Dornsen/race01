const express = require('express');
const path = require('path');
const app = express();

// Учим сервер понимать JSON от клиента
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));


const autoInitDatabase = require('./config/initDb');
const authController = require('./controllers/authController');


app.post('/api/register', authController.register);
app.post('/api/verify', authController.verifyEmail);
app.post('/api/login', authController.login);
app.post('/api/forgot-password', authController.forgotPassword);
app.post('/api/reset-password', authController.resetPassword);

// Запуск сервера
const PORT = process.env.PORT || 3000;
autoInitDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Сервер игры запущен на http://localhost:${PORT}`);
    });
});