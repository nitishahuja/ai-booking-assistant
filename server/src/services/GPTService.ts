import WebSocket from 'ws';
import OpenAI from 'openai';
import { EventEmitter } from 'events';
import { BrowserAgent } from '../agent/stagehandAgent';
import * as calendly from '../platforms/calendly';
import * as housecallpro from '../platforms/housecallpro';
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
  phone?: string;
  address?: string;
  service?: string;
  platform: 'calendly' | 'housecallpro';
  selectedTime?: string;
  isReadyToConfirm?: boolean;
  customFields?: { [key: string]: string };
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
        bookingDetails: {
          platform: 'calendly', // Default platform
        },
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
    if (!session) return;

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
        content: `You are an AI booking assistant that helps users schedule appointments via Calendly and Housecall Pro. Keep responses brief and natural. Ask one question at a time.

Platform-Specific Flows:
1. For Calendly (Meetings):
   - Collect: name, email, preferred date and time
   - Check availability for requested time
   - Show alternatives if requested time isn't available
   - Only book after user confirms a specific available time

2. For Housecall Pro (Services):
   - Collect in this order:
     a. Full name
     b. Email
     c. Phone number
     d. Service details (type of service, specific problem)
     e. Complete service address
   - DO NOT ask for date/time preferences
   - Once all information is collected, proceed with booking
   - If the form needs additional information, ask for it

Important:
- For Calendly: Never assume a time is available without checking
- For Housecall Pro: Focus on service details and contact information
- Keep the conversation friendly and efficient
- Ask for information one piece at a time
- If you're unsure about service categorization, ask for more details`,
      },
    ];

    this.sessions.set(this.ws, initialHistory);

    // Send initial greeting
    const greeting =
      "Hi! I'd be happy to help you schedule an appointment. Would you like to book through Calendly for a meeting, or Housecall Pro for a service?";
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
      platform: args.platform || 'calendly',
    };

    // Skip availability check for Housecall Pro
    if (session.bookingDetails.platform === 'housecallpro') {
      return {
        success: true,
        message:
          'No availability check needed for Housecall Pro. Please proceed with booking.',
        needsMoreInfo: false,
      };
    }

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
    session.state = 'booking';

    // Validate required fields based on platform
    if (args.platform === 'housecallpro') {
      // For Housecall Pro, we only validate basic info first
      if (!args.name || !args.email) {
        return {
          success: false,
          message: 'Missing required booking information',
          needsMoreInfo: true,
          missingFields: [
            ...(!args.name ? [{ label: 'Name', required: true }] : []),
            ...(!args.email ? [{ label: 'Email', required: true }] : []),
          ],
        };
      }
    } else {
      // For Calendly, we need all appointment details
      if (!args.name || !args.email || !args.date || !args.time) {
        return {
          success: false,
          message: 'Missing required booking information',
          needsMoreInfo: true,
          missingFields: [
            ...(!args.name ? [{ label: 'Name', required: true }] : []),
            ...(!args.email ? [{ label: 'Email', required: true }] : []),
            ...(!args.date ? [{ label: 'Date', required: true }] : []),
            ...(!args.time ? [{ label: 'Time', required: true }] : []),
          ],
        };
      }
    }

    // Now we know we have the basic required fields
    const bookingDetails = {
      name: args.name,
      email: args.email,
      platform: args.platform || 'calendly',
      ...(args.date && { date: args.date }),
      ...(args.time && { time: args.time }),
      ...(args.serviceCategory && { serviceCategory: args.serviceCategory }),
      ...(args.serviceType && { serviceType: args.serviceType }),
      ...(args.serviceDetails && { serviceDetails: args.serviceDetails }),
      ...(args.phone && { phone: args.phone }),
      ...(args.address && { address: args.address }),
      ...(args.customFields && { customFields: args.customFields }),
    } as const;

    session.bookingDetails = bookingDetails;

    let result;
    if (bookingDetails.platform === 'housecallpro') {
      result = await housecallpro.bookAppointment(
        session.agent.getStagehand(),
        bookingDetails
      );
    } else {
      result = await calendly.bookAppointment(
        session.agent.getStagehand(),
        bookingDetails
      );
    }

    // If we need additional fields, let GPT handle asking for them
    if (!result.success && result.missingFields) {
      return {
        success: false,
        needsMoreInfo: true,
        message: result.message,
        missingFields: result.missingFields,
      };
    }

    session.state = result.success ? 'completed' : 'error';

    if (!result.success) {
      await this.cleanupAgentSession(this.ws);
    } else {
      // Clean up after successful booking
      await this.cleanupAgentSession(this.ws);
    }

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
