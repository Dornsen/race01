module.exports = {
    name: '009_dedupe_emotes_and_unique_files',
    up: async (db) => {
        const [duplicateGroups] = await db.query(`
            SELECT file_name, MIN(id) AS keep_id, GROUP_CONCAT(id ORDER BY id) AS ids, COUNT(*) AS total
            FROM emotes
            GROUP BY file_name
            HAVING total > 1
        `);

        for (const group of duplicateGroups) {
            const ids = String(group.ids || '')
                .split(',')
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value));
            const keepId = Number(group.keep_id);
            const duplicateIds = ids.filter((value) => value !== keepId);

            if (duplicateIds.length === 0) continue;

            await db.query(
                'INSERT IGNORE INTO user_emotes (user_id, emote_id) SELECT user_id, ? FROM user_emotes WHERE emote_id IN (?)',
                [keepId, duplicateIds]
            );

            await db.query(
                'UPDATE user_emote_decks SET emote_id = ? WHERE emote_id IN (?)',
                [keepId, duplicateIds]
            );

            await db.query(
                'INSERT IGNORE INTO shop_emotes (emote_id, price) SELECT ?, COALESCE(MIN(price), 750) FROM shop_emotes WHERE emote_id IN (?)',
                [keepId, duplicateIds]
            );

            await db.query('DELETE FROM emotes WHERE id IN (?)', [duplicateIds]);
        }

        const [existingKey] = await db.query(
            `
            SELECT INDEX_NAME, NON_UNIQUE
            FROM information_schema.statistics
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'emotes'
              AND INDEX_NAME = 'uniq_emotes_file_name'
            LIMIT 1
            `
        );

        if (existingKey.length === 0) {
            await db.query(`
                ALTER TABLE emotes
                ADD UNIQUE KEY uniq_emotes_file_name (file_name)
            `);
        } else if (Number(existingKey[0].NON_UNIQUE) === 1) {
            await db.query(`
                ALTER TABLE emotes
                DROP INDEX uniq_emotes_file_name,
                ADD UNIQUE KEY uniq_emotes_file_name (file_name)
            `);
        }

        console.log('[Migration 009] Duplicate emotes removed and file_name uniqueness enforced.');
    }
};