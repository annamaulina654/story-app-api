require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const storyRoutes = require('./routes/storyRoutes');
const followRoutes = require('./routes/followRoutes');
const profileRoutes = require('./routes/profileRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/api', userRoutes);    
app.use('/api', storyRoutes);   
app.use('/api', followRoutes);
app.use('/api', profileRoutes);  

module.exports = app;
