/**
 * Gemini AI Studio - Frontend Application Controller
 * Handles UI interactions, Markdown rendering, SSE streaming,
 * and clear separation of concerns with the Express backend.
 */

class GeminiChatApp {
  constructor() {
    // Configuration & State
    this.storageKey = 'gemini_chat_sessions_v1';
    this.settingsKey = 'gemini_chat_settings_v1';

    // Default settings
    this.settings = this.loadSettings();

    // App state
    this.sessions = this.loadSessions();
    this.currentSessionId = null;
    this.activeMessages = [];
    this.abortController = null;
    this.isGenerating = false;
    this.healthInterval = null;

    // DOM Elements Cache
    this.cacheDom();

    // System Prompts Presets
    this.systemPresets = {
      general: 'You are a helpful, brilliant, and thoughtful AI assistant powered by Google Gemini. Provide clear, accurate, and structured responses.',
      coder: 'You are a Principal Software Engineer. Write clean, production-grade code with error handling, type safety, and clear comments explaining architecture.',
      architect: 'You are a Fullstack System Architect. Explain software architecture, separation of concerns, APIs, distributed systems, and best practices with clarity.',
      concise: 'You are a concise expert. Answer queries directly in 2-4 sentences or clear bullet points with zero unnecessary filler or fluff.',
    };

    // Initialize
    this.init();
  }

  /**
   * Load saved settings from LocalStorage
   */
  loadSettings() {
    const saved = localStorage.getItem(this.settingsKey);
    const defaults = {
      backendUrl: '', // empty defaults to current origin or fallback
      apiKey: '',
      model: 'gemini-2.5-flash',
      systemInstruction: 'You are a helpful, brilliant, and thoughtful AI assistant powered by Google Gemini.',
      temperature: 0.7,
    };
    if (saved) {
      try {
        return { ...defaults, ...JSON.parse(saved) };
      } catch (e) {
        return defaults;
      }
    }
    return defaults;
  }

