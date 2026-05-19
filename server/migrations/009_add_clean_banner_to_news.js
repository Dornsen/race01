module.exports = {
    name: '009_add_clean_banner_to_news',
    up: async (db) => {
        const [cols] = await db.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME   = 'lobby_news'
              AND COLUMN_NAME  = 'clean_banner'
        `);

        if (cols.length === 0) {
            await db.query(`
                ALTER TABLE lobby_news
                ADD COLUMN clean_banner TINYINT(1) NOT NULL DEFAULT 0
                AFTER background_value
            `);
            console.log('[Migration 009] clean_banner column added.');
        } else {
            console.log('[Migration 009] clean_banner already exists, skipping ALTER.');
        }
        const [updated] = await db.query(`
            UPDATE lobby_news
            SET clean_banner = 1
            WHERE background_type = 'image'
              AND cta_target = 'gacha'
        `);
        console.log(`[Migration 009] clean_banner=1 set on ${updated.affectedRows} row(s).`);
    }
};