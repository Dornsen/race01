const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CURRENT_CODE_VERSION = 2; 

async function autoInitDatabase() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true
        });

        const dbName = process.env.DB_NAME || 'KIRIdatabase';
        
        // 1. Создаем базу, если её нет вообще
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
        await connection.query(`USE ${dbName}`);

        // 2. Проверяем текущую версию в базе
        let dbVersion = 0;
        try {
            const [rows] = await connection.query("SELECT version FROM schema_version WHERE id = 1");
            if (rows.length > 0) dbVersion = rows[0].version;
        } catch (e) {
            // Если таблицы schema_version нет, значит база пустая (версия 0)
        }

        // 3. Если версия в коде выше — накатываем init.sql
        if (dbVersion < CURRENT_CODE_VERSION) {
            console.log(`[DB] Upgrading schema: v${dbVersion} -> v${CURRENT_CODE_VERSION}`);
            
            const sqlFilePath = path.join(__dirname, '../../database/init.sql');
            const sqlCode = fs.readFileSync(sqlFilePath, 'utf8');

            await connection.query(sqlCode);
            
            // Обновляем версию в базе до текущей
            await connection.query("INSERT INTO schema_version (id, version) VALUES (1, ?) ON DUPLICATE KEY UPDATE version = ?", 
                [CURRENT_CODE_VERSION, CURRENT_CODE_VERSION]);
            
            console.log('🎉 Database schema updated successfully!');
        } else {
            console.log(`✅ Database is up to date (v${dbVersion}).`);
        }

    } catch (error) {
        console.error('❌ DB Init Error:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

module.exports = autoInitDatabase;