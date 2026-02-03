// CORS middleware configuration for Materio Community API
const cors = require('cors');

// Allowed origins for CORS
const allowedOrigins = [
    'https://materioa.netlify.app',
    'https://materio-community.vercel.app',
    'https://materio.pages.dev',
    'http://localhost:8888',
    'http://localhost:4000',
    'http://127.0.0.1:8888',
    'http://127.0.0.1:4000'
];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, Postman)
        if (!origin) return callback(null, true);

        // Check if origin is in allowed list or matches localhost pattern
        if (allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
            callback(null, true);
        } else {
            // For development, allow all origins. In production, restrict this.
            console.log(`CORS: Allowing origin ${origin}`);
            callback(null, true);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
    maxAge: 86400 // 24 hours
};

module.exports = cors(corsOptions);
