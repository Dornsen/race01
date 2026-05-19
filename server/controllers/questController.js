const db = require('../config/database');

const ensureUserQuests = async (userId) => {
    try {
        const [[userQuests]] = await db.query('SELECT COUNT(*) as count FROM user_quests WHERE user_id = ?', [userId]);
        const [[totalQuests]] = await db.query('SELECT COUNT(*) as count FROM quests');

        if (userQuests.count >= totalQuests.count) {
            return; 
        }

        const [allQuests] = await db.query('SELECT id FROM quests');
        for (let q of allQuests) {
            try {
                await db.query(`
                    INSERT IGNORE INTO user_quests (user_id, quest_id) 
                    VALUES (?, ?)
                `, [userId, q.id]);
            } catch (err) {
                if (err.code !== 'ER_LOCK_DEADLOCK') {
                    console.error(`Error saving quest ${q.id}:`, err);
                }
            }
        }
    } catch (error) {
        console.error('Critical error in ensureUserQuests:', error);
    }
};

const questController = {
    getQuests: async (req, res) => {
        try {
            const userId = req.session.userId;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            await db.query(`
                UPDATE user_quests uq
                JOIN quests q ON uq.quest_id = q.id
                SET uq.current_progress = 0,
                    uq.is_completed = FALSE,
                    uq.is_claimed = FALSE,
                    uq.assigned_at = CURRENT_TIMESTAMP
                WHERE uq.user_id = ? 
                  AND q.quest_type = 'daily' 
                  AND DATE(uq.assigned_at) < CURDATE()
            `, [userId]);

            await db.query(`
                UPDATE user_quests uq
                JOIN quests q ON uq.quest_id = q.id
                SET uq.current_progress = 0,
                    uq.is_completed = FALSE,
                    uq.is_claimed = FALSE,
                    uq.assigned_at = CURRENT_TIMESTAMP
                WHERE uq.user_id = ? 
                  AND q.quest_type = 'weekly' 
                  AND YEARWEEK(uq.assigned_at, 1) < YEARWEEK(CURDATE(), 1)
            `, [userId]);

            await ensureUserQuests(userId);

            const [userQuests] = await db.query(`
                SELECT q.id, q.title, q.description, q.quest_type, q.target_amount, q.reward_coins,
                       uq.current_progress, uq.is_completed, uq.is_claimed
                FROM quests q
                JOIN user_quests uq ON q.id = uq.quest_id
                WHERE uq.user_id = ?
                ORDER BY FIELD(q.quest_type, 'daily', 'weekly', 'achievement'), q.id
            `, [userId]);

            res.json(userQuests);
        } catch (error) {
            console.error('Error fetching quests:', error);
            res.status(500).json({ error: 'Failed to fetch quests' });
        }
    },

    claimReward: async (req, res) => {
        try {
            const userId = req.session.userId;
            const { questId } = req.body;

            const [[quest]] = await db.query(`
                SELECT q.reward_coins, uq.is_completed, uq.is_claimed
                FROM quests q
                JOIN user_quests uq ON q.id = uq.quest_id
                WHERE uq.user_id = ? AND uq.quest_id = ?
            `, [userId, questId]);

            if (!quest) return res.status(404).json({ error: 'Quest not found' });
            if (!quest.is_completed) return res.status(400).json({ error: 'Quest not completed' });
            if (quest.is_claimed) return res.status(400).json({ error: 'Reward already claimed' });

            await db.query(`
                UPDATE user_quests SET is_claimed = TRUE
                WHERE user_id = ? AND quest_id = ?
            `, [userId, questId]);

            await db.query(`
                UPDATE users SET money = money + ?
                WHERE id = ?
            `, [quest.reward_coins, userId]);

            const [[user]] = await db.query('SELECT money FROM users WHERE id = ?', [userId]);
            res.json({ success: true, newBalance: user.money, reward: quest.reward_coins });

        } catch (error) {
            console.error('Error claiming quest reward:', error);
            res.status(500).json({ error: 'Failed to claim reward' });
        }
    },

    updateProgress: async (userId, actionType, amount = 1) => {
        try {
            await ensureUserQuests(userId);

            const [activeQuests] = await db.query(`
                SELECT q.id, q.target_amount, uq.current_progress
                FROM quests q
                JOIN user_quests uq ON q.id = uq.quest_id
                WHERE uq.user_id = ? AND q.action_type = ? AND uq.is_completed = FALSE
            `, [userId, actionType]);

            for (let q of activeQuests) {
                let newProgress = q.current_progress + amount;
                let isCompleted = newProgress >= q.target_amount;

                if (newProgress > q.target_amount) newProgress = q.target_amount;

                await db.query(`
                    UPDATE user_quests
                    SET current_progress = ?, is_completed = ?
                    WHERE user_id = ? AND quest_id = ?
                `, [newProgress, isCompleted, userId, q.id]);
            }
        } catch (error) {
            console.error(`Error updating quest progress (${actionType}):`, error);
        }
    }
};

module.exports = { ...questController, ensureUserQuests };