// src/routes/chat-ws.ts
import { Server } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import OpenAI from 'openai';
import { BrowserAgent } from '../agent/stagehandAgent';
import * as calendly from '../platforms/calendly';
import { BookingDetails } from '../types/BookingRequest';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const sessions = new Map<
  WebSocket,
  OpenAI.Chat.Completions.ChatCompletionMessageParam[]
>();

const pendingBookings = new Map<WebSocket, BookingDetails>();

export function initChatSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  console.log('✅ WebSocket server is running on /ws');

  wss.on('connection', (ws) => {
    console.log('🔌 New client connected');

    sessions.set(ws, [
      {
        role: 'system',
        content: `You are an AI booking assistant that helps users schedule meetings via Calendly.
Ask for their name, email, date, and time. When all are available, call the 'bookMeeting' function.
But DO NOT assume confirmation — always let the user confirm AFTER verifying availability.`,
      },
    ]);

    ws.send(
      JSON.stringify({
        sender: 'bot',
        text: "Hey! I know you're here to book a meeting today — is that right?",
      })
    );

    ws.on('message', async (data: string) => {
      const userMsg = data.toString().trim();
      const history = sessions.get(ws);
      if (!history) return;

      console.log('📨 Received:', userMsg);

      // Handle confirmation flow
      if (pendingBookings.has(ws)) {
        if (/yes|confirm|go ahead|sure/i.test(userMsg)) {
          const details = pendingBookings.get(ws)!;
          pendingBookings.delete(ws);
          const result = await triggerBooking(details);
          ws.send(
            JSON.stringify({
              sender: 'bot',
              text: result.success
                ? `✅ Your meeting is booked: ${result.message}`
                : `❌ Booking failed: ${result.message}`,
            })
          );
          return;
        } else if (/no|change|wait|not yet/i.test(userMsg)) {
          pendingBookings.delete(ws);
          ws.send(
            JSON.stringify({
              sender: 'bot',
              text: 'No problem! Let me know when you’d like to continue.',
            })
          );
          return;
        }
      }

      history.push({ role: 'user', content: userMsg });

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: history,
          tools: [
            {
              type: 'function',
              function: {
                name: 'bookMeeting',
                description: 'Book a Calendly meeting once details are ready',
                parameters: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    email: { type: 'string' },
                    date: { type: 'string' },
                    time: { type: 'string' },
                  },
                  required: ['name', 'email', 'date', 'time'],
                },
              },
            },
          ],

          tool_choice: 'auto',
        });

        const reply = completion.choices[0].message;

        if (reply.tool_calls?.length) {
          for (const toolCall of reply.tool_calls) {
            if (toolCall.function.name === 'bookMeeting') {
              const args = JSON.parse(toolCall.function.arguments || '{}');
              console.log('🤖 Booking details parsed:', args);

              const agent = new BrowserAgent();
              await agent.initialize();

              const isAvailable = await calendly.checkAvailability(
                agent.getStagehand(),
                args
              );
              await agent.close();

              if (isAvailable) {
                pendingBookings.set(ws, args);
                const summary = `✅ That time is available! You're booking a meeting on ${args.date} at ${args.time} for ${args.name} (${args.email}). Should I confirm this?`;
                ws.send(JSON.stringify({ sender: 'bot', text: summary }));
              } else {
                ws.send(
                  JSON.stringify({
                    sender: 'bot',
                    text: `❌ Sorry, that time appears to be unavailable. Could you please suggest a different time?`,
                  })
                );
              }
              return;
            }
          }
        }

        if (reply.content) {
          history.push({ role: 'assistant', content: reply.content });
          ws.send(JSON.stringify({ sender: 'bot', text: reply.content }));
        }
      } catch (err) {
        console.error('❌ OpenAI Error:', err);
        ws.send(
          JSON.stringify({
            sender: 'bot',
            text: 'Oops! Something went wrong while processing that.',
          })
        );
      }
    });

    ws.on('close', () => {
      sessions.delete(ws);
      pendingBookings.delete(ws);
      console.log('❌ Client disconnected');
    });
  });
}

async function triggerBooking(
  details: BookingDetails
): Promise<{ success: boolean; message: string }> {
  const agent = new BrowserAgent();
  try {
    await agent.initialize();
    return await calendly.bookAppointment(agent.getStagehand(), details);
  } catch (err: any) {
    return { success: false, message: err?.message || 'Unknown error' };
  } finally {
    await agent.close();
  }
}
