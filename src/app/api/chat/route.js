import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize the SDK. It will automatically use the GEMINI_API_KEY environment variable.
const ai = new GoogleGenAI({});

export async function POST(req) {
  try {
    const body = await req.json();
    const { history, message } = body;

    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not set in the environment variables.' },
        { status: 500 }
      );
    }

    // Convert the client-side history to the format expected by the SDK
    // The SDK expects history objects to have 'role' ('user' or 'model') and 'parts' [{text: '...'}]
    const formattedHistory = history.map((msg) => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{
            text: `You are an friendly and helpful English conversational tutor. 
Your goal is to help the user practice speaking English. 
Keep your responses relatively short, conversational, and natural, as they will be read aloud by a text-to-speech engine. 
Do not use emojis, markdown, or complex formatting. Just plain conversational text.
If the user makes a grammar mistake, gently correct them in a friendly way before continuing the conversation.`
          }],
        },
        ...formattedHistory,
        {
          role: 'user',
          parts: [{ text: message }],
        }
      ],
    });

    return NextResponse.json({ text: response.text });
  } catch (error) {
    console.error('Error generating AI response:', error);
    return NextResponse.json(
      { error: 'Failed to generate response.' },
      { status: 500 }
    );
  }
}
