// Materio Community API - Main Entry Point
require('dotenv').config();
const express = require('express');
const corsMiddleware = require('./middleware/cors');
const bodyParser = require('body-parser');

// Import routes
const postsRoute = require('./routes/posts');
const commentsRoute = require('./routes/comments');
const votesRoute = require('./routes/votes');
const notesRoute = require('./routes/notes');
const uploadRoute = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(corsMiddleware);
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
        next();
    });
}

// Health check & root route
app.get('/', (req, res) => {
    res.json({
        status: 'active',
        service: 'Materio Community API',
        version: '1.0.0',
        endpoints: {
            posts: '/posts',
            comments: '/comments',
            votes: '/votes',
            notes: '/notes',
            upload: '/upload'
        },
        documentation: 'https://github.com/Materioa/materio/wiki/Community-API'
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/posts', postsRoute);
app.use('/comments', commentsRoute);
app.use('/votes', votesRoute);
app.use('/notes', notesRoute);
app.use('/upload', uploadRoute);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path,
        method: req.method
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Too many files. Maximum is 5 files per upload.' });
    }
    if (err.message && err.message.includes('not allowed')) {
        return res.status(400).json({ error: err.message });
    }

    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV !== 'production' ? err.message : undefined
    });
});

// Start server (for local development)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Materio Community API running on port ${PORT}`);
        console.log(`📍 Health check: http://localhost:${PORT}/health`);
        console.log(`📋 Endpoints:`);
        console.log(`   - GET  /posts         - Get feed`);
        console.log(`   - POST /posts         - Create post`);
        console.log(`   - GET  /posts/:id     - Get post details`);
        console.log(`   - POST /comments/:id  - Add comment`);
        console.log(`   - POST /votes         - Cast vote`);
        console.log(`   - POST /notes/:id     - Add community note`);
        console.log(`   - POST /upload        - Upload files`);
    });
}

// Export for Vercel
module.exports = app;
