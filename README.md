# Lavender

A real-time, one-on-one and group messaging app in the same product category as
WhatsApp or Telegram — built with React + Vite on the client and Express +
Socket.IO on the server, backed by MongoDB.

**📖 Full architecture & implementation docs:** https://sumitjoshigit.github.io/cozy-chatroom-MERN/

The docs are a chapter-by-chapter walkthrough of how the system actually works —
data model, auth, the real-time messaging pipeline, file uploads, deployment, and
an honest feature-status/roadmap breakdown. This README is just the quickstart.

## Features

- Local signup with email OTP verification, plus Google OAuth login
- 1:1 direct messages and group chats (create, name, photo, members)
- Group roles — owner / admin / member, with promote / demote / remove
- Reply-to with a quoted preview, message edit, message forward
- Image and document attachments (PDF, Word/Excel/PowerPoint, text, CSV, zip)
- Emoji reactions, message pinning, starred/saved messages
- Typing indicators, delivery ticks
- Block / report a user, delete a chat or group
- Live profile editing, per-chat wallpaper, dark mode, accent theming

See the [feature status table](https://sumitjoshigit.github.io/cozy-chatroom-MERN/#/01-overview) for what's shipped vs. still on the [roadmap](https://sumitjoshigit.github.io/cozy-chatroom-MERN/#/15-roadmap).

Prepping for a system-design interview around this project? The docs have a
dedicated [Interview Prep section](https://sumitjoshigit.github.io/cozy-chatroom-MERN/#/09-interview-prep) —
grounded Q&A, a full capacity-estimation and scaling deep dive, tradeoff
breakdowns, and a worked mock-interview transcript, all built around this
specific codebase rather than generic chat-app theory.

## Tech stack

| | |
|---|---|
| Client | React 18, Vite, React Router, Tailwind CSS, Socket.IO client, IndexedDB (offline-first cache) |
| Server | Express 4, Socket.IO 4, Passport.js (local + OTP + Google OAuth2), Mongoose |
| Database | MongoDB, sessions shared between REST and WebSocket via `express-socket.io-session` |

`client/` and `server/` are independently deployable — see
[Chapter 8](https://sumitjoshigit.github.io/cozy-chatroom-MERN/#/08-deployment) for why.

## Quickstart

Prerequisites: Node.js 18+, a running MongoDB instance (local or Atlas).

```bash
git clone https://github.com/SumitJoshiGIT/cozy-chatroom-MERN.git
cd cozy-chatroom-MERN
```

**Server:**

```bash
cd server
npm install
cp .env.example .env   # fill in DATABASE, SESSION_SECRET, etc. — see below
npm run dev             # nodemon, http://localhost:3000
```

**Client** (in a second terminal):

```bash
cd client
npm install
cp .env.example .env   # VITE_API_ORIGIN=http://localhost:3000
npm run dev              # http://localhost:5173
```

Optional: `npm run seed` in `server/` populates the database with fake users/chats/messages (via `@faker-js/faker`) for local testing.

## Environment variables

**`server/.env`**

| Variable | Notes |
|---|---|
| `DATABASE` | MongoDB connection string |
| `SESSION_SECRET` | Required in production |
| `CLIENT_ORIGIN` | Exact origin allowed by CORS / Socket.IO — must match where the client is hosted |
| `PORT` | Defaults to 3000 |
| `NODE_ENV` | Gates secure-cookie / `sameSite=none` behavior |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Google OAuth — register in Google Cloud Console |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail SMTP for OTP delivery (use an app password) |

**`client/.env`**

| Variable | Notes |
|---|---|
| `VITE_API_ORIGIN` | The server's public URL — baked into the client bundle at build time |

## Deployment

- **Client → [Vercel](https://vercel.com).** Point a Vercel project at `client/`
  (framework preset: Vite), set `VITE_API_ORIGIN` as a build-time env var.
  `client/vercel.json` handles the SPA rewrite so client-side routes survive a
  hard refresh.
- **Server → Render, Railway, Fly.io, or any host that keeps a long-running
  process alive.** Socket.IO needs a persistent process — it cannot run as a
  serverless/edge function.

Full details, including cookie/CORS behavior in production and the honest gaps
between "deployable" and "production-grade at scale," are in
[Chapter 8 of the docs](https://sumitjoshigit.github.io/cozy-chatroom-MERN/#/08-deployment).

## Project structure

```
client/   React + Vite SPA
server/   Express + Socket.IO API
docs/     Architecture walkthrough, published to GitHub Pages via docsify
```
