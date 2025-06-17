// src/llm/assistant.ts
import { OpenAI } from 'openai';
import { generateSystemPrompt } from './prompt';

const systemPrompt = generateSystemPrompt();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getAssistantResponse(
  userMessage: string
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const reply = response.choices?.[0]?.message?.content?.trim();
    return reply || "Sorry, I couldn't understand that.";
  } catch (error) {
    console.error('Error fetching assistant response:', error);
    return 'Oops! Something went wrong while contacting the assistant.';
  }
}
