# AI FrontDesk - Intelligent Booking Assistant

An advanced AI-powered booking assistant that automates reservations across multiple platforms using intelligent browser automation and natural language processing.

![AI FrontDesk Interface](./client/public/preview.png)

## 🤖 Intelligent Agent Architecture

At the core of AI FrontDesk lies the Stagehand Agent, a sophisticated browser automation system that combines the power of GPT-4.1-mini with Playwright for intelligent web interaction. This agent is what makes our platform truly unique:

### Key Components

- **Stagehand Integration**
  - Uses `@browserbasehq/stagehand` for AI-driven browser automation
  - Powered by GPT-4.1-mini for intelligent decision making
  - Handles complex web interactions without brittle selectors
  - Adapts to UI changes and different scenarios dynamically

### Agent Capabilities

```typescript
class BrowserAgent {
  // Intelligent browser automation
  // Dynamic form filling
  // Adaptive decision making
  // Error recovery
}
```

- **Natural Language Understanding**

  - Interprets booking requirements in natural language
  - Converts user intentions into precise web actions
  - Handles edge cases and unexpected scenarios

- **Dynamic Interaction**

  - Real-time form analysis and filling
  - Smart service selection based on context
  - Automated verification and confirmation
  - Screenshot capture for debugging

- **Error Resilience**
  - Intelligent error recovery
  - Adaptive retry mechanisms
  - Detailed error reporting
  - Session management

### Why Stagehand?

Traditional automation tools rely on brittle selectors and rigid scripts. Our Stagehand Agent instead:

1. Understands context and intent
2. Adapts to UI changes automatically
3. Makes intelligent decisions
4. Handles unexpected situations
5. Provides detailed feedback

## 🌟 Features

- **Multi-Platform Support**

  - Calendly: Meeting scheduling
  - OpenTable: Restaurant reservations
  - Housecall Pro: Service appointments

- **Intelligent Automation**

  - GPT-4.1-mini powered decision making
  - Smart form filling
  - Dynamic service selection
  - Automated verification

- **Real-Time Communication**
  - WebSocket-based live updates
  - Interactive chat interface
  - Progress tracking
  - Status notifications

## 🛠️ Tech Stack

### Backend

- Node.js + TypeScript
- Express.js
- WebSocket (ws)
- Playwright
- Stagehand Browser Automation
- OpenAI GPT Integration

### Frontend

- React + TypeScript
- Tailwind CSS
- WebSocket Client
- Modern UI Components

## 📋 Prerequisites

- Node.js (v16+)
- npm or yarn
- OpenAI API Key
- Modern web browser
- Internet connection

## ⚙️ Environment Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/ai-booking-assistant.git
cd ai-booking-assistant
```

2. Install dependencies:

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

3. Create `.env` files:

Backend (.env in server directory):

```env
OPENAI_API_KEY=your_openai_api_key
PORT=3001
HEADLESS=true  # Set to false for visible browser automation
```

Frontend (.env in client directory):

```env
VITE_WS_URL=ws://localhost:3001/ws
```

## 🚀 Running the Application

1. Start the backend server:

```bash
cd server
npm run dev
```

2. Start the frontend development server:

```bash
cd client
npm run dev
```

3. Access the application at `http://localhost:5173`

## 🔧 Platform Configuration

### Calendly

- Supports automated scheduling
- Handles date/time selection
- Manages user detail submission

### OpenTable

- Automated restaurant reservations
- Party size selection
- Date/time availability checking
- OTP verification handling

### Housecall Pro

- Service booking automation
- Category/type selection
- Form analysis and filling
- Confirmation verification

## 🛡️ Security Features

- Environment variable protection
- Secure WebSocket implementation
- CORS enabled
- OTP handling
- Screenshot capture for verification

## 🔍 Debugging

The system includes comprehensive debugging features:

- Automated screenshot capture
- Detailed logging
- Error tracking
- Status monitoring

Screenshots are saved in the following format:

- Booking confirmations: `booking-confirmed-{timestamp}.png`
- Errors: `{platform}-error-{timestamp}.png`
- Status checks: `{platform}-{status}-{timestamp}.png`

## 📝 Error Handling

The system implements robust error handling:

- Connection monitoring
- Timeout management
- Platform-specific error recovery
- Detailed error logging
- User-friendly error messages

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for GPT integration
- Browserbase for Stagehand
- Playwright team for browser automation
- All contributors and testers

## 🛠️ Technical Details

### Stagehand Agent Configuration

The BrowserAgent is configured with optimal settings for booking automation:

```typescript
const stagehand = new Stagehand({
  env: 'LOCAL',
  verbose: 2,
  domSettleTimeoutMs: 60000,
  enableCaching: true,
  modelName: 'gpt-4.1-mini',
  modelClientOptions: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  localBrowserLaunchOptions: {
    headless: process.env.HEADLESS !== 'false',
    devtools: process.env.HEADLESS === 'false',
  },
});
```

### Key Configuration Parameters

- **Environment**: Local development with debugging capabilities
- **DOM Settle Timeout**: 60 seconds for complex page interactions
- **Model**: GPT-4.1-mini for optimal performance/cost ratio
- **Caching**: Enabled for improved performance
- **Browser Options**: Configurable headless mode for debugging

### Usage Examples

1. **Initializing the Agent**:

```typescript
const browserAgent = new BrowserAgent();
await browserAgent.initialize();
```

2. **Booking an Appointment**:

```typescript
const result = await browserAgent.bookAppointment(
  bookingDetails,
  platformModule
);
```

3. **Error Handling**:

```typescript
try {
  await browserAgent.bookAppointment(details, platform);
} catch (error) {
  console.error('Booking failed:', error);
  // Intelligent error recovery
}
```

### Platform Integration

Each platform (Calendly, OpenTable, Housecall Pro) integrates with the agent through a standardized interface:

```typescript
interface BookingResponse {
  success: boolean;
  message?: string;
  needsOTP?: boolean;
  availableTimes?: string[];
  // ... other platform-specific fields
}
```

### Best Practices

1. **Agent Lifecycle**

   - Initialize early in application lifecycle
   - Reuse agent instances when possible
   - Properly close sessions to prevent memory leaks

2. **Error Handling**

   - Implement platform-specific error recovery
   - Use screenshot capture for debugging
   - Maintain detailed error logs

3. **Performance Optimization**
   - Enable caching for repeated operations
   - Configure appropriate timeouts
   - Monitor memory usage
