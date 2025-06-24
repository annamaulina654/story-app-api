const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/stories', async (req, res) => {
    try {
        const [stories] = await db.execute(`
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
            ORDER BY
                s.created_at DESC
        `);

        const formattedStories = stories.map(story => ({
            id: story.id,
            description: story.description,
            photo_url: story.photo_url,
            created_at: story.created_at ? story.created_at.toISOString() : null,
            updated_at: story.updated_at ? story.updated_at.toISOString() : null,
            location: story.location,
            author_username: story.author_username,
            author_avatar_url: story.author_avatar_url || 'assets/images/user-profile.png',
            author_firebase_uid: story.author_firebase_uid,
        }));

        res.status(200).json(formattedStories);
    } catch (error) {
        console.error('Error fetching stories:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

router.post('/stories', async (req, res) => {
    const { firebase_uid, description, public_image_url, location } = req.body;

    if (!firebase_uid || !description || !public_image_url) {
        return res.status(400).json({ message: 'Missing required fields: firebase_uid, description, public_image_url.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [userRows] = await connection.execute('SELECT id FROM users WHERE firebase_uid = ?', [firebase_uid]);
        if (userRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'User not found in custom backend.' });
        }
        const userId = userRows[0].id;

        const [result] = await connection.execute(
            'INSERT INTO stories (user_id, description, media_url, location, created_at, likes_count, comments_count) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, description, public_image_url, location, new Date(), 0, 0] 
        );

        await connection.commit();
        res.status(201).json({ message: 'Story added successfully!', storyId: result.insertId, imageUrl: public_image_url });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error adding story (MySQL):', error); 
        res.status(500).json({ message: 'Internal server error while adding story.' });
    } finally {
        if (connection) connection.release();
    }
});

router.put('/stories/:id', async (req, res) => {
    const storyId = req.params.id;
    const { description, location, public_image_url, firebase_uid } = req.body; 

    if (!firebase_uid) {
        return res.status(401).json({ message: 'Unauthorized: Firebase UID is required.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [storyRows] = await connection.execute('SELECT user_id FROM stories WHERE id = ?', [storyId]);
        if (storyRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Story not found.' });
        }

        const currentStory = storyRows[0];
        const [userRows] = await connection.execute('SELECT id FROM users WHERE firebase_uid = ?', [firebase_uid]);
        if (userRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'User not found.' });
        }

        const userId = userRows[0].id;
        if (currentStory.user_id !== userId) {
            await connection.rollback();
            return res.status(403).json({ message: 'Forbidden: You do not own this story.' });
        }

        let newPhotoUrl = public_image_url;
        
        const [result] = await connection.execute(
            `UPDATE stories SET
                description = ?,
                media_url = ?,
                location = ?,
                updated_at = NOW()
             WHERE id = ?`,
            [description, newPhotoUrl, location, storyId]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Story not found or no changes made.' });
        }

        await connection.commit();
        res.status(200).json({ message: 'Story updated successfully!' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating story:', error);
        res.status(500).json({ message: 'Internal server error while updating story.', error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

router.delete('/stories/:id', async (req, res) => {
    const storyId = req.params.id;
    const firebase_uid = req.query.firebase_uid;

    if (!firebase_uid) {
        return res.status(401).json({ message: 'Unauthorized: Firebase UID is required.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [userRows] = await connection.execute('SELECT id FROM users WHERE firebase_uid = ?', [firebase_uid]);
        if (userRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'User not found.' });
        }
        const userId = userRows[0].id;

        const [storyRows] = await connection.execute('SELECT user_id FROM stories WHERE id = ?', [storyId]);
        if (storyRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Story not found.' });
        }

        const storyToDelete = storyRows[0];
        if (storyToDelete.user_id !== userId) {
            await connection.rollback();
            return res.status(403).json({ message: 'Forbidden: You do not own this story.' });
        }

        const [result] = await connection.execute('DELETE FROM stories WHERE id = ?', [storyId]);
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Story not found or already deleted.' });
        }

        await connection.commit();
        res.status(200).json({ message: 'Story deleted successfully!' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error deleting story:', error);
        res.status(500).json({ message: 'Internal server error while deleting story.', error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;