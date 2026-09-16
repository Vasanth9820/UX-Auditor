const key = process.env.GROQ_API_KEY;
console.log('Using Key:', key ? `${key.substring(0, 10)}...` : 'undefined');

async function listModels() {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${key}`
      }
    });
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    if (data.data) {
      console.log('Available models:');
      data.data.forEach(m => console.log(` - ${m.id}`));
    } else {
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

listModels();
