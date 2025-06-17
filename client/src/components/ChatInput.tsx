// src/components/ChatInput.tsx
import { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';

interface Props {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

const ChatInput = ({ onSendMessage, disabled }: Props) => {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      // Refocus the input after sending
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className='chat-input-container'>
      <input
        ref={inputRef}
        type='text'
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder='Type your message...'
        className='chat-input'
        disabled={disabled}
      />
      <button
        onClick={handleSend}
        disabled={!message.trim() || disabled}
        className='send-button'
      >
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='send-icon'
        >
          <line x1='22' y1='2' x2='11' y2='13'></line>
          <polygon points='22 2 15 22 11 13 2 9 22 2'></polygon>
        </svg>
      </button>
    </div>
  );
};

export default ChatInput;
