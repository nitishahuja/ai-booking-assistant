import { useRef, useEffect, useState, useCallback } from 'react';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import LoadingBubble from './LoadingBubble';

interface Message {
  text: string;
  isUser: boolean;
  isComplete?: boolean;
}

interface ChatResponse {
  text: string;
  isComplete: boolean;
  executingScript?: boolean;
}

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
}

function useChatSocket(
  onMessage: (msg: ChatResponse) => void,
  setTyping: (typing: boolean) => void,
  setExecutingScript: (executing: boolean) => void
) {
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:3001/ws');
    socketRef.current = socket;

    socket.onopen = () => console.log('✅ Connected to assistant');

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle script execution status
        if (data.executingScript !== undefined) {
          setExecutingScript(data.executingScript);
          return;
        }

        // Handle errors
        if (data.error) {
          console.error('Server error:', data.error);
          onMessage({
            text: `Error: ${data.error}`,
            isComplete: true,
          });
          setTyping(false);
          setExecutingScript(false);
          return;
        }

        // Handle messages
        setTyping(!data.isComplete);
        onMessage(data);
      } catch (error) {
        console.error('Failed to parse message:', error);
        setTyping(false);
        setExecutingScript(false);
      }
    };

    socket.onerror = (err) => {
      console.error('WebSocket error:', err);
      setTyping(false);
      setExecutingScript(false);
    };

    return () => socket.close();
  }, [onMessage, setTyping, setExecutingScript]);

  const sendMessage = useCallback(
    (text: string) => {
      setTyping(true);
      socketRef.current?.send(JSON.stringify({ text }));
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
  const [executingScript, setExecutingScript] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleMessage = useCallback((data: ChatResponse) => {
    if (data.isComplete) {
      setMessages((prev) => [
        ...prev,
        { text: data.text, isUser: false, isComplete: true },
      ]);
    }
  }, []);

  const sendMessage = useChatSocket(
    handleMessage,
    setTyping,
    setExecutingScript
  );

  const handleSendMessage = (text: string) => {
    setMessages((prev) => [...prev, { text, isUser: true, isComplete: true }]);
    sendMessage(text);
    if (onSendMessage) onSendMessage(text);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing, executingScript]);

  return (
    <div className='chat-window'>
      <div className='chat-messages'>
        {messages.map((message, index) => (
          <ChatBubble
            key={`msg-${index}`}
            text={message.text}
            isUser={message.isUser}
          />
        ))}

        {/* Show loading indicator */}
        {(typing || executingScript) && (
          <LoadingBubble type={executingScript ? 'script' : 'default'} />
        )}

        <div ref={messagesEndRef} />
      </div>
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={typing || executingScript}
      />
    </div>
  );
};

export default ChatWindow;
