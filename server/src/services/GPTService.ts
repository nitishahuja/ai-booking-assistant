import WebSocket from 'ws';
import OpenAI from 'openai';
import { EventEmitter } from 'events';
import { BrowserAgent } from '../agent/stagehandAgent';
import * as calendly from '../platforms/calendly';
import { tools, availableFunctions } from '../functions/manifest';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import dotenv from 'dotenv';

dotenv.config();

// Time in milliseconds before an inactive agent session is cleaned up
const AGENT_SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// Session states for tracking booking flow
type SessionState =
  | 'idle'
  | 'checking'
  | 'awaiting_confirmation'
  | 'booking'
  | 'completed'
  | 'error';

interface BookingDetails {
  date?: string;
  time?: string;
  name?: string;
  email?: string;
  foundSlot?: string;
  selectedTime?: string;
  isReadyToConfirm?: boolean;
}

interface AgentSession {
  agent: BrowserAgent;
  state: SessionState;
  lastUsed: number;
  timeoutId: NodeJS.Timeout;
  bookingDetails: BookingDetails;
  screenshotPath?: string;
}

export class GPTService extends EventEmitter {
  private openai: OpenAI;
  private sessions: Map<WebSocket, ChatCompletionMessageParam[]>;
  private agents: Map<WebSocket, AgentSession>;
  private ws: WebSocket;
  private processedTools: Set<string>;
  private lastUsed: number;
  private agent: BrowserAgent | null = null;
  private partialResponseIndex: number = 0;

