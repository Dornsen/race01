const db = require('../config/database');

// 1. Получить ВСЕ карты из базы (для левой панели)
exports.getAllCards = async (req, res) => {
    try {
        const [cards] = await db.query('SELECT * FROM cards');
        res.json({ cards });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки базы карт' });
    }
};

// 1.1 Получить коллекцию игрока (все карты + флаг owned)
exports.getCardCollection = async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Вы не авторизованы' });

    try {
        const [cards] = await db.query(
            `
            SELECT c.*, CASE WHEN uc.card_id IS NULL THEN 0 ELSE 1 END AS owned
            FROM cards c
            LEFT JOIN user_cards uc ON uc.card_id = c.id AND uc.user_id = ?
            ORDER BY c.cost ASC, c.id ASC
            `,
            [userId]
        );

        res.json({ cards });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки коллекции' });
    }
};

// 2. Сохранить колоду (строго 10 уникальных карт)
exports.saveDeck = async (req, res) => {
    const userId = req.session.userId;
    const { cardIds } = req.body; 

    if (!userId) return res.status(401).json({ error: 'Вы не авторизованы' });
    if (!cardIds || cardIds.length !== 10) return res.status(400).json({ error: 'Колода должна состоять ровно из 10 карт!' });

    try {
        // Проверяем на дубликаты на сервере
        const uniqueCards = new Set(cardIds);
        if (uniqueCards.size !== 10) return res.status(400).json({ error: 'В колоде не должно быть одинаковых карт!' });

        // Шаг А: Удаляем старую колоду из active_decks
        await db.query('DELETE FROM active_decks WHERE user_id = ?', [userId]);

        // Шаг Б: Записываем новую
        const values = cardIds.map(id => [userId, id]);
        await db.query('INSERT INTO active_decks (user_id, card_id) VALUES ?', [values]);

        res.json({ message: 'Колода из 10 карт успешно сохранена!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка при сохранении колоды' });
    }
};

// 3. Получить ТЕКУЩУЮ колоду игрока
exports.getMyDeck = async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Вы не авторизованы' });

    try {
        const [deck] = await db.query(`
            SELECT c.* FROM active_decks ad
            JOIN cards c ON ad.card_id = c.id
            WHERE ad.user_id = ?
        `, [userId]);
        
        res.json({ deck });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки колоды' });
    }
};