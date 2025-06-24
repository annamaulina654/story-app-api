const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/profile/:firebase_uid', async (req, res) => {
    const { firebase_uid } = req.params;

    if (!firebase_uid) {
        return res.status(400).json({ message: 'Firebase UID is required.' });
    }

    let connection;
    try {
        connection = await db.getConnection();

        const [userRows] = await connection.execute('SELECT * FROM users WHERE firebase_uid = ?', [firebase_uid]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const user = userRows[0];

        const [[{ storyCount }]] = await connection.execute('SELECT COUNT(*) as storyCount FROM stories WHERE user_id = ?', [user.id]);

        const [[{ followerCount }]] = await connection.execute('SELECT COUNT(*) as followerCount FROM follows WHERE followed_id = ?', [user.id]);

        const [[{ followingCount }]] = await connection.execute('SELECT COUNT(*) as followingCount FROM follows WHERE follower_id = ?', [user.id]);

        const [stories] = await connection.execute(`
            SELECT
                s.id,
                s.description,
                s.media_url AS photo_url,
                s.location,
                s.created_at,
                s.updated_at,
                u.username AS author_username,
                u.firebase_uid AS author_firebase_uid,
                u.profile_image_url AS author_avatar_url
            FROM
                stories s
            JOIN
                users u ON s.user_id = u.id
            WHERE
                s.user_id = ?
            ORDER BY
                s.created_at DESC
        `, [user.id]);

        const formattedStories = stories.map(story => ({
            id: story.id,
            description: story.description,
            photo_url: story.photo_url,      
            created_at: story.created_at,    
            updated_at: story.updated_at,    
            location: story.location,
            author_username: story.author_username,        
            author_avatar_url: story.author_avatar_url,  
            author_firebase_uid: story.author_firebase_uid, 
        }));

        const profileData = {
            id: user.id,
            firebase_uid: user.firebase_uid,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            profile_image_url: user.profile_image_url,
            bio: user.bio,
            storyCount,
            followerCount,
            followingCount,
            stories: formattedStories
        };
        res.status(200).json(profileData);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Internal server error while fetching profile.' });
    } finally {
        if (connection) connection.release();
    }
});

router.put('/profile/:firebase_uid', async (req, res) => {
    const { firebase_uid } = req.params;
    const { username, full_name, bio, profile_image_url } = req.body;

    if (!firebase_uid) {
        return res.status(400).json({ message: 'Firebase UID is required.' });
    }

    try {
        const [userRows] = await db.execute('SELECT * FROM users WHERE firebase_uid = ?', [firebase_uid]);
        if (userRows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const currentUser = userRows[0];

        const updatedUser = {
            username: username !== undefined ? username : currentUser.username,
            full_name: full_name !== undefined ? full_name : currentUser.full_name,
            bio: bio !== undefined ? bio : currentUser.bio,
            profile_image_url: 'profile_image_url' in req.body ? profile_image_url : currentUser.profile_image_url,
        };

        const sql = 'UPDATE users SET username = ?, full_name = ?, bio = ?, profile_image_url = ? WHERE firebase_uid = ?';
        await db.execute(sql, [
            updatedUser.username,
            updatedUser.full_name,
            updatedUser.bio,
            updatedUser.profile_image_url,
            firebase_uid
        ]);

        res.status(200).json({ message: 'Profile updated successfully!' });

    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Internal server error while updating profile.' });
    }
});

module.exports = router;