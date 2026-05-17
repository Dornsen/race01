module.exports = {
    name: '004_add_emotes',
    up: async (db) => {
        try {
            await db.query("INSERT INTO user_emotes (user_id, emote_id) SELECT id, 1 FROM users;");
            console.log("🔹 [Migration 004] Emotes have been successfully added to the user_emotes table.");
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log("ℹ️ [Migration 004] The 'emote_id' column already exists. Skipping.");
            } else {
                throw err;
            }
        }
    }
};