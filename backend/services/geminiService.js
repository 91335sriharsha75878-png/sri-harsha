const { GoogleGenAI } = require('@google/genai');

/**
 * Service to manage all interactions with the Google Gemini LLM API.
 * Keeps LLM-specific logic encapsulated cleanly on the backend.
 */
class GeminiService {
  constructor() {
    this.defaultModel = process.env.DEFAULT_MODEL || 'gemini-2.5-flash';
  }

  /**
   * Resolves the API key to use (either from request header/body or server .env)
   * @param {string} [overrideKey] Optional key provided from client
   * @returns {string|null}
   */
  resolveApiKey(overrideKey) {
    if (overrideKey && typeof overrideKey === 'string' && overrideKey.trim().length > 0) {
      return overrideKey.trim();
    }
    return process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
  }

  /**
   * Formats chat messages from frontend standard [{role: 'user'|'assistant', content: '...'}]
   * to Google Gemini format [{role: 'user'|'model', parts: [{text: '...'}]}]
   */
  formatMessagesForGemini(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages array cannot be empty.');
    }

    return messages.map((msg) => {
      // Map standard 'assistant' role to Gemini's 'model' role
      const role = msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user';
      const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return {
        role,
        parts: [{ text }],
      };
    });
  }

  /**
   * Get an initialized GoogleGenAI client
   * @param {string} apiKey
   * @returns {GoogleGenAI}
   */
  getClient(apiKey) {
    if (!apiKey) {
      throw new Error('MISSING_API_KEY');
    }
    return new GoogleGenAI({ apiKey });
  }

  /**
   * Generate standard non-streaming response
   */
  async generateChatResponse({
    messages,
    model = this.defaultModel,
    temperature = 0.7,
    systemInstruction,
    apiKey,
  }) {
    const activeApiKey = this.resolveApiKey(apiKey);

    if (!activeApiKey) {
      return this.generateDemoResponse(messages, 'Standard Response');
    }

    try {
      const ai = this.getClient(activeApiKey);
      const formattedContents = this.formatMessagesForGemini(messages);

      const config = {
        temperature: Number(temperature) || 0.7,
      };

      if (systemInstruction && systemInstruction.trim()) {
        config.systemInstruction = systemInstruction.trim();
      }

      const response = await ai.models.generateContent({
        model,
        contents: formattedContents,
        config,
      });

      return {
        text: response.text || '',
        model,
        usage: response.usageMetadata || null,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[GeminiService Error]:', error);
      throw this.normalizeError(error);
    }
  }

  /**
   * Generate streaming response using Server-Sent Events / generator
   */
  async *generateChatStream({
    messages,
    model = this.defaultModel,
    temperature = 0.7,
    systemInstruction,
    apiKey,
  }) {
    const activeApiKey = this.resolveApiKey(apiKey);

    if (!activeApiKey) {
      // Yield demo stream so user can see frontend-backend streaming working immediately
      const demoChunks = this.getDemoStreamChunks(messages);
      for (const chunk of demoChunks) {
        await new Promise((r) => setTimeout(r, 60));
        yield chunk;
      }
      return;
    }

    try {
      const ai = this.getClient(activeApiKey);
      const formattedContents = this.formatMessagesForGemini(messages);

      const config = {
        temperature: Number(temperature) || 0.7,
      };

      if (systemInstruction && systemInstruction.trim()) {
        config.systemInstruction = systemInstruction.trim();
      }

      const responseStream = await ai.models.generateContentStream({
        model,
        contents: formattedContents,
        config,
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          yield chunk.text;
        }
      }
    } catch (error) {
      console.error('[GeminiService Stream Error]:', error);
      throw this.normalizeError(error);
    }
  }

  /**
   * Check if Gemini API key is valid by running a lightweight test call
   */
  async checkApiKeyValidity(apiKey) {
    const key = this.resolveApiKey(apiKey);
    if (!key) {
      return { valid: false, message: 'No API key provided or configured.' };
    }

    try {
      const ai = this.getClient(key);
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Ping',
      });
      return {
        valid: true,
        message: 'API Key is verified and operational!',
        sampleResponse: result.text ? result.text.substring(0, 50) : 'OK',
      };
    } catch (err) {
      return {
        valid: false,
        message: err.message || 'Failed to authenticate with Gemini API.',
      };
    }
  }

  /**
   * List available Gemini models supported by this chatbot
   */
  getAvailableModels() {
    return [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Recommended: Google’s fastest and most versatile multimodal model with breakthrough performance.',
        isDefault: true,
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Deep reasoning, coding, and complex problem-solving capabilities.',
        isDefault: false,
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'High-frequency lightweight model with 1M context window.',
        isDefault: false,
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Flagship 1.5 model with 2M token context window for huge documents.',
        isDefault: false,
      },
    ];
  }

  /**
   * Normalize errors into user-friendly messages with action steps
   */
  normalizeError(error) {
    const message = error.message || String(error);

    if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
      const err = new Error('Invalid Gemini API Key. Please verify your key at https://aistudio.google.com/app/apikey');
      err.statusCode = 401;
      return err;
    }
    if (message.includes('QUOTA_EXCEEDED') || message.includes('Resource has been exhausted')) {
      const err = new Error('Gemini API Quota exceeded. Please try again in a few moments or switch models.');
      err.statusCode = 429;
      return err;
    }
    if (message.includes('MISSING_API_KEY')) {
      const err = new Error('No Gemini API key found. Please provide an API key in the backend .env or via settings.');
      err.statusCode = 400;
      return err;
    }

    const genericErr = new Error(message);
    genericErr.statusCode = error.status || error.statusCode || 500;
    return genericErr;
  }

  /**
   * Demo response when API key is not yet set
   */
  generateDemoResponse(messages, type) {
    const lastUserMessage = messages[messages.length - 1]?.content || 'Hello';
    return {
      text: `### 🤖 Gemini Chatbot (Backend Demo Mode)\n\nI received your prompt: **"${lastUserMessage}"**\n\nThe **Frontend-to-Backend HTTP REST connection is working perfectly**! 🎉\n\nTo enable live responses from Google Gemini LLM:\n1. Open \`backend/.env\`\n2. Set your free API key: \`GEMINI_API_KEY=AIzaSy...\`\n3. Or click **⚙️ Settings** in the top right to paste your API key directly in the browser.\n\n*(Get a free key instantly at [Google AI Studio](https://aistudio.google.com/app/apikey))*`,
      model: this.defaultModel,
      usage: { promptTokens: 12, responseTokens: 85, totalTokens: 97 },
      timestamp: new Date().toISOString(),
      isDemo: true,
    };
  }

  /**
   * Demo stream chunks
   */
  getDemoStreamChunks(messages) {
    const lastUserMessage = messages[messages.length - 1]?.content || 'Hello';
    return [
      `### ⚡ Gemini Backend Connection Active!\n\n`,
      `You sent: *"`,
      lastUserMessage,
      `"*\n\n`,
      `Notice how this response **streams in real time** through:\n`,
      `- **Frontend**: Browser EventSource / fetch stream listener\n`,
      `- **Backend**: Express Server-Sent Events (\`POST /api/chat/stream\`)\n`,
      `- **Gemini LLM**: Encapsulated inside \`backend/services/geminiService.js\`\n\n`,
      `> 🔑 **Next Step**: Add your Gemini API key to \`backend/.env\` or the UI **Settings** panel to chat with live **Gemini 2.5 Flash**!`,
    ];
  }
}

module.exports = new GeminiService();
