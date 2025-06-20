import React from 'react';

interface Props {
  text: string;
  isUser: boolean;
}

const ChatBubble = ({ text, isUser }: Props) => {
  return (
    <div className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className='bubble-content'>{text}</div>
      <div className='bubble-avatar'>
        <span
          className={`avatar-icon ${isUser ? 'user-icon' : 'assistant-icon'}`}
        />
      </div>
    </div>
  );
};

export default ChatBubble;
