const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const transporter = require('../config/mailer');
const questController = require('./questController');

const STARTER_EMOTE_FILES = [
    'emote_angry.png',
    'emote_shy.png',
    'emote_tilted.png',
    'emote_confused.png'
];

async function grantStarterEmotes(userId) {
    if (!userId) return;

    const placeholders = STARTER_EMOTE_FILES.map(() => '?').join(', ');
    const [rows] = await db.query(
        `SELECT id FROM emotes WHERE file_name IN (${placeholders}) OR is_basic = TRUE`,
        STARTER_EMOTE_FILES
    );

    if (!rows || rows.length === 0) return;

    const values = rows.map((row) => [userId, row.id]);
    await db.query('INSERT IGNORE INTO user_emotes (user_id, emote_id) VALUES ?', [values]);
}

function mapUserPayload(user) {
    return {
        id: user.id,
        username: user.username,
        avatar: user.avatar_url,
        frame_url: user.frame_url,
        mmr: user.match_making_rating,
        money: user.money,
        music_enabled: Boolean(user.music_enabled),
        music_volume: Number(user.music_volume ?? 0.5)
    };
}

exports.requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

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
            await grantStarterEmotes(result.insertId);
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

        // Grant basic emotes to verified user
        const [basicEmotes] = await db.query('SELECT id FROM emotes WHERE is_basic = TRUE');
        if (basicEmotes.length > 0) {
            const emoteData = basicEmotes.map(e => [userId, e.id]);
            await db.query('INSERT IGNORE INTO user_emotes (user_id, emote_id) VALUES ?', [emoteData]);
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
            user: mapUserPayload(user)
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
                SELECT u.username, u.avatar_url, u.match_making_rating, u.status, u.money, u.music_enabled, u.music_volume, sf.image_url AS frame_url 
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
                    user: mapUserPayload({
                        id: req.session.userId,
                        username: user.username,
                        avatar_url: user.avatar_url,
                        frame_url: user.frame_url,
                        match_making_rating: user.match_making_rating,
                        money: user.money,
                        music_enabled: user.music_enabled,
                        music_volume: user.music_volume
                    }) 
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
    const { avatar_url, avatar } = req.body;
    const userId = req.session.userId;
    const selectedAvatar = avatar_url || avatar;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!selectedAvatar) {
        return res.status(400).json({ error: 'Avatar is required' });
    }

    try {
        await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [selectedAvatar, userId]);
        res.json({ message: 'Avatar updated successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error updating avatar' });
    }
};

exports.getAvatars = async (req, res) => {
    try {
        const avatarsDir = path.join(__dirname, '../../client/assets/avatars');
        const avatars = await fs.promises.readdir(avatarsDir);
        const filtered = avatars.filter(file => /\.(png|jpe?g|webp|gif)$/i.test(file)).sort();
        res.json({ avatars: filtered });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error loading avatars' });
    }
};

exports.updatePassword = async (req, res) => {
    const userId = req.session.userId;
    const oldPassword = req.body.oldPassword || req.body.currentPassword || req.body.old_password;
    const newPassword = req.body.newPassword || req.body.password || req.body.new_password;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Old and new passwords are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    try {
        const [users] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isMatch = await bcrypt.compare(oldPassword, users[0].password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

        res.json({ message: 'Password updated successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error updating password' });
    }
};

exports.deleteAccount = async (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await db.query('UPDATE users SET status = "offline" WHERE id = ?', [userId]);
        await db.query('DELETE FROM users WHERE id = ?', [userId]);

        req.session.destroy(() => {});
        res.clearCookie('connect.sid');
        res.json({ message: 'Account deleted successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error deleting account' });
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

exports.updateMusicSettings = async (req, res) => {
    const userId = req.session.userId;
    const { musicEnabled, musicVolume } = req.body;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const enabledValue = Boolean(musicEnabled);
    const volumeNumber = Number(musicVolume);

    if (Number.isNaN(volumeNumber) || volumeNumber < 0 || volumeNumber > 1) {
        return res.status(400).json({ error: 'Music volume must be between 0 and 1' });
    }

    try {
        await db.query(
            'UPDATE users SET music_enabled = ?, music_volume = ? WHERE id = ?',
            [enabledValue, volumeNumber, userId]
        );

        res.json({
            message: 'Music settings saved',
            user: {
                music_enabled: enabledValue,
                music_volume: volumeNumber
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error saving music settings' });
    }
};