const db = require('../config/database');

exports.addFriend = async (req, res) => {
    const userId = req.session.userId;
    const { friendUsername } = req.body;

    if (!userId) return res.status(401).json({ error: 'Вы не авторизованы' });
    if (req.session.username === friendUsername) return res.status(400).json({ error: 'Нельзя добавить самого себя!' });

    try {
        const [users] = await db.query('SELECT id FROM users WHERE username = ?', [friendUsername]);
        if (users.length === 0) return res.status(404).json({ error: 'Игрок не найден' });

        const friendId = users[0].id;

        const [check] = await db.query(`
            SELECT * FROM friendships 
            WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
        `, [userId, friendId, friendId, userId]);

        if (check.length > 0) {
            const status = check[0].status;
            if (status === 'accepted') return res.status(400).json({ error: 'Вы уже друзья' });
            if (status === 'pending') return res.status(400).json({ error: 'Заявка уже существует' });
            if (status === 'blocked') return res.status(403).json({ error: 'Действие заблокировано' });
        }

        await db.query('INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)', [userId, friendId]);
        res.json({ message: 'Заявка в друзья отправлена!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

exports.getFriends = async (req, res) => {
    const userId = req.session.userId;
    try {
        const [friends] = await db.query(`
            SELECT u.id, u.username, u.status, u.avatar_url 
            FROM friendships f
            JOIN users u ON (f.friend_id = u.id OR f.user_id = u.id)
            WHERE (f.user_id = ? OR f.friend_id = ?) AND u.id != ? AND f.status = 'accepted'
            LIMIT 50
        `, [userId, userId, userId]);
        res.json({ friends });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки' });
    }
};

exports.getPendingRequests = async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Вы не авторизованы' });

    try {
        // Ищем тех, кто отправил заявку ТЕБЕ
        const [requests] = await db.query(`
            SELECT f.id as friendship_id, u.username 
            FROM friendships f
            JOIN users u ON f.user_id = u.id
            WHERE f.friend_id = ? AND f.status = 'pending'
        `, [userId]);
        
        res.json({ requests });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки заявок' });
    }
};

exports.acceptFriend = async (req, res) => {
    const userId = req.session.userId;
    const { friendshipId } = req.body;

    try {
        await db.query(`
            UPDATE friendships SET status = 'accepted' 
            WHERE id = ? AND friend_id = ?
        `, [friendshipId, userId]);
        
        res.json({ message: 'Заявка принята!' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка при принятии заявки' });
    }
};


exports.handleRequest = async (req, res) => {
    const { friendshipId, action } = req.body; // action: 'accept' или 'decline'
    const userId = req.session.userId;

    try {
        if (action === 'accept') {
            await db.query('UPDATE friendships SET status = "accepted" WHERE id = ? AND friend_id = ?', [friendshipId, userId]);
            res.json({ message: 'Друг добавлен!' });
        } else {
            await db.query('DELETE FROM friendships WHERE id = ? AND friend_id = ?', [friendshipId, userId]);
            res.json({ message: 'Заявка отклонена' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Ошибка обработки' });
    }
};

// 5. Удалить из друзей
exports.removeFriend = async (req, res) => {
    const userId = req.session.userId;
    const { friendId } = req.body;
    try {
        await db.query(`
            DELETE FROM friendships 
            WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
        `, [userId, friendId, friendId, userId]);
        res.json({ message: 'Игрок удален из друзей' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка при удалении' });
    }
};