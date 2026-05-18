module.exports = {
    name: '010_sync_shop_emotes_from_emotes',
    up: async (db) => {
        await db.query(`
            INSERT IGNORE INTO shop_emotes (emote_id, price)
            SELECT id, CASE
                WHEN price IS NULL OR price <= 0 THEN 750
                ELSE price
            END
            FROM emotes
        `);

        console.log('[Migration 010] shop_emotes synced from emotes.');
    }
};
