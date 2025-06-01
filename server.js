// require('dotenv').config(); // Load environment variables from .env file
// const express = require('express');
// const mysql = require('mysql2/promise'); // Using promise-based version
// const cors = require('cors');
// const { createClient } = require('@supabase/supabase-js'); 
// const uuid = require('uuid');
// const Buffer = require('buffer').Buffer;

// const app = express();
// const port = process.env.PORT || 3000; // Use port from .env or default to 3000

// // Middleware
// app.use(cors()); // Enable CORS for all routes
// app.use(express.json({ limit: '10mb' })); // Increased limit for image data
// app.use(express.urlencoded({ limit: '10mb', extended: true })); // To parse JSON request bodies

// // Database connection pool
// const pool = mysql.createPool({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0
// });

// // Inisialisasi Supabase Client dengan Service Role Key
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
// const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET; // Ambil nama bucket

// if (!supabaseUrl || !supabaseServiceKey || !supabaseStorageBucket) {
//     console.error('Missing Supabase environment variables! Please check your .env file.');
//     process.exit(1); // Exit if critical variables are missing
// }
// const supabase = createClient(supabaseUrl, supabaseServiceKey);

// // Test database connection
// pool.getConnection()
//     .then(connection => {
//         console.log('Connected to MySQL database!');
//         connection.release(); // Release the connection
//     })
//     .catch(err => {
//         console.error('Error connecting to MySQL:', err);
//     });

// // --- API Routes ---

// // 1. Endpoint untuk Pendaftaran User
// app.post('/api/register_user', async (req, res) => {
//     const { firebase_uid, username, email } = req.body;

//     // Validasi input sederhana (Anda bisa menambahkan validasi lebih lanjut)
//     if (!firebase_uid || !username || !email) {
//         return res.status(400).json({ message: 'Missing required fields: firebase_uid, username, email' });
//     }

//     try {
//         const [rows] = await pool.execute(
//             'INSERT INTO users (firebase_uid, username, email, full_name) VALUES (?, ?, ?, ?)',
//             [firebase_uid, username, email, username] // Asumsi full_name sama dengan username untuk sementara
//         );
//         res.status(201).json({ message: 'User registered successfully in MySQL!', userId: rows.insertId });
//     } catch (error) {
//         console.error('Error registering user:', error);
//         // Tangani error jika email atau username sudah ada
//         if (error.code === 'ER_DUP_ENTRY') {
//             return res.status(409).json({ message: 'Email or username already exists.' });
//         }
//         res.status(500).json({ message: 'Internal server error during user registration.' });
//     }
// });

// // 2. Contoh Endpoint untuk Mendapatkan Detail User (akan digunakan nanti)
// app.get('/api/users/:firebaseUid', async (req, res) => {
//     const { firebaseUid } = req.params;

//     try {
//         const [rows] = await pool.execute('SELECT id, firebase_uid, username, email, full_name, profile_image_url, bio, registration_date FROM users WHERE firebase_uid = ?', [firebaseUid]);
//         if (rows.length > 0) {
//             res.status(200).json(rows[0]);
//         } else {
//             res.status(404).json({ message: 'User not found.' });
//         }
//     } catch (error) {
//         console.error('Error fetching user details:', error);
//         res.status(500).json({ message: 'Internal server error.' });
//     }
// });

// // 3. Endpoint untuk Mendapatkan Daftar Cerita (Stories)
// // Mengambil data dari tabel `stories` dan `users`
// app.get('/api/stories', async (req, res) => {
//     try {
//         const [stories] = await pool.execute(`
//             SELECT
//                 s.id,
//                 s.description,
//                 s.media_url AS photo_url, -- Mengubah nama kolom media_url menjadi photo_url untuk Flutter
//                 s.location,
//                 s.likes_count,
//                 s.comments_count,
//                 s.created_at,
//                 s.updated_at,
//                 u.username AS author_username,
//                 u.firebase_uid AS author_firebase_uid,
//                 u.profile_image_url AS author_avatar_url
//             FROM
//                 stories s
//             JOIN
//                 users u ON s.user_id = u.id
//             ORDER BY
//                 s.created_at DESC
//         `);

