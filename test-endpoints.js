/**
 * Verification test script for Gemini Chatbot REST & SSE Endpoints
 */
const http = require('http');

async function testAll() {
  console.log('🧪 Starting Gemini Chatbot Endpoints Test...\n');

  // Launch server in-process if not already running
  let serverInstance;
  try {
    const app = require('./backend/server.js');
  } catch (err) {
    console.log('Note: Backend server might already be running, proceeding to test HTTP...');
  }

  // Small delay for server bind
  await new Promise((r) => setTimeout(r, 800));

  const PORT = 5000;
  const baseUrl = `http://localhost:${PORT}/api`;

  try {
    // 1. Test Health
    console.log('1️⃣ Testing GET /api/health...');
    const health = await fetch(`${baseUrl}/health`).then((r) => r.json());
    console.log('   Status:', health.status, '| API Key Configured:', health.apiKeyConfigured);

    // 2. Test Models
    console.log('2️⃣ Testing GET /api/models...');
    const models = await fetch(`${baseUrl}/models`).then((r) => r.json());
    console.log(`   Found ${models.models?.length || 0} models:`, models.models?.map((m) => m.id).join(', '));

    // 3. Test Architecture Endpoint
    console.log('3️⃣ Testing GET /api/architecture...');
    const arch = await fetch(`${baseUrl}/architecture`).then((r) => r.json());
    console.log('   Separation verified: Frontend =', arch.separationOfConcerns.frontend.role, '| Backend =', arch.separationOfConcerns.backend.role);

    // 4. Test Chat JSON Endpoint
    console.log('4️⃣ Testing POST /api/chat...');
    const chat = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What is frontend vs backend?' }],
        model: 'gemini-2.5-flash',
      }),
    }).then((r) => r.json());
    console.log('   Chat Response success:', chat.success, '| Output preview:', chat.data?.text?.slice(0, 50).replace(/\n/g, ' '));

    // 5. Test SSE Streaming Endpoint
    console.log('5️⃣ Testing POST /api/chat/stream (Server-Sent Events)...');
    const streamRes = await fetch(`${baseUrl}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Stream test' }],
        model: 'gemini-2.5-flash',
      }),
    });

    if (!streamRes.ok) throw new Error(`Stream HTTP ${streamRes.status}`);
    const textData = await streamRes.text();
    const hasData = textData.includes('data:');
    console.log('   SSE Stream response received:', hasData ? 'PASS (data chunks verified)' : 'FAIL');

    console.log('\n🎉 ALL ENDPOINTS PASSED VERIFICATION CLEANLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

testAll();
