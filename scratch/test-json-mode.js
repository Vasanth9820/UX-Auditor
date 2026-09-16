const key = process.env.GROQ_API_KEY;

async function testJson() {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'groq/compound-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Output JSON only.' },
          { role: 'user', content: 'Output a json object with a "hello" key and "world" value.' }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 50
      })
    });
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testJson();