//         // Format data agar sesuai dengan ekspektasi di Flutter FeedPage
//         const formattedStories = stories.map(story => ({
//             id: story.id,
//             description: story.description,
//             photo_url: story.photo_url, // Sudah di-alias dari media_url
//             created_at: story.created_at ? story.created_at.toISOString() : null,
//             updated_at: story.updated_at ? story.updated_at.toISOString() : null, // Ubah Date object ke ISO string
//             location: story.location,
//             author_username: story.author_username,
//             author_avatar_url: story.author_avatar_url || 'assets/images/user-profile.png', // Fallback default
//             likes_count: story.likes_count,
//             comments_count: story.comments_count,
//             author_firebase_uid: story.author_firebase_uid,
//         }));

//         res.status(200).json(formattedStories);
//     } catch (error) {
//         console.error('Error fetching stories:', error);
//         res.status(500).json({ message: 'Internal server error.' });
//     }
// });

// // Endpoint POST /api/stories (modifikasi)
// app.post('/api/stories', async (req, res) => {
//     const { firebase_uid, description, media_data, location } = req.body;

//     if (!firebase_uid || !description || !media_data) {
//         return res.status(400).json({ message: 'Missing required fields: firebase_uid, description, media_data (Base64 image).' });
//     }

//     let publicImageUrl = null;
//     try {
//         // Dapatkan userId dari MySQL
//         const [userRows] = await pool.execute('SELECT id FROM users WHERE firebase_uid = ?', [firebase_uid]);
//         if (userRows.length === 0) {
//             return res.status(404).json({ message: 'User not found in custom backend.' });
//         }
//         const userId = userRows[0].id;

//         // --- Proses Upload Gambar ke Supabase Storage ---
//         const buffer = Buffer.from(media_data, 'base64');
//         const fileName = `story_images/${userId}_${Date.now()}.jpeg`; // Contoh nama file unik

//         const { data, error: uploadError } = await supabase.storage
//             .from(supabaseStorageBucket) // Menggunakan variabel lingkungan
//             .upload(fileName, buffer, {
//                 contentType: 'image/jpeg',
//                 upsert: false // Jangan menimpa jika nama file sudah ada
//             });

//         if (uploadError) {
//             console.error('Error uploading to Supabase Storage:', uploadError);
//             return res.status(500).json({ message: 'Failed to upload image to storage.', error: uploadError.message });
//         }

//         // Dapatkan URL publik dari gambar yang diunggah
//         const { data: publicUrlData } = supabase.storage
//             .from(supabaseStorageBucket) // Menggunakan variabel lingkungan
//             .getPublicUrl(fileName);

//         if (!publicUrlData || !publicUrlData.publicUrl) {
//             console.error('Failed to get public URL for image:', fileName);
//             return res.status(500).json({ message: 'Failed to get public image URL.' });
//         }
//         publicImageUrl = publicUrlData.publicUrl;
//         console.log('Image uploaded to Supabase Storage:', publicImageUrl);

//         // --- Simpan data cerita ke MySQL ---
//         const [result] = await pool.execute(
//             'INSERT INTO stories (user_id, description, media_url, location, created_at, likes_count, comments_count) VALUES (?, ?, ?, ?, ?, ?, ?)',
//             [userId, description, publicImageUrl, location, new Date(), 0, 0]
//         );
//         res.status(201).json({ message: 'Story added successfully!', storyId: result.insertId, imageUrl: publicImageUrl });

//     } catch (error) {
//         console.error('Error adding story (Supabase/MySQL):', error);
//         res.status(500).json({ message: 'Internal server error while adding story.' });
//     }
// });

// // --- Endpoint PUT /api/stories/:id (Untuk Mengupdate Cerita) ---
// app.put('/api/stories/:id', async (req, res) => {
//     const storyId = req.params.id;
//     // Dapatkan data yang diperbarui: description, location, dan juga image_base64 (dari Flutter)
//     const { description, location, media_data, firebase_uid } = req.body; // firebase_uid tetap di body untuk PUT

//     // Validasi dasar
//     if (!firebase_uid) {
//         return res.status(401).json({ message: 'Unauthorized: Firebase UID is required.' });
//     }

//     let connection;
//     try {
//         connection = await pool.getConnection();
//         await connection.beginTransaction();

