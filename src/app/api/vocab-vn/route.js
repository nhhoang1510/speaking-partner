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

    const prompt = `You are a Vietnamese–English dictionary. The user searched for the Vietnamese word: "${word.trim()}"

Return a detailed dictionary entry in this exact JSON format (no markdown, no code fences):
{
  "word": "${word.trim()}",
  "pronunciation": "Vietnamese pronunciation guide (e.g. /fát/ or tone description)",
  "cefr": "B1",
  "meanings": [
    {
      "partOfSpeech": "noun / verb / adjective / etc",
      "definitions": [
        {
          "english": "English meaning",
          "example_vn": "Example sentence in Vietnamese",
          "example_en": "English translation of the example"
        }
      ],
      "synonyms_vn": ["Vietnamese synonym 1", "Vietnamese synonym 2"]
    }
  ],
  "notes": "Optional cultural/usage note (1 sentence max, or empty string)"
}

Rules:
- Set "cefr" to the CEFR level of the English equivalent: A1, A2, B1, B2, C1, or C2
- Provide up to 3 meanings. Be concise and accurate.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    let raw = response.text.trim();
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (error) {
    console.error('VN vocab API error:', error);
    return NextResponse.json({ error: 'Failed to look up word. Please try again.' }, { status: 500 });
  }
}
