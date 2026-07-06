# FlyAI - Intelligent Flight Search Agent

FlyAI is an integrated system designed to facilitate flight searches, price tracking, and user interactions through a conversational interface. The system leverages the SerpApi for real-time flight data and the Google Gemini API for natural language processing, translating user intentions into structured API calls.

## System Architecture

The project follows a standard client-server architecture, divided into two main components:

### 1. Frontend
- **Framework:** React with Vite.
- **State Management & Authentication:** Client-side session management using JSON Web Tokens (JWT) stored in Local Storage.
- **Conversational Interface:** A chat-based UI that communicates with the backend to process natural language queries.
- **Real-time Synchronization:** Server-Sent Events (SSE) implementation to receive asynchronous price drop alerts from the server.
- **UI Components:** Custom flight rendering cards, settings panel for alert configuration, and skeleton loaders for asynchronous state handling.

### 2. Backend
- **Framework:** Node.js with Express.
- **Database:** SQLite in WAL (Write-Ahead Logging) mode for concurrent read/write operations.
- **Authentication:** Stateless authentication flow using bcryptjs for password hashing and jsonwebtoken for session validation.
- **Caching Layer:** Local database caching (`flight_cache`) for SerpApi responses with a 24-hour Time-To-Live (TTL) to minimize external API costs and latency.
- **LLM Integration:** Google Generative AI SDK (Gemini) with function calling (`tools`) to extract origin, destination, and dates from natural language and translate them into IATA codes.
- **Task Scheduling:** `node-cron` jobs running asynchronously to verify active price alerts, dispatch emails via Nodemailer, and execute database garbage collection.

## Setup and Installation

### Prerequisites
- Node.js (v18 or higher)
- Google Gemini API Key
- SerpApi API Key (Google Flights API)

### Backend Configuration
1. Navigate to the backend directory:
   ```bash
   cd backend
   npm install
   ```
2. Create a `.env` file in the root of the `backend` directory with the following variables:
   ```env
   PORT=5000
   GEMINI_API_KEY=your_gemini_api_key
   SERPAPI_KEY=your_serpapi_key
   JWT_SECRET=your_secure_jwt_secret
   CRON_SCHEDULE=* * * * *
   ```
3. Start the server:
   ```bash
   npm run dev
   ```

### Frontend Configuration
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```
2. If the backend is running on a port other than 5000, create a `.env` file in the `frontend` directory:
   ```env
   VITE_API_URL=http://localhost:5000
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Security and Operational Guidelines

- **Data Privacy:** User passwords are encrypted using bcrypt salt and hash algorithms prior to persistence.
- **Rate Limit Resilience:** The frontend implements an exponential backoff strategy for HTTP 429 (Too Many Requests) responses, while safely aborting on HTTP 400 and 401 errors to prevent client-side hanging.
- **Database Maintenance:** The cron job automatically purges expired flight alerts and invalidates cached flight searches older than 24 hours to prevent uncontrolled storage growth.
- **Connection Stability:** The SSE connection utilizes a 30-second silent heartbeat to prevent modern browsers and proxies from dropping idle TCP connections.
