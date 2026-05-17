module.exports = {
    name: '005_grant_starter_emotes_to_existing_users',
    up: async (db) => {
        const starterEmotes = [
            'emote_angry.png',
            'emote_shy.png',
            'emote_tilted.png',
            'emote_confused.png'
        ];

        const placeholders = starterEmotes.map(() => '?').join(', ');

        await db.query(
            `
                INSERT IGNORE INTO user_emotes (user_id, emote_id)
                SELECT u.id, e.id
                FROM users u
                JOIN emotes e ON e.file_name IN (${placeholders})
            `,
            starterEmotes
        );

        console.log('[Migration 005] Granted starter emotes to existing users.');
    }
};
