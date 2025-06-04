const express = require('express');
const router = express.Router();
const db = require('../config/db'); 

router.post('/follow', async (req, res) => {
    const { follower_firebase_uid, followed_firebase_uid } = req.body;

    if (!follower_firebase_uid || !followed_firebase_uid) {
        return res.status(400).json({ message: 'Missing required fields: follower_firebase_uid, followed_firebase_uid' });
    }
    
    if (follower_firebase_uid === followed_firebase_uid) {
        return res.status(400).json({ message: 'Cannot follow yourself.' });
    }

    let connection;
    try {
        connection = await db.getConnection(); 
        await connection.beginTransaction();

        const [followerRows] = await connection.execute('SELECT id FROM users WHERE firebase_uid = ?', [follower_firebase_uid]);
        const [followedRows] = await connection.execute('SELECT id FROM users WHERE firebase_uid = ?', [followed_firebase_uid]);

        if (followerRows.length === 0 || followedRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'One or both users not found.' });
        }

        const followerId = followerRows[0].id;
        const followedId = followedRows[0].id;

        const [existingFollow] = await connection.execute('SELECT * FROM follows WHERE follower_id = ? AND followed_id = ?', [followerId, followedId]);

        if (existingFollow.length > 0) {
            await connection.rollback();
            return res.status(409).json({ message: 'Already following.' });
        }

        await connection.execute('INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)', [followerId, followedId]);
        
        await connection.commit();
        res.status(200).json({ message: 'Successfully followed.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error following user:', error);
        res.status(500).json({ message: 'Internal server error during follow operation.' });
    } finally {
        if (connection) connection.release();
    }
});

router.delete('/unfollow', async (req, res) => {
    const { follower_firebase_uid, followed_firebase_uid } = req.body;

    if (!follower_firebase_uid || !followed_firebase_uid) {
        return res.status(400).json({ message: 'Missing required fields: follower_firebase_uid, followed_firebase_uid' });
    }

    let connection;
    try {
        connection = await db.getConnection(); 
        await connection.beginTransaction();

        const [followerRows] = await connection.execute('SELECT id FROM users WHERE firebase_uid = ?', [follower_firebase_uid]);
        const [followedRows] = await connection.execute('SELECT id FROM users WHERE firebase_uid = ?', [followed_firebase_uid]);

        if (followerRows.length === 0 || followedRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'One or both users not found.' });
        }

        const followerId = followerRows[0].id;
        const followedId = followedRows[0].id;

        const [result] = await connection.execute('DELETE FROM follows WHERE follower_id = ? AND followed_id = ?', [followerId, followedId]);

        if (result.affectedRows > 0) {
            await connection.commit();
            res.status(200).json({ message: 'Successfully unfollowed.' });
        } else {
            await connection.rollback();
            res.status(404).json({ message: 'Follow relationship not found.' });
        }
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error unfollowing user:', error);
        res.status(500).json({ message: 'Internal server error during unfollow operation.' });
    } finally {
        if (connection) connection.release();
    }
});

router.get('/follows/status', async (req, res) => {
    const { follower_firebase_uid, followed_firebase_uid } = req.query;

    if (!follower_firebase_uid || !followed_firebase_uid) {
        return res.status(400).json({ message: 'Missing required query parameters: follower_firebase_uid, followed_firebase_uid' });
    }

    let connection;
    try {
        connection = await db.getConnection();

        const [followerRows] = await connection.execute('SELECT id FROM users WHERE firebase_uid = ?', [follower_firebase_uid]);
        const [followedRows] = await connection.execute('SELECT id FROM users WHERE firebase_uid = ?', [followed_firebase_uid]);

        if (followerRows.length === 0 || followedRows.length === 0) {
            return res.status(200).json({ isFollowing: false, message: 'One or both users not found.' });
        }

        const followerId = followerRows[0].id;
        const followedId = followedRows[0].id;

        const [existingFollow] = await connection.execute(
            'SELECT COUNT(*) AS count FROM follows WHERE follower_id = ? AND followed_id = ?',
            [followerId, followedId]
        );

        res.status(200).json({ isFollowing: existingFollow[0].count > 0 });

    } catch (error) {
        console.error('Error checking follow status:', error);
        res.status(500).json({ message: 'Internal server error.', error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;