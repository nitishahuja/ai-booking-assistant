import WebSocket from 'ws';
import OpenAI from 'openai';
import { EventEmitter } from 'events';
import { BrowserAgent } from '../agent/stagehandAgent';
import * as calendly from '../platforms/calendly';
import { tools, availableFunctions } from '../functions/manifest';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import dotenv from 'dotenv';

dotenv.config();

export class GPTService extends EventEmitter {
  private openai: OpenAI;
  private sessions: Map<WebSocket, ChatCompletionMessageParam[]>;
  private ws: WebSocket;
  private processedTools: Set<string>;

  constructor(ws: WebSocket) {
    super();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    this.sessions = new Map();
    this.ws = ws;
    this.processedTools = new Set();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.ws.on('message', async (data: string) => {
      try {
        let message;
        try {
          const event = JSON.parse(data);
          message = event.payload.text;
        } catch {
          message = data.toString();
        }
        // Clear processed tools for new message
        this.processedTools.clear();
        await this.processMessage(message);
      } catch (error) {
        console.error('Error processing message:', error);
        this.emit('error', error);
      }
    });
  }

  public async initializeSession() {
    console.log('🔌 New client connected - Initializing chat session');

    const initialHistory: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are an AI booking assistant that helps users schedule meetings via Calendly.

Your task is to help users book a meeting by collecting:
- Full name
- Email address
- Preferred date and time

Follow these steps:
1. Start with a friendly greeting asking if they'd like to book a meeting
2. Collect name and email
3. Ask for preferred date and time
4. Use normalizeBookingDate to validate any dates mentioned
5. Use validateBookingDetails before checking availability
6. Use checkAvailability to find available slots
   - Carefully read the full response message from the availability check
   - The response will tell you exactly what times are available
   - If the requested time is not available, inform the user about ALL available options
   - For example, if user wants 12pm but response shows "closest options are 11:30am and 4:00pm",
     tell the user exactly that and ask which time they prefer
7. Only use bookAppointment after user selects one of the available times

Important:
- Never assume a time is available without explicit confirmation in the availability response
- Always communicate ALL available time options to the user
- If the requested time is not available, say something like:
  "I checked for your requested time of [requested_time], but that slot isn't available. The closest available times are [list all options]. Would you like to book any of these times instead?"
- Wait for the user to specifically choose one of the available times
- Handle rejections gracefully by offering to check different dates

Keep the conversation natural and friendly. Handle errors gracefully and guide users through the booking process step by step.`,
      },
    ];

    this.sessions.set(this.ws, initialHistory);

    try {
      // Get initial greeting from GPT
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: initialHistory,
        tools: tools,
      });

      const reply = completion.choices[0].message;

      if (reply.content) {
        initialHistory.push({ role: 'assistant', content: reply.content });
        this.emit('response', reply.content);
      }
    } catch (error: any) {
      console.error('❌ OpenAI Error during initialization:', error);
      this.emit('error', error);
      // Send a fallback greeting if GPT fails
      this.emit(
        'response',
        "Hello! I'm here to help you book a meeting. Would you like to schedule one now?"
      );
    }
  }

  private async processMessage(message: string) {
    const history = this.sessions.get(this.ws);
    if (!history) return;

    console.log('📨 Received:', message);
    history.push({ role: 'user', content: message });

    try {
      let shouldContinue = true;
      while (shouldContinue) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: history,
          tools: tools,
        });

        const reply = completion.choices[0].message;
        shouldContinue = false;

        // Handle assistant's response
        if (reply.content) {
          history.push({ role: 'assistant', content: reply.content });
          this.emit('response', reply.content);
        }

        // Handle function calls
        if (reply.tool_calls?.length) {
          for (const toolCall of reply.tool_calls) {
            const functionName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments || '{}');
            let result;

            // Find the tool definition and emit 'say' message only once per tool per user message
            const tool = tools.find((t) => t.function.name === functionName);
            if (tool?.function.say && !this.processedTools.has(functionName)) {
              this.emit('response', tool.function.say);
              this.processedTools.add(functionName);
            }

            // Handle function execution
            if (
              functionName === 'checkAvailability' ||
              functionName === 'bookAppointment'
            ) {
              const agent = new BrowserAgent();
              try {
                await agent.initialize();
                result = await (functionName === 'checkAvailability'
                  ? calendly.checkAvailability(agent.getStagehand(), args)
                  : calendly.bookAppointment(agent.getStagehand(), args));

                console.log(
                  '📬 Function execution result:',
                  JSON.stringify(result, null, 2)
                );
              } finally {
                await agent.close();
              }
            } else if (functionName in availableFunctions) {
              result = await availableFunctions[functionName](args);
            } else {
              throw new Error(`Unknown function: ${functionName}`);
            }

            // Add function result to history
            const functionResponse = {
              role: 'function' as const,
              name: functionName,
              content: JSON.stringify(result),
            };
            console.log(
              '🎯 Adding to GPT history:',
              JSON.stringify(functionResponse, null, 2)
            );
            history.push(functionResponse);

            // Continue the conversation if there are function results
            shouldContinue = true;
          }
        }
      }
    } catch (error: any) {
      console.error('❌ OpenAI Error:', error);
      this.emit('error', error);
    }
  }

  public handleDisconnect() {
    this.sessions.delete(this.ws);
    this.processedTools.clear();
    console.log('❌ Client disconnected');
  }
}
