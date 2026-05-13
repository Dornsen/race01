const db = require('../config/database');

exports.addFriend = async (req, res) => {
    const userId = req.session.userId;
    const { friendUsername } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (req.session.username === friendUsername) return res.status(400).json({ error: 'You cannot add yourself!' });

    try {
        const [users] = await db.query('SELECT id FROM users WHERE username = ?', [friendUsername]);
        if (users.length === 0) return res.status(404).json({ error: 'Player not found' });

        const friendId = users[0].id;

        const [check] = await db.query(`
            SELECT * FROM friendships 
            WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
        `, [userId, friendId, friendId, userId]);

        if (check.length > 0) {
            const status = check[0].status;
            if (status === 'accepted') return res.status(400).json({ error: 'You are already friends' });
            if (status === 'pending') return res.status(400).json({ error: 'Friend request already exists' });
            if (status === 'blocked') return res.status(403).json({ error: 'Action blocked' });
        }

        await db.query('INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)', [userId, friendId]);
        res.json({ message: 'Friend request sent!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
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
        res.status(500).json({ error: 'Error loading friends list' });
    }
};

exports.getPendingRequests = async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const [requests] = await db.query(`
            SELECT f.id as friendship_id, u.username 
            FROM friendships f
            JOIN users u ON f.user_id = u.id
            WHERE f.friend_id = ? AND f.status = 'pending'
        `, [userId]);
        
        res.json({ requests });
    } catch (error) {
        res.status(500).json({ error: 'Error loading requests' });
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
        
        res.json({ message: 'Request accepted!' });
    } catch (error) {
        res.status(500).json({ error: 'Error accepting request' });
    }
};

exports.handleRequest = async (req, res) => {
    const { friendshipId, action } = req.body;
    const userId = req.session.userId;

    try {
        if (action === 'accept') {
            await db.query('UPDATE friendships SET status = "accepted" WHERE id = ? AND friend_id = ?', [friendshipId, userId]);
            res.json({ message: 'Friend added!' });
        } else {
            await db.query('DELETE FROM friendships WHERE id = ? AND friend_id = ?', [friendshipId, userId]);
            res.json({ message: 'Request declined' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error processing request' });
    }
};

exports.removeFriend = async (req, res) => {
    const userId = req.session.userId;
    const { friendId } = req.body;
    try {
        await db.query(`
            DELETE FROM friendships 
            WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
        `, [userId, friendId, friendId, userId]);
        
        res.json({ message: 'Player removed from friends' });
    } catch (error) {
        res.status(500).json({ error: 'Error removing friend' });
    }
};