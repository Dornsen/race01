module.exports = {
    name: '006_create_user_emote_decks',
    up: async (db) => {
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_emote_decks (
                user_id INT NOT NULL,
                slot_index INT NOT NULL,
                emote_id INT NOT NULL,
                PRIMARY KEY (user_id, slot_index),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (emote_id) REFERENCES emotes(id) ON DELETE CASCADE
            )
        `);

        console.log('[Migration 006] user_emote_decks table ensured.');
    }
};
