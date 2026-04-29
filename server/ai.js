const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function askGroq({ apiKey, system, prompt, model = 'llama-3.3-70b-versatile', temperature = 0.4 }) {
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY. Add it to your Render environment variables.');
  }

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error: ${response.status} ${err}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content ?? 'No content returned by model.';
}
