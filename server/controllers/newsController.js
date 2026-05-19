const db = require('../config/database');
const fs = require('fs');
const path = require('path');

const ALLOWED_TARGETS = new Set(['', 'quests', 'gacha', 'shop', 'leaderboard', 'deck-builder']);

function normalizeNewsPayload(payload = {}) {
    const title = String(payload.title || '').trim();
    const body = String(payload.body || '').trim();
    const chip = String(payload.chip || 'Update').trim().slice(0, 40);
    const ctaText = String(payload.cta_text || '').trim().slice(0, 80);
    const ctaTargetRaw = String(payload.cta_target || '').trim();
    const ctaTarget = ALLOWED_TARGETS.has(ctaTargetRaw) ? ctaTargetRaw : '';
    const backgroundType = payload.background_type === 'image' ? 'image' : 'gradient';
    const backgroundValue = String(payload.background_value || '').trim();
    const status = ['draft', 'published', 'archived'].includes(payload.status) ? payload.status : 'draft';
    const isActive = payload.is_active ? 1 : 0;
    const cleanBanner = payload.clean_banner ? 1 : 0;
    const sortOrder = Number.isFinite(Number(payload.sort_order)) ? Number(payload.sort_order) : 0;

    const publishFrom = payload.publish_from ? new Date(payload.publish_from) : null;
    const publishTo = payload.publish_to ? new Date(payload.publish_to) : null;

    if (!title) throw new Error('Title is required');
    if (!body) throw new Error('Body is required');
    if (!backgroundValue) throw new Error('Background value is required');
    if (title.length > 180) throw new Error('Title is too long');

    const fromSql = publishFrom && !Number.isNaN(publishFrom.getTime()) ? publishFrom : null;
    const toSql = publishTo && !Number.isNaN(publishTo.getTime()) ? publishTo : null;

    return {
        title,
        body,
        chip,
        ctaText,
        ctaTarget,
        backgroundType,
        backgroundValue,
        status,
        isActive,
        cleanBanner,
        sortOrder,
        publishFrom: fromSql,
        publishTo: toSql
    };
}

