import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

export async function POST(req) {
  try {
    const { vietnamese, userTranslation } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not set in the environment variables.' },
        { status: 500 }
      );
    }

    if (!vietnamese?.trim() || !userTranslation?.trim()) {
      return NextResponse.json({ error: 'Both Vietnamese text and your translation are required.' }, { status: 400 });
    }

    const prompt = `You are an expert English teacher reviewing a Vietnamese learner's translation.

ORIGINAL VIETNAMESE TEXT:
"${vietnamese.trim()}"

LEARNER'S ENGLISH TRANSLATION:
"${userTranslation.trim()}"

Your task:
1. Provide the ideal/reference English translation of the Vietnamese text.
2. Score the learner's translation on a 0–100 scale for: Grammar, Vocabulary, Accuracy (faithfulness to the original meaning), Naturalness.
3. List all errors found in the learner's translation (grammar mistakes, wrong word choices, unnatural phrasing, missing meaning, etc.).
4. Provide the corrected version of the learner's translation (keep their style but fix all issues).
5. Give 2–3 actionable tips to help them improve.

Respond ONLY with a valid JSON object (no markdown, no code fences):
{
  "referenceTranslation": "The ideal English translation of the Vietnamese text",
  "scores": {
    "grammar": 70,
    "vocabulary": 65,
    "accuracy": 80,
    "naturalness": 60
  },
  "errors": [
    {
      "type": "Grammar",
      "original": "the incorrect phrase from learner's translation",
      "correction": "the corrected phrase",
      "explanation": "Brief explanation of the error"
    }
  ],
  "corrected": "The learner's translation with all errors fixed",
  "tips": [
    "Specific tip 1",
    "Specific tip 2",
    "Specific tip 3"
  ],
  "summary": "A 1-2 sentence overall encouraging feedback message for the learner"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    let raw = response.text.trim();
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Translation review API error:', error);
    return NextResponse.json({ error: 'Failed to review translation. Please try again.' }, { status: 500 });
  }
}