  constructor(ws: WebSocket) {
    super();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    this.sessions = new Map();
    this.agents = new Map();
    this.ws = ws;
    this.processedTools = new Set();
    this.lastUsed = Date.now();
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
        this.processedTools.clear();
        await this.processMessage(message);
      } catch (error) {
        console.error('Error processing message:', error);
        await this.handleError(error);
      }
    });
  }

  private async handleError(error: any) {
    console.error('❌ Error:', error);

    // Take screenshot if we have an active agent
    const session = this.agents.get(this.ws);
    if (session?.agent) {
      try {
        const timestamp = Date.now();
        const path = `error-${timestamp}.png`;
        await session.agent.getStagehand().page.screenshot({ path });
        session.screenshotPath = path;
        console.log('📸 Error screenshot saved:', path);
      } catch (screenshotError) {
        console.error('Failed to take error screenshot:', screenshotError);
      }
    }

    // Update session state
    if (session) {
      session.state = 'error';
    }

    this.emit('error', error);
  }

  private async getOrCreateAgent(): Promise<AgentSession> {
    let session = this.agents.get(this.ws);

    if (!session) {
      const agent = new BrowserAgent();
      await agent.initialize();

      const timeoutId = setTimeout(
        () => this.cleanupAgentSession(this.ws),
        AGENT_SESSION_TIMEOUT
      );

      session = {
        agent,
        state: 'idle',
        lastUsed: Date.now(),
        timeoutId,
        bookingDetails: {},
      };

      this.agents.set(this.ws, session);
      console.log('🔄 Created new browser agent session');
    } else {
      session.lastUsed = Date.now();
      clearTimeout(session.timeoutId);
      session.timeoutId = setTimeout(
        () => this.cleanupAgentSession(this.ws),
        AGENT_SESSION_TIMEOUT
      );
      console.log('♻️ Reusing existing browser agent session');
    }

    return session;
  }

  private async cleanupAgentSession(ws: WebSocket) {
    const session = this.agents.get(ws);
    if (session) {
      console.log('🧹 Cleaning up session:', {
        state: session.state,
        lastUsed: new Date(session.lastUsed).toISOString(),
        bookingDetails: session.bookingDetails,
      });

      // Take final screenshot if in an interesting state
      if (session.state !== 'idle' && session.state !== 'completed') {
        try {
          const timestamp = Date.now();
          const path = `cleanup-${timestamp}.png`;
          await session.agent.getStagehand().page.screenshot({ path });
          console.log('📸 Final state screenshot saved:', path);
        } catch (error) {
          console.error('Failed to take cleanup screenshot:', error);
        }
      }

      clearTimeout(session.timeoutId);
      await session.agent.close();
      this.agents.delete(ws);
    }
  }

  private sendMessage(data: any) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private setScriptExecutionStatus(executing: boolean) {
    this.sendMessage({ executingScript: executing });
  }

  private sendResponse(text: string, isComplete: boolean = false) {
    if (!text.trim()) return;

    this.sendMessage({
      text,
      isComplete,
    });
  }

  public async initializeSession() {
    console.log('🔌 New client connected - Initializing chat session');

    const initialHistory: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are an AI booking assistant that helps users schedule meetings via Calendly. Keep responses brief and natural. Ask one question at a time. Don't make assumptions about dates or times - always ask for clarification if needed.

Key Tasks:
- Collect name, email, preferred date and time
- Validate dates and check availability
- Show all available options if requested time isn't free
- Only book after user confirms a specific available time

Important:
- Never assume a time is available without checking
- Always show ALL available options
- Wait for explicit time selection before booking
- Keep the conversation friendly and efficient`,
      },
    ];

    this.sessions.set(this.ws, initialHistory);

    // Send initial greeting
    const greeting =
      "Hi! I'd be happy to help you schedule a meeting. Would you like to book one now?";
    this.sendResponse(greeting, true);

    // Add greeting to history
    initialHistory.push({
      role: 'assistant',
      content: greeting,
    });
  }

  public async processMessage(message: string) {
    const history = this.sessions.get(this.ws);
    if (!history) return;

    console.log('📨 Received:', message);
    history.push({ role: 'user', content: message });

    try {
      let shouldContinue = true;
      while (shouldContinue) {
        const stream = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: history,
          tools: tools,
          stream: true,
        });

        let completeResponse = '';
        let functionName = '';
        let functionArgs = '';

        for await (const chunk of stream) {
          const delta = chunk.choices[0].delta;
          const content = delta.content || '';
          const toolCalls = delta.tool_calls;
          const finishReason = chunk.choices[0].finish_reason;

          if (toolCalls) {
            // Collect function call information
            const toolCall = toolCalls[0]?.function;
            if (toolCall?.name) functionName = toolCall.name;
            if (toolCall?.arguments) functionArgs += toolCall.arguments;
          }

          if (finishReason === 'tool_calls') {
            // If we have collected any response, send it before handling the function
            if (completeResponse.trim()) {
              this.sendResponse(completeResponse, true);
            }

            // Handle function calls
            const tool = tools.find((t) => t.function.name === functionName);
            if (tool?.function.say && !this.processedTools.has(functionName)) {
              this.sendResponse(tool.function.say, true);
              this.processedTools.add(functionName);
            }

            let result;
            if (
              functionName === 'checkAvailability' ||
              functionName === 'bookAppointment'
            ) {
              try {
                const session = await this.getOrCreateAgent();
                this.setScriptExecutionStatus(true);

                if (functionName === 'checkAvailability') {
                  result = await this.handleAvailabilityCheck(
                    session,
                    JSON.parse(functionArgs)
                  );
                } else {
                  result = await this.handleBooking(
                    session,
                    JSON.parse(functionArgs)
                  );
                }

                this.setScriptExecutionStatus(false);
              } catch (error) {
                this.setScriptExecutionStatus(false);
                throw error;
              }
            } else if (functionName in availableFunctions) {
              result = await availableFunctions[functionName](
                JSON.parse(functionArgs)
              );
            }

            history.push({
              role: 'function',
              name: functionName,
              content: JSON.stringify(result),
            });

            shouldContinue = true;
            break;
          } else {
            completeResponse += content;

            if (finishReason === 'stop') {
              this.sendResponse(completeResponse, true);
              history.push({ role: 'assistant', content: completeResponse });
              shouldContinue = false;
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error:', error);
      await this.handleError(error);
    }
  }

  private async handleAvailabilityCheck(session: AgentSession, args: any) {
    session.state = 'checking';
    session.bookingDetails = {
      ...session.bookingDetails,
      date: args.date,
      time: args.time,
    };

    const result = await calendly.checkAvailability(
      session.agent.getStagehand(),
      args
    );

    if (result.success && result.isReadyToConfirm) {
      session.state = 'awaiting_confirmation';
      session.bookingDetails = {
        ...session.bookingDetails,
        selectedTime: result.selectedTime,
        isReadyToConfirm: true,
      };
      clearTimeout(session.timeoutId);
      session.timeoutId = setTimeout(
        () => this.cleanupAgentSession(this.ws),
        AGENT_SESSION_TIMEOUT
      );
    } else {
      await this.cleanupAgentSession(this.ws);
    }

    return result;
  }

  private async handleBooking(session: AgentSession, args: any) {
    if (!session.bookingDetails.isReadyToConfirm) {
      throw new Error(
        'No slot is ready for booking. Please check availability first.'
      );
    }

    session.state = 'booking';
    session.bookingDetails = {
      ...session.bookingDetails,
      name: args.name,
      email: args.email,
    };

    const result = await calendly.bookAppointment(
      session.agent.getStagehand(),
      args
    );

    session.state = result.success ? 'completed' : 'error';
    await this.cleanupAgentSession(this.ws);

    return result;
  }

  public async handleDisconnect() {
    console.log('👋 Client disconnecting - Cleaning up resources');

    // Clean up chat session
    this.sessions.delete(this.ws);
    this.processedTools.clear();

    // Clean up agent session if it exists
    await this.cleanupAgentSession(this.ws);

    console.log('❌ Client disconnected - All resources cleaned up');
  }

  public getLastUsed(): number {
    return this.lastUsed;
  }

  public async handleMessage(data: any): Promise<any> {
    this.lastUsed = Date.now();
    // Implement your message handling logic here
    // This should integrate with your existing GPT and booking flow
    return { success: true, message: 'Message handled' };
  }

  public async cleanup(): Promise<void> {
    if (this.agent) {
      try {
        // Close any open browser sessions
        const stagehand = this.agent.getStagehand();
        if (stagehand) {
          await stagehand.close();
        }
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
      this.agent = null;
    }
  }
}
