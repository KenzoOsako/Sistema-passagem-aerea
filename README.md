# FlyAI - Intelligent Flight Search Agent

FlyAI is an integrated system designed to facilitate flight searches, price tracking, and user interactions through a conversational interface. The system leverages the SerpApi for real-time flight data and the Google Gemini API for natural language processing, translating user intentions into structured API calls.

## Project status and validation boundaries

This is an experimental application, not a production-ready travel service. Flight data, model responses, alerts and email delivery depend on external providers.

Before using real accounts or data, review signing-key configuration, authentication on every data path, per-user event isolation and logging. The current backend accepts a fallback signing key when JWT_SECRET is absent, and the event stream does not currently establish per-user isolation. This documentation and the CI below do not remediate those controls. Do not expose this version as a shared production service.

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
- Node.js 24 for the frontend CI; backend runtime/provider integration still requires separate validation.
- Google Gemini API Key
- SerpApi API Key (Google Flights API)

### Backend Configuration
1. Navigate to the backend directory:
   ```bash
   cd backend
   npm ci
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
   npm ci
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

- **Data Privacy:** User passwords are hashed with bcrypt before persistence; hashing is not reversible encryption.
- **Rate Limit Resilience:** The frontend implements an exponential backoff strategy for HTTP 429 (Too Many Requests) responses, while safely aborting on HTTP 400 and 401 errors to prevent client-side hanging.
- **Database Maintenance:** The cron job automatically purges expired flight alerts and invalidates cached flight searches older than 24 hours to prevent uncontrolled storage growth.
- **Connection Stability:** The SSE implementation sends a heartbeat every 30 seconds. This does not guarantee connection availability or authorize access to user-specific events.

## Repository map

| Path | Responsibility |
| --- | --- |
| `backend/index.js` | Express routes and server startup |
| `backend/auth.js` | Token creation and validation |
| `backend/db.js` | SQLite persistence |
| `backend/flightSearch.js` | Flight-provider integration |
| `backend/cron.js` | Scheduled alert processing |
| `backend/sse.js` | In-memory event connections |
| `frontend/src/` | React interface and API consumers |
| `.github/workflows/ci.yml` | Frontend lint/build and backend syntax checks |

## Automated checks

The frontend job runs `npm ci`, `npm run lint` and `npm run build` on Node.js 24. A separate job parses the backend JavaScript with `node --check` without starting the API, scheduler or provider scripts.

These checks are not backend integration tests. They do not verify authentication, event isolation, SQLite/native-module installation, real searches, Gemini function calls or delivery of alerts. Files named `backend/test-gemini*.js` and `backend/test-serpapi*.js` are manual provider scripts; running them may need credentials and use provider quota. They are deliberately not executed by CI.

Use synthetic data and separate provider accounts for further validation. Keep API keys, mail credentials and local databases out of commits and logs. A successful build is not evidence that the deployed service is secure or operational.
