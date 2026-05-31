import Groq from 'groq-sdk';

let client = null;

export function getGroqClient() {
  if (!client) {
    const apiKey = String(process.env.GROQ_API_KEY || '').trim();
    if (!apiKey) throw new Error('GROQ_API_KEY not set');
    client = new Groq({ apiKey });
  }
  return client;
}

export async function analyzeWithGroq(prompt) {
  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0,
    max_tokens: 2000,
  });

  return completion?.choices?.[0]?.message?.content || '';
}