//         // 1. Verifikasi kepemilikan dan dapatkan URL gambar lama
//         const [storyRows] = await connection.execute('SELECT user_id, media_url FROM stories WHERE id = ?', [storyId]);
//         if (storyRows.length === 0) {
//             await connection.rollback();
//             return res.status(404).json({ message: 'Story not found.' });
//         }
        
//         const currentStory = storyRows[0];
//         // Dapatkan user_id dari database berdasarkan firebase_uid yang dikirim Flutter
//         const [userRows] = await connection.execute('SELECT id FROM users WHERE firebase_uid = ?', [firebase_uid]);
//         if (userRows.length === 0) {
//             await connection.rollback();
//             return res.status(404).json({ message: 'User not found.' });
//         }
//         const userId = userRows[0].id;

//         // Periksa apakah pengguna yang mencoba mengedit adalah pemilik cerita
//         if (currentStory.user_id !== userId) {
//             await connection.rollback();
//             return res.status(403).json({ message: 'Forbidden: You do not own this story.' });
//         }

//         let newPhotoUrl = currentStory.media_url; // Default: gunakan URL gambar lama

//         // 2. Jika ada data gambar baru (media_data Base64) dari Flutter
//         if (media_data) {
//             // Hapus 'data:image/jpeg;base64,' atau sejenisnya dari string Base64
//             const base64Data = media_data.replace(/^data:image\/\w+;base64,/, "");
//             const imageBuffer = Buffer.from(base64Data, 'base64');
//             const fileName = `story_${Date.now()}_${uuid.v4()}.jpeg`; // Nama file unik
//             const filePathInBucket = `story_images/${fileName}`; // Path di bucket Supabase

//             // Upload gambar baru ke Supabase Storage
//             const { data: uploadData, error: uploadError } = await supabase.storage
//                 .from(supabaseStorageBucket)
//                 .upload(filePathInBucket, imageBuffer, {
//                     contentType: 'image/jpeg', // Sesuaikan jika tipe gambar bisa berbeda
//                     upsert: false, // Jangan menimpa jika sudah ada, buat baru
//                 });

//             if (uploadError) {
//                 await connection.rollback();
//                 console.error('Error uploading new image to Supabase Storage:', uploadError);
//                 return res.status(500).json({ message: 'Failed to upload new image.', error: uploadError.message });
//             }

//             // Dapatkan URL publik dari gambar yang baru diunggah
//             const { data: publicUrlData } = supabase.storage
//                 .from(supabaseStorageBucket)
//                 .getPublicUrl(filePathInBucket);
            
//             newPhotoUrl = publicUrlData.publicUrl;

//             // 3. Hapus gambar lama dari Supabase Storage (opsional tapi disarankan)
//             if (currentStory.media_url && currentStory.media_url.includes(supabaseUrl)) {
//                 try {
//                     const oldFileName = currentStory.media_url.substring(currentStory.media_url.lastIndexOf('/') + 1);
//                     const oldFilePathInBucket = `story_images/${oldFileName}`;
//                     console.log(`Attempting to delete old image from Supabase: ${oldFilePathInBucket}`);
//                     const { error: deleteStorageError } = await supabase.storage
//                         .from(supabaseStorageBucket)
//                         .remove([oldFilePathInBucket]);

//                     if (deleteStorageError) {
//                         console.error('Error deleting old image from Supabase Storage:', deleteStorageError);
//                         // Lanjutkan proses update meskipun gagal hapus gambar lama
//                     } else {
//                         console.log('Old image successfully deleted from Supabase Storage.');
//                     }
//                 } catch (deleteError) {
//                     console.error('Exception during old image deletion:', deleteError);
//                 }
//             }
//         }

//         // 4. Perbarui cerita di database MySQL
//         const [result] = await connection.execute(
//             `UPDATE stories SET 
//                 description = ?, 
//                 media_url = ?, 
//                 location = ?,
//                 updated_at = NOW()  -- Pastikan ini diupdate
//              WHERE id = ?`,
//             [description, newPhotoUrl, location, storyId]
//         );

//         if (result.affectedRows === 0) {
//             await connection.rollback();
//             return res.status(404).json({ message: 'Story not found or not updated.' });
//         }

