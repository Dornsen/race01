module.exports = {
    name: '001_add_role_to_users',
    up: async (db) => {
        try {
            await db.query("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'");
            console.log("🔹 [Migration 001] The 'role' column has been successfully added to the users table.");
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log("ℹ️ [Migration 001] The 'role' column already exists. Skipping.");
            } else {
                throw err;
            }
        }
    }
};