const fs = require('fs');
const path = require('path');

async function listModels() {
  console.log('🔍 Listing Available Gemini Models...');

  // 1. Read .env.local
  const envPath = path.resolve(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local not found');
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/GEMINI_API_KEY=(.*)/);

  if (!match || !match[1]) {
    console.error('❌ GEMINI_API_KEY not found in .env.local');
    return;
  }

  const apiKey = match[1].trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || response.statusText);
    }

    console.log('✅ Available Models:');
    if (data.models) {
      data.models.forEach(m => {
        if (m.name.includes('gemini')) {
          console.log(`- ${m.name} (${m.displayName})`);
        }
      });
    } else {
      console.log('No models found in response.');
    }

  } catch (error) {
    console.error('❌ Failed to list models:', error.message);
  }
}

listModels();
