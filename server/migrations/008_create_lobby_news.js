module.exports = {
    name: '008_create_lobby_news',
    up: async (db) => {
        await db.query(`
            CREATE TABLE IF NOT EXISTS lobby_news (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(180) NOT NULL,
                body TEXT NOT NULL,
                chip VARCHAR(40) DEFAULT 'Update',
                cta_text VARCHAR(80) DEFAULT '',
                cta_target VARCHAR(40) DEFAULT '',
                background_type ENUM('gradient', 'image') NOT NULL DEFAULT 'gradient',
                background_value TEXT NOT NULL,
                status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                sort_order INT NOT NULL DEFAULT 0,
                publish_from DATETIME NULL,
                publish_to DATETIME NULL,
                impressions INT NOT NULL DEFAULT 0,
                clicks INT NOT NULL DEFAULT 0,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_news_visibility (is_active, status, sort_order),
                INDEX idx_news_dates (publish_from, publish_to)
            )
        `);

        const [rows] = await db.query('SELECT COUNT(*) AS total FROM lobby_news');
        if (!rows[0] || rows[0].total === 0) {
            await db.query(`
                INSERT INTO lobby_news
                    (title, body, chip, cta_text, cta_target, background_type, background_value, status, is_active, sort_order)
                VALUES
                    (?, ?, ?, ?, ?, ?, ?, 'published', 1, 1),
                    (?, ?, ?, ?, ?, ?, ?, 'published', 1, 2),
                    (?, ?, ?, ?, ?, ?, ?, 'published', 1, 3)
            `, [
                'Season of Ash is Live',
                'New balance pass, faster queue timings and improved battle emote sync are now active in all modes.',
                'Update',
                'Open Quests',
                'quests',
                'gradient',
                'linear-gradient(135deg, rgba(106, 23, 17, 0.75), rgba(16, 18, 25, 0.9)), radial-gradient(circle at 15% 20%, rgba(240, 164, 84, 0.35), transparent 40%)',
                'Omamori Event Banner',
                'Ritual x5 is still discounted. Visit Omamori and claim your guaranteed epic+ card in the final pack.',
                'Shop',
                'Go to Omamori',
                'gacha',
                'gradient',
                'linear-gradient(135deg, rgba(26, 43, 68, 0.72), rgba(13, 16, 20, 0.92)), radial-gradient(circle at 80% 10%, rgba(89, 159, 255, 0.32), transparent 40%)',
                'Challenge Friends Instantly',
                'Right-click a friend to send a duel invite and jump straight into a live PvP match.',
                'Social',
                'View Leaderboard',
                'leaderboard',
                'gradient',
                'linear-gradient(135deg, rgba(35, 53, 28, 0.75), rgba(12, 15, 18, 0.9)), radial-gradient(circle at 20% 15%, rgba(171, 209, 112, 0.3), transparent 40%)'
            ]);
        }

        console.log('[Migration 008] lobby_news table ensured and seeded.');
    }
};
