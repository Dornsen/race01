const mysql = require('mysql2/promise');
require('dotenv').config(); 

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 26886,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = db;