
// Assumes Node.js 18+ with native fetch
async function testChat() {
  console.log('🧪 Starting API Test...');

  const payload = {
    messages: [
      { role: 'user', content: "Please change the first line to 'UPDATED BY TERMINAL TEST'" }
    ],
    documentContent: "Line 1: Original Content\nLine 2: Another line",
    file: null
  };

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Response Received:');
    console.log(JSON.stringify(data, null, 2));

    if (data.updatedDocument) {
      console.log('🎉 Function Calling SUCCESS: Document was updated!');
    } else {
      console.log('⚠️ Function Calling: Document was NOT updated (Check logs if this is expected).');
    }

  } catch (error) {
    console.error('❌ Test Failed:', error.message);
  }
}

// Simple retry logic to wait for server
async function run() {
  const maxRetries = 10;
  let attempts = 0;

  console.log('Waiting for localhost:3000 to be ready...');

  while (attempts < maxRetries) {
    try {
      // First check if server is reachable
      await fetch('http://localhost:3000');
      console.log('Server is UP! Running test...');
      await testChat();
      return;
    } catch (e) {
      attempts++;
      console.log(`Waiting for server... (${attempts}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  console.error('❌ Server did not start in time.');
}

run();
