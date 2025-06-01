const express = require('express');
const router = express.Router();
const db = require('../config/db'); 

router.post('/register_user', async (req, res) => {
    const { firebase_uid, username, email } = req.body;

    if (!firebase_uid || !username || !email) {
        return res.status(400).json({ message: 'Missing required fields: firebase_uid, username, email' });
    }

    try {
        const [rows] = await db.execute(
            'INSERT INTO users (firebase_uid, username, email, full_name) VALUES (?, ?, ?, ?)',
            [firebase_uid, username, email, username]
        );
        res.status(201).json({ message: 'User registered successfully in MySQL!', userId: rows.insertId });
    } catch (error) {
        console.error('Error registering user:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Email or username already exists.' });
        }
        res.status(500).json({ message: 'Internal server error during user registration.' });
    }
});

router.get('/users/:firebaseUid', async (req, res) => {
    const { firebaseUid } = req.params;

    try {
        const [rows] = await db.execute('SELECT id, firebase_uid, username, email, full_name, profile_image_url, bio, registration_date FROM users WHERE firebase_uid = ?', [firebaseUid]);
        if (rows.length > 0) {
            res.status(200).json(rows[0]);
        } else {
            res.status(404).json({ message: 'User not found.' });
        }
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;