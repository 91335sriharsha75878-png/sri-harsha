const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

/**
 * REST API Routes for Gemini Chatbot
 * Clear separation of HTTP endpoints
 */

// Health & diagnostics
router.get('/health', (req, res) => chatController.getHealth(req, res));

// Architecture breakdown
router.get('/architecture', (req, res) => chatController.getArchitecture(req, res));

// Available models
router.get('/models', (req, res) => chatController.getModels(req, res));

// Verify Gemini API key
router.post('/verify-key', (req, res) => chatController.verifyKey(req, res));

// Send chat message (standard JSON response)
router.post('/chat', (req, res, next) => chatController.sendMessage(req, res, next));

// Stream chat message (SSE streaming response)
router.post('/chat/stream', (req, res, next) => chatController.streamMessage(req, res, next));

module.exports = router;
