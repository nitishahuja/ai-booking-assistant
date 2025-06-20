import React from 'react';

interface LoadingBubbleProps {
  type?: 'default' | 'script';
}

const LoadingBubble: React.FC<LoadingBubbleProps> = ({ type = 'default' }) => {
  return (
    <div className='chat-bubble assistant'>
      <div className='bubble-content loading-bubble'>
        {type === 'script' ? (
          <>
            <div className='script-indicator'>
              <div className='spinner'></div>
              <span>Working on it...</span>
            </div>
          </>
        ) : (
          <div className='typing-indicator'>
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
      </div>
      <div
        className='bubble-avatar'
        style={{
          background: 'linear-gradient(135deg, #6a82fb 0%, #fc5c7d 100%)',
          color: 'white',
        }}
      >
        🤖
      </div>
    </div>
  );
};

export default LoadingBubble;
