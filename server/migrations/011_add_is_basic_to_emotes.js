module.exports = {
    name: '011_add_is_basic_to_emotes',
    up: async (db) => {
        // add column
        await db.query(`ALTER TABLE emotes ADD COLUMN is_basic TINYINT(1) NOT NULL DEFAULT 0`);

        // mark known starter emotes as basic
        await db.query(`UPDATE emotes SET is_basic = 1 WHERE file_name IN ('emote_angry.png','emote_shy.png','emote_tilted.png','emote_confused.png')`);

        // grant all basic emotes to existing users
        await db.query(`INSERT IGNORE INTO user_emotes (user_id, emote_id)
            SELECT u.id, e.id FROM users u JOIN emotes e ON e.is_basic = 1`);

        console.log('[Migration 011] is_basic added to emotes and basic emotes granted to existing users.');
    }
};
