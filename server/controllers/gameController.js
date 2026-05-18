const db = require('../config/database');
const GAME_CONFIG = require('../config/gameConfig');
const questController = require('./questController');

exports.getAllCards = async (req, res) => {
    try {
        const [cards] = await db.query('SELECT * FROM cards');
        res.json({ cards });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error loading card database' });
    }
};

// ==============================
// GET PLAYER COLLECTION
// ==============================
exports.getCardCollection = async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const [cards] = await db.query(`
            SELECT c.*, CASE WHEN uc.card_id IS NULL THEN 0 ELSE 1 END AS owned
            FROM cards c
            LEFT JOIN user_cards uc ON uc.card_id = c.id AND uc.user_id = ?
            ORDER BY c.cost ASC, c.id ASC
        `, [userId]);

        res.json({ cards });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error loading collection' });
    }
};

exports.saveDeck = async (req, res) => {
    const userId = req.session.userId;
    const { cardIds } = req.body; 

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!cardIds || cardIds.length !== 10) {
        return res.status(400).json({ error: 'Deck must contain exactly 10 cards!' });
    }

    try {
        const uniqueCards = new Set(cardIds);
        if (uniqueCards.size !== 10) {
            return res.status(400).json({ error: 'Deck cannot contain duplicate cards!' });
        }

        await db.query('DELETE FROM active_decks WHERE user_id = ?', [userId]);

        const values = cardIds.map(id => [userId, id]);
        await db.query('INSERT INTO active_decks (user_id, card_id) VALUES ?', [values]);

        res.json({ message: '10-card deck saved successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error saving deck' });
    }
};

exports.getMyDeck = async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const [deck] = await db.query(`
            SELECT c.* FROM active_decks ad
            JOIN cards c ON ad.card_id = c.id
            WHERE ad.user_id = ?
        `, [userId]);
        
        res.json({ deck });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error loading active deck' });
    }
};

