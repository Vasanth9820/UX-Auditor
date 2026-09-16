import express from 'express';
import { config } from '../config/index.js';

const router = express.Router();
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!config.groqApiKey) {
      return res.status(500).json({ error: 'Groq API key not configured on server' });
    }

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.groqApiKey}`,
      },
      body: JSON.stringify({
        model: config.groqModel || 'groq/compound-mini',
        messages: [
          { role: 'system', content: 'You are a helpful UX and accessibility auditor AI assistant. Keep your responses concise, helpful, and formatted in markdown.' },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq Chat Error:', errText);
      return res.status(response.status).json({ error: 'Failed to generate chat response' });
    }

    const data = await response.json();
    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    console.error('Chat API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export const createChatRoutes = () => router;
