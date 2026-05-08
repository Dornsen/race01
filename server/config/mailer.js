const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Твоя почта в .env
        pass: process.env.EMAIL_PASS  // Пароль приложения в .env
    }
});

module.exports = transporter;