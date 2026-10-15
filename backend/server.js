const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const apiRoutes = require('./routes/api');

const app = express();
let PORT = parseInt(process.env.PORT, 10) || 5000;

// Enable CORS for all origins so frontend can run standalone (e.g. file:// or separate port)
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-gemini-api-key'],
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets directly from the frontend directory
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// API Routes
app.use('/api', apiRoutes);

// Fallback route for frontend single-page navigation
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'API route not found' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('[Backend Server Error]:', err);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error',
    statusCode: status,
    timestamp: new Date().toISOString(),
  });
});

// Start server with automatic port retry if occupied
function startServer(portToTry) {
  const server = app.listen(portToTry, () => {
    const hasKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
    console.log('\n========================================================');
    console.log('🚀 Gemini Chatbot Backend Server Running');
    console.log('========================================================');
    console.log(`📡 Local Server URL:  http://localhost:${portToTry}`);
    console.log(`🔌 API Base Endpoint: http://localhost:${portToTry}/api`);
    console.log(`🎨 Frontend App:      http://localhost:${portToTry}/`);
    console.log(`🔑 Gemini API Key:    ${hasKey ? '✅ Configured (.env)' : '⚠️ Not configured (Demo/UI Key mode active)'}`);
    console.log(`🧠 Default Model:     ${process.env.DEFAULT_MODEL || 'gemini-2.5-flash'}`);
    console.log('========================================================\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Server Notice]: Port ${portToTry} is in use. Trying port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('[Server Error]:', err);
    }
  });
}

startServer(PORT);
