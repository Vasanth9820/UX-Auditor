// No dotenv import needed, run with node --env-file=.env

const key = process.env.GROQ_API_KEY;
console.log('Using Key:', key ? `${key.substring(0, 10)}...` : 'undefined');

async function test(model) {
  console.log(`Testing model: ${model}`);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Say hello' }],
        max_tokens: 10
      })
    });
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

async function main() {
  await test('groq/compound-mini');
  await test('qwen/qwen3.6-27b');
}

main();
