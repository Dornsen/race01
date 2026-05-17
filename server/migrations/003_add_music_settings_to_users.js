module.exports = {
    name: '003_add_music_settings_to_users',
    up: async (db) => {
        try {
            await db.query("ALTER TABLE users ADD COLUMN music_enabled BOOLEAN NOT NULL DEFAULT TRUE");
            console.log("🔹 [Migration 003] The 'music_enabled' column has been successfully added to the users table.");
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log("ℹ️ [Migration 003] The 'music_enabled' column already exists. Skipping.");
            } else {
                throw err;
            }
        }

        try {
            await db.query("ALTER TABLE users ADD COLUMN music_volume DECIMAL(3,2) NOT NULL DEFAULT 0.50");
            console.log("🔹 [Migration 003] The 'music_volume' column has been successfully added to the users table.");
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log("ℹ️ [Migration 003] The 'music_volume' column already exists. Skipping.");
            } else {
                throw err;
            }
        }
    }
};