exports.getMatchHistory = async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const [rows] = await db.query(`
            SELECT 
                mh.id,
                mh.mode,
                mh.reason,
                mh.created_at,
                u.username AS opponent_name,
                u.avatar_url AS opponent_avatar,
                CASE 
                    WHEN mh.winner_id IS NULL THEN 'draw'
                    WHEN mh.winner_id = ? THEN 'win'
                    ELSE 'lose'
                END AS result
            FROM match_history mh
            JOIN users u ON u.id = IF(mh.player1_id = ?, mh.player2_id, mh.player1_id)
            WHERE mh.player1_id = ? OR mh.player2_id = ?
            ORDER BY mh.created_at DESC
            LIMIT 50
        `, [userId, userId, userId, userId]);

        res.json({
            matches: rows,
            mmrDelta: {
                win: GAME_CONFIG.rankedWinDelta,
                lose: GAME_CONFIG.rankedLoseDelta
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error loading match history' });
    }
};
exports.getLeaderboard = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT u.username, u.match_making_rating, u.avatar_url, sf.image_url AS frame_url 
            FROM users u
            LEFT JOIN shop_frames sf ON u.equipped_frame = sf.id
            ORDER BY match_making_rating DESC
            LIMIT 50
        `);

        res.json({ leaderboard: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error loading leaderboard' });
    }
};
exports.openGacha = async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const rawCount = Number(req.body && req.body.count) || 1;
    const count = Math.max(1, Math.min(10, rawCount));
    
    const packSize = GAME_CONFIG.gacha.packSize;
    const packCost = GAME_CONFIG.gacha.packCost;
    const packCost10 = GAME_CONFIG.gacha.packCost10;
    
    const totalCost = count >= 10 ? packCost10 : packCost * count;
    const totalCards = count * packSize;

    try {
        const [chargeResult] = await db.query(
            'UPDATE users SET money = money - ? WHERE id = ? AND money >= ?',
            [totalCost, userId, totalCost]
        );

        if (chargeResult.affectedRows === 0) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }

        const [commons] = await db.query('SELECT * FROM cards WHERE rarity = "common"');
        const [rares] = await db.query('SELECT * FROM cards WHERE rarity = "rare"');
        const [epics] = await db.query('SELECT * FROM cards WHERE rarity = "epic"');
        const [legendaries] = await db.query('SELECT * FROM cards WHERE rarity = "legendary"');

        const pools = { common: commons, rare: rares, epic: epics, legendary: legendaries };
        const odds = GAME_CONFIG.gacha.odds;
        const fallbackPool = commons.length > 0 ? commons : [...rares, ...epics, ...legendaries];

        const drawRarity = () => {
            const roll = Math.random() * 100;
            if (roll < odds.legendary) return 'legendary';
            if (roll < odds.legendary + odds.epic) return 'epic';
            if (roll < odds.legendary + odds.epic + odds.rare) return 'rare';
            return 'common';
        };

        const picks = [];

        for (let i = 0; i < totalCards; i += 1) {
            const rarity = drawRarity();
            const pool = pools[rarity];
            const finalPool = pool && pool.length > 0 ? pool : fallbackPool;
            
            if (!finalPool || finalPool.length === 0) continue;
            
            const card = finalPool[Math.floor(Math.random() * finalPool.length)];
            picks.push({ ...card });
        }

        while (picks.length < totalCards && fallbackPool && fallbackPool.length > 0) {
            const card = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
            picks.push({ ...card });
        }

        if (count >= 10) {
            const lastPackStart = (count - 1) * packSize;
            const lastPack = picks.slice(lastPackStart, lastPackStart + packSize);
            const hasSr = lastPack.some(card => card.rarity === 'epic' || card.rarity === 'legendary');

            if (!hasSr) {
                const srPool = [...epics, ...legendaries];
                if (srPool.length > 0) {
                    const srCard = srPool[Math.floor(Math.random() * srPool.length)];
                    const replaceIndex = lastPackStart + Math.floor(Math.random() * packSize);
                    picks[replaceIndex] = { ...srCard };
                }
            }
        }

        if (picks.length > 0) {
            const values = picks.map(card => [userId, card.id]);
            await db.query('INSERT IGNORE INTO user_cards (user_id, card_id) VALUES ?', [values]);
        }

        const [[userRow]] = await db.query('SELECT money FROM users WHERE id = ?', [userId]);

        questController.updateProgress(userId, 'open_pack', 1);
        
        res.json({
            count,
            packSize,
            cards: picks,
            balance: userRow ? userRow.money : 0
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error opening pack' });
    }
};

exports.getUserEmotes = async (req, res) => {
    try {
        const userId = req.session.userId; 

        const query = `
            SELECT e.id, e.name, e.file_name 
            FROM emotes e
            JOIN user_emotes ue ON e.id = ue.emote_id
            WHERE ue.user_id = ?
        `;
        
        const [emotes] = await db.query(query, [userId]);
        res.json({ success: true, emotes: emotes });
    } catch (error) {
        console.error("Error getting user emotes:", error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Return all emotes available in the game
exports.getAllEmotes = async (req, res) => {
    try {
        const [emotes] = await db.query('SELECT id, name, file_name FROM emotes ORDER BY id');
        res.json({ success: true, emotes });
    } catch (error) {
        console.error('Error getting all emotes:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get saved emote deck for user
exports.getUserEmoteDeck = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const [rows] = await db.query(`
            SELECT ued.slot_index, ued.emote_id, e.name, e.file_name
            FROM user_emote_decks ued
            JOIN emotes e ON e.id = ued.emote_id
            WHERE ued.user_id = ?
            ORDER BY ued.slot_index
        `, [userId]);
        res.json({ success: true, deck: rows });
    } catch (error) {
        console.error('Error getting user emote deck:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Save emote deck for user (expects { slots: [emoteId,...] })
exports.saveUserEmoteDeck = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { slots } = req.body;
        if (!Array.isArray(slots)) return res.status(400).json({ error: 'Invalid payload' });

        // Replace existing deck for user
        await db.query('DELETE FROM user_emote_decks WHERE user_id = ?', [userId]);

        // Build insert values only for non-null emote ids
        const insertRows = [];
        for (let i = 0; i < slots.length; i++) {
            const emoteId = slots[i];
            if (emoteId === null || emoteId === undefined) continue;
            // ensure numeric
            const nid = Number(emoteId);
            if (!Number.isInteger(nid)) continue;
            insertRows.push([userId, i, nid]);
        }

        if (insertRows.length > 0) {
            // Validate ownership: user_emotes must contain these emote ids for this user
            const emoteIds = insertRows.map(r => r[2]);
            const [owned] = await db.query('SELECT emote_id FROM user_emotes WHERE user_id = ? AND emote_id IN (?)', [userId, emoteIds]);
            const ownedSet = new Set(owned.map(r => r.emote_id));
            const notOwned = emoteIds.filter(id => !ownedSet.has(id));
            if (notOwned.length > 0) {
                return res.status(400).json({ success: false, error: 'You do not own some emotes', notOwned });
            }

            await db.query('INSERT INTO user_emote_decks (user_id, slot_index, emote_id) VALUES ?', [insertRows]);
        }

        res.json({ success: true, message: 'Emote deck saved' });
    } catch (error) {
        console.error('Error saving user emote deck:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};