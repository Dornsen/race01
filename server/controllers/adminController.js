const db = require('../config/database');
const fs = require('fs');
const path = require('path');

const adminController = {
    checkAdmin: async (req, res, next) => {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized. Please log in.' });
        }
        try {
            const [rows] = await db.query('SELECT role FROM users WHERE id = ?', [req.session.userId]);
            const user = rows[0];
            
            if (user && user.role === 'admin') {
                next();
            } else {
                res.status(403).json({ error: 'Access denied. Admins only.' });
            }
        } catch (err) {
            res.status(500).json({ error: 'Server authorization error' });
        }
    },

    getAllCards: async (req, res) => {
        try {
            const [cards] = await db.query('SELECT * FROM cards ORDER BY id DESC');
            res.json(cards);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    saveCard: async (req, res) => {
        const { id, name, description, avatar_url, attack, cost, defense, rarity, is_basic, clan, ability_code, ability_description } = req.body;
        const isBasicValue = is_basic ? 1 : 0;
        
        try {
            let cardId = id;

            if (id) {
                await db.query(`
                    UPDATE cards 
                    SET name = ?, description = ?, avatar_url = ?, attack = ?, cost = ?, defense = ?, rarity = ?, is_basic = ?, clan = ?, ability_code = ?, ability_description = ? 
                    WHERE id = ?`,
                    [name, description, avatar_url, attack, cost, defense, rarity, isBasicValue, clan, ability_code, ability_description, id]
                );
            } else {
                const [result] = await db.query(`
                    INSERT INTO cards (name, description, avatar_url, attack, cost, defense, rarity, is_basic, clan, ability_code, ability_description) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [name, description, avatar_url, attack, cost, defense, rarity, isBasicValue, clan, ability_code, ability_description]
                );
                cardId = result.insertId;
            }

            if (isBasicValue === 1) {
                await db.query(`
                    INSERT IGNORE INTO user_cards (user_id, card_id)
                    SELECT id, ? FROM users
                `, [cardId]);
                
                console.log(`🎁 Auto Distribution: Basic card "${name}" (ID: ${cardId}) successfully distributed to all players!`);
            }

            return res.json({ 
                success: true, 
                message: isBasicValue === 1 
                    ? 'Card saved and distributed to ALL players successfully!' 
                    : 'Card saved successfully!' 
            });

        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    deleteCard: async (req, res) => {
        const { id } = req.params;
        try {
            await db.query('DELETE FROM cards WHERE id = ?', [id]);
            res.json({ success: true, message: 'Card vaporized from existence.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getAllFrames: async (req, res) => {
        try {
            const [frames] = await db.query('SELECT * FROM shop_frames ORDER BY id DESC');
            res.json(frames);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    saveFrame: async (req, res) => {
        const { id, name, price, image_url, isNewFrame } = req.body;
        try {
            if (!isNewFrame) {
                await db.query(
                    'UPDATE shop_frames SET name = ?, price = ?, image_url = ? WHERE id = ?',
                    [name, price, image_url, id]
                );
                res.json({ success: true, message: 'Frame modified successfully.' });
            } else {
                await db.query(
                    'INSERT INTO shop_frames (id, name, price, image_url) VALUES (?, ?, ?, ?)',
                    [id, name, price, image_url]
                );
                res.json({ success: true, message: 'Brand new frame added to shop!' });
            }
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    deleteFrame: async (req, res) => {
        const { id } = req.params;
        try {
            await db.query('DELETE FROM shop_frames WHERE id = ?', [id]);
            res.json({ success: true, message: 'Frame deleted from the shop.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
,

    // --- Emotes management for admin panel ---
    getAllEmotes: async (req, res) => {
        try {
            const [rows] = await db.query(`
                SELECT e.id, e.name, e.file_name, e.is_basic, se.price
                FROM emotes e
                LEFT JOIN shop_emotes se ON se.emote_id = e.id
                ORDER BY e.id DESC
            `);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    saveEmote: async (req, res) => {
        const { id, name, file_name, price, is_basic } = req.body;
        const isBasicValue = is_basic ? 1 : 0;
        try {
            if (id) {
                await db.query('UPDATE emotes SET name = ?, file_name = ?, is_basic = ? WHERE id = ?', [name, file_name, isBasicValue, id]);
                if (price !== undefined) {
                    await db.query('INSERT INTO shop_emotes (emote_id, price) VALUES (?, ?) ON DUPLICATE KEY UPDATE price = VALUES(price)', [id, price]);
                }
                if (isBasicValue === 1) {
                    await db.query('INSERT IGNORE INTO user_emotes (user_id, emote_id) SELECT id, ? FROM users', [id]);
                }
                return res.json({ success: true, message: 'Emote updated.' });
            } else {
                const [result] = await db.query(`
                    INSERT INTO emotes (name, file_name, is_basic)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        id = LAST_INSERT_ID(id),
                        name = VALUES(name),
                        is_basic = VALUES(is_basic)
                `, [name, file_name, isBasicValue]);
                const newId = result.insertId;
                if (price !== undefined) {
                    await db.query('INSERT INTO shop_emotes (emote_id, price) VALUES (?, ?)', [newId, price]);
                }
                if (isBasicValue === 1) {
                    await db.query('INSERT IGNORE INTO user_emotes (user_id, emote_id) SELECT id, ? FROM users', [newId]);
                }
                return res.json({ success: true, message: 'Emote created.', id: newId });
            }
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    deleteEmote: async (req, res) => {
        const { id } = req.params;
        try {
            await db.query('DELETE FROM emotes WHERE id = ?', [id]);
            await db.query('DELETE FROM user_emotes WHERE emote_id = ?', [id]);
            await db.query('DELETE FROM shop_emotes WHERE emote_id = ?', [id]);
            await db.query('DELETE FROM user_emote_decks WHERE emote_id = ?', [id]);
            res.json({ success: true, message: 'Emote and related references removed.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    ,

    uploadEmote: async (req, res) => {
        // multer places file on req.file
        try {
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
            const fileName = req.file.filename || req.file.originalname;
            const name = req.body.name || fileName;
            const price = req.body.price;

            const isBasic = req.body && req.body.is_basic ? 1 : 0;
            const [result] = await db.query(`
                INSERT INTO emotes (name, file_name, is_basic)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    id = LAST_INSERT_ID(id),
                    name = VALUES(name),
                    is_basic = VALUES(is_basic)
            `, [name, fileName, isBasic]);
            const newId = result.insertId;
            if (price !== undefined && price !== '') {
                await db.query('INSERT INTO shop_emotes (emote_id, price) VALUES (?, ?)', [newId, price]);
            }
            res.json({ success: true, message: 'Emote uploaded', id: newId });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    grantEmoteToAll: async (req, res) => {
        const { id } = req.params;
        try {
            await db.query('INSERT IGNORE INTO user_emotes (user_id, emote_id) SELECT id, ? FROM users', [id]);
            res.json({ success: true, message: 'Emote granted to all users.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    ,

    uploadEmoteBase64: async (req, res) => {
        try {
            const { data, file_name, name, price } = req.body;
            if (!data) return res.status(400).json({ error: 'Missing file data' });

            const emoteDir = path.resolve(__dirname, '..', '..', 'client', 'assets', 'emotes');
            if (!fs.existsSync(emoteDir)) fs.mkdirSync(emoteDir, { recursive: true });

            const rawName = file_name || (`emote-${Date.now()}.png`);
            const safeName = rawName.replace(/[^a-zA-Z0-9\.\-_]/g, '_');
            const filePath = path.join(emoteDir, safeName);

            const base64 = data.replace(/^data:.*;base64,/, '');
            const buffer = Buffer.from(base64, 'base64');
            fs.writeFileSync(filePath, buffer);

            const isBasic2 = req.body && (req.body.is_basic === 1 || req.body.is_basic === true) ? 1 : 0;
            const [result] = await db.query(`
                INSERT INTO emotes (name, file_name, is_basic)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    id = LAST_INSERT_ID(id),
                    name = VALUES(name),
                    is_basic = VALUES(is_basic)
            `, [name || safeName, safeName, isBasic2]);
            const newId = result.insertId;
            if (price !== undefined && price !== '') {
                await db.query('INSERT INTO shop_emotes (emote_id, price) VALUES (?, ?)', [newId, price]);
            }
            res.json({ success: true, message: 'Emote uploaded (base64)', id: newId });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = adminController;