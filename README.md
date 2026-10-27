# FlyAI - Intelligent Flight Search Agent

FlyAI is an integrated system designed to facilitate flight searches, price tracking, and user interactions through a conversational interface. The system leverages the SerpApi for real-time flight data and the Google Gemini API for natural language processing, translating user intentions into structured API calls.

## Project status and validation boundaries

This is an experimental application, not a production-ready travel service. Flight data, model responses, alerts and email delivery depend on external providers.

The backend requires an explicitly configured signing key and isolates authenticated alert streams by user. These controls have focused synthetic checks; they do not establish authentication on every data path or production readiness. Before using real accounts or data, review the public chat endpoint, provider usage limits, logging and deployment configuration. Do not expose this experimental version as a shared production service.

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
   JWT_SECRET=
   CRON_SCHEDULE=* * * * *
   ```
   Generate a signing key locally, then paste it into `JWT_SECRET` in your untracked `.env`:
   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```
   Startup fails if the key is missing, shorter than 32 characters, or padded with whitespace.
   Use a different random key per environment. Rotating the key invalidates existing sessions and requires logging in again.
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
- **Chat retries:** The chat client waits a fixed 10 seconds after HTTP 429 or network errors and can retry indefinitely. Bounded retries, cancellation and server-side rate limiting remain operational work.
- **Database Maintenance:** The cron job automatically purges expired flight alerts and invalidates cached flight searches older than 24 hours to prevent uncontrolled storage growth.
- **Live alerts:** `/api/stream` requires the same bearer token as alert CRUD. Each event goes only to connections with the alert's numeric `user_id`. Connections close at token expiry; the frontend authenticates each reconnect and cancels pending work on logout. Tokens never appear in stream URLs. Heartbeats run every 30 seconds; slow connections are closed and may reconnect.
- **Legacy alerts:** Rows without a valid numeric owner are never streamed. Their existing email processing remains available; do not assign ownership by email address or a default user.
- **Scope:** These checks cover session signing and alert isolation. They do not establish production readiness for the public chat endpoint, rate limiting, account recovery, mail delivery or external providers. Ethereal remains an email simulation.

### Local verification

With Node.js 24, run `npm ci && npm test` inside `backend`, and `npm ci && npm test && npm run lint && npm run build` inside `frontend`.
Backend tests use synthetic accounts, an in-memory SQLite database and stubbed scheduler/provider paths. They do not read the local application database or send email. CI runs the same checks. External Gemini, SerpApi, SMTP delivery and deployment configuration need separate staging validation.

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
| `.github/workflows/ci.yml` | Frontend lint/tests/build and backend syntax/tests |

## Automated checks

The frontend job runs `npm ci`, `npm run lint`, `npm test` and `npm run build` on Node.js 24. The backend job parses JavaScript with `node --check`, installs dependencies with `npm ci` and runs `npm test` without starting scheduled provider jobs.

Backend checks cover signing configuration, bearer validation, owned CRUD through real Express routes and in-memory SQLite, event isolation, expiry, disconnects and owner propagation through a stubbed cron run. Frontend checks cover the authenticated alert transport, parsing, reconnects and stale-response cancellation. They do not verify real searches, Gemini function calls, SMTP delivery or deployed behavior. Files named `backend/test-gemini*.js` and `backend/test-serpapi*.js` are manual provider scripts; running them may need credentials and use provider quota. They are deliberately not executed by CI.

Use synthetic data and separate provider accounts for further validation. Keep API keys, mail credentials and local databases out of commits and logs. A successful build is not evidence that the deployed service is secure or operational.
