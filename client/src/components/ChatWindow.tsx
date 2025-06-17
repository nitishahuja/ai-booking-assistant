import { useRef, useEffect, useState, useCallback } from 'react';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';

interface Message {
  text: string;
  isUser: boolean;
}

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
}

// Custom hook for WebSocket chat
function useChatSocket(
  onMessage: (msg: string) => void,
  setTyping: (typing: boolean) => void
) {
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:3001/ws');
    socketRef.current = socket;

    socket.onopen = () => console.log('✅ Connected to assistant');
    socket.onmessage = (event) => {
      setTyping(false);
      try {
        const data = JSON.parse(event.data);
        onMessage(data.text);
      } catch {
        onMessage(event.data);
      }
    };
    socket.onerror = (err) => console.error('WebSocket error:', err);

    return () => socket.close();
  }, [onMessage, setTyping]);

  const sendMessage = useCallback(
    (msg: string) => {
      setTyping(true);
      socketRef.current?.send(msg);
    },
    [setTyping]
  );

  return sendMessage;
}

const ChatWindow = ({
  messages: initialMessages,
  onSendMessage,
}: ChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebSocket integration
  const handleBotMessage = useCallback((botMsg: string) => {
    setMessages((prev) => [...prev, { text: botMsg, isUser: false }]);
  }, []);
  const sendMessage = useChatSocket(handleBotMessage, setTyping);

  const handleSendMessage = (text: string) => {
    setMessages((prev) => [...prev, { text, isUser: true }]);
    sendMessage(text);
    if (onSendMessage) onSendMessage(text);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  return (
    <div className='chat-window'>
      <div className='chat-messages'>
        {messages.map((message, index) => (
          <ChatBubble key={index} text={message.text} isUser={message.isUser} />
        ))}
        {typing && <ChatBubble text={'...'} isUser={false} />}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSendMessage={handleSendMessage} disabled={typing} />
    </div>
  );
};

export default ChatWindow;
