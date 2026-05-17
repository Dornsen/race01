module.exports = {
    name: '007_create_shop_emotes',
    up: async (db) => {
        await db.query(`
            CREATE TABLE IF NOT EXISTS shop_emotes (
                emote_id INT PRIMARY KEY,
                price INT NOT NULL DEFAULT 100,
                FOREIGN KEY (emote_id) REFERENCES emotes(id) ON DELETE CASCADE
            )
        `);

        // Seed default prices for any emotes missing in shop_emotes
        const [emotes] = await db.query('SELECT id FROM emotes');
        if (emotes && emotes.length > 0) {
            const values = emotes.map(e => [e.id, 100]);
            await db.query('INSERT IGNORE INTO shop_emotes (emote_id, price) VALUES ?', [values]);
        }

        console.log('[Migration 007] shop_emotes table ensured and seeded.');
    }
};
