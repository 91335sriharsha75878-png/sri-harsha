const geminiService = require('../services/geminiService');

/**
 * Chat Controller handles HTTP request validation, parameter extraction,
 * and delegates to the Gemini service.
 */
class ChatController {
  /**
   * POST /api/chat
   * Standard JSON request/response for chatbot messages
   */
  async sendMessage(req, res, next) {
    try {
      const { messages, model, temperature, systemInstruction } = req.body;
      const apiKey = req.headers['x-gemini-api-key'] || req.body.apiKey;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error: "messages" array is required and must not be empty.',
        });
      }

      const result = await geminiService.generateChatResponse({
        messages,
        model,
        temperature,
        systemInstruction,
        apiKey,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/chat/stream
   * Real-time streaming response using Server-Sent Events (SSE)
   */
  async streamMessage(req, res, next) {
    try {
      const { messages, model, temperature, systemInstruction } = req.body;
      const apiKey = req.headers['x-gemini-api-key'] || req.body.apiKey;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error: "messages" array is required.',
        });
      }

      // Configure headers for Server-Sent Events (SSE)
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering
      res.flushHeaders();

      // Send initial connection event
      res.write(`data: ${JSON.stringify({ type: 'start', model: model || 'gemini-2.5-flash' })}\n\n`);

      const stream = geminiService.generateChatStream({
        messages,
        model,
        temperature,
        systemInstruction,
        apiKey,
      });

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
      }

      // Send end event
      res.write(`data: ${JSON.stringify({ type: 'done', timestamp: new Date().toISOString() })}\n\n`);
      res.end();
    } catch (error) {
      console.error('[Stream Controller Error]:', error);
      // If headers already sent, write an error SSE event
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Stream processing error' })}\n\n`);
        return res.end();
      }
      next(error);
    }
  }

  /**
   * GET /api/health
   * Health check and diagnostics endpoint
   */
  async getHealth(req, res) {
    const hasServerApiKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());

    res.status(200).json({
      status: 'healthy',
      service: 'Gemini Chatbot Backend',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      apiKeyConfigured: hasServerApiKey,
      defaultModel: process.env.DEFAULT_MODEL || 'gemini-2.5-flash',
      nodeVersion: process.version,
    });
  }

  /**
   * GET /api/models
   * Return available Gemini models
   */
  async getModels(req, res) {
    const models = geminiService.getAvailableModels();
    res.status(200).json({
      success: true,
      models,
    });
  }

  /**
   * POST /api/verify-key
   * Validates an API key (useful for UI key testing)
   */
  async verifyKey(req, res) {
    const apiKey = req.headers['x-gemini-api-key'] || req.body.apiKey;
    const result = await geminiService.checkApiKeyValidity(apiKey);
    res.status(200).json(result);
  }

  /**
   * GET /api/architecture
   * Detailed breakdown of the Frontend / Backend separation
   */
  async getArchitecture(req, res) {
    res.status(200).json({
      separationOfConcerns: {
        frontend: {
          role: 'Client & Presentation Layer',
          responsibilities: [
            'Renders the modern, responsive UI with glassmorphism and animations',
            'Manages user input, chat sessions, and message history locally',
            'Processes Server-Sent Events (SSE) for smooth real-time token streaming',
            'Renders formatted Markdown and syntax-highlighted code with copy buttons',
            'NEVER exposes API secrets directly to end users',
          ],
          technologies: ['Semantic HTML5', 'Vanilla CSS3 Design Tokens', 'Modern ES6+ JavaScript'],
        },
        backend: {
          role: 'Server & Business Logic Layer',
          responsibilities: [
            'Securely manages the Google Gemini API Secret Key (via .env or headers)',
            'Validates message payloads and formats chat turns for Gemini SDK',
            'Exposes clean REST and SSE endpoints (/api/chat, /api/chat/stream)',
            'Handles rate limiting, safety filters, quota errors, and fallbacks',
            'Provides decoupled architecture that can scale independently',
          ],
          technologies: ['Node.js', 'Express.js', '@google/genai SDK', 'Server-Sent Events (SSE)'],
        },
        communication: {
          protocol: 'HTTP / JSON & Server-Sent Events (SSE)',
          endpoints: [
            { method: 'POST', path: '/api/chat', description: 'Standard prompt request/response' },
            { method: 'POST', path: '/api/chat/stream', description: 'Real-time token streaming via SSE' },
            { method: 'GET', path: '/api/health', description: 'Server and API key status probe' },
            { method: 'GET', path: '/api/models', description: 'List of supported Gemini models' },
            { method: 'POST', path: '/api/verify-key', description: 'Validates an API key' },
          ],
        },
      },
    });
  }
}

module.exports = new ChatController();