  /**
   * Save settings to LocalStorage
   */
  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem(this.settingsKey, JSON.stringify(this.settings));
  }

  /**
   * Load chat sessions from LocalStorage
   */
  loadSessions() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  /**
   * Save sessions to LocalStorage
   */
  persistSessions() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.sessions));
  }

  /**
   * Cache critical DOM elements
   */
  cacheDom() {
    // Header
    this.btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    this.appSidebar = document.getElementById('app-sidebar');
    this.backendStatusBadge = document.getElementById('backend-status-badge');
    this.backendStatusText = document.getElementById('backend-status-text');
    this.backendLatency = document.getElementById('backend-latency');
    this.modelSelect = document.getElementById('model-select');
    this.btnArchitectureModal = document.getElementById('btn-architecture-modal');
    this.btnApiInspector = document.getElementById('btn-api-inspector');
    this.btnSettingsModal = document.getElementById('btn-settings-modal');

    // Sidebar
    this.btnNewChat = document.getElementById('btn-new-chat');
    this.btnClearAllChats = document.getElementById('btn-clear-all-chats');
    this.chatHistoryList = document.getElementById('chat-history-list');
    this.presetChips = document.querySelectorAll('.preset-chip');
    this.btnSidebarViewArch = document.getElementById('btn-sidebar-view-arch');

    // Chat Area
    this.chatMain = document.getElementById('chat-main');
    this.welcomeHero = document.getElementById('welcome-hero');
    this.starterCards = document.querySelectorAll('.starter-card');
    this.messagesContainer = document.getElementById('messages-container');
    this.chatForm = document.getElementById('chat-form');
    this.chatInput = document.getElementById('chat-input');
    this.btnSendMessage = document.getElementById('btn-send-message');
    this.btnStopStream = document.getElementById('btn-stop-stream');
    this.charCounter = document.getElementById('char-counter');

    // Modals
    this.modalArchitecture = document.getElementById('modal-architecture');
    this.btnCloseArchModal = document.getElementById('btn-close-arch-modal');

    this.modalApiInspector = document.getElementById('modal-api-inspector');
    this.btnCloseInspectorModal = document.getElementById('btn-close-inspector-modal');
    this.inspectorRequestBody = document.getElementById('inspector-request-body');
    this.inspectorResponseBody = document.getElementById('inspector-response-body');
    this.inspectorStreamStatus = document.getElementById('inspector-stream-status');

    this.modalSettings = document.getElementById('modal-settings');
    this.btnCloseSettingsModal = document.getElementById('btn-close-settings-modal');
    this.settingsForm = document.getElementById('settings-form');
    this.settingBackendUrl = document.getElementById('setting-backend-url');
    this.btnTestBackend = document.getElementById('btn-test-backend');
    this.settingApiKey = document.getElementById('setting-api-key');
    this.btnToggleKeyVisibility = document.getElementById('btn-toggle-key-visibility');
    this.btnVerifyKey = document.getElementById('btn-verify-key');
    this.keyVerificationStatus = document.getElementById('key-verification-status');
    this.settingSystemPrompt = document.getElementById('setting-system-prompt');
    this.settingTemperature = document.getElementById('setting-temperature');
    this.tempDisplay = document.getElementById('temp-display');
    this.btnResetSettings = document.getElementById('btn-reset-settings');

    // Toast
    this.toastContainer = document.getElementById('toast-container');
  }

  /**
   * Determine active backend API base URL
   */
  getApiBaseUrl() {
    if (this.settings.backendUrl && this.settings.backendUrl.trim()) {
      return this.settings.backendUrl.trim().replace(/\/$/, '');
    }
    // If running from file:// or empty origin, fallback to port 5000
    if (window.location.protocol === 'file:' || !window.location.host) {
      return 'http://localhost:5000';
    }
    // If served by the Express backend directly
    return window.location.origin;
  }

  /**
   * Initialize event handlers and initial views
   */
  init() {
    this.bindEvents();
    this.syncSettingsToUI();
    this.renderSessionsList();
    this.startNewChat();
    this.checkBackendHealth();

    // Check health periodically every 25 seconds
    this.healthInterval = setInterval(() => this.checkBackendHealth(), 25000);
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Sidebar toggle
    this.btnToggleSidebar.addEventListener('click', () => {
      this.appSidebar.classList.toggle('collapsed');
    });

    // New Chat
    this.btnNewChat.addEventListener('click', () => this.startNewChat());
    this.btnClearAllChats.addEventListener('click', () => this.clearAllChats());

    // Starter Prompt Cards
    this.starterCards.forEach((card) => {
      card.addEventListener('click', () => {
        const prompt = card.getAttribute('data-prompt');
        if (prompt) {
          this.chatInput.value = prompt;
          this.handleSendMessage();
        }
      });
    });

    // Preset Chips
    this.presetChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        this.presetChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const presetKey = chip.getAttribute('data-preset');
        if (this.systemPresets[presetKey]) {
          this.settings.systemInstruction = this.systemPresets[presetKey];
          this.saveSettings({ systemInstruction: this.settings.systemInstruction });
          this.showToast(`System preset applied: ${chip.textContent.trim()}`, 'success');
        }
      });
    });

    // Model Selector
    this.modelSelect.addEventListener('change', (e) => {
      this.settings.model = e.target.value;
      this.saveSettings({ model: this.settings.model });
      this.showToast(`Switched model to ${this.settings.model}`, 'success');
    });

    // Textarea input auto-grow & keyboard handling
    this.chatInput.addEventListener('input', () => {
      this.adjustTextareaHeight();
      this.charCounter.textContent = `${this.chatInput.value.length} chars`;
    });

    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    // Send and Stop buttons
    this.btnSendMessage.addEventListener('click', () => this.handleSendMessage());
    this.btnStopStream.addEventListener('click', () => this.stopGeneration());

    // Global keyboard shortcuts (Ctrl+K for new chat)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.startNewChat();
      }
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });

    // Modals bindings
    this.btnArchitectureModal.addEventListener('click', () => this.openModal(this.modalArchitecture));
    this.btnSidebarViewArch.addEventListener('click', () => this.openModal(this.modalArchitecture));
    this.btnCloseArchModal.addEventListener('click', () => this.closeModal(this.modalArchitecture));

    this.btnApiInspector.addEventListener('click', () => this.openModal(this.modalApiInspector));
    this.btnCloseInspectorModal.addEventListener('click', () => this.closeModal(this.modalApiInspector));

    this.btnSettingsModal.addEventListener('click', () => {
      this.syncSettingsToUI();
      this.openModal(this.modalSettings);
    });
    this.btnCloseSettingsModal.addEventListener('click', () => this.closeModal(this.modalSettings));

    // Close modals on background click
    [this.modalArchitecture, this.modalApiInspector, this.modalSettings].forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal(modal);
      });
    });

    // Settings actions
    this.settingTemperature.addEventListener('input', (e) => {
      this.tempDisplay.textContent = e.target.value;
    });

    this.btnToggleKeyVisibility.addEventListener('click', () => {
      this.settingApiKey.type = this.settingApiKey.type === 'password' ? 'text' : 'password';
    });

    this.btnTestBackend.addEventListener('click', () => this.checkBackendHealth(true));
    this.btnVerifyKey.addEventListener('click', () => this.verifyGeminiKey());

    this.btnResetSettings.addEventListener('click', () => {
      localStorage.removeItem(this.settingsKey);
      this.settings = this.loadSettings();
      this.syncSettingsToUI();
      this.showToast('Settings reset to defaults', 'success');
    });

    this.settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings({
        backendUrl: this.settingBackendUrl.value.trim(),
        apiKey: this.settingApiKey.value.trim(),
        systemInstruction: this.settingSystemPrompt.value.trim(),
        temperature: parseFloat(this.settingTemperature.value),
        model: this.modelSelect.value,
      });
      this.closeModal(this.modalSettings);
      this.showToast('Settings successfully saved!', 'success');
      this.checkBackendHealth();
    });
  }

  /**
   * Adjust textarea height to avoid scroll jumps
   */
  adjustTextareaHeight() {
    this.chatInput.style.height = 'auto';
    this.chatInput.style.height = `${Math.min(this.chatInput.scrollHeight, 180)}px`;
  }

  /**
   * Open a modal
   */
  openModal(modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close a modal
   */
  closeModal(modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  /**
   * Close all modals
   */
  closeAllModals() {
    [this.modalArchitecture, this.modalApiInspector, this.modalSettings].forEach((m) => {
      if (m) m.classList.add('hidden');
    });
    document.body.style.overflow = '';
  }

  /**
   * Sync settings state to the Settings Modal form
   */
  syncSettingsToUI() {
    this.settingBackendUrl.value = this.settings.backendUrl || '';
    this.settingApiKey.value = this.settings.apiKey || '';
    this.settingSystemPrompt.value = this.settings.systemInstruction || '';
    this.settingTemperature.value = this.settings.temperature ?? 0.7;
    this.tempDisplay.textContent = this.settings.temperature ?? 0.7;
    this.modelSelect.value = this.settings.model || 'gemini-2.5-flash';
  }

  /**
   * Ping backend health endpoint and update status badge
   */
  async checkBackendHealth(interactive = false) {
    const startTime = performance.now();
    const baseUrl = this.getApiBaseUrl();

    this.backendStatusBadge.className = 'status-badge status-checking';
    this.backendStatusText.textContent = 'Checking Backend...';

    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      const elapsed = Math.round(performance.now() - startTime);

      if (response.ok) {
        const data = await response.json();
        this.backendStatusBadge.className = 'status-badge status-connected';
        this.backendStatusText.textContent = 'Backend Connected';
        this.backendLatency.textContent = `${elapsed} ms`;
        this.backendStatusBadge.title = `Connected to Express on ${baseUrl}\nGemini Key in .env: ${data.apiKeyConfigured ? 'Yes' : 'No'}`;

        if (interactive) {
          this.showToast(`Backend connection healthy! Ping: ${elapsed}ms`, 'success');
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      this.backendStatusBadge.className = 'status-badge status-disconnected';
      this.backendStatusText.textContent = 'Backend Offline';
      this.backendLatency.textContent = 'Err';
      this.backendStatusBadge.title = `Failed to connect to ${baseUrl}/api/health\nPlease start the backend server with: npm run start:backend`;

      if (interactive) {
        this.showToast(`Cannot reach backend at ${baseUrl}. Ensure backend is running.`, 'error');
      }
    }
  }

  /**
   * Verify Gemini API key via backend
   */
  async verifyGeminiKey() {
    const key = this.settingApiKey.value.trim();
    const baseUrl = this.getApiBaseUrl();

    this.keyVerificationStatus.className = 'verification-status-box';
    this.keyVerificationStatus.classList.remove('hidden');
    this.keyVerificationStatus.textContent = 'Testing key authentication with Gemini API...';

    try {
      const response = await fetch(`${baseUrl}/api/verify-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': key,
        },
        body: JSON.stringify({ apiKey: key }),
      });

      const result = await response.json();
      if (result.valid) {
        this.keyVerificationStatus.className = 'verification-status-box success';
        this.keyVerificationStatus.textContent = `✅ ${result.message}`;
        this.showToast('Gemini API Key verified successfully!', 'success');
      } else {
        this.keyVerificationStatus.className = 'verification-status-box error';
        this.keyVerificationStatus.textContent = `❌ ${result.message}`;
      }
    } catch (err) {
      this.keyVerificationStatus.className = 'verification-status-box error';
      this.keyVerificationStatus.textContent = `❌ Verification failed: ${err.message}`;
    }
  }

  /**
   * Start a brand new chat session
   */
  startNewChat() {
    if (this.isGenerating) {
      this.stopGeneration();
    }
    const newSession = {
      id: 'session_' + Date.now(),
      title: 'New Conversation',
      messages: [],
      model: this.settings.model,
      updatedAt: new Date().toISOString(),
    };

    this.sessions.unshift(newSession);
    this.currentSessionId = newSession.id;
    this.activeMessages = [];
    this.persistSessions();
    this.renderSessionsList();
    this.renderChatMessages();
    this.chatInput.focus();
  }

  /**
   * Switch to an existing chat session
   */
  switchSession(sessionId) {
    if (this.currentSessionId === sessionId) return;
    if (this.isGenerating) this.stopGeneration();

    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) return;

    this.currentSessionId = session.id;
    this.activeMessages = [...session.messages];
    this.renderSessionsList();
    this.renderChatMessages();
  }

  /**
   * Delete a chat session
   */
  deleteSession(sessionId, e) {
    e.stopPropagation();
    this.sessions = this.sessions.filter((s) => s.id !== sessionId);
    this.persistSessions();

    if (this.currentSessionId === sessionId) {
      if (this.sessions.length > 0) {
        this.switchSession(this.sessions[0].id);
      } else {
        this.startNewChat();
      }
    } else {
      this.renderSessionsList();
    }
  }

  /**
   * Clear all chats
   */
  clearAllChats() {
    if (confirm('Are you sure you want to delete all saved conversations?')) {
      this.sessions = [];
      this.persistSessions();
      this.startNewChat();
      this.showToast('All chat sessions cleared', 'success');
    }
  }

  /**
   * Render sessions in the sidebar
   */
  renderSessionsList() {
    this.chatHistoryList.innerHTML = '';

    if (this.sessions.length === 0) {
      this.chatHistoryList.innerHTML = `<span style="font-size: 0.76rem; color: var(--text-muted); padding: 0.4rem;">No saved chats yet.</span>`;
      return;
    }

    this.sessions.forEach((s) => {
      const item = document.createElement('div');
      item.className = `history-item ${s.id === this.currentSessionId ? 'active' : ''}`;
      item.innerHTML = `
        <span class="history-title" title="${this.escapeHtml(s.title)}">${this.escapeHtml(s.title)}</span>
        <button class="btn-delete-session" title="Delete conversation" aria-label="Delete">✕</button>
      `;
      item.addEventListener('click', () => this.switchSession(s.id));
      const deleteBtn = item.querySelector('.btn-delete-session');
      deleteBtn.addEventListener('click', (e) => this.deleteSession(s.id, e));
      this.chatHistoryList.appendChild(item);
    });
  }

  /**
   * Render chat messages into the main view
   */
  renderChatMessages() {
    this.messagesContainer.innerHTML = '';

    if (this.activeMessages.length === 0) {
      this.welcomeHero.classList.remove('hidden');
      return;
    }

    this.welcomeHero.classList.add('hidden');

    this.activeMessages.forEach((msg) => {
      this.appendMessageToDOM(msg.role, msg.content, msg.model);
    });

    this.scrollToBottom();
  }

  /**
   * Append a single message bubble to DOM
   */
  appendMessageToDOM(role, content, model) {
    const isUser = role === 'user';
    const row = document.createElement('div');
    row.className = `message-row ${isUser ? 'user' : 'assistant'}`;

    const avatarHtml = isUser
      ? `<div class="message-avatar">U</div>`
      : `<div class="message-avatar" title="Gemini LLM">✦</div>`;

    const metaSender = isUser ? 'You' : 'Gemini AI';
    const modelBadge = !isUser && model ? `<span class="message-model-tag">${model}</span>` : '';

    row.innerHTML = `
      ${avatarHtml}
      <div class="message-content-wrapper">
        <div class="message-meta">
          <span class="message-sender">${metaSender}</span>
          ${modelBadge}
          <span class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="message-bubble">
          ${isUser ? `<p>${this.escapeHtml(content).replace(/\n/g, '<br>')}</p>` : this.renderMarkdown(content)}
        </div>
      </div>
    `;

    this.messagesContainer.appendChild(row);
    this.attachCodeCopyHandlers(row);
    return row;
  }

  /**
   * Handle user submitting a chat message
   */
  async handleSendMessage() {
    const rawText = this.chatInput.value.trim();
    if (!rawText || this.isGenerating) return;

    // Reset input
    this.chatInput.value = '';
    this.adjustTextareaHeight();
    this.charCounter.textContent = '0 chars';

    // Hide welcome hero
    this.welcomeHero.classList.add('hidden');

    // Add user message to state
    const userMessage = { role: 'user', content: rawText, timestamp: new Date().toISOString() };
    this.activeMessages.push(userMessage);
    this.appendMessageToDOM('user', rawText);

    // Update conversation title if first message
    const currentSession = this.sessions.find((s) => s.id === this.currentSessionId);
    if (currentSession) {
      if (currentSession.messages.length === 0) {
        currentSession.title = rawText.length > 28 ? rawText.slice(0, 28) + '...' : rawText;
      }
      currentSession.messages = [...this.activeMessages];
      currentSession.updatedAt = new Date().toISOString();
      this.persistSessions();
      this.renderSessionsList();
    }

    this.scrollToBottom();

    // Start streaming response from backend
    await this.executeStreamChat();
  }

  /**
   * Execute streaming chat call to backend using Server-Sent Events (SSE)
   */
  async executeStreamChat() {
    const baseUrl = this.getApiBaseUrl();
    const endpoint = `${baseUrl}/api/chat/stream`;

    this.isGenerating = true;
    this.btnSendMessage.disabled = true;
    this.btnStopStream.classList.remove('hidden');

    // Setup AbortController for cancellation
    this.abortController = new AbortController();

    // Prepare payload for backend
    const payload = {
      messages: this.activeMessages.map((m) => ({ role: m.role, content: m.content })),
      model: this.settings.model || 'gemini-2.5-flash',
      temperature: this.settings.temperature ?? 0.7,
      systemInstruction: this.settings.systemInstruction || '',
    };

    // Update Live API Inspector drawer
    this.inspectorRequestBody.textContent = JSON.stringify(payload, null, 2);
    this.inspectorResponseBody.textContent = '// Stream connecting...\n';
    this.inspectorStreamStatus.textContent = 'Streaming...';
    this.inspectorStreamStatus.className = 'badge-sse';

    // Create temporary Assistant bubble in DOM for incremental token streaming
    const assistantRow = document.createElement('div');
    assistantRow.className = 'message-row assistant';
    assistantRow.innerHTML = `
      <div class="message-avatar">✦</div>
      <div class="message-content-wrapper">
        <div class="message-meta">
          <span class="message-sender">Gemini AI</span>
          <span class="message-model-tag">${payload.model}</span>
          <span class="message-time">Streaming...</span>
        </div>
        <div class="message-bubble">
          <div class="typing-bubble">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
        </div>
      </div>
    `;
    this.messagesContainer.appendChild(assistantRow);
    this.scrollToBottom();

    const bubble = assistantRow.querySelector('.message-bubble');
    let accumulatedText = '';

    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      if (this.settings.apiKey && this.settings.apiKey.trim()) {
        headers['x-gemini-api-key'] = this.settings.apiKey.trim();
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        let errMessage = `Server error ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson.error) errMessage = errJson.error;
        } catch (_) {}
        throw new Error(errMessage);
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      // Clear initial typing dots
      bubble.innerHTML = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep remainder

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.replace(/^data:\s*/, '');
          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'chunk' && event.text) {
              accumulatedText += event.text;
              bubble.innerHTML = this.renderMarkdown(accumulatedText) + '<span class="streaming-cursor"></span>';
              this.attachCodeCopyHandlers(assistantRow);
              this.scrollToBottom();

              // Append to inspector log
              this.inspectorResponseBody.textContent += event.text;
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Stream error from Gemini backend');
            } else if (event.type === 'done') {
              this.inspectorStreamStatus.textContent = 'Completed';
            }
          } catch (parseErr) {
            console.warn('[SSE Parse warning]:', parseErr, jsonStr);
          }
        }
      }

      // Finish streaming cleanly
      const cursor = bubble.querySelector('.streaming-cursor');
      if (cursor) cursor.remove();

      // Fallback if no text received
      if (!accumulatedText) {
        bubble.innerHTML = '<p><em>No response content received from Gemini.</em></p>';
      }

      // Save assistant message to state
      const assistantMessage = {
        role: 'assistant',
        content: accumulatedText || 'No response content',
        model: payload.model,
        timestamp: new Date().toISOString(),
      };
      this.activeMessages.push(assistantMessage);

      // Persist to session
      const currentSession = this.sessions.find((s) => s.id === this.currentSessionId);
      if (currentSession) {
        currentSession.messages = [...this.activeMessages];
        currentSession.updatedAt = new Date().toISOString();
        this.persistSessions();
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        bubble.innerHTML = this.renderMarkdown(accumulatedText) + '<p><em>[Generation stopped by user]</em></p>';
        this.showToast('Generation stopped', 'success');
      } else {
        console.error('[Chat Error]:', error);
        bubble.innerHTML = `
          <div style="color: var(--accent-rose); font-weight: 500;">
            <p>⚠️ <strong>Request Failed:</strong> ${this.escapeHtml(error.message)}</p>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.35rem;">
              Make sure the backend server is running and your Gemini API key is configured in <code>backend/.env</code> or UI Settings.
            </p>
          </div>
        `;
        this.showToast(`Error: ${error.message}`, 'error');
        this.inspectorStreamStatus.textContent = 'Error';
        this.inspectorStreamStatus.className = 'badge-sse';
      }
    } finally {
      this.isGenerating = false;
      this.btnSendMessage.disabled = false;
      this.btnStopStream.classList.add('hidden');
      this.abortController = null;
      this.scrollToBottom();
      this.chatInput.focus();
    }
  }

  /**
   * Stop generation mid-stream
   */
  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Simple, resilient client-side Markdown parser
   */
  renderMarkdown(text) {
    if (!text) return '';

    let html = text;

    // Code blocks with syntax copy button
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang || 'text';
      const escapedCode = this.escapeHtml(code.trim());
      return `
        <div class="code-block-container">
          <div class="code-block-header">
            <span class="code-lang-label">${language}</span>
            <button class="copy-code-btn" data-code="${this.escapeAttribute(code.trim())}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy</span>
            </button>
          </div>
          <pre><code>${escapedCode}</code></pre>
        </div>
      `;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, (match, code) => `<code>${this.escapeHtml(code)}</code>`);

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold & Italics
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Unordered lists
    html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>');
    // Clean up duplicate nested <ul>
    html = html.replace(/<\/ul>\s*<ul>/gim, '');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--accent-cyan); text-decoration: underline;">$1</a>');

    // Paragraphs: double newlines
    const paragraphs = html.split(/\n{2,}/);
    html = paragraphs
      .map((p) => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        if (
          trimmed.startsWith('<h') ||
          trimmed.startsWith('<div') ||
          trimmed.startsWith('<ul') ||
          trimmed.startsWith('<ol') ||
          trimmed.startsWith('<blockquote')
        ) {
          return trimmed;
        }
        return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
      })
      .join('\n');

    return html;
  }

  /**
   * Attach copy-to-clipboard click handlers to code blocks
   */
  attachCodeCopyHandlers(container) {
    const copyButtons = container.querySelectorAll('.copy-code-btn');
    copyButtons.forEach((btn) => {
      // Avoid duplicate event listener
      if (btn.dataset.hasListener) return;
      btn.dataset.hasListener = 'true';

      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const codeText = btn.getAttribute('data-code');
        if (!codeText) return;

        try {
          await navigator.clipboard.writeText(codeText);
          const originalText = btn.innerHTML;
          btn.classList.add('copied');
          btn.innerHTML = `<span>✓ Copied!</span>`;

          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = originalText;
          }, 2000);
        } catch (err) {
          console.error('Failed to copy code:', err);
        }
      });
    });
  }

  /**
   * Escape raw HTML
   */
  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Escape HTML attribute content
   */
  escapeAttribute(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Smoothly scroll message container to bottom
   */
  scrollToBottom() {
    requestAnimationFrame(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    });
  }

  /**
   * Display toast notification
   */
  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : '⚠️'}</span>
      <span>${this.escapeHtml(message)}</span>
    `;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }
}

// Instantiate on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  window.geminiApp = new GeminiChatApp();
});
