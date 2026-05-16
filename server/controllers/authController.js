const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/database');
const transporter = require('../config/mailer');
const questController = require('./questController');

exports.register = async (req, res) => {
    const { username, email, password, avatar_url } = req.body; 

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        const finalAvatar = avatar_url || 'avatar1.png';

        const [result] = await db.query(
            'INSERT INTO users (username, email, password, verification_code, avatar_url) VALUES (?, ?, ?, ?, ?)',
            [username, email, hashedPassword, verificationCode, finalAvatar]
        );

        if (result && result.insertId) {
            await questController.ensureUserQuests(result.insertId);
        }

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

        await db.query(
            'UPDATE users SET is_verified = TRUE, verification_code = NULL WHERE id = ?',
            [userId]
        );

        // Grant basic cards for the starter deck upon successful verification
        const [basicCards] = await db.query('SELECT id FROM cards WHERE is_basic = TRUE');
        if (basicCards.length > 0) {
            const inventoryData = basicCards.map(card => [userId, card.id]);
            await db.query('INSERT IGNORE INTO user_cards (user_id, card_id) VALUES ?', [inventoryData]);
        }

        await questController.ensureUserQuests(userId);

        res.json({ message: 'Email verified! Your starter deck is ready.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Verification failed' });
    }
};

exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const [users] = await db.query(`
            SELECT u.*, sf.image_url AS frame_url 
            FROM users u
            LEFT JOIN shop_frames sf ON u.equipped_frame = sf.id
            WHERE u.username = ?
        `, [username]);
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        if (!user.is_verified) {
            return res.status(403).json({ error: 'Please verify your email first' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        await db.query('UPDATE users SET status = "online" WHERE id = ?', [user.id]);

        req.session.userId = user.id;
        req.session.username = user.username;

        await questController.ensureUserQuests(user.id);

        res.json({
            message: 'Login successful! Welcome to Kiri!',
            user: {
                id: user.id,
                username: user.username,
                avatar: user.avatar_url,
                frame_url: user.frame_url,
                mmr: user.match_making_rating,
                money: user.money
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login error' });
    }
};

exports.checkAuth = async (req, res) => {
    if (req.session.userId) {
        try {
            const [users] = await db.query(`
                SELECT u.username, u.avatar_url, u.match_making_rating, u.status, u.money, sf.image_url AS frame_url 
                FROM users u
                LEFT JOIN shop_frames sf ON u.equipped_frame = sf.id
                WHERE u.id = ?
            `, [req.session.userId]);
            
            if (users.length > 0) {
                const user = users[0];
                
                if (user.status === 'offline') {
                    db.query('UPDATE users SET status = "online" WHERE id = ?', [req.session.userId]);
                }
                
                res.json({ 
                    isLoggedIn: true, 
                    user: { 
                        id: req.session.userId, 
                        username: user.username,
                        avatar: user.avatar_url, 
                        frame_url: user.frame_url,
                        mmr: user.match_making_rating,
                        money: user.money
                    } 
                });
            } else {
                res.json({ isLoggedIn: false });
            }
        } catch (error) {
            res.status(500).json({ error: 'Auth check error' });
        }
    } else {
        res.json({ isLoggedIn: false });
    }
};

exports.updateAvatar = async (req, res) => {
    const { avatar_url } = req.body;
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatar_url, userId]);
        res.json({ message: 'Avatar updated successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error updating avatar' });
    }
};

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const token = crypto.randomBytes(20).toString('hex');
        const expires = new Date(Date.now() + 3600000);

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
    const userId = req.session.userId;
    
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout error' });
        }
        
        res.clearCookie('connect.sid');
        
        if (userId) {
            db.query('UPDATE users SET status = "offline" WHERE id = ?', [userId]);
        }
        
        return res.json({ message: 'Exit successful!' });
    });
};