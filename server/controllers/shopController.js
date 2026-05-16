const db = require('../config/database');

async function ensureDailyFrameRotation() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS shop_frame_rotations (
            rotation_date DATE PRIMARY KEY,
            slot1 VARCHAR(50) DEFAULT NULL,
            slot2 VARCHAR(50) DEFAULT NULL,
            slot3 VARCHAR(50) DEFAULT NULL
        )
    `);

    const [existingRows] = await db.query(
        'SELECT rotation_date, slot1, slot2, slot3 FROM shop_frame_rotations WHERE rotation_date = CURDATE()'
    );

    if (existingRows.length > 0) {
        const existing = existingRows[0];
        const frameIds = [existing.slot1, existing.slot2, existing.slot3].filter(Boolean);
        if (frameIds.length === 3) {
            return frameIds;
        }

        await db.query('DELETE FROM shop_frame_rotations WHERE rotation_date = CURDATE()');
    }

    const [frames] = await db.query(
        'SELECT id FROM shop_frames ORDER BY RAND() LIMIT 3'
    );

    const frameIds = frames.map(frame => frame.id);
    if (frameIds.length > 0) {
        await db.query(
            'INSERT INTO shop_frame_rotations (rotation_date, slot1, slot2, slot3) VALUES (CURDATE(), ?, ?, ?)',
            [frameIds[0] || null, frameIds[1] || null, frameIds[2] || null]
        );
    }

    return frameIds;
}

async function loadUserFrameState(userId, frames) {
    const frameIds = frames.map(frame => frame.id);
    if (frameIds.length === 0) return frames;

    const [ownedRows] = await db.query(
        'SELECT frame_id FROM user_frames WHERE user_id = ? AND frame_id IN (?)',
        [userId, frameIds]
    );
    const ownedSet = new Set(ownedRows.map(row => row.frame_id));

    const [userRows] = await db.query('SELECT equipped_frame, money FROM users WHERE id = ?', [userId]);
    const equippedFrame = userRows.length > 0 ? userRows[0].equipped_frame : null;
    const money = userRows.length > 0 ? userRows[0].money : 0;

    return frames.map(frame => ({
        ...frame,
        owned: ownedSet.has(frame.id),
        equipped: equippedFrame === frame.id,
        money
    }));
}

exports.getFrameShop = async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const frameIds = await ensureDailyFrameRotation();

        if (frameIds.length === 0) {
            return res.json({ frames: [], money: 0, equippedFrame: null });
        }

        const [frames] = await db.query(
            'SELECT id, name, price, image_url FROM shop_frames WHERE id IN (?)',
            [frameIds]
        );

        const order = new Map(frameIds.map((id, index) => [id, index]));
        frames.sort((a, b) => order.get(a.id) - order.get(b.id));

        const framesWithState = await loadUserFrameState(userId, frames);
        const [[userRow]] = await db.query('SELECT money, equipped_frame FROM users WHERE id = ?', [userId]);

        res.json({
            frames: framesWithState,
            money: userRow ? userRow.money : 0,
            equippedFrame: userRow ? userRow.equipped_frame : null
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error loading frame shop' });
    }
};

exports.buyOrEquipFrame = async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { frameId } = req.body;
    if (!frameId) return res.status(400).json({ error: 'Frame id is required' });

    try {
        const [[frame]] = await db.query('SELECT id, price, image_url FROM shop_frames WHERE id = ?', [frameId]);
        if (!frame) {
            return res.status(404).json({ error: 'Frame not found' });
        }

        const [[userRow]] = await db.query('SELECT money, equipped_frame FROM users WHERE id = ?', [userId]);
        if (!userRow) {
            return res.status(404).json({ error: 'User not found' });
        }

        const [ownedRows] = await db.query(
            'SELECT 1 FROM user_frames WHERE user_id = ? AND frame_id = ? LIMIT 1',
            [userId, frameId]
        );

        if (ownedRows.length === 0) {
            if (userRow.money < frame.price) {
                return res.status(400).json({ error: 'Insufficient funds' });
            }

            await db.query('UPDATE users SET money = money - ? WHERE id = ?', [frame.price, userId]);
            await db.query('INSERT IGNORE INTO user_frames (user_id, frame_id) VALUES (?, ?)', [userId, frameId]);
        }

        await db.query('UPDATE users SET equipped_frame = ? WHERE id = ?', [frameId, userId]);

        const [[updatedUser]] = await db.query('SELECT money, equipped_frame FROM users WHERE id = ?', [userId]);

        res.json({
            message: ownedRows.length === 0 ? 'Frame purchased and equipped!' : 'Frame equipped!',
            frame: {
                id: frame.id,
                image_url: frame.image_url
            },
            money: updatedUser ? updatedUser.money : 0,
            equippedFrame: updatedUser ? updatedUser.equipped_frame : frameId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error updating frame' });
    }
};