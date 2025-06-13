require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const storyRoutes = require('./routes/storyRoutes');
const followRoutes = require('./routes/followRoutes');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/api', userRoutes);    
app.use('/api', storyRoutes);   
app.use('/api', followRoutes);  

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`API base URL: http://localhost:${port}/api`);
});
