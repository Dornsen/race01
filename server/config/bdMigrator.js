const fs = require('fs');
const path = require('path');
const db = require('./db');

async function migrateDatabase() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const [rows] = await db.query("SELECT name FROM migrations");
        const executedMigrations = rows.map(row => row.name);

        const migrationsDir = path.join(__dirname, '../migrations');
        if (!fs.existsSync(migrationsDir)) {
            fs.mkdirSync(migrationsDir);
        }

        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();

        for (const file of files) {
            const migration = require(path.join(migrationsDir, file));

            if (!executedMigrations.includes(migration.name)) {
                console.log(`⏳ [Migration] Start script: ${migration.name}...`);
                
                await migration.up(db);

                await db.query("INSERT INTO migrations (name) VALUES (?)", [migration.name]);
                
                console.log(`✅ [Migration] Script ${migration.name} successfully executed.`);
            }
        }
        
        console.log("🔒 [Migration] All structures checked. Database is ready.");
    } catch (err) {
        console.error("❌ [Migration] Critical error in auto-migration:", err.message);
        process.exit(1);
    }
}

module.exports = migrateDatabase;