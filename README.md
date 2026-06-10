# LiveLink Transcriber

A 100% free, production-ready real-time transcription broadcasting web application.
The speaker talks into their browser, and unlimited viewers can read the real-time transcript instantly from anywhere in the world.

Built with **React (Vite)**, **Tailwind CSS**, **Web Speech API**, **Node.js**, and **WebSockets**.

---

## ⚡ Features

- **100% Free**: Uses the native browser Web Speech API — no OpenAI or cloud transcription costs.
- **Ultra-low Latency**: Text deltas are streamed directly over WebSockets in real time.
- **Multi-language Support**: English, Hindi, and Hinglish natively supported.
- **Shareable Links & QR Codes**: Easily invite viewers without them needing an account.
- **Password Protection**: Secure your live sessions.
- **Picture-in-Picture**: Viewers can pop out the transcript into a floating window and switch tabs.
- **Profanity Filter**: Client-side profanity masking toggle for viewers.
- **Transcript Search**: Search live through the transcript.
- **Export**: One-click download of the full transcript as a `.txt` file.

---

## 🚀 Local Development

To run this application locally, you need to run both the Node.js backend server and the React frontend.

### 1. Setup Backend
Open a terminal in the project root:

```bash
# Move to the server directory
cd apps/server

# Install dependencies
npm install

# Start the Node.js WebSocket backend (Runs on http://localhost:3001)
npm run dev
```

### 2. Setup Frontend
Open a **new** terminal in the project root:

```bash
# Move to the web directory
cd apps/web

# Install dependencies
npm install

# Start the Vite React app (Runs on http://localhost:3000)
npm run dev
```

Finally, open your browser to `http://localhost:3000`. 

---

## 🌍 Free Production Deployment

### 1. Backend (Render.com)

1. Create a free account on [Render](https://render.com).
2. Click **New Web Service** and connect your GitHub repo.
3. Set the Root Directory to `apps/server`.
4. Set Build Command: `npm install && npm run build`
5. Set Start Command: `npm start`
6. Add Environment Variables:
   - `NODE_ENV=production`
   - `JWT_SECRET=your_random_secret`
   - `FRONTEND_URL=https://your-vercel-domain.vercel.app`
7. Click **Create**.

*Note: Render free tier sleeps after 15 minutes of inactivity. Use a free service like [UptimeRobot](https://uptimerobot.com) to ping `https://your-backend.onrender.com/health` every 5 minutes to keep it awake.*

### 2. Frontend (Vercel)

1. Create a free account on [Vercel](https://vercel.com).
2. Click **Add New Project** and connect your GitHub repo.
3. Set the Root Directory to `apps/web`.
4. Add Environment Variables:
   - `VITE_API_URL=https://your-backend.onrender.com`
   - `VITE_WS_URL=wss://your-backend.onrender.com`
   - `VITE_APP_URL=https://your-vercel-domain.vercel.app`
5. Click **Deploy**.

---

## 🔒 Privacy & Architecture

- **No Audio Leaves the Device**: The Web Speech API processes audio locally in the speaker's browser (Chrome/Edge/Safari).
- **Text-only Streaming**: Only the text strings are sent to the Node.js backend.
- **In-memory Storage**: Sessions are stored purely in RAM on the backend and destroyed after 24 hours. No database is required.

---

## ⚠️ Browser Compatibility

- **Speaker View**: Requires Google Chrome, Microsoft Edge, or Safari (iOS 14.5+). Firefox does not support the Web Speech API.
- **Viewer View**: Works on any modern browser (Chrome, Firefox, Safari, Edge, Mobile).
