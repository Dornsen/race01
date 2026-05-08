// Подключаем наши установленные библиотеки
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);

// Настройка порта (по умолчанию 3000)
const PORT = 3000;

// Говорим серверу, что когда кто-то заходит на главную страницу,
// нужно отправить простое сообщение (позже мы заменим это на отправку твоего HTML-файла)
app.get('/', (req, res) => {
    res.send('<h1>Сервер Marvel Nexus Clash запущен и готов к бою!</h1>');
});

// Слушаем подключения по WebSockets (когда игрок заходит в игру)
io.on('connection', (socket) => {
    console.log(`Новый игрок подключился! Его ID: ${socket.id}`);

    // Если игрок закрыл вкладку
    socket.on('disconnect', () => {
        console.log(`Игрок ${socket.id} покинул игру.`);
    });
});

// Запускаем сервер
http.listen(PORT, () => {
    console.log(`🚀 Сервер летит на порту http://localhost:${PORT}`);
});