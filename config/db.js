require('dotenv').config();
const mysql = require('mysql2/promise');

const connectionUrl = process.env.DATABASE_URL;

if (!connectionUrl) {
    throw new Error("DATABASE_URL environment variable is not set.");
}

const pool = mysql.createPool({
    uri: connectionUrl,
    
    ssl: {
        rejectUnauthorized: false 
    },
    
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection()
    .then(connection => {
        console.log('Successfully connected to Aiven MySQL database!');
        connection.release();
    })
    .catch(err => {
        console.error('FATAL ERROR: Could not connect to Aiven MySQL.', err);
        process.exit(1);
    });

module.exports = pool;