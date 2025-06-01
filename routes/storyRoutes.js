const express = require('express');
const router = express.Router();
const db = require('../config/db'); 
const { supabase, supabaseStorageBucket } = require('../config/supabase'); 
const uuid = require('uuid');
const Buffer = require('buffer').Buffer;

router.get('/stories', async (req, res) => {
    try {
        const [stories] = await db.execute(`
            SELECT
                s.id,
                s.description,
                s.media_url AS photo_url,
                s.location,
                s.likes_count,
                s.comments_count,
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
            likes_count: story.likes_count,
            comments_count: story.comments_count,
            author_firebase_uid: story.author_firebase_uid,
        }));

        res.status(200).json(formattedStories);
    } catch (error) {
        console.error('Error fetching stories:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

router.post('/stories', async (req, res) => {
    const { firebase_uid, description, media_data, location } = req.body;

    if (!firebase_uid || !description || !media_data) {
        return res.status(400).json({ message: 'Missing required fields: firebase_uid, description, media_data (Base64 image).' });
    }

    let publicImageUrl = null;
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

        const buffer = Buffer.from(media_data, 'base64');
        const fileName = `story_images/${userId}_${Date.now()}.jpeg`;

        const { data, error: uploadError } = await supabase.storage
            .from(supabaseStorageBucket)
            .upload(fileName, buffer, {
                contentType: 'image/jpeg',
                upsert: false
            });

        if (uploadError) {
            await connection.rollback(); 
            console.error('Error uploading to Supabase Storage:', uploadError);
            return res.status(500).json({ message: 'Failed to upload image to storage.', error: uploadError.message });
        }

        const { data: publicUrlData } = supabase.storage
            .from(supabaseStorageBucket)
            .getPublicUrl(fileName);

        if (!publicUrlData || !publicUrlData.publicUrl) {
            await connection.rollback(); 
            console.error('Failed to get public URL for image:', fileName);
            return res.status(500).json({ message: 'Failed to get public image URL.' });
        }
        publicImageUrl = publicUrlData.publicUrl;
        console.log('Image uploaded to Supabase Storage:', publicImageUrl);

        const [result] = await connection.execute(
            'INSERT INTO stories (user_id, description, media_url, location, created_at, likes_count, comments_count) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, description, publicImageUrl, location, new Date(), 0, 0]
        );
        
        await connection.commit(); 
        res.status(201).json({ message: 'Story added successfully!', storyId: result.insertId, imageUrl: publicImageUrl });

    } catch (error) {
        if (connection) await connection.rollback(); 
        console.error('Error adding story (Supabase/MySQL):', error);
        res.status(500).json({ message: 'Internal server error while adding story.' });
    } finally {
        if (connection) connection.release();
    }
});

router.put('/stories/:id', async (req, res) => {
    const storyId = req.params.id;
    const { description, location, media_data, firebase_uid } = req.body;

    if (!firebase_uid) {
        return res.status(401).json({ message: 'Unauthorized: Firebase UID is required.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [storyRows] = await connection.execute('SELECT user_id, media_url FROM stories WHERE id = ?', [storyId]);
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

        let newPhotoUrl = currentStory.media_url;

        if (media_data) {
            const base64Data = media_data.replace(/^data:image\/\w+;base64,/, "");
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const fileName = `story_${Date.now()}_${uuid.v4()}.jpeg`;
            const filePathInBucket = `story_images/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(supabaseStorageBucket)
                .upload(filePathInBucket, imageBuffer, {
                    contentType: 'image/jpeg',
                    upsert: false,
                });

            if (uploadError) {
                await connection.rollback();
                console.error('Error uploading new image to Supabase Storage:', uploadError);
                return res.status(500).json({ message: 'Failed to upload new image.', error: uploadError.message });
            }

            const { data: publicUrlData } = supabase.storage
                .from(supabaseStorageBucket)
                .getPublicUrl(filePathInBucket);
            
            newPhotoUrl = publicUrlData.publicUrl;

            if (currentStory.media_url && currentStory.media_url.includes(supabase.supabaseUrl)) { 
                try {
                    const oldFileName = currentStory.media_url.substring(currentStory.media_url.lastIndexOf('/') + 1);
                    const oldFilePathInBucket = `story_images/${oldFileName}`;
                    console.log(`Attempting to delete old image from Supabase: ${oldFilePathInBucket}`);
                    const { error: deleteStorageError } = await supabase.storage
                        .from(supabaseStorageBucket)
                        .remove([oldFilePathInBucket]);

                    if (deleteStorageError) {
                        console.error('Error deleting old image from Supabase Storage:', deleteStorageError);
                    } else {
                        console.log('Old image successfully deleted from Supabase Storage.');
                    }
                } catch (deleteError) {
                    console.error('Exception during old image deletion:', deleteError);
                }
            }
        }

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
            return res.status(404).json({ message: 'Story not found or not updated.' });
        }

        await connection.commit();
        res.status(200).json({ message: 'Story updated successfully!' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating story:', error);
        res.status(500).json({ message: 'Internal server error while updating story.' });
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

        const [storyRows] = await connection.execute('SELECT user_id, media_url FROM stories WHERE id = ?', [storyId]);
        if (storyRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Story not found.' });
        }

        if (storyRows[0].user_id !== userId) {
            await connection.rollback();
            return res.status(403).json({ message: 'Forbidden: You do not own this story.' });
        }

        const oldPhotoUrl = storyRows[0].media_url;

        if (oldPhotoUrl && oldPhotoUrl.includes(supabase.supabaseUrl)) { 
            const oldFileName = oldPhotoUrl.substring(oldPhotoUrl.lastIndexOf('/') + 1);
            const oldFilePathInBucket = `story_images/${oldFileName}`;

            console.log(`Attempting to delete image from Supabase: ${oldFilePathInBucket}`);
            const { error: deleteStorageError } = await supabase.storage
                .from(supabaseStorageBucket)
                .remove([oldFilePathInBucket]);

            if (deleteStorageError) {
                console.error('Error deleting image from Supabase Storage:', deleteStorageError);
            } else {
                console.log('Image successfully deleted from Supabase Storage.');
            }
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
        res.status(500).json({ message: 'Internal server error while deleting story.' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;