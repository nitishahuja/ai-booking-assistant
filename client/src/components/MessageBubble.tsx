import React from 'react';

interface Props {
  message: string;
  sender: 'user' | 'bot';
}

const MessageBubble: React.FC<Props> = ({ message, sender }) => {
  const isUser = sender === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} my-1`}>
      <div
        className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
          isUser
            ? 'bg-blue-500 text-white rounded-br-none'
            : 'bg-gray-200 text-gray-800 rounded-bl-none'
        }`}
      >
        {message}
      </div>
    </div>
  );
};

export default MessageBubble;
