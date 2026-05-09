const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/database');
const transporter = require('../config/mailer');

// --- РЕГИСТРАЦИЯ ---
exports.register = async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Сохраняем юзера (по умолчанию is_verified = FALSE)
        await db.query(
            'INSERT INTO users (username, email, password, verification_code) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, verificationCode]
        );

        // Отправляем код на почту
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Aeterna: Kintsugi - Verification Code',
            text: `Welcome to the Kiri! Your verification code is: ${verificationCode}`
        };

        await transporter.sendMail(mailOptions);

        res.status(201).json({ message: 'Registration successful! Please check your email for the verification code.' });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        res.status(500).json({ error: 'Server error during registration' });
    }
};

// --- ПОДТВЕРЖДЕНИЕ ПОЧТЫ ---
exports.verifyEmail = async (req, res) => {
    const { email, code } = req.body;

    try {
        const [users] = await db.query(
            'SELECT id FROM users WHERE email = ? AND verification_code = ?',
            [email, code]
        );

        if (users.length === 0) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        const userId = users[0].id;

        // Помечаем как подтвержденного
        await db.query(
            'UPDATE users SET is_verified = TRUE, verification_code = NULL WHERE id = ?',
            [userId]
        );

        // ВЫДАЕМ СТАРТОВЫЕ КАРТЫ (is_basic = TRUE из твоего init.sql)
        const [basicCards] = await db.query('SELECT id FROM cards WHERE is_basic = TRUE');
        if (basicCards.length > 0) {
            const inventoryData = basicCards.map(card => [userId, card.id]);
            await db.query('INSERT IGNORE INTO user_cards (user_id, card_id) VALUES ?', [inventoryData]);
        }

        res.json({ message: 'Email verified! Your starter deck is ready.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Verification failed' });
    }
};

// --- ЛОГИН ---
exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Проверяем, подтвердил ли он почту
        if (!user.is_verified) {
            return res.status(403).json({ error: 'Please verify your email first' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Обновляем статус на online (запятая на месте!)
        await db.query('UPDATE users SET status = "online" WHERE id = ?', [user.id]);

        req.session.userId = user.id;
        req.session.username = user.username;

        res.json({
            message: 'Login successful! Welcome to Kiri!',
            user: {
                id: user.id,
                username: user.username,
                avatar: user.avatar_url,
                mmr: user.match_making_rating
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login error' });
    }
};

exports.checkAuth = (req, res) => {
    if (req.session.userId) {
        res.json({ 
            isLoggedIn: true, 
            user: { id: req.session.userId, username: req.session.username } 
        });
    } else {
        res.json({ isLoggedIn: false });
    }
};

// --- ЗАБЫЛИ ПАРОЛЬ ---
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const token = crypto.randomBytes(20).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 час

        const [result] = await db.query(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?',
            [token, expires, email]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset',
            text: `Your password reset token is: ${token}`
        });

        res.json({ message: 'Reset token sent to email' });
    } catch (error) {
        res.status(500).json({ error: 'Error sending reset email' });
    }
};

// --- СБРОС ПАРОЛЯ ---
exports.resetPassword = async (req, res) => {
    const { email, token, newPassword } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const [result] = await db.query(
            'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE email = ? AND reset_token = ? AND reset_token_expires > NOW()',
            [hashedPassword, email, token]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        res.json({ message: 'Password reset successful!' });
    } catch (error) {
        res.status(500).json({ error: 'Error resetting password' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка при выходе' });
        }
        res.clearCookie('connect.sid');
        return res.json({ message: 'Exit successful!' });
    });
};
exports.checkAuth = async (req, res) => {
    if (req.session.userId) {
        try {
            // Достаем свежие данные из базы, включая аватар и MMR
            const [users] = await db.query(
                'SELECT username, avatar_url, match_making_rating FROM users WHERE id = ?', 
                [req.session.userId]
            );
            
            if (users.length > 0) {
                const user = users[0];
                res.json({ 
                    isLoggedIn: true, 
                    user: { 
                        id: req.session.userId, 
                        username: user.username,
                        avatar: user.avatar_url, // Теперь аватар передается!
                        mmr: user.match_making_rating
                    } 
                });
            } else {
                res.json({ isLoggedIn: false });
            }
        } catch (e) {
            console.error(e);
            res.status(500).json({ isLoggedIn: false });
        }
    } else {
        res.json({ isLoggedIn: false });
    }
};