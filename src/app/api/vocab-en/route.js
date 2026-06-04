import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

export async function POST(req) {
  try {
    const { word } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not set.' }, { status: 500 });
    }
    if (!word?.trim()) {
      return NextResponse.json({ error: 'Word is required.' }, { status: 400 });
    }

    const prompt = `You are an English–Vietnamese dictionary for Vietnamese learners. The user searched for the English word: "${word.trim()}"

Return a detailed dictionary entry in this exact JSON format (no markdown, no code fences):
{
  "word": "${word.trim()}",
  "phonetic": "/fəˈnetɪk/",
  "cefr": "B2",
  "meanings": [
    {
      "partOfSpeech": "noun",
      "definitions": [
        {
          "english": "The English definition in simple, clear English",
          "vietnamese": "Nghĩa tiếng Việt tương ứng, rõ ràng và tự nhiên",
          "example_en": "An example sentence in English",
          "example_vn": "Bản dịch tiếng Việt của câu ví dụ"
        }
      ],
      "synonyms": ["synonym1", "synonym2"]
    }
  ]
}

Rules:
- Set "cefr" to the appropriate CEFR level: A1, A2, B1, B2, C1, or C2 based on how common/difficult the word is
- Provide up to 3 different partOfSpeech meanings if applicable
- Provide up to 3 definitions per meaning
- The "vietnamese" field MUST be in Vietnamese
- The "example_vn" field MUST be in Vietnamese
- Keep definitions concise and beginner-friendly`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    let raw = response.text.trim();
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (error) {
    console.error('EN vocab API error:', error);
    return NextResponse.json({ error: 'Failed to look up word. Please try again.' }, { status: 500 });
  }
}
