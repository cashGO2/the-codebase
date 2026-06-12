/**
 * Shared CORS origin checks for Vercel serverless handlers.
 */
const STATIC_ALLOWED_ORIGINS = [
  'https://getmaterio.app',
  'https://materioa.netlify.app',
  'https://materioa.vercel.app',
  'https://materioapp.in',
  'https://auth-materioa.netlify.app',
  'https://insightroom.vercel.app',
  'http://localhost:8888',
  'http://localhost:5173',
  'http://localhost:1000',
  // Tauri 2 WebView origins (desktop + mobile)
  'https://tauri.localhost',
  'http://tauri.localhost',
  'tauri://localhost'
];

function isAllowedOrigin(origin) {
  if (!origin) {
    return false;
  }
  if (STATIC_ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
    return true;
  }
  if (origin.startsWith('tauri://')) {
    return true;
  }
  return false;
}

module.exports = { STATIC_ALLOWED_ORIGINS, isAllowedOrigin };
