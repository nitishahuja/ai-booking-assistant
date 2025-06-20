import { useState } from 'react';
import ChatWindow from './components/ChatWindow';
import './App.css';
import './components/chat.css';

function App() {
  const [messages, setMessages] = useState<
    Array<{ text: string; isUser: boolean }>
  >([]);

  const handleSendMessage = (text: string) => {
    setMessages((prev) => [...prev, { text, isUser: true }]);
    // Here you would typically handle the AI response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          text: "I'm processing your request...",
          isUser: false,
        },
      ]);
    }, 1000);
  };

  return (
    <div className='app-container'>
      <header className='app-header'>
        <h1>AI FrontDesk</h1>
        <p>Intelligent Reception & Concierge Services</p>
      </header>
      <main className='app-main'>
        <ChatWindow messages={messages} onSendMessage={handleSendMessage} />
      </main>
      <footer className='app-footer'>
        <p>Smart • Efficient • Available 24/7</p>
      </footer>
    </div>
  );
}

export default App;
