import Groq from 'groq-sdk';

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.warn(
    'GROQ_API_KEY is not configured. AI lecture summarization will be unavailable.'
  );
}

export const groq = new Groq({
  apiKey: apiKey || 'missing-groq-api-key',
});