const db = require('../config/database');

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
        try {
            if (id) {
                await db.query(`
                    UPDATE cards 
                    SET name = ?, description = ?, avatar_url = ?, attack = ?, cost = ?, defense = ?, rarity = ?, is_basic = ?, clan = ?, ability_code = ?, ability_description = ? 
                    WHERE id = ?`,
                    [name, description, avatar_url, attack, cost, defense, rarity, is_basic ? 1 : 0, clan, ability_code, ability_description, id]
                );
                return res.json({ success: true, message: 'Card updated and balanced!' });
            } else {
                await db.query(`
                    INSERT INTO cards (name, description, avatar_url, attack, cost, defense, rarity, is_basic, clan, ability_code, ability_description) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [name, description, avatar_url, attack, cost, defense, rarity, is_basic ? 1 : 0, clan, ability_code, ability_description]
                );
                return res.json({ success: true, message: 'New card created successfully!' });
            }
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
};

module.exports = adminController;