//         await connection.commit(); // Komit transaksi jika semua operasi berhasil
//         res.status(200).json({ message: 'Story updated successfully!' });

//     } catch (error) {
//         if (connection) await connection.rollback();
//         console.error('Error updating story:', error);
//         res.status(500).json({ message: 'Internal server error while updating story.' });
//     } finally {
//         if (connection) connection.release();
//     }
// });

// // server.js (Tambahkan ini di file server.js Anda)

// // --- Endpoint DELETE /api/stories/:id (Untuk Menghapus Cerita) ---
// app.delete('/api/stories/:id', async (req, res) => {
//     const storyId = req.params.id; // Ambil ID cerita dari URL
//     const firebase_uid = req.query.firebase_uid; // <--- UBAH DARI req.body menjadi req.query

//     // Validasi dasar: firebase_uid diperlukan
//     if (!firebase_uid) {
//         return res.status(401).json({ message: 'Unauthorized: Firebase UID is required.' });
//     }

//     let connection; // Variabel untuk koneksi database
//     try {
//         connection = await pool.getConnection(); // Dapatkan koneksi dari pool
//         await connection.beginTransaction(); // Mulai transaksi database untuk atomicity

//         // 1. Dapatkan user_id dari database berdasarkan firebase_uid
//         const [userRows] = await connection.execute('SELECT id FROM users WHERE firebase_uid = ?', [firebase_uid]);
//         if (userRows.length === 0) {
//             await connection.rollback();
//             return res.status(404).json({ message: 'User not found.' });
//         }
//         const userId = userRows[0].id;

//         // 2. Verifikasi kepemilikan cerita dan dapatkan URL gambar lama
//         const [storyRows] = await connection.execute('SELECT user_id, media_url FROM stories WHERE id = ?', [storyId]);
//         if (storyRows.length === 0) {
//             await connection.rollback();
//             return res.status(404).json({ message: 'Story not found.' });
//         }

//         // Periksa apakah pengguna yang mencoba menghapus adalah pemilik cerita
//         if (storyRows[0].user_id !== userId) {
//             await connection.rollback();
//             return res.status(403).json({ message: 'Forbidden: You do not own this story.' });
//         }

//         const oldPhotoUrl = storyRows[0].media_url;

//         // 3. Hapus gambar dari Supabase Storage (jika ada dan merupakan URL Supabase)
//         if (oldPhotoUrl && oldPhotoUrl.includes(supabaseUrl)) {
//             // Ekstrak nama file dari URL
//             const oldFileName = oldPhotoUrl.substring(oldPhotoUrl.lastIndexOf('/') + 1);
//             const oldFilePathInBucket = `story_images/${oldFileName}`; // Pastikan path ini sesuai dengan struktur folder Anda di Supabase

//             console.log(`Attempting to delete image from Supabase: ${oldFilePathInBucket}`);
//             const { error: deleteStorageError } = await supabase.storage
//                 .from(supabaseStorageBucket)
//                 .remove([oldFilePathInBucket]);

//             if (deleteStorageError) {
//                 // Jangan rollback database jika hanya gagal hapus gambar dari storage,
//                 // karena mungkin gambar sudah tidak ada atau ada masalah lain.
//                 // Log saja errornya.
//                 console.error('Error deleting image from Supabase Storage:', deleteStorageError);
//                 // return res.status(500).json({ message: 'Failed to delete image from storage.', error: deleteStorageError.message });
//             } else {
//                 console.log('Image successfully deleted from Supabase Storage.');
//             }
//         }

//         // 4. Hapus cerita dari database MySQL
//         const [result] = await connection.execute('DELETE FROM stories WHERE id = ?', [storyId]);

//         if (result.affectedRows === 0) {
//             await connection.rollback();
//             return res.status(404).json({ message: 'Story not found or already deleted.' });
//         }

//         await connection.commit(); // Komit transaksi jika semua operasi berhasil
//         res.status(200).json({ message: 'Story deleted successfully!' });

//     } catch (error) {
//         if (connection) await connection.rollback(); // Batalkan transaksi jika ada error
//         console.error('Error deleting story:', error);
//         res.status(500).json({ message: 'Internal server error while deleting story.' });
//     } finally {
//         if (connection) connection.release(); // Pastikan koneksi dilepaskan kembali ke pool
//     }
// });

