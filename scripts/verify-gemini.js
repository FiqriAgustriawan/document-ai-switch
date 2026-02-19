const fs = require('fs');
const path = require('path');

// Standalone verify script
async function verify() {
  console.log('🔍 Verifying Gemini API Key directly...');

  // 1. Read .env.local
  const envPath = path.resolve(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local not found at:', envPath);
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/GEMINI_API_KEY=(.*)/); // Simple regex

  if (!match || !match[1]) {
    console.error('❌ GEMINI_API_KEY not found in .env.local');
    return;
  }

  const apiKey = match[1].trim();
  console.log('🔑 API Key found (length: ' + apiKey.length + ')');
  // console.log('Key:', apiKey); // UNCOMMENT TO SEE KEY IF NEEDED (Security Risk)

  // 2. Test API Call
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{ text: "Hello, answer with 'API WORKS'" }]
    }]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ API Call Successful!');
    console.log('Response:', JSON.stringify(data, null, 2));

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text && text.includes('API WORKS')) {
      console.log('🎉 Verification PASSED: Key and Model are valid.');
    } else {
      console.log('⚠️ Verification: Response received but content unexpected.');
    }

  } catch (error) {
    console.error('❌ API Call Failed:', error.message);
    if (error.message.includes('404')) {
      console.error('👉 Suggestion: Model name might be wrong or key lacks access.');
    }
  }
}

verify();