const newsController = {
    uploadNewsImageBase64: async (req, res) => {
        try {
            const { data, file_name } = req.body;
            if (!data) return res.status(400).json({ error: 'Missing file data' });

            const newsDir = path.resolve(__dirname, '..', '..', 'client', 'assets', 'news');
            if (!fs.existsSync(newsDir)) fs.mkdirSync(newsDir, { recursive: true });

            const rawName = file_name || (`news-${Date.now()}.png`);
            const safeName = rawName.replace(/[^a-zA-Z0-9\.\-_]/g, '_');
            const filePath = path.join(newsDir, safeName);

            const base64 = data.replace(/^data:.*;base64,/, '');
            const buffer = Buffer.from(base64, 'base64');
            fs.writeFileSync(filePath, buffer);

            // Return public path for client use
            const publicPath = `/assets/news/${safeName}`;
            res.json({ success: true, file: publicPath });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    getLobbyNews: async (_req, res) => {
        try {
            const [rows] = await db.query(`
                SELECT
                    id,
                    title,
                    body,
                    chip,
                    cta_text,
                    cta_target,
                    background_type,
                    background_value,
                    sort_order
                FROM lobby_news
                WHERE is_active = 1
                  AND status = 'published'
                  AND (publish_from IS NULL OR publish_from <= NOW())
                  AND (publish_to IS NULL OR publish_to >= NOW())
                ORDER BY sort_order ASC, id ASC
                LIMIT 20
            `);

            res.json({ news: rows || [] });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    trackImpression: async (req, res) => {
        const { id } = req.params;
        try {
            await db.query('UPDATE lobby_news SET impressions = impressions + 1 WHERE id = ?', [id]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    trackClick: async (req, res) => {
        const { id } = req.params;
        try {
            await db.query('UPDATE lobby_news SET clicks = clicks + 1 WHERE id = ?', [id]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    getAllNewsAdmin: async (_req, res) => {
        try {
            const [rows] = await db.query(`
                SELECT
                    id,
                    title,
                    body,
                    chip,
                    cta_text,
                    cta_target,
                    background_type,
                    background_value,
                    clean_banner,
                    status,
                    is_active,
                    sort_order,
                    publish_from,
                    publish_to,
                    impressions,
                    clicks,
                    created_at,
                    updated_at,
                    CASE
                        WHEN impressions > 0 THEN ROUND((clicks / impressions) * 100, 2)
                        ELSE 0
                    END AS ctr
                FROM lobby_news
                ORDER BY sort_order ASC, id ASC
            `);
            res.json(rows || []);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    saveNewsAdmin: async (req, res) => {
        try {
            const payload = normalizeNewsPayload(req.body || {});
            const id = req.body && req.body.id ? Number(req.body.id) : null;

            if (id) {
                await db.query(`
                    UPDATE lobby_news
                    SET
                        title = ?,
                        body = ?,
                        chip = ?,
                        cta_text = ?,
                        cta_target = ?,
                        background_type = ?,
                        background_value = ?,
                        clean_banner = ?,
                        status = ?,
                        is_active = ?,
                        sort_order = ?,
                        publish_from = ?,
                        publish_to = ?
                    WHERE id = ?
                `, [
                    payload.title,
                    payload.body,
                    payload.chip,
                    payload.ctaText,
                    payload.ctaTarget,
                    payload.backgroundType,
                    payload.backgroundValue,
                    payload.cleanBanner,
                    payload.status,
                    payload.isActive,
                    payload.sortOrder,
                    payload.publishFrom,
                    payload.publishTo,
                    id
                ]);
                return res.json({ success: true, message: 'News updated.' });
            }

            await db.query(`
                INSERT INTO lobby_news
                    (title, body, chip, cta_text, cta_target, background_type, background_value, clean_banner, status, is_active, sort_order, publish_from, publish_to, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                payload.title,
                payload.body,
                payload.chip,
                payload.ctaText,
                payload.ctaTarget,
                payload.backgroundType,
                payload.backgroundValue,
                payload.cleanBanner,
                payload.status,
                payload.isActive,
                payload.sortOrder,
                payload.publishFrom,
                payload.publishTo,
                req.session ? req.session.userId : null
            ]);

            return res.json({ success: true, message: 'News created.' });
        } catch (err) {
            res.status(400).json({ error: err.message || 'Failed to save news.' });
        }
    },

    deleteNewsAdmin: async (req, res) => {
        try {
            await db.query('DELETE FROM lobby_news WHERE id = ?', [req.params.id]);
            res.json({ success: true, message: 'News deleted.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    toggleNewsAdmin: async (req, res) => {
        try {
            await db.query('UPDATE lobby_news SET is_active = IF(is_active = 1, 0, 1) WHERE id = ?', [req.params.id]);
            res.json({ success: true, message: 'News active state toggled.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    cloneNewsAdmin: async (req, res) => {
        try {
            const id = req.params.id;
            const [rows] = await db.query('SELECT * FROM lobby_news WHERE id = ?', [id]);
            if (!rows[0]) return res.status(404).json({ error: 'News item not found.' });

            const source = rows[0];
            const [maxRows] = await db.query('SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM lobby_news');
            const nextOrder = (maxRows[0] ? Number(maxRows[0].maxOrder) : 0) + 1;

            await db.query(`
                INSERT INTO lobby_news
                    (title, body, chip, cta_text, cta_target, background_type, background_value, clean_banner, status, is_active, sort_order, publish_from, publish_to, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?, ?, ?, ?)
            `, [
                `${source.title} (Copy)`,
                source.body,
                source.chip,
                source.cta_text,
                source.cta_target,
                source.background_type,
                source.background_value,
                source.clean_banner,
                nextOrder,
                source.publish_from,
                source.publish_to,
                req.session ? req.session.userId : null
            ]);

            res.json({ success: true, message: 'News duplicated.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    reorderNewsAdmin: async (req, res) => {
        const orderedIds = Array.isArray(req.body && req.body.orderedIds) ? req.body.orderedIds : [];
        if (orderedIds.length === 0) {
            return res.status(400).json({ error: 'orderedIds is required.' });
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            for (let i = 0; i < orderedIds.length; i += 1) {
                await connection.query('UPDATE lobby_news SET sort_order = ? WHERE id = ?', [i + 1, orderedIds[i]]);
            }
            await connection.commit();
            res.json({ success: true, message: 'News order updated.' });
        } catch (err) {
            await connection.rollback();
            res.status(500).json({ error: err.message });
        } finally {
            connection.release();
        }
    }
};

module.exports = newsController;