// // 5. (Opsional) Endpoint untuk Follow/Unfollow
// // Mengelola hubungan follow di tabel `follows`
// app.post('/api/follow', async (req, res) => {
//     const { follower_firebase_uid, followed_firebase_uid } = req.body;

//     if (!follower_firebase_uid || !followed_firebase_uid) {
//         return res.status(400).json({ message: 'Missing required fields: follower_firebase_uid, followed_firebase_uid' });
//     }

//     try {
//         // Dapatkan ID internal dari kedua pengguna
//         const [followerRows] = await pool.execute('SELECT id FROM users WHERE firebase_uid = ?', [follower_firebase_uid]);
//         const [followedRows] = await pool.execute('SELECT id FROM users WHERE firebase_uid = ?', [followed_firebase_uid]);

//         if (followerRows.length === 0 || followedRows.length === 0) {
//             return res.status(404).json({ message: 'One or both users not found.' });
//         }

//         const followerId = followerRows[0].id;
//         const followedId = followedRows[0].id;

//         // Cek apakah sudah follow
//         const [existingFollow] = await pool.execute('SELECT * FROM follows WHERE follower_id = ? AND followed_id = ?', [followerId, followedId]);

//         if (existingFollow.length > 0) {
//             return res.status(409).json({ message: 'Already following.' });
//         }

//         // Tambahkan hubungan follow
//         await pool.execute('INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)', [followerId, followedId]);
//         res.status(200).json({ message: 'Successfully followed.' });
//     } catch (error) {
//         console.error('Error following user:', error);
//         res.status(500).json({ message: 'Internal server error during follow operation.' });
//     }
// });

// app.delete('/api/unfollow', async (req, res) => {
//     const { follower_firebase_uid, followed_firebase_uid } = req.body; // Atau dari params/query jika RESTful

//     if (!follower_firebase_uid || !followed_firebase_uid) {
//         return res.status(400).json({ message: 'Missing required fields: follower_firebase_uid, followed_firebase_uid' });
//     }

//     try {
//         const [followerRows] = await pool.execute('SELECT id FROM users WHERE firebase_uid = ?', [follower_firebase_uid]);
//         const [followedRows] = await pool.execute('SELECT id FROM users WHERE firebase_uid = ?', [followed_firebase_uid]);

//         if (followerRows.length === 0 || followedRows.length === 0) {
//             return res.status(404).json({ message: 'One or both users not found.' });
//         }

//         const followerId = followerRows[0].id;
//         const followedId = followedRows[0].id;

//         const [result] = await pool.execute('DELETE FROM follows WHERE follower_id = ? AND followed_id = ?', [followerId, followedId]);

//         if (result.affectedRows > 0) {
//             res.status(200).json({ message: 'Successfully unfollowed.' });
//         } else {
//             res.status(404).json({ message: 'Follow relationship not found.' });
//         }
//     } catch (error) {
//         console.error('Error unfollowing user:', error);
//         res.status(500).json({ message: 'Internal server error during unfollow operation.' });
//     }
// });


// // Start the server
// app.listen(port, '0.0.0.0', () => {
//     console.log(`Server is running on http://localhost:${port}`);
//     console.log(`API base URL: http://localhost:${port}/api`);
// });

// server.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');

// Import konfigurasi
const db = require('./config/db'); // db sudah diinisialisasi dan koneksi diuji di db.js
const { supabase, supabaseStorageBucket } = require('./config/supabase'); // supabase sudah diinisialisasi di supabase.js

// Import rute-rute API
const userRoutes = require('./routes/userRoutes');
const storyRoutes = require('./routes/storyRoutes');
const followRoutes = require('./routes/followRoutes');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// --- API Routes (menggunakan router terpisah) ---
app.use('/api', userRoutes);    // Menangani /api/register_user, /api/users/:firebaseUid
app.use('/api', storyRoutes);   // Menangani /api/stories (GET, POST, PUT, DELETE)
app.use('/api', followRoutes);  // Menangani /api/follow, /api/unfollow

// Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`API base URL: http://localhost:${port}/api`);
});