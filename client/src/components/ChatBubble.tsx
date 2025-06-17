import React from 'react';

interface Props {
  text: string;
  isUser: boolean;
}

const userEmoji = '🧑‍💼'; // Modern, professional user
const assistantEmoji = '🤖'; // Modern robot for assistant

const ChatBubble = ({ text, isUser }: Props) => {
  return (
    <div className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className='bubble-content'>{text}</div>
      <div
        className='bubble-avatar'
        style={
          !isUser
            ? {
                background: 'linear-gradient(135deg, #6a82fb 0%, #fc5c7d 100%)',
                color: 'white',
              }
            : {}
        }
      >
        {isUser ? userEmoji : assistantEmoji}
      </div>
    </div>
  );
};

export default ChatBubble;
